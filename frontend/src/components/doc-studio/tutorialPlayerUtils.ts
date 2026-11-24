import type { TutorialData, TutorialStep } from '@/services/docStudioService';

const DEFAULT_CUE_DURATION_SECONDS = 5;
const MAX_ALT_SNIPPET_LENGTH = 160;
const GENERIC_STEP_LABEL_RE = /^step\s+\d+$/i;

function pad2(n: number): string {
  return String(Math.floor(n)).padStart(2, '0');
}

function pad3(n: number): string {
  return String(Math.floor(n)).padStart(3, '0');
}

export function getStepHeading(step: TutorialStep, index: number): string {
  return step.caption?.trim() || step.title?.trim() || `Step ${index + 1}`;
}

export function getStepDescription(step: TutorialStep): string {
  return step.description?.trim() || step.body?.trim() || step.narration?.trim() || '';
}

export function getStepStartSeconds(step: TutorialStep): number | null {
  if (typeof step.tMs === 'number' && Number.isFinite(step.tMs) && step.tMs >= 0) {
    return step.tMs / 1000;
  }
  if (
    typeof step.timestamp_seconds === 'number' &&
    Number.isFinite(step.timestamp_seconds) &&
    step.timestamp_seconds >= 0
  ) {
    return step.timestamp_seconds;
  }
  return null;
}

function getStepExplicitEndSeconds(step: TutorialStep, startSeconds: number): number | null {
  if (
    typeof step.end_tMs === 'number' &&
    Number.isFinite(step.end_tMs) &&
    step.end_tMs / 1000 > startSeconds
  ) {
    return step.end_tMs / 1000;
  }
  if (
    typeof step.duration_seconds === 'number' &&
    Number.isFinite(step.duration_seconds) &&
    step.duration_seconds > 0
  ) {
    return startSeconds + step.duration_seconds;
  }
  return null;
}

export function formatTimestampShort(seconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${pad2(minutes)}:${pad2(secs)}`;
  }
  return `${minutes}:${pad2(secs)}`;
}

export function formatVttTimestamp(seconds: number): string {
  const totalMs = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(totalMs / 3_600_000);
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
  const secs = Math.floor((totalMs % 60_000) / 1000);
  const ms = totalMs % 1000;
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(secs)}.${pad3(ms)}`;
}

