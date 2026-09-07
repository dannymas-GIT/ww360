/** Recording mode and media helpers for the tutorial builder. */

export type RecordingMode =
  | 'screen'
  | 'screen_camera'
  | 'camera'
  | 'voice'
  | 'screenshots'
  | 'photo'
  | 'video_mobile';

export type CompositorBackend = 'insertable-worker' | 'canvas-interval' | 'none';

export function pickRecordingMimeType(
  mode: RecordingMode,
  options: { hasAudio?: boolean } = {}
): string {
  if (mode === 'voice') {
    const audioCandidates = ['audio/webm;codecs=opus', 'audio/webm'];
    for (const type of audioCandidates) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return 'audio/webm';
  }
  // VP8 plays back more reliably in the same Chrome tab than VP9. Never advertise
  // opus if the stream has no audio track — Chrome then writes a file <video> rejects.
  const hasAudio = options.hasAudio !== false;
  const candidates = hasAudio
    ? ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9,opus', 'video/webm']
    : ['video/webm;codecs=vp8', 'video/webm;codecs=vp9', 'video/webm'];
  for (const type of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return 'video/webm';
}

/** Container type only — used as a playback retry if the codec string is rejected. */
export function recordingBlobType(mimeType: string): string {
  const base = (mimeType || '').split(';')[0].trim().toLowerCase();
  if (base.startsWith('audio/')) return base || 'audio/webm';
  return base || 'video/webm';
}

export const MIN_RECORDING_BYTES = 1024;

export function assembleRecordingBlob(chunks: Blob[], mimeType: string): Blob {
  const type = mimeType?.trim() || recordingBlobType(mimeType);
  return new Blob(chunks, { type });
}

export function alternateRecordingBlob(blob: Blob): Blob {
  const nextType = recordingBlobType(blob.type);
  if (nextType === blob.type) return blob;
  return new Blob([blob], { type: nextType });
}

export function recordingBlobLooksEmpty(blob: Blob | null | undefined): boolean {
  return !blob || blob.size < MIN_RECORDING_BYTES;
}

export function isAudioOnlyMode(mode: RecordingMode): boolean {
  return mode === 'voice';
}

export function isScreenshotOnlyMode(mode: RecordingMode): boolean {
  return mode === 'screenshots';
}

export function modeNeedsDisplayCapture(mode: RecordingMode): boolean {
  return mode === 'screen' || mode === 'screen_camera' || mode === 'screenshots';
}

export function modeNeedsCamera(mode: RecordingMode): boolean {
  return mode === 'screen_camera' || mode === 'camera' || mode === 'video_mobile';
}

export function modeNeedsMobileCapture(mode: RecordingMode): boolean {
  return mode === 'photo' || mode === 'video_mobile';
}

export function displayCaptureSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia;
}

export function supportsInsertableStreams(): boolean {
  const g = globalThis as typeof globalThis & {
    MediaStreamTrackProcessor?: unknown;
    MediaStreamTrackGenerator?: unknown;
  };
  return (
    typeof g.MediaStreamTrackProcessor !== 'undefined' &&
    typeof g.MediaStreamTrackGenerator !== 'undefined' &&
    typeof OffscreenCanvas !== 'undefined'
  );
}

/** Merge multiple audio tracks into one via Web Audio (fixes multi-track MediaRecorder quirks). */
export async function mixAudioTracks(tracks: MediaStreamTrack[]): Promise<MediaStreamTrack | null> {
  const live = tracks.filter(t => t.readyState === 'live');
  if (live.length === 0) return null;
  if (live.length === 1) return live[0];

  const ctx = new AudioContext();
  const dest = ctx.createMediaStreamDestination();
  for (const track of live) {
    const src = ctx.createMediaStreamSource(new MediaStream([track]));
    src.connect(dest);
  }
  await ctx.resume();
  return dest.stream.getAudioTracks()[0] ?? null;
}

const PIP_SIZE_RATIO = 0.22;
const PIP_MARGIN = 24;

export interface PipCompositorHandle {
  backend: CompositorBackend;
  /** Stream used for MediaRecorder (video track). */
  start(): Promise<MediaStream>;
  /** Same composited frames — use for live preview bubble. */
  getPreviewStream(): MediaStream | null;
  stop(): void;
}

