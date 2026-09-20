import type { Ww360TourSlide } from '@/components/ww360/Ww360TourOverlay';

/**
 * Insights guided tour — persona lens → six correlations → how to act on a card.
 * Audience: OWW partners (Jenny), state/EPA regulators, and utility planners.
 */
export function buildInsightsTourSlides(stateCode = 'NY'): Ww360TourSlide[] {
  const state = (stateCode || 'NY').toUpperCase().slice(0, 2);
  return [
    {
      id: 'welcome',
      title: 'Welcome to Insights',
      body: `Insights turns ${state} inventory, compliance, roster, and overlay data into correlation cards — so you see where workforce pressure and funding opportunity line up, not just a pile of separate dashboards.`,
      tip: 'Reopen this tour any time from How to use this in the header.',
    },
    {
      id: 'personas',
      title: 'Persona lenses',
      body: 'Jenny (OWW / section partner), Regulator (state / EPA OpCert), and Utility (district planner) reorder and highlight the same six correlations. Switch tabs to see which cards matter most for your role — the underlying facts stay shared.',
      highlight: '[data-tour="insights-personas"]',
      tip: 'District users may only see the Utility lens; partners and national roles see all three.',
    },
    {
      id: 'correlations',
      title: 'Six correlation families',
      body: 'Cards cover compliance vs coverage, grade demand vs certified supply, renewal cliffs, retirement / vacancy horizon, source-water complexity, and a fundable-need overlay (SNC, major POTWs, DAC / MHI / EJ). Preferred cards for your persona rise to the top.',
      highlight: '[data-tour="insights-correlations"]',
      tip: 'Live / mixed / curated badges tell you how much of each card is inventory vs planning estimate.',
    },
    {
      id: 'reading-a-card',
      title: 'How to read a card',
      body: 'Each card has a plain-language summary, optional strength and metrics, notes, and sometimes county detail. Prefer persona-matched cards when they appear — they are the ones tuned for your lens, not a different dataset.',
      highlight: '[data-tour="insights-correlations"]',
      tip: 'Empty cards usually mean overlays or roster feeds still need refresh for this state.',
    },
    {
      id: 'explore-links',
      title: 'Explore into action',
      body: 'When a card offers Explore, it deep-links into Landscape, Grants, Continuity, or a scorecard slice. Use Insights to decide where to look; use those modules to act (invite cohorts, draft NOFO narratives, fill vacancies).',
      highlight: '[data-tour="insights-grants-link"]',
      tip: 'Grants Studio is one hop away when fundable-need or grant-fit cards light up.',
    },
    {
      id: 'next',
      title: 'What to do next',
      body: `Pick the persona that matches today’s meeting, scan the top cards for ${state}, then follow Explore into Landscape or Grants. Come back after roster or overlay refresh — correlations update with the same six families.`,
      tip: 'You can restart this tour from How to use this.',
    },
  ];
}

export const INSIGHTS_TOUR_DISMISSED_KEY = 'ww360-insights-tour-dismissed';
export const INSIGHTS_TOUR_STEP_KEY = 'ww360-insights-tour-step';
export const INSIGHTS_TOUR_EVENT = 'ww360-open-insights-tour';