function sanitizeVttCueText(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(/-->/g, '→')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function getStepCueText(step: TutorialStep): string {
  const narration = step.narration?.trim();
  if (narration) return sanitizeVttCueText(narration);

  const heading = step.caption?.trim() || step.title?.trim() || '';
  const detail = step.description?.trim() || step.body?.trim() || '';

  if (heading && detail && heading.toLowerCase() !== detail.toLowerCase()) {
    return sanitizeVttCueText(`${heading}: ${detail}`);
  }
  return sanitizeVttCueText(detail || heading);
}

/**
 * Generate a WebVTT caption string from inline VTT, timed/structured steps,
 * or transcript fallback. Returns null when no cue text is available.
 */
export function buildWebVttFromTutorial(
  tutorialData: TutorialData | null | undefined,
  sortedSteps: TutorialStep[]
): string | null {
  const inlineVtt = tutorialData?.captions_vtt?.trim();
  if (inlineVtt) {
    const normalized = inlineVtt.replace(/\r\n?/g, '\n');
    return normalized.startsWith('WEBVTT') ? normalized : `WEBVTT\n\n${normalized}`;
  }

  const cueItems = sortedSteps
    .map(step => ({
      step,
      text: getStepCueText(step),
      explicitStart: getStepStartSeconds(step),
    }))
    .filter(item => item.text.length > 0);

  if (cueItems.length > 0) {
    const cues: string[] = [];
    let cursorSeconds = 0;

    for (let i = 0; i < cueItems.length; i += 1) {
      const item = cueItems[i];
      const startSeconds =
        item.explicitStart !== null ? Math.max(cursorSeconds, item.explicitStart) : cursorSeconds;

      const explicitEnd = getStepExplicitEndSeconds(item.step, startSeconds);
      const nextExplicitStart =
        i + 1 < cueItems.length ? cueItems[i + 1].explicitStart : null;

      let endSeconds: number;
      if (explicitEnd !== null) {
        endSeconds = explicitEnd;
      } else if (nextExplicitStart !== null && nextExplicitStart > startSeconds) {
        endSeconds = nextExplicitStart;
      } else {
        endSeconds = startSeconds + DEFAULT_CUE_DURATION_SECONDS;
      }

      cues.push(
        `${formatVttTimestamp(startSeconds)} --> ${formatVttTimestamp(endSeconds)}\n${item.text}`
      );
      cursorSeconds = endSeconds;
    }

    return `WEBVTT\n\n${cues.join('\n\n')}\n`;
  }

  const transcript = tutorialData?.transcript?.trim();
  if (transcript) {
    const blocks = transcript
      .replace(/\r\n?/g, '\n')
      .split(/\n{2,}|\n/)
      .map(part => sanitizeVttCueText(part))
      .filter(Boolean);

    if (blocks.length > 0) {
      const cues = blocks.map((block, idx) => {
        const start = idx * DEFAULT_CUE_DURATION_SECONDS;
        const end = start + DEFAULT_CUE_DURATION_SECONDS;
        return `${formatVttTimestamp(start)} --> ${formatVttTimestamp(end)}\n${block}`;
      });
      return `WEBVTT\n\n${cues.join('\n\n')}\n`;
    }
  }

  return null;
}

/**
 * Build a full plain-text transcript from explicit tutorial transcript text,
 * structured tutorial steps, or fallback document markdown.
 */
export function buildPlainTextTranscript(
  tutorialData: TutorialData | null | undefined,
  sortedSteps: TutorialStep[],
  contentMarkdown?: string | null
): string {
  const explicit = tutorialData?.transcript?.trim();
  if (explicit) return explicit;

  const sections: string[] = [];
  sortedSteps.forEach((step, idx) => {
    const startSec = getStepStartSeconds(step);
    const timePrefix = startSec !== null ? `[${formatTimestampShort(startSec)}] ` : '';
    const rawHeading = step.caption?.trim() || step.title?.trim() || '';
    const hasSpecificHeading = rawHeading.length > 0 && !GENERIC_STEP_LABEL_RE.test(rawHeading);
    const headingLine = hasSpecificHeading
      ? `${timePrefix}Step ${idx + 1}: ${rawHeading}`
      : `${timePrefix}Step ${idx + 1}`;

    const narration = step.narration?.trim() || '';
    const detail = step.description?.trim() || step.body?.trim() || '';

    const lines: string[] = [];
    if (hasSpecificHeading || narration || detail || rawHeading) {
      lines.push(headingLine);
    }
    if (narration) {
      lines.push(narration);
    }
    if (detail && detail.toLowerCase() !== narration.toLowerCase()) {
      lines.push(detail);
    }

    if (lines.length > 0) {
      sections.push(lines.join('\n'));
    }
  });

  if (sections.length > 0) {
    return sections.join('\n\n');
  }

  return contentMarkdown?.trim() || '';
}

/**
 * Always return meaningful, descriptive non-empty alt text for a step screenshot.
 */
export function buildStepScreenshotAlt(
  step: TutorialStep,
  index: number,
  totalSteps: number,
  tutorialTitle?: string | null
): string {
  const explicitAlt = step.screenshot_alt?.trim();
  if (explicitAlt) return explicitAlt;

  const stepNumber = index + 1;
  const position = totalSteps > 1 ? `Step ${stepNumber} of ${totalSteps}` : `Step ${stepNumber}`;
  const rawLabel = step.caption?.trim() || step.title?.trim() || '';
  const label = GENERIC_STEP_LABEL_RE.test(rawLabel) ? '' : rawLabel;
  const rawDetail = getStepDescription(step);
  const normalizedDetail = rawDetail.replace(/\s+/g, ' ').trim();
  const snippet =
    normalizedDetail.length > MAX_ALT_SNIPPET_LENGTH
      ? `${normalizedDetail.slice(0, MAX_ALT_SNIPPET_LENGTH - 1).trimEnd()}…`
      : normalizedDetail;
  const cleanTitle = tutorialTitle?.trim() || '';

  if (label && snippet && snippet.toLowerCase() !== label.toLowerCase()) {
    return `Screenshot for ${position}: ${label} — ${snippet}`;
  }
  if (label) {
    return cleanTitle
      ? `Screenshot for ${position} of ${cleanTitle}: ${label}`
      : `Screenshot for ${position}: ${label}`;
  }
  if (snippet) {
    return `Screenshot for ${position}: ${snippet}`;
  }
  return cleanTitle
    ? `Screenshot for ${position} of ${cleanTitle}`
    : `Tutorial screenshot for ${position}`;
}
