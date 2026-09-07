/**
 * Screenshot capture helpers for documentation editing.
 */

export const MAX_SCREENSHOT_WIDTH = 1920;
export const SCREENSHOT_HELPER_DISMISSED_KEY = 'doc-editor-screenshot-helper-dismissed';

export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type AnnotationTool = 'arrow' | 'rect' | 'highlight' | 'text';
export type AnnotationColor = '#ef4444' | '#eab308' | '#3b82f6';

export interface Annotation {
  type: AnnotationTool;
  color: AnnotationColor;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  text?: string;
}

export function isDisplayCaptureSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getDisplayMedia === 'function'
  );
}

export function normalizeSelectionRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  maxWidth: number,
  maxHeight: number,
  minSize = 8
): SelectionRect | null {
  const left = Math.max(0, Math.min(x1, x2));
  const top = Math.max(0, Math.min(y1, y2));
  const right = Math.min(maxWidth, Math.max(x1, x2));
  const bottom = Math.min(maxHeight, Math.max(y1, y2));
  const width = right - left;
  const height = bottom - top;
  if (width < minSize || height < minSize) {
    return null;
  }
  return { x: left, y: top, width, height };
}

export function generateScreenshotFilename(topicId?: string | null, sequence = 1): string {
  const prefix = (topicId || 'screenshot').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 40);
  const date = new Date().toISOString().slice(0, 10);
  return `${prefix}-${date}-${sequence}.png`;
}

export async function grabDisplayFrame(): Promise<{
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
} | null> {
  if (!isDisplayCaptureSupported()) {
    return null;
  }

  let stream: MediaStream | null = null;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 30 },
      audio: false,
    });

    const video = document.createElement('video');
    video.muted = true;
    video.srcObject = stream;
    await video.play();

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('Timed out waiting for video frame')),
        8000
      );
      const check = () => {
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          clearTimeout(timeout);
          resolve();
        } else {
          requestAnimationFrame(check);
        }
      };
      check();
    });

    const scale = Math.min(1, MAX_SCREENSHOT_WIDTH / video.videoWidth);
    const width = Math.round(video.videoWidth * scale);
    const height = Math.round(video.videoHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, width, height);

    const blob = await new Promise<Blob | null>(resolve => {
      canvas.toBlob(b => resolve(b), 'image/png', 0.92);
    });
    if (!blob) return null;

    const dataUrl = canvas.toDataURL('image/png', 0.92);
    return { blob, dataUrl, width, height };
  } catch (err) {
    console.warn('[doc-editor] display grab failed:', err);
    return null;
  } finally {
    stream?.getTracks().forEach(track => track.stop());
  }
}

export function cropImageToCanvas(
  source: HTMLImageElement | HTMLCanvasElement,
  rect: SelectionRect
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = rect.width;
  canvas.height = rect.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.drawImage(source, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
  return canvas;
}

function drawArrowHead(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  color: string
) {
  const headLen = 12;
  const angle = Math.atan2(toY - fromY, toX - fromX);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(
    toX - headLen * Math.cos(angle - Math.PI / 6),
    toY - headLen * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    toX - headLen * Math.cos(angle + Math.PI / 6),
    toY - headLen * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fill();
}

export function drawAnnotations(
  ctx: CanvasRenderingContext2D,
  annotations: Annotation[],
  width: number,
  height: number
) {
  for (const ann of annotations) {
    const { type, color, x1, y1, x2, y2 } = ann;
    const left = Math.min(x1, x2);
    const top = Math.min(y1, y2);
    const w = Math.abs(x2 - x1);
    const h = Math.abs(y2 - y1);

    if (type === 'highlight') {
      ctx.fillStyle = color + '55';
      ctx.fillRect(left, top, w, h);
      continue;
    }

    if (type === 'rect') {
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.strokeRect(left, top, w, h);
      continue;
    }

    if (type === 'arrow') {
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      drawArrowHead(ctx, x1, y1, x2, y2, color);
      continue;
    }

    if (type === 'text' && ann.text) {
      const fontSize = Math.max(14, Math.round(Math.min(width, height) * 0.04));
      ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
      ctx.fillStyle = color;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.strokeText(ann.text, x1, y1);
      ctx.fillText(ann.text, x1, y1);
    }
  }
}

export async function flattenScreenshot(
  baseCanvas: HTMLCanvasElement,
  annotations: Annotation[]
): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = baseCanvas.width;
  canvas.height = baseCanvas.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(baseCanvas, 0, 0);
  drawAnnotations(ctx, annotations, canvas.width, canvas.height);
  return new Promise(resolve => {
    canvas.toBlob(b => resolve(b), 'image/png', 0.92);
  });
}

export function getClipboardImageFile(event: ClipboardEvent): File | null {
  const items = event.clipboardData?.items;
  if (!items) return null;
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) return file;
    }
  }
  return null;
}
