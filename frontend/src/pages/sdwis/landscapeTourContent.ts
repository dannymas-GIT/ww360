import type { Ww360TourSlide } from '@/components/ww360/Ww360TourOverlay';

/**
 * Jenny / OWW landscape tour — why each block matters for workforce programming,
 * and where “grade demand” actually comes from.
 */
export function buildLandscapeTourSlides(stateName = 'New York'): Ww360TourSlide[] {
  return [
    {
      id: 'welcome',
      title: 'Why this landscape exists',
      body: `This is not EPA homework. It is a ${stateName} map of where water systems are under compliance pressure and what operator capacity that pressure likely needs — so your section can aim training, outreach, and recruitment instead of guessing.`,
      tip: 'If a number would not change who you call or where you run a cohort, it does not belong on your daily home.',
    },
    {
      id: 'live-vs-estimate',
      title: 'Live inventory vs estimates',
      body: 'Active CWS, population, health flags, and SNC come from live EPA SDWIS / ECHO. Size tiers are counted from each system’s population served. Grade demand is different: it is a planning estimate derived from those size tiers — not a live list of certified operators from NYSDOH.',
      tip: 'Live badge on the page means the system inventory is live. Grade demand is always an estimate until a public OpCert roster feed is linked.',
      highlight: '[data-tour="landscape-kpis"]',
    },
    {
      id: 'kpis',
      title: 'Top numbers — what they buy you',
      body: 'Health-based violations and Serious/SNC flag systems under stress — often overtime, retirements, and hard-to-fill seats. Population and CWS counts are board context; use them with member coverage below, not alone.',
      highlight: '[data-tour="landscape-kpis"]',
    },
    {
      id: 'member-coverage',
      title: 'Member coverage',
      body: 'When this says 0 utilities, the map is still the federal inventory — not yet your member story. Linking PWSIDs to member utilities turns pressure into “our systems in trouble,” which is where OWW value shows up.',
      highlight: '[data-tour="landscape-coverage"]',
      tip: 'Use Admin → PWSID links (or ask staff) to connect members.',
    },
    {
      id: 'size-tiers',
      title: 'Size tiers',
      body: 'Most systems are very small. Small systems struggle most with succession and entry-level certification. That shapes program design — regional training, shared operators, exam prep — more than a statewide average ever will.',
      highlight: '[data-tour="size-tiers"]',
    },
    {
      id: 'grade-demand',
      title: 'Grade demand estimate',
      body: 'We map population size bands to a simple Grade D→A heuristic (e.g. very small → Grade D seat). Use it to ask “do we need more Grade D bootcamps or Grade C pathways?” Pair with Continuity vacancies and CEU cliffs — do not treat these counts as licensed operators on payroll.',
      highlight: '[data-tour="grade-demand"]',
      tip: 'Source: live SDWIS population → size tier → planning heuristic. Not NYSDOH OpCert roster.',
    },
    {
      id: 'county-pressure',
      title: 'Compliance pressure by county',
      body: 'Your targeting list: which counties to visit, which utilities to invite, where Learning Stream seats should go first. Filter by economic region or county when you want to zero in for a board trip or cohort.',
      highlight: '[data-tour="county-pressure"]',
    },
    {
      id: 'region-filter',
      title: 'Zero in on an area',
      body: 'Use Economic region (Capital, Finger Lakes, Western NY, …) to focus a section outreach geography, or County for a single county. Both filters use live SDWIS county names.',
      highlight: '[data-tour="landscape-region-filter"]',
      tip: 'Pick an economic region (e.g. Finger Lakes) to limit the table to its counties, then drill into one county.',
    },
  ];
}

export const LANDSCAPE_TOUR_DISMISSED_KEY = 'ww360-landscape-tour-dismissed';
export const LANDSCAPE_TOUR_STEP_KEY = 'ww360-landscape-tour-step';
export const LANDSCAPE_TOUR_EVENT = 'ww360-open-landscape-tour';
