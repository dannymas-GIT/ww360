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
export type WorkspaceTool = AnnotationTool | 'select';
export type AnnotationColor = '#ef4444' | '#eab308' | '#3b82f6';

export interface Annotation {
  id: string;
  type: AnnotationTool;
  color: AnnotationColor;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  text?: string;
  /** Degrees, clockwise around the annotation center. */
  rotation?: number;
  /** Explicit font size for text annotations. */
  fontSize?: number;
}

export type TransformHandle =
  | 'move'
  | 'rotate'
  | 'nw'
  | 'ne'
  | 'sw'
  | 'se'
  | 'start'
  | 'end';

export function createAnnotationId(): string {
  return `ann-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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

export function defaultTextFontSize(canvasWidth: number, canvasHeight: number): number {
  return Math.max(16, Math.round(Math.min(canvasWidth, canvasHeight) * 0.045));
}

export function measureTextSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  fontSize: number
): { width: number; height: number } {
  ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
  const metrics = ctx.measureText(text);
  return {
    width: Math.max(fontSize, metrics.width),
    height: fontSize * 1.25,
  };
}

export function getAnnotationCenter(ann: Annotation): { cx: number; cy: number } {
  return { cx: (ann.x1 + ann.x2) / 2, cy: (ann.y1 + ann.y2) / 2 };
}

function rotationRad(ann: Annotation): number {
  return ((ann.rotation ?? 0) * Math.PI) / 180;
}

/** Local axis-aligned bounds centered at origin (before rotation). */
export function getLocalHalfExtents(
  ctx: CanvasRenderingContext2D,
  ann: Annotation,
  canvasWidth: number,
  canvasHeight: number
): { hw: number; hh: number } {
  if (ann.type === 'text' && ann.text) {
    const fontSize = ann.fontSize ?? defaultTextFontSize(canvasWidth, canvasHeight);
    const size = measureTextSize(ctx, ann.text, fontSize);
    return { hw: size.width / 2, hh: size.height / 2 };
  }
  if (ann.type === 'arrow') {
    const dx = ann.x2 - ann.x1;
    const dy = ann.y2 - ann.y1;
    const len = Math.hypot(dx, dy) / 2;
    return { hw: Math.max(8, len), hh: 10 };
  }
  return {
    hw: Math.max(4, Math.abs(ann.x2 - ann.x1) / 2),
    hh: Math.max(4, Math.abs(ann.y2 - ann.y1) / 2),
  };
}

export function worldToLocal(
  ann: Annotation,
  x: number,
  y: number
): { lx: number; ly: number } {
  const { cx, cy } = getAnnotationCenter(ann);
  const rad = rotationRad(ann);
  const dx = x - cx;
  const dy = y - cy;
  const cos = Math.cos(-rad);
  const sin = Math.sin(-rad);
  return { lx: dx * cos - dy * sin, ly: dx * sin + dy * cos };
}

function drawAnnotationBody(
  ctx: CanvasRenderingContext2D,
  ann: Annotation,
  canvasWidth: number,
  canvasHeight: number
) {
  const { type, color, x1, y1, x2, y2 } = ann;
  const { cx, cy } = getAnnotationCenter(ann);
  const rad = rotationRad(ann);

  // Arrows keep world-space endpoints (rotation is baked into coordinates).
  if (type === 'arrow') {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    drawArrowHead(ctx, x1, y1, x2, y2, color);
    ctx.restore();
    return;
  }

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rad);

  if (type === 'highlight') {
    const w = Math.abs(x2 - x1);
    const h = Math.abs(y2 - y1);
    ctx.fillStyle = color + '55';
    ctx.fillRect(-w / 2, -h / 2, w, h);
  } else if (type === 'rect') {
    const w = Math.abs(x2 - x1);
    const h = Math.abs(y2 - y1);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.strokeRect(-w / 2, -h / 2, w, h);
  } else if (type === 'text' && ann.text) {
    const fontSize = ann.fontSize ?? defaultTextFontSize(canvasWidth, canvasHeight);
    ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(2, Math.round(fontSize / 8));
    ctx.strokeText(ann.text, 0, 0);
    ctx.fillStyle = color;
    ctx.fillText(ann.text, 0, 0);
  }

  ctx.restore();
}

export function drawAnnotations(
  ctx: CanvasRenderingContext2D,
  annotations: Annotation[],
  width: number,
  height: number,
  selectedId?: string | null
) {
  for (const ann of annotations) {
    drawAnnotationBody(ctx, ann, width, height);
  }
  if (selectedId) {
    const selected = annotations.find(a => a.id === selectedId);
    if (selected) drawSelectionChrome(ctx, selected, width, height);
  }
}

function drawHandle(ctx: CanvasRenderingContext2D, x: number, y: number, fill = '#fff') {
  ctx.beginPath();
  ctx.arc(x, y, 6, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = 2;
  ctx.stroke();
}

export function drawSelectionChrome(
  ctx: CanvasRenderingContext2D,
  ann: Annotation,
  canvasWidth: number,
  canvasHeight: number
) {
  const { cx, cy } = getAnnotationCenter(ann);
  const { hw, hh } = getLocalHalfExtents(ctx, ann, canvasWidth, canvasHeight);
  const rad =
    ann.type === 'arrow'
      ? Math.atan2(ann.y2 - ann.y1, ann.x2 - ann.x1)
      : rotationRad(ann);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rad);
  ctx.strokeStyle = '#60a5fa';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);
  ctx.strokeRect(-hw - 4, -hh - 4, hw * 2 + 8, hh * 2 + 8);
  ctx.setLineDash([]);

  if (ann.type === 'arrow') {
    drawHandle(ctx, -hw, 0);
    drawHandle(ctx, hw, 0);
  } else {
    drawHandle(ctx, -hw, -hh);
    drawHandle(ctx, hw, -hh);
    drawHandle(ctx, -hw, hh);
    drawHandle(ctx, hw, hh);
  }

  const rotateY = -hh - 28;
  ctx.beginPath();
  ctx.moveTo(0, -hh - 4);
  ctx.lineTo(0, rotateY);
  ctx.strokeStyle = '#60a5fa';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  drawHandle(ctx, 0, rotateY, '#93c5fd');
  ctx.restore();
}

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

export function hitTestHandle(
  ctx: CanvasRenderingContext2D,
  ann: Annotation,
  x: number,
  y: number,
  canvasWidth: number,
  canvasHeight: number,
  threshold = 12
): TransformHandle | null {
  const { cx, cy } = getAnnotationCenter(ann);
  const { hw, hh } = getLocalHalfExtents(ctx, ann, canvasWidth, canvasHeight);
  const rad =
    ann.type === 'arrow'
      ? Math.atan2(ann.y2 - ann.y1, ann.x2 - ann.x1)
      : rotationRad(ann);

  const toWorld = (llx: number, lly: number) => {
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return { x: cx + llx * cos - lly * sin, y: cy + llx * sin + lly * cos };
  };

  const rotatePt = toWorld(0, -hh - 28);
  if (dist(x, y, rotatePt.x, rotatePt.y) <= threshold) return 'rotate';

  if (ann.type === 'arrow') {
    if (dist(x, y, ann.x1, ann.y1) <= threshold) return 'start';
    if (dist(x, y, ann.x2, ann.y2) <= threshold) return 'end';
  } else {
    const corners: Array<{ h: TransformHandle; lx: number; ly: number }> = [
      { h: 'nw', lx: -hw, ly: -hh },
      { h: 'ne', lx: hw, ly: -hh },
      { h: 'sw', lx: -hw, ly: hh },
      { h: 'se', lx: hw, ly: hh },
    ];
    for (const c of corners) {
      const p = toWorld(c.lx, c.ly);
      if (dist(x, y, p.x, p.y) <= threshold) return c.h;
    }
  }

  // Body hit in local space of this annotation's orientation
  const dx = x - cx;
  const dy = y - cy;
  const cos = Math.cos(-rad);
  const sin = Math.sin(-rad);
  const lx = dx * cos - dy * sin;
  const ly = dx * sin + dy * cos;
  if (Math.abs(lx) <= hw + 8 && Math.abs(ly) <= hh + 8) return 'move';
  return null;
}

export function hitTestAnnotation(
  ctx: CanvasRenderingContext2D,
  annotations: Annotation[],
  x: number,
  y: number,
  canvasWidth: number,
  canvasHeight: number
): Annotation | null {
  for (let i = annotations.length - 1; i >= 0; i -= 1) {
    const ann = annotations[i];
    if (hitTestHandle(ctx, ann, x, y, canvasWidth, canvasHeight, 14)) return ann;
  }
  return null;
}

export function moveAnnotation(ann: Annotation, dx: number, dy: number): Annotation {
  return {
    ...ann,
    x1: ann.x1 + dx,
    y1: ann.y1 + dy,
    x2: ann.x2 + dx,
    y2: ann.y2 + dy,
  };
}

export function rotateAnnotation(ann: Annotation, pointerX: number, pointerY: number): Annotation {
  const { cx, cy } = getAnnotationCenter(ann);
  if (ann.type === 'arrow') {
    const halfLen = Math.hypot(ann.x2 - ann.x1, ann.y2 - ann.y1) / 2;
    const angle = Math.atan2(pointerY - cy, pointerX - cx) - Math.PI / 2;
    return {
      ...ann,
      rotation: 0,
      x1: cx - Math.cos(angle) * halfLen,
      y1: cy - Math.sin(angle) * halfLen,
      x2: cx + Math.cos(angle) * halfLen,
      y2: cy + Math.sin(angle) * halfLen,
    };
  }
  const deg = (Math.atan2(pointerY - cy, pointerX - cx) * 180) / Math.PI + 90;
  return { ...ann, rotation: deg };
}

export function resizeAnnotation(
  ann: Annotation,
  handle: TransformHandle,
  pointerX: number,
  pointerY: number,
  canvasWidth: number,
  canvasHeight: number,
  ctx: CanvasRenderingContext2D
): Annotation {
  if (handle === 'start') return { ...ann, x1: pointerX, y1: pointerY };
  if (handle === 'end') return { ...ann, x2: pointerX, y2: pointerY };

  const { lx, ly } = worldToLocal(ann, pointerX, pointerY);
  const { hw, hh } = getLocalHalfExtents(ctx, ann, canvasWidth, canvasHeight);
  const { cx, cy } = getAnnotationCenter(ann);
  const rad = rotationRad(ann);

  let nextHw = hw;
  let nextHh = hh;
  if (handle === 'nw' || handle === 'sw') nextHw = Math.max(8, Math.abs(lx));
  if (handle === 'ne' || handle === 'se') nextHw = Math.max(8, Math.abs(lx));
  if (handle === 'nw' || handle === 'ne') nextHh = Math.max(8, Math.abs(ly));
  if (handle === 'sw' || handle === 'se') nextHh = Math.max(8, Math.abs(ly));
  // Use absolute pointer distance from center in local space for cleaner scaling
  nextHw = Math.max(8, Math.abs(lx));
  nextHh = Math.max(8, Math.abs(ly));

  if (ann.type === 'text' && ann.text) {
    const base = ann.fontSize ?? defaultTextFontSize(canvasWidth, canvasHeight);
    const current = measureTextSize(ctx, ann.text, base);
    const scale = Math.max(nextHw / Math.max(1, current.width / 2), nextHh / Math.max(1, current.height / 2));
    const fontSize = Math.max(12, Math.min(160, Math.round(base * scale)));
    const size = measureTextSize(ctx, ann.text, fontSize);
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const localCorners = [
      { x: -size.width / 2, y: -size.height / 2 },
      { x: size.width / 2, y: size.height / 2 },
    ];
    const world = localCorners.map(p => ({
      x: cx + p.x * cos - p.y * sin,
      y: cy + p.x * sin + p.y * cos,
    }));
    return {
      ...ann,
      fontSize,
      x1: world[0].x,
      y1: world[0].y,
      x2: world[1].x,
      y2: world[1].y,
    };
  }

  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const corners = [
    { x: -nextHw, y: -nextHh },
    { x: nextHw, y: nextHh },
  ].map(p => ({
    x: cx + p.x * cos - p.y * sin,
    y: cy + p.x * sin + p.y * cos,
  }));

  return {
    ...ann,
    x1: corners[0].x,
    y1: corners[0].y,
    x2: corners[1].x,
    y2: corners[1].y,
  };
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
  drawAnnotations(ctx, annotations, canvas.width, canvas.height, null);
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
