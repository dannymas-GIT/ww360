/** Parse and serialize tutorial steps for the structured step editor. */

import type { CapturedStep } from '@/utils/tutorialCapture';
import type { StepAnnotation } from '@/utils/stepAnnotations';
import { annotationsFromCapture } from '@/utils/stepAnnotations';

export interface EditableStep {
  index: number;
  title: string;
  description: string;
  screenshot?: Blob;
  previewUrl?: string;
  annotations?: StepAnnotation[];
  clickX?: number;
  clickY?: number;
  tMs?: number;
}

const STEP_HEADING = /^###\s+Step\s+(\d+)\s*(?:[—–-]\s*(.+))?$/i;
const IMAGE_LINE = /^!\[[^\]]*\]\(([^)]+)\)\s*$/;

export function parseMarkdownToSteps(markdown: string, captured: CapturedStep[]): EditableStep[] {
  const byIndex = new Map<number, CapturedStep>();
  for (const s of captured) byIndex.set(s.index, s);

  const lines = markdown.split('\n');
  const steps: EditableStep[] = [];
  let i = 0;
  while (i < lines.length) {
    const m = lines[i].trim().match(STEP_HEADING);
    if (!m) {
      i += 1;
      continue;
    }
    const index = parseInt(m[1], 10);
    const title = (m[2] || '').trim();
    i += 1;
    const descLines: string[] = [];
    while (i < lines.length) {
      const line = lines[i];
      if (STEP_HEADING.test(line.trim()) || line.trim().startsWith('## ')) break;
      if (!IMAGE_LINE.test(line.trim())) {
        const t = line.trim();
        if (t) descLines.push(t);
      }
      i += 1;
    }
    const cap = byIndex.get(index);
    steps.push({
      index,
      title,
      description: descLines.join('\n'),
      screenshot: cap?.screenshot,
      previewUrl: cap?.screenshot ? URL.createObjectURL(cap.screenshot) : undefined,
      clickX: cap?.clickX,
      clickY: cap?.clickY,
      tMs: cap?.tMs,
    });
  }

  if (steps.length === 0 && captured.length > 0) {
    return captured.map(s => ({
      index: s.index,
      title: s.label.replace(/^Click\s+"?|"?$/g, ''),
      description: s.label,
      screenshot: s.screenshot,
      previewUrl: s.screenshot ? URL.createObjectURL(s.screenshot) : undefined,
      clickX: s.clickX,
      clickY: s.clickY,
      tMs: s.tMs,
    }));
  }
  return steps;
}

/** Seed numbered badge annotations from captured click coordinates. */
export async function seedStepAnnotations(
  steps: EditableStep[],
  captured: CapturedStep[]
): Promise<EditableStep[]> {
  const byIndex = new Map(captured.map(s => [s.index, s]));
  return Promise.all(
    steps.map(async step => {
      const cap = byIndex.get(step.index);
      if (!step.screenshot || cap?.clickX == null || cap?.clickY == null) {
        return step;
      }
      const bitmap = await createImageBitmap(step.screenshot);
      const annotations = annotationsFromCapture(
        step.index,
        cap.clickX,
        cap.clickY,
        bitmap.width,
        bitmap.height
      );
      bitmap.close();
      return {
        ...step,
        annotations,
        clickX: cap.clickX,
        clickY: cap.clickY,
        tMs: cap.tMs ?? step.tMs,
      };
    })
  );
}

export function stepsToMarkdown(docTitle: string, intro: string, steps: EditableStep[]): string {
  const parts: string[] = [`# ${docTitle}`, '', intro.trim(), '', '## Steps', ''];
  for (const step of steps) {
    const heading = step.title
      ? `### Step ${step.index} — ${step.title}`
      : `### Step ${step.index}`;
    parts.push(heading, '');
    if (step.description.trim()) {
      parts.push(step.description.trim(), '');
    }
    parts.push(`![Step ${step.index}](step-${String(step.index).padStart(2, '0')}.png)`, '');
  }
  return parts.join('\n').trim() + '\n';
}

export function extractIntroFromMarkdown(markdown: string, docTitle: string): string {
  const lines = markdown.split('\n');
  let pastTitle = false;
  const intro: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!pastTitle) {
      if (t.startsWith('# ')) pastTitle = true;
      continue;
    }
    if (t.startsWith('## ')) break;
    if (t.startsWith('###')) continue;
    if (t) intro.push(t);
  }
  return intro.join('\n').trim() || `Step-by-step walkthrough for ${docTitle}.`;
}

/** Pixelate a rectangular region on a PNG blob (PII redaction). */
export async function blurRegionOnImage(
  blob: Blob,
  region: { x: number; y: number; w: number; h: number },
  blockSize = 12
): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return blob;
  ctx.drawImage(bitmap, 0, 0);
  const { x, y, w, h } = region;
  const imgData = ctx.getImageData(x, y, w, h);
  for (let py = 0; py < h; py += blockSize) {
    for (let px = 0; px < w; px += blockSize) {
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let dy = 0; dy < blockSize && py + dy < h; dy++) {
        for (let dx = 0; dx < blockSize && px + dx < w; dx++) {
          const i = ((py + dy) * w + (px + dx)) * 4;
          r += imgData.data[i];
          g += imgData.data[i + 1];
          b += imgData.data[i + 2];
          n += 1;
        }
      }
      r = Math.round(r / n);
      g = Math.round(g / n);
      b = Math.round(b / n);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x + px, y + py, blockSize, blockSize);
    }
  }
  bitmap.close();
  return new Promise(resolve => {
    canvas.toBlob(b => resolve(b || blob), 'image/png', 0.92);
  });
}