/** Canvas compositor with rAF + interval fallback (main thread). */
class CanvasPipCompositor implements PipCompositorHandle {
  readonly backend: CompositorBackend = 'canvas-interval';
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly screenVideo: HTMLVideoElement;
  private readonly cameraVideo: HTMLVideoElement;
  private frameId = 0;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private outputStream: MediaStream | null = null;

  constructor(screenStream: MediaStream, cameraStream: MediaStream) {
    this.canvas = document.createElement('canvas');
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D unavailable');
    this.ctx = ctx;

    this.screenVideo = document.createElement('video');
    this.screenVideo.muted = true;
    this.screenVideo.playsInline = true;
    this.screenVideo.srcObject = screenStream;

    this.cameraVideo = document.createElement('video');
    this.cameraVideo.muted = true;
    this.cameraVideo.playsInline = true;
    this.cameraVideo.srcObject = cameraStream;
  }

  getPreviewStream(): MediaStream | null {
    return this.outputStream;
  }

  async start(): Promise<MediaStream> {
    await Promise.all([this.screenVideo.play(), this.cameraVideo.play()]);
    this.running = true;
    this.resizeCanvas();
    this.drawFrame();
    this.intervalId = setInterval(() => this.drawFrame(), 33);
    this.outputStream = this.canvas.captureStream(30);
    return this.outputStream;
  }

  stop(): void {
    this.running = false;
    if (this.frameId) cancelAnimationFrame(this.frameId);
    if (this.intervalId) clearInterval(this.intervalId);
    this.screenVideo.srcObject = null;
    this.cameraVideo.srcObject = null;
    this.outputStream = null;
  }

  private resizeCanvas(): void {
    const w = this.screenVideo.videoWidth || 1280;
    const h = this.screenVideo.videoHeight || 720;
    this.canvas.width = w;
    this.canvas.height = h;
  }

  private drawFrame = (): void => {
    if (!this.running) return;
    const { ctx, screenVideo, cameraVideo, canvas } = this;
    if (screenVideo.videoWidth) {
      if (canvas.width !== screenVideo.videoWidth || canvas.height !== screenVideo.videoHeight) {
        this.resizeCanvas();
      }
      ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);

      if (cameraVideo.videoWidth) {
        const pipW = Math.round(canvas.width * PIP_SIZE_RATIO);
        const pipH = Math.round((pipW * cameraVideo.videoHeight) / cameraVideo.videoWidth);
        const x = canvas.width - pipW - PIP_MARGIN;
        const y = canvas.height - pipH - PIP_MARGIN;
        const r = Math.min(pipW, pipH) / 2;
        const cx = x + pipW / 2;
        const cy = y + pipH / 2;

        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(cameraVideo, x, y, pipW, pipH);
        ctx.restore();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    this.frameId = requestAnimationFrame(this.drawFrame);
  };
}

/** Main-thread insertable compositor (no worker transfer issues). */
class MainThreadInsertablePipCompositor implements PipCompositorHandle {
  readonly backend: CompositorBackend = 'insertable-worker';
  private running = false;
  private outputStream: MediaStream | null = null;
  private screenTrack: MediaStreamTrack;
  private cameraTrack: MediaStreamTrack;
  private writer: WritableStreamDefaultWriter<VideoFrame> | null = null;

  constructor(screenStream: MediaStream, cameraStream: MediaStream) {
    this.screenTrack = screenStream.getVideoTracks()[0];
    this.cameraTrack = cameraStream.getVideoTracks()[0];
  }

  getPreviewStream(): MediaStream | null {
    return this.outputStream;
  }

