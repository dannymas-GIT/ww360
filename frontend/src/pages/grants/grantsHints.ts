/**
 * Hover-hint copy for Grants Studio. Keys map to readiness checklist ids and
 * a few page-level terms (data badges, fit score, IWIWD).
 */

export const GRANTS_HINTS_STORAGE_KEY = 'ww360-grants-hints-enabled';

export const GRANTS_READINESS_HINTS: Record<string, string> = {
  sam_gov:
    'SAM.gov is the federal System for Award Management. Your organization must have an active Unique Entity ID (UEI) before EPA can make an award. Keep a screenshot of Active status with the packet.',
  grants_gov:
    'Grants.gov is where the package is assembled and submitted. An Authorized Organization Representative (AOR) must be assigned and available on deadline day to hit Submit.',
  sf424:
    'SF-424 is the Application for Federal Assistance; SF-424A is the budget information form. Dollar totals here must match the budget narrative before upload.',
  narrative:
    'The NOFO project narrative (max 20 pages) — Cover through Budget Narrative. Section order follows NOFO §4.B so reviewers can score against the published outline.',
  letters:
    'Signed letters from partner utilities or training providers stating what they will contribute (seats, instructors, facilities). Attach PDFs to the Grants.gov workspace.',
  budget:
    'Line-item justification for each SF-424A object class (personnel, fringe, travel, contracts, other). Totals must tie to SF-424A before you submit.',
  // State / other catalog ids used elsewhere
  eng_report:
    'Engineering report documenting project need, alternatives, and cost — usually required for NYS EFC capital grants.',
  seqr:
    'State Environmental Quality Review / SHPO clearance when the project triggers environmental or historic review.',
  smart_growth:
    'NYS Smart Growth assessment confirming the project aligns with growth and infrastructure policy.',
  mwbe:
    'Minority/Women-Owned Business Enterprise and Equal Employment Opportunity plan required by many NYS funders.',
  hardship:
    'Income survey or hardship documentation used when seeking an enhanced state grant share.',
};

export const GRANTS_PAGE_HINTS = {
  fitScore:
    'Eligibility fit is a weighted match against catalog rules and your scope facts — not a guarantee of award. Missing facts lower the score and show on the program detail.',
  liveData:
    'Live data means this block is reading current WW360 / federal feeds. Sample or mixed badges mean some figures are planning estimates or placeholders.',
  mixedData:
    'Mixed fidelity: some numbers are live (for example SDWIS inventory) while program metrics may still be sample until your district facts are complete.',
  iwiwd:
    'EPA Innovative Water Infrastructure Workforce Development (IWIWD) — opportunity EPA-OW-OWM-26-03. The Studio template autofills WW360 workforce and compliance stats into the narrative shell.',
  openInStudio:
    'Opens Document Studio with the matching starter template for this checklist item so you are not drafting from a blank page.',
  eligibility:
    'Each rule is a fact the matcher evaluates (operator, value, weight). Collect missing facts before you prioritize narrative polish.',
  nofo:
    'Notice of Funding Opportunity outline — section order mirrors the announcement. Use hints as prompts when drafting in Studio.',
} as const;

export function readinessHintFor(id: string, label?: string): string | undefined {
  if (GRANTS_READINESS_HINTS[id]) return GRANTS_READINESS_HINTS[id];
  const hay = `${id} ${label || ''}`.toLowerCase();
  if (hay.includes('sam')) return GRANTS_READINESS_HINTS.sam_gov;
  if (hay.includes('grants.gov') || hay.includes('aor') || hay.includes('authorized')) {
    return GRANTS_READINESS_HINTS.grants_gov;
  }
  if (hay.includes('sf-424') || hay.includes('sf424')) return GRANTS_READINESS_HINTS.sf424;
  if (hay.includes('narrative') || hay.includes('nofo')) return GRANTS_READINESS_HINTS.narrative;
  if (hay.includes('letter') || hay.includes('partner')) return GRANTS_READINESS_HINTS.letters;
  if (hay.includes('budget')) return GRANTS_READINESS_HINTS.budget;
  return undefined;
}
