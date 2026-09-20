/**
 * Fill Document Studio `{{placeholders}}` when opening from a context that
 * already knows applicant / state / EPA IWIWD stats (Grants, jurisdiction).
 */
import { fetchEpaIwiwdAutofill, type EpaIwiwdAutofill } from '@/services/grantsService';

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export type StudioFillVars = Record<string, string | number | null | undefined>;

/** Replace `{{key}}` tokens. Unknown keys are left as-is so authors can still see gaps. */
export function applyStudioPlaceholders(markdown: string, vars: StudioFillVars): string {
  if (!markdown || !Object.keys(vars).length) return markdown;
  return markdown.replace(PLACEHOLDER_RE, (full, key: string) => {
    if (!Object.prototype.hasOwnProperty.call(vars, key)) return full;
    const value = vars[key];
    if (value == null || value === '') return '';
    return String(value);
  });
}

function str(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  const s = String(value).trim();
  return s || undefined;
}

/** Flatten EPA IWIWD autofill (+ optional jurisdiction) into template vars. */
export function varsFromEpaIwiwdAutofill(
  autofill: EpaIwiwdAutofill,
  extras?: StudioFillVars
): StudioFillVars {
  const vars: StudioFillVars = { ...(extras || {}) };
  const put = (key: string, value: unknown) => {
    const s = str(value);
    if (s != null) vars[key] = s;
  };

  put('applicant', autofill.applicant);
  put('state_code', autofill.state_code);
  put('opportunity_number', autofill.opportunity_number);
  put('deadline', autofill.deadline);
  put('suggested_project_area', autofill.suggested_project_area);
  put('template_id', autofill.template_id);
  put('data_mode', autofill.data_mode);

  // Copy any other top-level scalar fields the API may add later.
  for (const [k, v] of Object.entries(autofill as Record<string, unknown>)) {
    if (k === 'stats' || k === 'narrative_bullets') continue;
    if (typeof v === 'string' || typeof v === 'number') put(k, v);
  }

  if (autofill.stats) {
    for (const [k, v] of Object.entries(autofill.stats)) {
      put(k, v);
    }
  }

  if (autofill.narrative_bullets?.length) {
    put(
      'narrative_bullets',
      autofill.narrative_bullets.map(b => `- ${b}`).join('\n')
    );
  }

  return vars;
}

export function templateLooksGrantRelated(templateId: string | null | undefined): boolean {
  if (!templateId) return false;
  const id = templateId.toLowerCase();
  return (
    id.startsWith('epa-') ||
    id.includes('iwiwd') ||
    id.includes('grant') ||
    id.includes('sam-gov') ||
    id.includes('grants-gov') ||
    id.includes('nofo') ||
    id.includes('budget') ||
    id.includes('letter-of-commitment')
  );
}

export type ResolveStudioFillOptions = {
  templateId?: string | null;
  stateCode?: string | null;
  districtCode?: string | null;
  /** Jurisdiction pack partner / org name when EPA autofill is unavailable. */
  partnerName?: string | null;
  /** Force EPA autofill fetch even for non-grant templates. */
  forceEpaAutofill?: boolean;
};

/**
 * Build fill vars from active jurisdiction + (for grant templates) EPA IWIWD autofill.
 * Never throws — returns best-effort vars so Studio can still open.
 */
export async function resolveStudioFillVars(
  options: ResolveStudioFillOptions
): Promise<StudioFillVars> {
  const state = (options.stateCode || '').toUpperCase().slice(0, 2) || undefined;
  const district =
    options.districtCode && options.districtCode !== 'program'
      ? options.districtCode
      : undefined;

  const base: StudioFillVars = {};
  if (state) base.state_code = state;
  if (options.partnerName) base.applicant = options.partnerName;

  const wantEpa =
    options.forceEpaAutofill || templateLooksGrantRelated(options.templateId || undefined);
  if (!wantEpa) return base;

  try {
    const autofill = await fetchEpaIwiwdAutofill({
      ...(state ? { state_code: state } : {}),
      ...(district ? { district_code: district } : {}),
    });
    return varsFromEpaIwiwdAutofill(autofill, base);
  } catch {
    return base;
  }
}

export async function fillStudioTemplateMarkdown(
  markdown: string,
  options: ResolveStudioFillOptions
): Promise<string> {
  if (!markdown.includes('{{')) return markdown;
  const vars = await resolveStudioFillVars(options);
  return applyStudioPlaceholders(markdown, vars);
}
