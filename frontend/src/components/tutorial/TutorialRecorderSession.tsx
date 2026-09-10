/**
 * WW360 Document Studio tutorial recorder session.
 *
 * Captures screen/camera/voice or screenshot-only walkthroughs, logs interactions
 * with per-step screenshots, generates an AI-assisted guide, and publishes to
 * Document Studio.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Video,
  Square,
  Loader2,
  X,
  RotateCcw,
  Circle,
  Sparkles,
  FileText,
  Mic,
  Camera,
  Monitor,
  ExternalLink,
  AlertTriangle,
  ImageIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { TutorialCaptureSession, CapturedStep } from '@/utils/tutorialCapture';
import { useTutorialRecorder } from '@/context/TutorialRecorderContext';
import {
  type CompositorBackend,
  type RecordingMode,
  createPipCompositor,
  type PipCompositorHandle,
  pickRecordingMimeType,
  mixAudioTracks,
  modeNeedsCamera,
  modeNeedsDisplayCapture,
  assembleRecordingBlob,
  alternateRecordingBlob,
  recordingBlobType,
  recordingBlobLooksEmpty,
  canPublishGuide,
  CAPTURE_WARNING,
  guideHasContent,
  isScreenshotOnlyMode,
  isAudioOnlyMode,
} from '@/utils/recorderUtils';
import { TutorialStepEditor } from '@/components/tutorial/TutorialStepEditor';
import {
  type EditableStep,
  parseMarkdownToSteps,
  stepsToMarkdown,
  extractIntroFromMarkdown,
  seedStepAnnotations,
} from '@/utils/stepMarkdown';
import { generateStudioTutorial } from '@/services/docStudioService';
import { publishTutorialToStudio } from '@/utils/tutorialStudioPublish';
import { useAuth } from '@/context/AuthContext';
import { fetchMyTasks } from '@/services/documentationTaskService';
import {
  displayCaptureSupported,
  modeNeedsMobileCapture,
} from '@/utils/recorderUtils';

type RecorderPhase =
  | 'idle'
  | 'recording'
  | 'preview'
  | 'generating'
  | 'review'
  | 'publishing'
  | 'success';

const RECORDING_MODES: { id: RecordingMode; label: string; icon: React.ReactNode; hint: string }[] =
  [
    {
      id: 'screen',
      label: 'Screen',
      icon: <Monitor className="w-4 h-4" />,
      hint: 'Screen + mic narration',
    },
    {
      id: 'screen_camera',
      label: 'Screen + Camera',
      icon: <Video className="w-4 h-4" />,
      hint: 'Screen with webcam bubble',
    },
    {
      id: 'camera',
      label: 'Camera only',
      icon: <Camera className="w-4 h-4" />,
      hint: 'Talking-head video',
    },
    {
      id: 'voice',
      label: 'Voice only',
      icon: <Mic className="w-4 h-4" />,
      hint: 'Narration + step log, no video',
    },
    {
      id: 'screenshots',
      label: 'Screenshots',
      icon: <ImageIcon className="w-4 h-4" />,
      hint: 'Pick a screen/window, then Capture frame',
    },
    {
      id: 'photo',
      label: 'Photo',
      icon: <ImageIcon className="w-4 h-4" />,
      hint: 'Mobile / field photo per step',
    },
    {
      id: 'video_mobile',
      label: 'Field video',
      icon: <Video className="w-4 h-4" />,
      hint: 'Rear-camera video clip',
    },
  ];

function visibleRecordingModes(): typeof RECORDING_MODES {
  if (displayCaptureSupported()) {
    return RECORDING_MODES.filter(m => !modeNeedsMobileCapture(m.id));
  }
  return RECORDING_MODES.filter(
    m => modeNeedsMobileCapture(m.id) || m.id === 'voice' || m.id === 'camera'
  );
}

const MAX_SHOT_WIDTH = 1280;

function pickMimeType(mode: RecordingMode = 'screen', hasAudio = true): string {
  return pickRecordingMimeType(mode, { hasAudio });
}

function extractError(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message.trim()) {
    return err.message;
  }
  console.error('[TutorialRecorderSession]', err);
  return fallback;
}

export function TutorialRecorderSession() {
  const { isOpen, launch, closeRecorder, setSessionActive, sessionActive } = useTutorialRecorder();
  const { isWorkforceOperator, isDistrictManager, isPlatformAdmin } = useAuth();
  const submitForReview = isWorkforceOperator && !isDistrictManager && !isPlatformAdmin;

  const effectiveStudioTarget = launch?.studioTarget;
  const effectiveDocumentTitle = launch?.documentTitle ?? '';
  const effectiveOnPublished = launch?.onPublished;
  const effectiveOnSaved = launch?.onSaved;
  const originRoute = launch?.originRoute ?? '/studio';

  const documentTitle = effectiveDocumentTitle || 'Tutorial';

  const setOpen = useCallback(
    (value: boolean) => {
      if (!value) closeRecorder();
    },
    [closeRecorder]
  );

  const [phase, setPhase] = useState<RecorderPhase>('idle');
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [stepCount, setStepCount] = useState(0);
  const [title, setTitle] = useState('');
  const [draftMarkdown, setDraftMarkdown] = useState('');
  const [genInfo, setGenInfo] = useState<{ usedAi: boolean; usedTranscript: boolean } | null>(null);
  const [recordingMode, setRecordingMode] = useState<RecordingMode>('screen');
  const [editableSteps, setEditableSteps] = useState<EditableStep[]>([]);
  const [showMarkdownEditor, setShowMarkdownEditor] = useState(false);
  const [introText, setIntroText] = useState('');
  const [cameraPreviewActive, setCameraPreviewActive] = useState(false);
  const [compositorBackend, setCompositorBackend] = useState<CompositorBackend>('none');
  const [compositorWarning, setCompositorWarning] = useState('');
  const [captureWarning, setCaptureWarning] = useState('');
  const [publishResult, setPublishResult] = useState<{ studioDocId?: string } | null>(null);
  const [capturingFrame, setCapturingFrame] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamsRef = useRef<MediaStream[]>([]);
  const recordedBlobRef = useRef<Blob | null>(null);
  const durationRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);
  const captureRef = useRef<TutorialCaptureSession | null>(null);
  const stepsRef = useRef<CapturedStep[]>([]);
  const pipCompositorRef = useRef<PipCompositorHandle | null>(null);
  const recordingModeRef = useRef<RecordingMode>('screen');
  const cameraPreviewRef = useRef<HTMLVideoElement | null>(null);
  const cameraPreviewStreamRef = useRef<MediaStream | null>(null);
  const previewRetryRef = useRef(false);
  const recordedMimeRef = useRef('video/webm');
  const screenshotsVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenshotsCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (isOpen && phase === 'idle' && !sessionActive) {
      setError('');
    }
  }, [isOpen, phase, sessionActive]);

  useEffect(() => {
    if (phase !== 'recording' || !cameraPreviewActive || !cameraPreviewRef.current) return;
    const stream = cameraPreviewStreamRef.current;
    if (!stream) return;
    cameraPreviewRef.current.srcObject = stream;
    void cameraPreviewRef.current.play().catch(() => {});
  }, [phase, cameraPreviewActive]);

  const stopTracks = useCallback(() => {
    streamsRef.current.forEach(stream => stream.getTracks().forEach(track => track.stop()));
    streamsRef.current = [];
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const resetState = useCallback(() => {
    clearTimer();
    stopTracks();
    pipCompositorRef.current?.stop();
    pipCompositorRef.current = null;
    captureRef.current?.stop();
    captureRef.current = null;
    stepsRef.current = [];
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    recordedBlobRef.current = null;
    durationRef.current = 0;
    previewRetryRef.current = false;
    screenshotsVideoRef.current = null;
    screenshotsCanvasRef.current = null;
    setElapsed(0);
    setStepCount(0);
    setTitle('');
    setDraftMarkdown('');
    setGenInfo(null);
    setEditableSteps([]);
    setShowMarkdownEditor(false);
    setIntroText('');
    setCameraPreviewActive(false);
    cameraPreviewStreamRef.current = null;
    setCompositorBackend('none');
    setCompositorWarning('');
    setCaptureWarning('');
    setPublishResult(null);
    setCapturingFrame(false);
    setError('');
    setSessionActive(false);
    setPhase('idle');
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  }, [clearTimer, stopTracks, previewUrl, setSessionActive]);

  const previewUrlRef = useRef<string | null>(null);
  previewUrlRef.current = previewUrl;

  useEffect(() => {
    return () => {
      clearTimer();
      stopTracks();
      captureRef.current?.stop();
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, [clearTimer, stopTracks]);

  useEffect(() => {
    elapsedRef.current = elapsed;
  }, [elapsed]);

  const finishScreenshotSession = useCallback(() => {
    clearTimer();
    stepsRef.current = captureRef.current?.stop() ?? [];
    captureRef.current = null;
    stopTracks();
    screenshotsVideoRef.current = null;
    screenshotsCanvasRef.current = null;
    setStepCount(stepsRef.current.length);
    durationRef.current = elapsedRef.current;
    if (stepsRef.current.length <= 1) {
      setCaptureWarning(CAPTURE_WARNING);
    } else {
      setCaptureWarning('');
    }
    setPhase('preview');
    setSessionActive(true);
  }, [clearTimer, stopTracks, setSessionActive]);

  const finishMediaRecording = useCallback(() => {
    clearTimer();
    pipCompositorRef.current?.stop();
    pipCompositorRef.current = null;
    setCameraPreviewActive(false);
    const blob = assembleRecordingBlob(chunksRef.current, recordedMimeRef.current);
    recordedBlobRef.current = blob;
    durationRef.current = elapsedRef.current;
    stepsRef.current = captureRef.current?.stop() ?? [];
    captureRef.current = null;
    setStepCount(stepsRef.current.length);
    stopTracks();
    previewRetryRef.current = false;

    if (
      modeNeedsDisplayCapture(recordingModeRef.current) &&
      !isScreenshotOnlyMode(recordingModeRef.current) &&
      stepsRef.current.length <= 1
    ) {
      setCaptureWarning(CAPTURE_WARNING);
    } else {
      setCaptureWarning('');
    }

    if (recordingBlobLooksEmpty(blob) && !isAudioOnlyMode(recordingModeRef.current)) {
      setError(
        'The recording produced no playable video. When the browser asks what to share, pick this WW360 tab — not a blank window or another monitor — then record again.'
      );
      setPreviewUrl(null);
      setPhase('idle');
      setSessionActive(false);
      return;
    }

    setError('');
    if (blob.size >= 1024) {
      setPreviewUrl(URL.createObjectURL(blob));
    }
    setPhase('preview');
    setSessionActive(true);
  }, [clearTimer, stopTracks, setSessionActive]);

  const acquireDisplayStream = useCallback(async (): Promise<MediaStream | null> => {
    try {
      let captureController: unknown = null;
      const CaptureControllerCtor = (
        window as unknown as {
          CaptureController?: new () => { setFocusBehavior(behavior: string): void };
        }
      ).CaptureController;
      if (CaptureControllerCtor) {
        try {
          const ctrl = new CaptureControllerCtor();
          ctrl.setFocusBehavior('no-focus-change');
          captureController = ctrl;
        } catch {
          captureController = null;
        }
      }
      // Do not set preferCurrentTab / displaySurface:'browser' — those lock Chrome
      // to a this-tab-only picker and hide Window + Entire Screen.
      return await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: !isScreenshotOnlyMode(recordingMode),
        selfBrowserSurface: 'include',
        surfaceSwitching: 'include',
        monitorTypeSurfaces: 'include',
        ...(captureController ? { controller: captureController } : {}),
      } as DisplayMediaStreamOptions);
    } catch (err) {
      console.warn('[TutorialRecorderSession] display capture cancelled:', err);
      return null;
    }
  }, [recordingMode]);

  const startRecording = useCallback(async () => {
    setError('');
    const mode = recordingMode;
    recordingModeRef.current = mode;

    if (!effectiveStudioTarget) {
      setError('Document Studio target is required to publish tutorials.');
      return;
    }

    if (modeNeedsDisplayCapture(mode) && !navigator.mediaDevices?.getDisplayMedia) {
      setError('Screen recording is not supported in this browser.');
      return;
    }

    if (isScreenshotOnlyMode(mode)) {
      const displayStream = await acquireDisplayStream();
      if (!displayStream) {
        setError('Screen capture was cancelled or denied.');
        return;
      }
      streamsRef.current.push(displayStream);

      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.srcObject = displayStream;
      screenshotsVideoRef.current = video;
      screenshotsCanvasRef.current = document.createElement('canvas');
      void video.play().catch(() => {});

      displayStream.getVideoTracks()[0]?.addEventListener('ended', () => {
        if (phase === 'recording') finishScreenshotSession();
      });

      captureRef.current = new TutorialCaptureSession(displayStream, true);
      captureRef.current.start();
      setPhase('recording');
      setSessionActive(true);
      setElapsed(0);
      elapsedRef.current = 0;
      timerRef.current = setInterval(() => {
        elapsedRef.current += 1;
        setElapsed(elapsedRef.current);
      }, 1000);
      return;
    }

    let displayStream: MediaStream | null = null;
    let cameraStream: MediaStream | null = null;
    let recordStream: MediaStream;
    const audioTracks: MediaStreamTrack[] = [];

    // Request camera/mic first. getDisplayMedia consumes the user-gesture token;
    // a later getUserMedia often fails without showing a permission prompt.
    if (modeNeedsCamera(mode)) {
      try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        streamsRef.current.push(cameraStream);
        setCameraPreviewActive(true);
      } catch (err) {
        console.warn('[TutorialRecorderSession] camera denied:', err);
        const name = err instanceof DOMException ? err.name : '';
        const blockedByPolicy =
          name === 'NotAllowedError' || name === 'PermissionDeniedError';
        if (mode === 'camera' || mode === 'screen_camera') {
          setError(
            blockedByPolicy
              ? 'Camera permission was blocked. Allow camera for this site in the browser address bar (or site settings), then try again.'
              : mode === 'camera'
                ? 'Camera access was denied.'
                : 'Camera access is required for Screen + Camera mode.'
          );
          stopTracks();
          return;
        }
      }
    }

    try {
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamsRef.current.push(micStream);
      audioTracks.push(...micStream.getAudioTracks());
    } catch {
      // Continue without mic for most modes; voice-only checks below.
    }

    if (modeNeedsDisplayCapture(mode)) {
      displayStream = await acquireDisplayStream();
      if (!displayStream) {
        setError('Screen capture was cancelled or denied.');
        stopTracks();
        return;
      }
      streamsRef.current.push(displayStream);
      audioTracks.push(...displayStream.getAudioTracks());
    }

    if (mode === 'screen_camera' && displayStream && cameraStream) {
      const compositor = createPipCompositor(displayStream, cameraStream);
      pipCompositorRef.current = compositor;
      const canvasStream = await compositor.start();
      setCompositorBackend(compositor.backend);
      if (compositor.backend === 'canvas-interval') {
        setCompositorWarning(
          'Using canvas compositor — keep this tab visible for best Screen + Camera quality.'
        );
      }
      const mixedAudio = await mixAudioTracks(audioTracks);
      recordStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...(mixedAudio ? [mixedAudio] : []),
      ]);
      cameraPreviewStreamRef.current = compositor.getPreviewStream();
      setCameraPreviewActive(true);
    } else if (mode === 'camera' && cameraStream) {
      const mixedAudio = await mixAudioTracks(audioTracks);
      recordStream = new MediaStream([
        ...cameraStream.getVideoTracks(),
        ...(mixedAudio ? [mixedAudio] : []),
      ]);
      cameraPreviewStreamRef.current = cameraStream;
    } else if (mode === 'voice') {
      const mixedAudio = await mixAudioTracks(audioTracks);
      if (!mixedAudio) {
        setError('Microphone access is required for voice-only recording.');
        stopTracks();
        return;
      }
      recordStream = new MediaStream([mixedAudio]);
    } else if (displayStream) {
      const mixedAudio = await mixAudioTracks(audioTracks);
      recordStream = new MediaStream([
        ...displayStream.getVideoTracks(),
        ...(mixedAudio ? [mixedAudio] : []),
      ]);
    } else {
      setError('Could not start recording.');
      stopTracks();
      return;
    }

    const hasAudio = recordStream.getAudioTracks().some(t => t.readyState === 'live');
    const mimeType = pickMimeType(mode, hasAudio);
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(recordStream, { mimeType });
    } catch {
      try {
        recorder = new MediaRecorder(recordStream);
      } catch {
        setError('Could not start the recorder.');
        stopTracks();
        return;
      }
    }
    const actualMime = recorder.mimeType || mimeType;
    recordedMimeRef.current = actualMime;

    chunksRef.current = [];
    recorder.ondataavailable = event => {
      if (event.data && event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };
    recorder.onstop = finishMediaRecording;

    displayStream?.getVideoTracks()[0]?.addEventListener('ended', () => {
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    });

    captureRef.current = new TutorialCaptureSession(displayStream, Boolean(displayStream));
    captureRef.current.start();

    mediaRecorderRef.current = recorder;
    recorder.start(1000);
    setPhase('recording');
    setSessionActive(true);
    setElapsed(0);
    elapsedRef.current = 0;
    timerRef.current = setInterval(() => {
      elapsedRef.current += 1;
      setElapsed(elapsedRef.current);
    }, 1000);
  }, [
    recordingMode,
    effectiveStudioTarget,
    acquireDisplayStream,
    finishMediaRecording,
    finishScreenshotSession,
    phase,
    stopTracks,
    setSessionActive,
  ]);

  const stopRecording = useCallback(() => {
    if (isScreenshotOnlyMode(recordingModeRef.current)) {
      finishScreenshotSession();
      return;
    }
    const rec = mediaRecorderRef.current;
    if (rec?.state === 'recording') {
      try {
        rec.requestData();
      } catch {
        /* some browsers throw if no data yet */
      }
      rec.stop();
    } else if (rec?.state === 'inactive' && chunksRef.current.length) {
      finishMediaRecording();
    }
  }, [finishScreenshotSession, finishMediaRecording]);

  const captureManualFrame = useCallback(async () => {
    const video = screenshotsVideoRef.current;
    const canvas = screenshotsCanvasRef.current;
    if (!video || !canvas || !captureRef.current) return;
    setCapturingFrame(true);
    try {
      if (!video.videoWidth || !video.videoHeight) return;
      const scale = Math.min(1, MAX_SHOT_WIDTH / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>(resolve => {
        canvas.toBlob(b => resolve(b), 'image/png', 0.92);
      });
      if (!blob) return;

      const steps = captureRef.current.getSteps();
      const index = steps.length + 1;
      const step: CapturedStep = {
        index,
        tMs: Math.round(elapsedRef.current * 1000),
        type: 'click',
        label: `Capture frame ${index}`,
        route: window.location.pathname,
        screenshot: blob,
      };
      const next = [...steps, step];
      captureRef.current.setSteps(next);
      stepsRef.current = next;
      setStepCount(next.length);
    } finally {
      setCapturingFrame(false);
    }
  }, []);

  const stepsPayload = useCallback(
    () =>
      stepsRef.current.map(s => ({
        index: s.index,
        tMs: s.tMs,
        type: s.type,
        label: s.label,
        route: s.route,
        hasShot: Boolean(s.screenshot),
      })),
    []
  );

  const generateGuide = useCallback(async () => {
    const blob = recordedBlobRef.current;
    setPhase('generating');
    setError('');
    try {
      const eventsPayload = {
        title: title.trim(),
        durationSeconds: durationRef.current || 0,
        steps: stepsPayload(),
      };

      const data = await generateStudioTutorial(
        eventsPayload,
        isScreenshotOnlyMode(recordingMode) ? null : blob,
        documentTitle,
        effectiveStudioTarget?.scope
      );

      setTitle(data.title || title);
      setDraftMarkdown(data.markdown || '');
      setGenInfo({ usedAi: Boolean(data.usedAi), usedTranscript: Boolean(data.usedTranscript) });
      let parsed = parseMarkdownToSteps(data.markdown || '', stepsRef.current);
      parsed = await seedStepAnnotations(parsed, stepsRef.current);
      setEditableSteps(parsed);
      setIntroText(extractIntroFromMarkdown(data.markdown || '', data.title || title));
      setShowMarkdownEditor(false);
      setPhase('review');
    } catch (err) {
      setError(extractError(err, 'Failed to generate the step-by-step guide.'));
      setPhase('preview');
    }
  }, [title, stepsPayload, documentTitle, effectiveStudioTarget, recordingMode]);

  const syncStepsToCaptureRef = (steps: EditableStep[]) => {
    stepsRef.current = steps.map(s => ({
      index: s.index,
      tMs: s.tMs ?? 0,
      type: 'click' as const,
      label: s.title || s.description,
      route: '',
      ...(s.screenshot ? { screenshot: s.screenshot } : {}),
    }));
    captureRef.current?.setSteps(stepsRef.current);
  };

  const publishGuide = useCallback(async () => {
    if (!effectiveStudioTarget) {
      setError('Document Studio target is required.');
      return;
    }

    setPhase('publishing');
    setError('');
    const finalMarkdown = showMarkdownEditor
      ? draftMarkdown
      : stepsToMarkdown(title.trim() || documentTitle, introText, editableSteps);

    const stepsToPublish = showMarkdownEditor
      ? parseMarkdownToSteps(finalMarkdown, stepsRef.current)
      : editableSteps;

    if (
      !guideHasContent({
        showMarkdownEditor,
        draftMarkdown: finalMarkdown,
        editableSteps: stepsToPublish,
      })
    ) {
      setError('Add at least one step or write guide content before publishing.');
      setPhase('review');
      return;
    }

    if (!showMarkdownEditor) {
      syncStepsToCaptureRef(editableSteps);
    }

    try {
      const openTask = submitForReview
        ? (await fetchMyTasks()).find(t =>
            ['assigned', 'in_progress', 'changes_requested', 'overdue'].includes(t.status)
          )
        : undefined;
      const result = await publishTutorialToStudio({
        ...(effectiveStudioTarget.scope ? { scope: effectiveStudioTarget.scope } : {}),
        ...(effectiveStudioTarget.folderId ? { folderId: effectiveStudioTarget.folderId } : {}),
        ...(effectiveStudioTarget.existingDocumentId
          ? { existingDocumentId: effectiveStudioTarget.existingDocumentId }
          : {}),
        title: title.trim() || documentTitle,
        markdown: finalMarkdown,
        steps: stepsToPublish,
        videoBlob: isScreenshotOnlyMode(recordingMode) ? null : recordedBlobRef.current,
        recordingMode,
        submitForReview,
        ...(openTask ? { documentationTaskId: openTask.id } : {}),
      });
      effectiveOnPublished?.(result.documentId);
      setPublishResult({ studioDocId: result.documentId });
      effectiveOnSaved?.();
      setPhase('success');
    } catch (err) {
      setError(extractError(err, 'Failed to publish the guide.'));
      setPhase('review');
    }
  }, [
    title,
    documentTitle,
    draftMarkdown,
    editableSteps,
    introText,
    showMarkdownEditor,
    effectiveOnSaved,
    effectiveOnPublished,
    effectiveStudioTarget,
    recordingMode,
  ]);

  const closeModal = useCallback(() => {
    if (phase === 'recording') {
      stopRecording();
    }
    setOpen(false);
    resetState();
  }, [phase, stopRecording, resetState, setOpen]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const busy = phase === 'generating' || phase === 'publishing';
  const showUi = sessionActive || isOpen;
  const showModal = (isOpen || sessionActive) && phase !== 'recording';

  if (!showUi) return null;

  return (
    <>
      {phase === 'recording' && (
        <div
          data-tutorial-recorder
          className="fixed bottom-4 right-4 z-[60] flex items-center gap-3 rounded-full border border-gray-200 bg-white px-4 py-2 shadow-lg"
        >
          {cameraPreviewActive && (
            <video
              ref={cameraPreviewRef}
              muted
              playsInline
              className={`${recordingMode === 'screen_camera' ? 'w-24 h-14 rounded-lg' : 'w-16 h-16 rounded-full'} object-cover border-2 border-sky-400`}
            />
          )}
          <span className="flex items-center gap-2 text-sm font-medium text-red-600">
            <Circle className="w-3 h-3 fill-red-600 animate-pulse" />
            {formatTime(elapsed)}
          </span>
          <span className="text-xs text-gray-500">
            {captureRef.current?.getSteps().length ?? 0} steps
          </span>
          {isScreenshotOnlyMode(recordingMode) && (
            <button
              type="button"
              onClick={() => void captureManualFrame()}
              disabled={capturingFrame}
              className="flex items-center gap-1 rounded-full border border-sky-300 px-3 py-1.5 text-sm text-sky-800 hover:bg-sky-50 disabled:opacity-50"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              {capturingFrame ? 'Capturing…' : 'Capture frame'}
            </button>
          )}
          <button
            onClick={stopRecording}
            className="flex items-center gap-1 rounded-full bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700"
          >
            <Square className="w-3.5 h-3.5" />
            Stop
          </button>
        </div>
      )}

      {showModal && (
        <div
          data-tutorial-recorder
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900">
                Record tutorial — {documentTitle}
              </h3>
              <button
                onClick={closeModal}
                className="p-1 hover:bg-gray-100 rounded"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              {phase === 'idle' && (
                <div className="text-sm text-gray-600 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2">
                      Recording mode
                    </label>
                    <div className="grid grid-cols-2 gap-2" data-tour="studio-mode-picker">
                      {visibleRecordingModes().map(m => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setRecordingMode(m.id)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-xs transition-colors ${
                            recordingMode === m.id
                              ? 'border-sky-500 bg-sky-50 text-sky-900'
                              : 'border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          {m.icon}
                          <span>
                            <span className="font-medium block">{m.label}</span>
                            <span className="text-gray-500">{m.hint}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                  {compositorBackend !== 'none' && (
                    <p className="text-xs text-gray-500">
                      Compositor:{' '}
                      {compositorBackend === 'insertable-worker'
                        ? 'insertable streams'
                        : 'canvas fallback'}
                    </p>
                  )}
                  {compositorWarning && (
                    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      {compositorWarning}
                    </div>
                  )}
                  <div className="rounded-lg border border-sky-100 bg-sky-50/50 p-3 text-xs text-sky-900">
                    <p className="font-medium">Document Studio publish</p>
                    <p className="mt-1">
                      Your tutorial will be saved as a draft in Document Studio, then published when
                      you finish review.
                    </p>
                  </div>
                  <p>
                    Record a walkthrough of WW360. While you record, clicks and navigations in this
                    app are logged so we can generate a written step-by-step guide.
                  </p>
                  {isScreenshotOnlyMode(recordingMode) ? (
                    <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900 space-y-1">
                      <p className="font-medium">Screenshots mode</p>
                      <p>
                        After you start, the browser lets you share a <b>Chrome tab</b>,{' '}
                        <b>Window</b>, or <b>Entire screen</b>. Use <b>Capture frame</b> on the
                        floating bar whenever you want a still — no video is saved.
                      </p>
                    </div>
                  ) : null}
                  <ul className="list-disc pl-5 space-y-1 text-gray-500">
                    <li>
                      When the browser asks what to share, choose <b>Chrome Tab</b>,{' '}
                      <b>Window</b>, or <b>Entire Screen</b> (not locked to this tab).
                    </li>
                    <li>
                      Step clicks are logged inside Water Workforce 360; share this tab if you want
                      the richest auto step list.
                    </li>
                    <li>
                      This dialog hides while recording — controls stay bottom-right. Click{' '}
                      <b>Stop</b> when finished.
                    </li>
                  </ul>
                </div>
              )}

              {phase === 'preview' && (
                <div className="space-y-3">
                  {captureWarning && (
                    <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      <p>{captureWarning}</p>
                    </div>
                  )}
                  <p className="text-sm text-gray-600">
                    {isScreenshotOnlyMode(recordingMode)
                      ? `Screenshot session complete (${stepCount} step${stepCount === 1 ? '' : 's'} captured).`
                      : `Preview your recording (${formatTime(durationRef.current)} · ${stepCount} step${stepCount === 1 ? '' : 's'} captured).`}
                  </p>
                  {previewUrl && recordingMode === 'voice' ? (
                    <audio src={previewUrl} controls className="w-full" />
                  ) : previewUrl && !isScreenshotOnlyMode(recordingMode) ? (
                    <video
                      key={previewUrl}
                      controls
                      playsInline
                      preload="auto"
                      className="w-full rounded-lg border border-gray-200 bg-black aspect-video"
                      onLoadedData={e => {
                        const el = e.currentTarget;
                        if (el.videoWidth === 0 && el.videoHeight === 0) {
                          setError(
                            'This recording has no video frames. Share the WW360 Chrome tab (not a blank window), keep the tab visible, and record again.'
                          );
                        }
                      }}
                      onError={() => {
                        const current = recordedBlobRef.current;
                        if (current && !previewRetryRef.current) {
                          const alt = alternateRecordingBlob(current);
                          if (alt !== current) {
                            previewRetryRef.current = true;
                            if (previewUrl) URL.revokeObjectURL(previewUrl);
                            recordedBlobRef.current = alt;
                            setPreviewUrl(URL.createObjectURL(alt));
                            return;
                          }
                        }
                        setError(
                          'The browser could not play this recording. Allow media on this site (refresh after the security update), then record again and share this WW360 tab.'
                        );
                      }}
                    >
                      <source
                        src={previewUrl}
                        type={recordingBlobType(recordedMimeRef.current || 'video/webm')}
                      />
                    </video>
                  ) : null}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Tutorial title
                    </label>
                    <input
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      placeholder="e.g. How to complete a training module"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                </div>
              )}

              {phase === 'generating' && (
                <div className="flex items-center gap-2 text-gray-600 py-10 justify-center">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating step-by-step guide from your recording…
                </div>
              )}

              {(phase === 'review' || phase === 'publishing') && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Title</label>
                    <input
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  {!showMarkdownEditor && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Intro</label>
                      <textarea
                        value={introText}
                        onChange={e => setIntroText(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs"
                      />
                    </div>
                  )}
                  <TutorialStepEditor
                    steps={editableSteps}
                    onChange={next => {
                      setEditableSteps(next);
                      syncStepsToCaptureRef(next);
                    }}
                    markdown={draftMarkdown}
                    onMarkdownChange={setDraftMarkdown}
                    showMarkdown={showMarkdownEditor}
                    onToggleMarkdown={setShowMarkdownEditor}
                  />
                  {genInfo && (
                    <span className="text-xs text-gray-400">
                      {genInfo.usedAi ? 'AI-drafted' : 'events-only'}
                      {genInfo.usedTranscript ? ' · narration used' : ''}
                    </span>
                  )}
                </div>
              )}

              {phase === 'success' && (
                <div className="space-y-4 text-sm">
                  <p className="text-green-700 font-medium">Tutorial published successfully.</p>
                  <ul className="space-y-2">
                    {publishResult?.studioDocId && (
                      <li>
                        <Link
                          to="/studio"
                          className="inline-flex items-center gap-1 text-sky-700 hover:underline"
                          onClick={() => {
                            effectiveOnPublished?.(publishResult.studioDocId!);
                          }}
                        >
                          <ExternalLink className="w-4 h-4" />
                          Open in Document Studio
                        </Link>
                      </li>
                    )}
                    <li>
                      <Link
                        to={originRoute}
                        className="inline-flex items-center gap-1 text-gray-700 hover:underline"
                      >
                        Return to where you started
                      </Link>
                    </li>
                  </ul>
                </div>
              )}

              {error && (
                <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">
                  {error}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200 bg-gray-50">
              {phase === 'idle' && (
                <button
                  onClick={() => void startRecording()}
                  disabled={!effectiveStudioTarget}
                  className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-sm disabled:opacity-50"
                >
                  {isScreenshotOnlyMode(recordingMode) ? (
                    <ImageIcon className="w-4 h-4" />
                  ) : (
                    <Video className="w-4 h-4" />
                  )}
                  {isScreenshotOnlyMode(recordingMode)
                    ? 'Start screenshot capture'
                    : 'Start recording'}
                </button>
              )}
              {phase === 'preview' && (
                <>
                  <button
                    onClick={() => {
                      if (previewUrl) {
                        URL.revokeObjectURL(previewUrl);
                        setPreviewUrl(null);
                      }
                      recordedBlobRef.current = null;
                      stepsRef.current = [];
                      setStepCount(0);
                      setPhase('idle');
                    }}
                    className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg text-sm"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Record again
                  </button>
                  <button
                    onClick={() => void generateGuide()}
                    disabled={stepCount === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-sm disabled:opacity-50"
                  >
                    <Sparkles className="w-4 h-4" />
                    Generate step-by-step guide
                  </button>
                </>
              )}
              {phase === 'review' && (
                <>
                  <button
                    onClick={() => setPhase('preview')}
                    className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg text-sm"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Back
                  </button>
                  <button
                    onClick={() => void publishGuide()}
                    disabled={
                      busy ||
                      !canPublishGuide({
                        title,
                        showMarkdownEditor,
                        draftMarkdown,
                        editableSteps,
                        publishStudio: true,
                        hasStudioTarget: Boolean(effectiveStudioTarget),
                        publishDocumentation: false,
                        activeTopicId: '',
                        publishReservoir: false,
                      })
                    }
                    className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-sm disabled:opacity-50"
                  >
                    <FileText className="w-4 h-4" />
                    Publish guide
                  </button>
                </>
              )}
              {phase === 'success' && (
                <button
                  onClick={closeModal}
                  className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-sm"
                >
                  Done
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default TutorialRecorderSession;
