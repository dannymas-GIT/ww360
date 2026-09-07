/**
 * Image metadata in markdown alt text: `![caption|width=60|float=left](file.png)`.
 * Survives TipTap ↔ markdown round-trip and export.
 */

export const MIN_IMAGE_WIDTH_PCT = 15;
export const MAX_IMAGE_WIDTH_PCT = 100;

export type ImageFloat = 'none' | 'left' | 'right';

export type ImageAltMeta = {
  alt: string;
  width: number | null;
  float: ImageFloat;
};

const WIDTH_PART_RE = /^width=(\d{1,3})$/i;
const FLOAT_PART_RE = /^float=(left|right|none)$/i;

/** Split alt suffixes into caption, width percent, and float direction. */
export function splitImageAlt(alt: string | null | undefined): ImageAltMeta {
  if (!alt) return { alt: '', width: null, float: 'none' };

  const parts = alt.split('|').map(part => part.trim());
  const captionParts: string[] = [];
  let width: number | null = null;
  let float: ImageFloat = 'none';

  for (const part of parts) {
    const widthMatch = part.match(WIDTH_PART_RE);
    const floatMatch = part.match(FLOAT_PART_RE);
    if (widthMatch) {
      const parsed = parseInt(widthMatch[1], 10);
      if (Number.isFinite(parsed) && parsed >= 5 && parsed <= MAX_IMAGE_WIDTH_PCT) {
        width = parsed;
      }
    } else if (floatMatch) {
      const dir = floatMatch[1].toLowerCase() as ImageFloat;
      float = dir === 'none' ? 'none' : dir;
    } else {
      captionParts.push(part);
    }
  }

  return { alt: captionParts.join('|'), width, float };
}

/** Compose alt text with optional width and float suffixes. */
export function composeImageAlt(
  alt: string,
  width?: number | null,
  float?: ImageFloat | null
): string {
  const meta = splitImageAlt(alt);
  let result = meta.alt;
  const nextWidth = width ?? meta.width;
  const nextFloat = float ?? meta.float;
  if (nextWidth) result += `|width=${Math.round(nextWidth)}`;
  if (nextFloat && nextFloat !== 'none') result += `|float=${nextFloat}`;
  return result;
}