  async start(): Promise<MediaStream> {
    const generator = new MediaStreamTrackGenerator({ kind: 'video' });
    this.outputStream = new MediaStream([generator as unknown as MediaStreamTrack]);
    this.writer = generator.writable.getWriter();

    const screenProcessor = new MediaStreamTrackProcessor({ track: this.screenTrack });
    const cameraProcessor = new MediaStreamTrackProcessor({ track: this.cameraTrack });
    const screenReader = screenProcessor.readable.getReader();
    const cameraReader = cameraProcessor.readable.getReader();

    this.running = true;
    const cameraState: { bitmap: ImageBitmap | null } = { bitmap: null };

    void (async () => {
      try {
        while (this.running) {
          const { value: camFrame } = await cameraReader.read();
          if (!this.running) break;
          if (camFrame) {
            cameraState.bitmap?.close();
            cameraState.bitmap = await createImageBitmap(camFrame);
            camFrame.close();
          }
        }
      } catch {
        /* ended */
      }
    })();

    const canvas = new OffscreenCanvas(1280, 720);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('OffscreenCanvas unavailable');

    void (async () => {
      try {
        while (this.running) {
          const { value: screenFrame, done } = await screenReader.read();
          if (done || !screenFrame || !this.running) break;

          const screenBitmap = await createImageBitmap(screenFrame);
          if (canvas.width !== screenBitmap.width || canvas.height !== screenBitmap.height) {
            canvas.width = screenBitmap.width;
            canvas.height = screenBitmap.height;
          }
          ctx.drawImage(screenBitmap, 0, 0);
          screenBitmap.close();

          if (cameraState.bitmap) {
            const cam = cameraState.bitmap;
            const pipW = Math.round(canvas.width * PIP_SIZE_RATIO);
            const pipH = Math.round((pipW * cam.height) / cam.width);
            const x = canvas.width - pipW - PIP_MARGIN;
            const y = canvas.height - pipH - PIP_MARGIN;
            const r = Math.min(pipW, pipH) / 2;
            const cx = x + pipW / 2;
            const cy = y + pipH / 2;
            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(cam, x, y, pipW, pipH);
            ctx.restore();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.stroke();
          }

          const ts = screenFrame.timestamp ?? performance.now() * 1000;
          screenFrame.close();
          const out = new VideoFrame(canvas, { timestamp: ts });
          await this.writer?.write(out);
          out.close();
        }
      } finally {
        cameraState.bitmap?.close();
        await this.writer?.close().catch(() => {});
      }
    })();

    return this.outputStream;
  }

  stop(): void {
    this.running = false;
    this.writer = null;
    this.outputStream = null;
  }
}

/** Create the best available PiP compositor for screen + camera recording. */
export function createPipCompositor(
  screenStream: MediaStream,
  cameraStream: MediaStream
): PipCompositorHandle {
  if (supportsInsertableStreams()) {
    return new MainThreadInsertablePipCompositor(screenStream, cameraStream);
  }
  return new CanvasPipCompositor(screenStream, cameraStream);
}

/** @deprecated Use createPipCompositor */
export class PipCompositor extends CanvasPipCompositor {}

export interface PublishGuideGateInput {
  title: string;
  showMarkdownEditor: boolean;
  draftMarkdown: string;
  editableSteps: Array<{ title?: string; description?: string }>;
  publishStudio: boolean;
  hasStudioTarget: boolean;
  publishDocumentation: boolean;
  activeTopicId: string;
  publishReservoir: boolean;
}

/** True when the guide has author content (both editor modes). */
export function guideHasContent(input: {
  showMarkdownEditor: boolean;
  draftMarkdown: string;
  editableSteps: Array<{ title?: string; description?: string }>;
}): boolean {
  if (input.showMarkdownEditor) {
    return input.draftMarkdown.trim().length > 0;
  }
  if (input.draftMarkdown.trim().length > 0) {
    return true;
  }
  return input.editableSteps.some(
    step => (step.title ?? '').trim().length > 0 || (step.description ?? '').trim().length > 0
  );
}

export function hasPublishDestination(input: {
  publishStudio: boolean;
  hasStudioTarget: boolean;
  publishDocumentation: boolean;
  activeTopicId: string;
  publishReservoir: boolean;
}): boolean {
  return (
    (input.publishStudio && input.hasStudioTarget) ||
    (input.publishDocumentation && !!input.activeTopicId) ||
    input.publishReservoir
  );
}

/** Whether the Publish guide action should be enabled in the recorder review step. */
export function canPublishGuide(input: PublishGuideGateInput): boolean {
  if (!input.title.trim()) return false;
  if (!hasPublishDestination(input)) return false;
  return guideHasContent(input);
}

export const CAPTURE_WARNING =
  'You can share a tab, window, or the entire screen. Auto-logged click steps only fire inside this Water Workforce 360 tab — use Capture frame (Screenshots mode) for stills of other surfaces.';
