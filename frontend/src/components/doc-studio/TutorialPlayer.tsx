/**
 * Step-by-step tutorial player for Document Studio.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Circle,
  Copy,
  FileText,
} from 'lucide-react';
import type { DocDetail, TutorialStep } from '@/services/docStudioService';
import { AUTH_TOKEN_KEY } from '@/services/authService';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  buildPlainTextTranscript,
  buildStepScreenshotAlt,
  buildWebVttFromTutorial,
  formatTimestampShort,
  getStepDescription,
  getStepHeading,
  getStepStartSeconds,
} from './tutorialPlayerUtils';

export interface TutorialPlayerProps {
  document: Pick<DocDetail, 'title' | 'tutorial_data' | 'content_markdown'>;
  scope?: string;
  compact?: boolean;
  onStepChange?: (index: number) => void;
}

const PLAYBACK_RATES = [
  { value: 0.75, label: '0.75×', ariaLabel: 'Playback speed 0.75x (slower)' },
  { value: 1, label: '1×', ariaLabel: 'Playback speed 1x (normal)' },
  { value: 1.25, label: '1.25×', ariaLabel: 'Playback speed 1.25x (faster)' },
] as const;

const FOCUS_RING_CLASS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-700 focus-visible:ring-offset-2 focus-visible:ring-offset-white';

/** Build a media URL the browser can load without Authorization headers. */
function assetUrl(assetId: string, scope?: string): string {
  const base = `/api/v1/doc-studio/assets/${assetId}/file`;
  const params = new URLSearchParams();
  if (scope) params.set('scope', scope);
  const token = typeof window !== 'undefined' ? localStorage.getItem(AUTH_TOKEN_KEY) : null;
  if (token) params.set('access_token', token);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

function isEditableOrMediaTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'VIDEO') {
    return true;
  }
  return target.isContentEditable || Boolean(target.closest('[contenteditable="true"]'));
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to textarea copy fallback
    }
  }
  if (typeof window === 'undefined' || typeof window.document === 'undefined') {
    return false;
  }
  try {
    const textarea = window.document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    window.document.body.appendChild(textarea);
    textarea.select();
    const ok = window.document.execCommand('copy');
    textarea.remove();
    return ok;
  } catch {
    return false;
  }
}

