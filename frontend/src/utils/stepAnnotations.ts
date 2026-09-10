/**
 * Step screenshot annotation helpers for the tutorial recorder / Document Studio.
 */
import type { AnnotationColor } from '@/utils/screenshotCapture';

export const STUDIO_ANNOTATION_COLOR: AnnotationColor = '#ef4444';

export const ANNOTATION_COLORS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#3b82f6',
  '#a855f7',
  '#111827',
] as const;

export type AnnotationLineStyle = 'solid' | 'dashed' | 'dotted';
export type StepAnnotationType =
  | 'arrow'
  | 'rect'
  | 'ellipse'
  | 'highlight'
  | 'text'
  | 'badge';

export interface StepAnnotation {
  type: StepAnnotationType;
  color: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  text?: string;
  /** Stroke thickness in px (arrows, boxes, ellipses). */
  strokeWidth?: number;
  lineStyle?: AnnotationLineStyle;
  /** Fill closed shapes (rect/ellipse). Highlight always fills. */
  fill?: boolean;
  /** 0–1 fill opacity when fill is enabled. */
  fillOpacity?: number;
}

export const DEFAULT_STROKE_WIDTH = 3;
export const STROKE_WIDTH_OPTIONS = [2, 3, 5, 8] as const;

export interface AnnotationStyleDefaults {
  color: string;
  strokeWidth: number;
  lineStyle: AnnotationLineStyle;
  fill: boolean;
  fillOpacity: number;
}

export const DEFAULT_ANNOTATION_STYLE: AnnotationStyleDefaults = {
  color: STUDIO_ANNOTATION_COLOR,
  strokeWidth: DEFAULT_STROKE_WIDTH,
  lineStyle: 'solid',
  fill: false,
  fillOpacity: 0.2,
};

function dashForStyle(style: AnnotationLineStyle | undefined, width: number): number[] {
  if (style === 'dashed') return [Math.max(6, width * 3), Math.max(4, width * 2)];
  if (style === 'dotted') return [width, Math.max(3, width * 1.5)];
  return [];
}

