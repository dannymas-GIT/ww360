import type { Ww360TourSlide } from '@/components/ww360/Ww360TourOverlay';

/**
 * Grants Studio guided tour — catalog → eligibility → readiness → Document Studio.
 * Copy targets OWW program partners and utility managers reviewing funding fit.
 */
export function buildGrantsListTourSlides(): Ww360TourSlide[] {
  return [
    {
      id: 'welcome',
      title: 'Welcome to Grants Studio',
      body: 'Browse verified water and wastewater funding programs, see eligibility fit for your scope, and open application packets in Document Studio. This is where deadline pressure and program fit meet your narrative work.',
      tip: 'Reopen this tour any time from How to use this in the header.',
    },
    {
      id: 'deadline-banner',
      title: 'Deadline banners',
      body: 'When a priority NOFO is within 60 days of close, a banner appears here so you can jump straight to that program. EPA IWIWD (EPA-OW-OWM-26-03) is the flagship cycle for One Water Workforce narratives.',
      highlight: '[data-tour="grants-deadline-banner"]',
      tip: 'No banner means nothing urgent in the catalog window — still scan deadlines on each row.',
    },
    {
      id: 'catalog',
      title: 'Funding catalog',
      body: 'Each row is a verified program: funder, level, water focus, status, and deadline. Fit % comes from the eligibility matcher against your scope facts (ACS, DAC, EJScreen, and program-entered facts).',
      highlight: '[data-tour="grants-catalog"]',
      tip: 'Open a program to see rules, NOFO outline, readiness checklist, and Studio autofill.',
    },
    {
      id: 'fit-scores',
      title: 'Eligibility fit scores',
      body: 'Fit % is a weighted match against eligibility rules — not a guarantee of award. Missing facts lower the score and show up on the program detail so you know what to collect next.',
      highlight: '[data-tour="grants-catalog"]',
      tip: 'Use Insights and district metrics to fill gaps before you draft.',
    },
  ];
}

export function buildGrantsDetailTourSlides(opts?: {
  programName?: string;
  isEpa?: boolean;
}): Ww360TourSlide[] {
  const name = opts?.programName?.trim() || 'this program';
  const slides: Ww360TourSlide[] = [
    {
      id: 'welcome-detail',
      title: 'Program detail',
      body: `You are on ${name}. Use this page to confirm eligibility rules, walk the NOFO outline, check readiness, and — for EPA IWIWD — open a Document Studio narrative with autofilled WW360 stats.`,
      tip: 'Reopen this tour any time from How to use this in the header.',
    },
    {
      id: 'actions',
      title: 'Portal links and Studio',
      body: 'Open Grants.gov or the program info page when you need the official NOFO. For EPA IWIWD, Ensure OWW application creates a tracked packet, and Open studio template starts the narrative with WW360 autofill.',
      highlight: '[data-tour="grant-actions"]',
    },
    {
      id: 'eligibility',
      title: 'Eligibility rules',
      body: 'Each rule is a fact the matcher evaluates (operator, value, weight). Reasons explain why the rule matters for fit. Missing facts listed below the rules are the next data to gather before you score high enough to prioritize drafting.',
      highlight: '[data-tour="grant-eligibility"]',
      tip: 'Fact names map to ExternalMetricSnapshot and program facts — not free text.',
    },
    {
      id: 'nofo',
      title: 'NOFO outline',
      body: 'Section order mirrors the funding announcement. Use hints as prompts when you draft in Document Studio so your narrative follows reviewer expectations instead of starting from a blank page.',
      highlight: '[data-tour="grant-nofo"]',
    },
    {
      id: 'readiness',
      title: 'Readiness checklist',
      body: 'Required items block a complete application packet. Work the checklist before you spend hours on narrative polish — attachments and registrations often take longer than writing.',
      highlight: '[data-tour="grant-readiness"]',
      tip: 'Each required item has Open in Studio — use the matching template instead of a blank page.',
    },
  ];

  if (opts?.isEpa) {
    slides.push({
      id: 'autofill',
      title: 'EPA IWIWD autofill',
      body: 'WW360 pulls state and workforce stats into narrative bullets for the IWIWD template. Review live vs sample badges, then open Document Studio to finish the story with your section’s voice.',
      highlight: '[data-tour="grant-autofill"]',
      tip: 'Autofill is a starting draft — always verify numbers against your board materials.',
    });
  }

  slides.push({
    id: 'next',
    title: 'What to do next',
    body: 'Pick a high-fit open program, close missing facts, finish the readiness checklist, then draft in Document Studio. Reopen Grants Studio from Funding whenever a new cycle lands in the catalog.',
    tip: 'You can restart this tour from How to use this.',
  });

  return slides;
}

export const GRANTS_TOUR_DISMISSED_KEY = 'ww360-grants-tour-dismissed';
export const GRANTS_TOUR_STEP_KEY = 'ww360-grants-tour-step';
export const GRANTS_TOUR_EVENT = 'ww360-open-grants-tour';
