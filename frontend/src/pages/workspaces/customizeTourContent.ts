import type { Ww360TourSlide } from '@/components/ww360/Ww360TourOverlay';

/** Tutorial: identify your KPIs and match them to home-screen panels (building blocks). */
export function buildCustomizeHomeTourSlides(): Ww360TourSlide[] {
  return [
    {
      id: 'welcome',
      title: 'Customize your home',
      body: 'Your home screen is made of building blocks we call panels — each one shows numbers, charts, or tools for your role. You choose which panels appear and in what order. Your choices are saved for the next visit.',
      tip: 'We avoid jargon like “widgets.” Think of panels as sections on a one-page briefing.',
    },
    {
      id: 'identify-kpis',
      title: 'Step 1 — Identify your KPIs',
      body: 'Ask: What must I see every morning? What would I show a board, primacy partner, or utility superintendent in 30 seconds? Write 3–5 measures (for example: projected openings, CEU renewals in 90 days, systems in SNC, succession readiness).',
      tip: 'Prefer measures you can explain and that have a clear source — live public data or your program records.',
      highlight: '[data-tour="customize-kpi-guide"]',
    },
    {
      id: 'match-panels',
      title: 'Step 2 — Match KPIs to panels',
      body: 'Headline numbers hold your top 3–4 measures. Charts fit comparisons and trends. Continuity and OpCert panels match workforce and certification KPIs. Federal job openings pair with “demand for operators.” Document Studio is for reporting, not a KPI itself.',
      tip: 'Each panel in the library lists “Good for these KPIs” hints — use those as a checklist.',
      highlight: '[data-tour="customize-foundry"]',
    },
    {
      id: 'foundry',
      title: 'The panel library',
      body: 'Turn panels on or off, move them up or down, and choose full-width or half-width. Only panels for your role appear in the library. Changes apply to your home after you save.',
      highlight: '[data-tour="customize-foundry"]',
    },
    {
      id: 'save',
      title: 'Save for next time',
      body: 'Save writes your layout to the database under your account (and role profile). Preview mode cannot save — exit preview or use Act as if you need to edit as an admin. Reset restores the role default.',
      highlight: '[data-tour="customize-save"]',
      tip: 'Kitchen Sink still controls the full tool menu; Customize controls what sits on your home.',
    },
  ];
}

export const CUSTOMIZE_TOUR_DISMISSED_KEY = 'ww360-customize-home-dismissed';
export const CUSTOMIZE_TOUR_STEP_KEY = 'ww360-customize-home-step';
export const CUSTOMIZE_TOUR_EVENT = 'ww360-open-customize-tour';