function applyStroke(
  ctx: CanvasRenderingContext2D,
  ann: StepAnnotation,
  fallbackWidth = DEFAULT_STROKE_WIDTH
) {
  ctx.strokeStyle = ann.color;
  ctx.lineWidth = ann.strokeWidth ?? fallbackWidth;
  ctx.setLineDash(dashForStyle(ann.lineStyle, ann.strokeWidth ?? fallbackWidth));
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

function drawArrowHead(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  color: string,
  strokeWidth: number
) {
  const headLen = Math.max(10, strokeWidth * 3.5);
  const angle = Math.atan2(toY - fromY, toX - fromX);
  ctx.setLineDash([]);
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

/** Map click coordinates (viewport) to canvas-space badge annotation. */
export function seedBadgeAnnotation(
  stepNumber: number,
  clickX: number,
  clickY: number,
  canvasWidth: number,
  canvasHeight: number,
  viewportWidth = window.innerWidth,
  viewportHeight = window.innerHeight
): StepAnnotation {
  const scaleX = canvasWidth / viewportWidth;
  const scaleY = canvasHeight / viewportHeight;
  const x = clickX * scaleX;
  const y = clickY * scaleY;
  const radius = 16;
  return {
    type: 'badge',
    color: STUDIO_ANNOTATION_COLOR,
    x1: x,
    y1: y,
    x2: x + radius * 2,
    y2: y + radius * 2,
    text: String(stepNumber),
  };
}

/** Build default annotations from captured click coordinates. */
export function annotationsFromCapture(
  stepNumber: number,
  clickX?: number,
  clickY?: number,
  canvasWidth?: number,
  canvasHeight?: number
): StepAnnotation[] {
  if (clickX == null || clickY == null || canvasWidth == null || canvasHeight == null) {
    return [];
  }
  return [seedBadgeAnnotation(stepNumber, clickX, clickY, canvasWidth, canvasHeight)];
}

/** Draw badge annotations (numbered circles). */
export function drawBadgeAnnotation(
  ctx: CanvasRenderingContext2D,
  ann: StepAnnotation,
  width: number,
  height: number
) {
  if (ann.type !== 'badge') return;
  const cx = ann.x1 + (ann.x2 - ann.x1) / 2;
  const cy = ann.y1 + (ann.y2 - ann.y1) / 2;
  const radius = Math.min(20, Math.max(14, Math.min(width, height) * 0.022));
  ctx.save();
  ctx.fillStyle = ann.color;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  const label = ann.text || '?';
  const fontSize = Math.max(12, Math.round(radius * 0.95));
  ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, cx, cy + 1);
  ctx.restore();
}

/** Draw one annotation with style controls (stroke, dash, fill, color). */
export function drawStepAnnotation(
  ctx: CanvasRenderingContext2D,
  ann: StepAnnotation,
  width: number,
  height: number,
  selected = false
) {
  const left = Math.min(ann.x1, ann.x2);
  const top = Math.min(ann.y1, ann.y2);
  const w = Math.abs(ann.x2 - ann.x1);
  const h = Math.abs(ann.y2 - ann.y1);
  const strokeW = ann.strokeWidth ?? DEFAULT_STROKE_WIDTH;

  ctx.save();

  if (ann.type === 'badge') {
    drawBadgeAnnotation(ctx, ann, width, height);
  } else if (ann.type === 'highlight') {
    const opacity = ann.fillOpacity ?? 0.35;
    ctx.fillStyle = hexWithAlpha(ann.color, opacity);
    ctx.fillRect(left, top, w, h);
  } else if (ann.type === 'rect' || ann.type === 'ellipse') {
    if (ann.fill) {
      ctx.fillStyle = hexWithAlpha(ann.color, ann.fillOpacity ?? 0.2);
      if (ann.type === 'ellipse') {
        ctx.beginPath();
        ctx.ellipse(left + w / 2, top + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(left, top, w, h);
      }
    }
    applyStroke(ctx, ann);
    if (ann.type === 'ellipse') {
      ctx.beginPath();
      ctx.ellipse(left + w / 2, top + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.strokeRect(left, top, w, h);
    }
  } else if (ann.type === 'arrow') {
    applyStroke(ctx, ann);
    ctx.beginPath();
    ctx.moveTo(ann.x1, ann.y1);
    ctx.lineTo(ann.x2, ann.y2);
    ctx.stroke();
    drawArrowHead(ctx, ann.x1, ann.y1, ann.x2, ann.y2, ann.color, strokeW);
  } else if (ann.type === 'text' && ann.text) {
    const fontSize = Math.max(14, Math.round(Math.min(width, height) * 0.035));
    ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
    ctx.fillStyle = ann.color;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(2, Math.round(fontSize * 0.15));
    ctx.setLineDash([]);
    ctx.strokeText(ann.text, ann.x1, ann.y1);
    ctx.fillText(ann.text, ann.x1, ann.y1);
  }

  if (selected) {
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = '#0ea5e9';
    ctx.lineWidth = 1.5;
    const pad = 6;
    ctx.strokeRect(left - pad, top - pad, w + pad * 2, h + pad * 2);
  }

  ctx.restore();
}

export function drawStepAnnotations(
  ctx: CanvasRenderingContext2D,
  annotations: StepAnnotation[],
  width: number,
  height: number,
  selectedIndex = -1
) {
  annotations.forEach((ann, i) => {
    drawStepAnnotation(ctx, ann, width, height, i === selectedIndex);
  });
}

function hexWithAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return hex;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha))})`;
}

/** Next badge label that is not already used (1, 2, 3…). */
export function nextBadgeNumber(annotations: StepAnnotation[], preferred?: number): number {
  const used = new Set(
    annotations
      .filter(a => a.type === 'badge')
      .map(a => parseInt(String(a.text || ''), 10))
      .filter(n => Number.isFinite(n) && n > 0)
  );
  if (preferred && preferred > 0 && !used.has(preferred)) return preferred;
  let n = 1;
  while (used.has(n)) n += 1;
  return n;
}

function pointInExpandedBox(
  x: number,
  y: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  pad: number
): boolean {
  const left = Math.min(x1, x2) - pad;
  const right = Math.max(x1, x2) + pad;
  const top = Math.min(y1, y2) - pad;
  const bottom = Math.max(y1, y2) + pad;
  return x >= left && x <= right && y >= top && y <= bottom;
}

function distToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/** Hit-test annotations top-most first. Returns index or -1. */
export function hitTestAnnotation(
  annotations: StepAnnotation[],
  x: number,
  y: number,
  canvasWidth: number,
  canvasHeight: number
): number {
  const pad = Math.max(10, Math.min(canvasWidth, canvasHeight) * 0.012);
  for (let i = annotations.length - 1; i >= 0; i -= 1) {
    const ann = annotations[i];
    if (ann.type === 'badge') {
      const cx = ann.x1 + (ann.x2 - ann.x1) / 2;
      const cy = ann.y1 + (ann.y2 - ann.y1) / 2;
      const radius = Math.min(20, Math.max(14, Math.min(canvasWidth, canvasHeight) * 0.022));
      if (Math.hypot(x - cx, y - cy) <= radius + pad) return i;
      continue;
    }
    if (ann.type === 'text') {
      const approxW = Math.max(40, (ann.text?.length || 4) * 8);
      if (pointInExpandedBox(x, y, ann.x1, ann.y1 - 14, ann.x1 + approxW, ann.y1 + 6, pad)) {
        return i;
      }
      continue;
    }
    if (ann.type === 'arrow') {
      if (distToSegment(x, y, ann.x1, ann.y1, ann.x2, ann.y2) <= pad + (ann.strokeWidth ?? 3)) {
        return i;
      }
      continue;
    }
    if (pointInExpandedBox(x, y, ann.x1, ann.y1, ann.x2, ann.y2, pad)) return i;
  }
  return -1;
}

/** Translate an annotation by delta pixels. */
export function moveAnnotation(ann: StepAnnotation, dx: number, dy: number): StepAnnotation {
  return {
    ...ann,
    x1: ann.x1 + dx,
    y1: ann.y1 + dy,
    x2: ann.x2 + dx,
    y2: ann.y2 + dy,
  };
}

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Remap annotations into crop-local coordinates.
 * Keeps annotations whose center remains inside the crop; drops the rest.
 */
export function cropAnnotations(
  annotations: StepAnnotation[],
  crop: CropRect
): StepAnnotation[] {
  const right = crop.x + crop.width;
  const bottom = crop.y + crop.height;
  const next: StepAnnotation[] = [];
  for (const ann of annotations) {
    const cx = (ann.x1 + ann.x2) / 2;
    const cy = (ann.y1 + ann.y2) / 2;
    if (cx < crop.x || cx > right || cy < crop.y || cy > bottom) continue;
    next.push({
      ...ann,
      x1: ann.x1 - crop.x,
      y1: ann.y1 - crop.y,
      x2: ann.x2 - crop.x,
      y2: ann.y2 - crop.y,
    });
  }
  return next;
}

/** Flatten base image + step annotations (including badges) to PNG. */
export async function flattenStepScreenshot(
  baseCanvas: HTMLCanvasElement,
  annotations: StepAnnotation[]
): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = baseCanvas.width;
  canvas.height = baseCanvas.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(baseCanvas, 0, 0);
  drawStepAnnotations(ctx, annotations, canvas.width, canvas.height);

  return new Promise(resolve => {
    canvas.toBlob(b => resolve(b), 'image/png', 0.92);
  });
}

/** Load a blob into a canvas for editing. */
export async function blobToCanvas(blob: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('Canvas not supported');
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas;
}

/** Render annotations onto an existing canvas for preview (non-destructive). */
export function renderAnnotationsPreview(
  ctx: CanvasRenderingContext2D,
  annotations: StepAnnotation[],
  width: number,
  height: number
) {
  drawStepAnnotations(ctx, annotations, width, height);
}