export function TutorialPlayer({
  document,
  scope,
  compact,
  onStepChange,
}: TutorialPlayerProps) {
  const tutorialData = document.tutorial_data;

  const steps: TutorialStep[] = useMemo(
    () =>
      tutorialData?.steps?.length
        ? [...tutorialData.steps].sort((a, b) => a.order - b.order)
        : [],
    [tutorialData?.steps]
  );

  const videoUrl = tutorialData?.video_asset_id
    ? assetUrl(tutorialData.video_asset_id, scope)
    : null;

  const externalCaptionsUrl = useMemo(() => {
    const explicitUrl = tutorialData?.captions_url?.trim();
    if (explicitUrl) return explicitUrl;
    if (tutorialData?.captions_asset_id) {
      return assetUrl(tutorialData.captions_asset_id, scope);
    }
    return null;
  }, [tutorialData?.captions_url, tutorialData?.captions_asset_id, scope]);

  const generatedVtt = useMemo(
    () => (videoUrl && !externalCaptionsUrl ? buildWebVttFromTutorial(tutorialData, steps) : null),
    [videoUrl, externalCaptionsUrl, tutorialData, steps]
  );

  const transcriptText = useMemo(
    () => buildPlainTextTranscript(tutorialData, steps, document.content_markdown),
    [tutorialData, steps, document.content_markdown]
  );

  const [activeStep, setActiveStep] = useState(0);
  const [videoError, setVideoError] = useState('');
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [generatedTrackUrl, setGeneratedTrackUrl] = useState<string | null>(null);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<'idle' | 'copied' | 'error'>('idle');
  const [transcriptStatus, setTranscriptStatus] = useState('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const copyTimerRef = useRef<number | null>(null);
  const transcriptPanelId = useId();
  const headingId = useId();

  const safeStepIndex = steps.length > 0 ? Math.min(activeStep, steps.length - 1) : 0;

  useEffect(() => {
    if (steps.length > 0 && activeStep >= steps.length) {
      setActiveStep(steps.length - 1);
    }
  }, [activeStep, steps.length]);

  const goTo = useCallback(
    (idx: number) => {
      if (steps.length === 0) return;
      const next = Math.max(0, Math.min(steps.length - 1, idx));
      setActiveStep(next);
      onStepChange?.(next);
    },
    [steps.length, onStepChange]
  );

  useEffect(() => {
    setVideoError('');
  }, [videoUrl]);

  useEffect(() => {
    if (!videoUrl || externalCaptionsUrl || !generatedVtt) {
      setGeneratedTrackUrl(null);
      return;
    }
    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
      setGeneratedTrackUrl(null);
      return;
    }
    const blob = new Blob([generatedVtt], { type: 'text/vtt;charset=utf-8' });
    const objectUrl = URL.createObjectURL(blob);
    setGeneratedTrackUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [videoUrl, externalCaptionsUrl, generatedVtt]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
      videoRef.current.defaultPlaybackRate = playbackRate;
    }
  }, [playbackRate, videoUrl]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (steps.length === 0) return;
    const handler = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (isEditableOrMediaTarget(e.target)) return;
      if (e.key === 'ArrowRight') goTo(safeStepIndex + 1);
      if (e.key === 'ArrowLeft') goTo(safeStepIndex - 1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [safeStepIndex, steps.length, goTo]);

  const handlePlaybackRateChange = useCallback((rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
      videoRef.current.defaultPlaybackRate = rate;
    }
  }, []);

  const handleCopyTranscript = useCallback(async () => {
    if (!transcriptText) return;
    if (copyTimerRef.current !== null) {
      window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = null;
    }
    const copied = await copyTextToClipboard(transcriptText);
    if (copied) {
      setCopyFeedback('copied');
      setTranscriptStatus('Transcript copied to clipboard.');
    } else {
      setCopyFeedback('error');
      setTranscriptStatus('Could not copy transcript. Select the text below to copy manually.');
    }
    copyTimerRef.current = window.setTimeout(() => {
      setCopyFeedback('idle');
      setTranscriptStatus('');
      copyTimerRef.current = null;
    }, 4000);
  }, [transcriptText]);

  const captionTrackUrl = externalCaptionsUrl || generatedTrackUrl;

  if (steps.length === 0 && !videoUrl) {
    return (
      <div
        className={`tutorial-player rounded-lg border border-slate-200 bg-slate-50 ${
          compact ? 'p-4' : 'p-6'
        } text-lg leading-[1.55] text-slate-800`}
      >
        {document.content_markdown ? (
          <div className="max-w-none whitespace-pre-wrap break-words">
            {document.content_markdown}
          </div>
        ) : (
          <p className="text-lg leading-[1.55] text-slate-700">No tutorial steps defined yet.</p>
        )}
      </div>
    );
  }

  const step = steps[safeStepIndex];
  const progress = steps.length ? ((safeStepIndex + 1) / steps.length) * 100 : 0;
  const screenshotUrl =
    step?.screenshot_url ||
    (step?.screenshot_asset_id ? assetUrl(step.screenshot_asset_id, scope) : null);
  const stepHeading = step ? getStepHeading(step, safeStepIndex) : '';
  const stepDescription = step ? getStepDescription(step) : '';
  const stepScreenshotAlt = step
    ? buildStepScreenshotAlt(step, safeStepIndex, steps.length, document.title)
    : '';

  return (
    <section
      aria-labelledby={headingId}
      className={`tutorial-player flex min-w-0 flex-col ${compact ? 'gap-3' : 'gap-4'}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3
          id={headingId}
          className={`min-w-0 break-words font-semibold leading-[1.3] text-slate-900 ${
            compact ? 'text-xl' : 'text-2xl'
          }`}
        >
          {document.title}
        </h3>
        {steps.length > 0 && (
          <span className="text-sm font-medium text-slate-700">
            Step {safeStepIndex + 1} of {steps.length}
          </span>
        )}
      </div>

      {videoUrl && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-950">
          <video
            ref={videoRef}
            key={videoUrl}
            src={videoUrl}
            controls
            playsInline
            preload="metadata"
            aria-label={`${document.title || 'Tutorial'} video`}
            className={`w-full ${compact ? 'max-h-60' : 'max-h-96'} object-contain`}
            onLoadedMetadata={() => {
              if (videoRef.current) {
                videoRef.current.playbackRate = playbackRate;
                videoRef.current.defaultPlaybackRate = playbackRate;
              }
            }}
            onError={() =>
              setVideoError(
                'Could not play this video. In-app recordings use WebM (Chrome/Edge). Imported QuickTime (.mov / HEVC) often only plays in Safari — re-import as H.264 MP4 for widest support.'
              )
            }
          >
            {captionTrackUrl && (
              <track
                kind="captions"
                src={captionTrackUrl}
                srcLang="en"
                label="English"
                default
              />
            )}
          </video>

          <div
            role="group"
            aria-label="Playback speed"
            className="flex flex-wrap items-center gap-2 border-t border-slate-200 bg-slate-50 px-3 py-2.5"
          >
            <span className="mr-1 text-base font-medium text-slate-800">Playback speed</span>
            <div className="flex flex-wrap items-center gap-2">
              {PLAYBACK_RATES.map(rate => {
                const isSelected = playbackRate === rate.value;
                return (
                  <button
                    key={rate.value}
                    type="button"
                    aria-pressed={isSelected}
                    aria-label={rate.ariaLabel}
                    onClick={() => handlePlaybackRateChange(rate.value)}
                    className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border px-3.5 py-2 text-base font-medium transition-colors motion-reduce:transition-none ${FOCUS_RING_CLASS} ${
                      isSelected
                        ? 'border-[#07111f] bg-[#07111f] text-white'
                        : 'border-slate-300 bg-white text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    {rate.label}
                  </button>
                );
              })}
            </div>
          </div>

          {videoError && (
            <p
              role="alert"
              className="border-t border-amber-800/60 bg-slate-950 p-4 text-base leading-[1.55] text-amber-200"
            >
              {videoError}
            </p>
          )}
        </div>
      )}

      {steps.length > 0 && (
        <Progress
          value={progress}
          aria-label={`Tutorial progress: Step ${safeStepIndex + 1} of ${steps.length}`}
          className="h-2 bg-slate-200"
          indicatorClassName="bg-[#07111f] motion-reduce:transition-none"
        />
      )}

      {steps.length > 0 && step && (
        <div
          className={`grid min-w-0 ${compact ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-5'} gap-4`}
        >
          <nav aria-label="Tutorial steps" className={`min-w-0 ${compact ? '' : 'lg:col-span-2'}`}>
            <ol className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
              {steps.map((s, idx) => {
                const isActive = idx === safeStepIndex;
                const startSeconds = getStepStartSeconds(s);
                return (
                  <li key={s.id || idx}>
                    <button
                      type="button"
                      aria-current={isActive ? 'step' : undefined}
                      onClick={() => goTo(idx)}
                      className={`flex min-h-[44px] min-w-[44px] w-full items-start gap-2.5 rounded-md border px-3 py-2.5 text-left text-base leading-[1.5] transition-colors motion-reduce:transition-none ${FOCUS_RING_CLASS} ${
                        isActive
                          ? 'border-sky-700 bg-sky-50 font-semibold text-sky-950'
                          : 'border-slate-200 bg-white font-normal text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      <Circle
                        aria-hidden="true"
                        className={`mt-1.5 h-3.5 w-3.5 shrink-0 ${
                          idx <= safeStepIndex
                            ? 'fill-sky-800 text-sky-800'
                            : 'text-slate-500'
                        }`}
                      />
                      <span className="min-w-0 flex-1 break-words">
                        {getStepHeading(s, idx)}
                      </span>
                      {startSeconds !== null && (
                        <span className="shrink-0 text-sm font-medium text-slate-700">
                          {formatTimestampShort(startSeconds)}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>

          <div className={`min-w-0 ${compact ? '' : 'lg:col-span-3'}`}>
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              {screenshotUrl && (
                <img
                  src={screenshotUrl}
                  alt={stepScreenshotAlt}
                  className="max-h-80 w-full bg-slate-100 object-contain"
                />
              )}
              <div className="p-4 sm:p-5">
                <h4 className="mb-2 break-words text-xl font-semibold leading-[1.35] text-slate-900">
                  {stepHeading}
                </h4>
                {stepDescription && (
                  <p className="whitespace-pre-wrap break-words text-lg leading-[1.55] text-slate-800">
                    {stepDescription}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {steps.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={safeStepIndex === 0}
            onClick={() => goTo(safeStepIndex - 1)}
            className={`h-auto min-h-[44px] min-w-[44px] border-slate-400 bg-white px-4 py-2 text-base font-medium text-slate-900 hover:bg-slate-100 motion-reduce:transition-none ${FOCUS_RING_CLASS}`}
          >
            <ChevronLeft aria-hidden="true" className="mr-1 h-5 w-5" />
            Previous
          </Button>
          <Button
            type="button"
            disabled={safeStepIndex >= steps.length - 1}
            onClick={() => goTo(safeStepIndex + 1)}
            className={`h-auto min-h-[44px] min-w-[44px] bg-[#07111f] px-4 py-2 text-base font-medium text-white hover:bg-slate-800 motion-reduce:transition-none ${FOCUS_RING_CLASS}`}
          >
            Next
            <ChevronRight aria-hidden="true" className="ml-1 h-5 w-5" />
          </Button>
        </div>
      )}

      {transcriptText && (
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 px-3 py-2.5">
            <button
              type="button"
              aria-expanded={transcriptOpen}
              aria-controls={transcriptPanelId}
              onClick={() => setTranscriptOpen(prev => !prev)}
              className={`inline-flex min-h-[44px] min-w-[44px] items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-base font-medium text-slate-900 transition-colors hover:bg-slate-100 motion-reduce:transition-none ${FOCUS_RING_CLASS}`}
            >
              <FileText aria-hidden="true" className="h-5 w-5 shrink-0 text-slate-700" />
              <span>{transcriptOpen ? 'Hide full transcript' : 'Show full transcript'}</span>
              {transcriptOpen ? (
                <ChevronUp aria-hidden="true" className="h-5 w-5 shrink-0 text-slate-700" />
              ) : (
                <ChevronDown aria-hidden="true" className="h-5 w-5 shrink-0 text-slate-700" />
              )}
            </button>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleCopyTranscript()}
                className={`inline-flex min-h-[44px] min-w-[44px] items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-base font-medium text-slate-900 transition-colors hover:bg-slate-100 motion-reduce:transition-none ${FOCUS_RING_CLASS}`}
              >
                {copyFeedback === 'copied' ? (
                  <Check aria-hidden="true" className="h-5 w-5 shrink-0 text-emerald-700" />
                ) : (
                  <Copy aria-hidden="true" className="h-5 w-5 shrink-0 text-slate-700" />
                )}
                <span>{copyFeedback === 'copied' ? 'Copied' : 'Copy transcript'}</span>
              </button>
              <span
                role="status"
                aria-live="polite"
                className={
                  transcriptStatus ? 'text-sm font-medium text-slate-700' : 'sr-only'
                }
              >
                {transcriptStatus}
              </span>
            </div>
          </div>

          {transcriptOpen && (
            <div
              id={transcriptPanelId}
              role="region"
              aria-label="Full plain-text transcript"
              className="border-t border-slate-200 p-4 sm:p-5"
            >
              <div className="whitespace-pre-wrap break-words text-lg leading-[1.6] text-slate-900">
                {transcriptText}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
