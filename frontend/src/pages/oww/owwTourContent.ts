export interface OwwTourSlide {
  id: string;
  title: string;
  body: string;
  tip?: string;
  /** CSS selector — usually a `[data-tour="…"]` hook on the dashboard. */
  highlight?: string;
}

export const OWW_TOUR_DISMISSED_KEY = 'ww360-oww-tour-dismissed';
export const OWW_TOUR_STEP_KEY = 'ww360-oww-tour-step';

export const OWW_TOUR_SLIDES: OwwTourSlide[] = [
  {
    id: 'welcome',
    title: 'Welcome to your One Water Workforce workspace',
    body: 'This is the executive view of the whole pipeline — from a student discovering water careers on onewaterworkforce.org, through Learning Stream training, to a hire at a New York utility — plus the statewide EPA compliance landscape. Four sources feed it; you read one screen.',
    tip: 'You can reopen this tour any time from the Tour button in the header.',
  },
  {
    id: 'sources',
    title: 'Four sources, one picture',
    body: 'EPA SDWIS / ECHO is the live federal inventory of New York community water systems — compliance, population served, and county pressure. Learning Stream is the LMS system of record for training. onewaterworkforce.org captures members and the career pipeline. Water Workforce 360 adds the employer side — vacancies, retirements, and training needs from utilities. The strip shows which feeds are live today and which still show sample figures until connected.',
    highlight: '[data-tour="sources"]',
    tip: 'SDWIS refreshes from Admin → Settings (or the nightly job). Live badges mean federal data; Sample badges mean program metrics awaiting their API.',
  },
  {
    id: 'kpis',
    title: 'The numbers that matter',
    body: 'Top cards mix live SDWIS counts (active CWS, population, health violations, SNC) with program metrics (members, contact hours, retirements, placements). Each card is tagged Live or Sample and shows which source it comes from.',
    highlight: '[data-tour="kpis"]',
    tip: 'Hover a card to see which source it comes from.',
  },
  {
    id: 'sdwis-landscape',
    title: 'Water system landscape (SDWIS)',
    body: 'Safe Drinking Water Information System (SDWIS) is EPA’s national database of public water systems. Here you see New York’s community water systems: how many are active, who they serve, health-based violations, and serious non-compliance — the compliance backdrop for workforce planning.',
    highlight: '[data-tour="sdwis-landscape"]',
    tip: 'Link utility PWSIDs under Admin → PWSID links to build a member watchlist from this landscape.',
  },
  {
    id: 'pipeline',
    title: 'Candidate pipeline',
    body: 'How many people are at each stage between awareness and employment. Drop-offs between stages tell you where outreach, scholarships or exam prep would move the most people.',
    highlight: '[data-tour="pipeline"]',
  },
  {
    id: 'supply-demand',
    title: 'Supply vs. demand by region',
    body: 'Openings utilities expect in 24 months against candidates in training in the same region. Red gaps are where a cohort or a bootcamp should be scheduled; green means the bench is deeper than demand.',
    highlight: '[data-tour="supply-demand"]',
  },
  {
    id: 'learning-stream',
    title: 'Learning Stream at a glance',
    body: 'Monthly registrations, attendance and CE hours, plus fill rate and waitlists on the upcoming calendar. Waitlists are demand you have not seated yet.',
    highlight: '[data-tour="learning-stream"]',
  },
  {
    id: 'regions',
    title: 'Regional workforce risk',
    body: 'Every region with utilities enrolled, ranked by supply gap and critical roles without a named successor. Small systems are flagged so rural needs are not lost in statewide totals. Above it, live county compliance pressure from SDWIS shows where federal compliance load is heaviest.',
    highlight: '[data-tour="regions"]',
  },
  {
    id: 'epa',
    title: 'EPA Area 3 measures',
    body: 'Progress against each grant output, mapped to Tasks 1–4, with reporting-period readiness. The quarterly package exports from here.',
    highlight: '[data-tour="epa"]',
  },
  {
    id: 'insights',
    title: 'Recommended actions',
    body: 'Where the four sources disagree or line up, the dashboard says so in plain language and proposes a next step — add a course section, launch a referral campaign, open candidate matching, or dig into a high-pressure SDWIS county.',
    highlight: '[data-tour="insights"]',
  },
  {
    id: 'access',
    title: 'Your platform access',
    body: 'You hold platform privileges scoped to the workforce program: statewide aggregates, Learning Stream mirror, pipeline, grant exports and OWW staff management. Utility-level detail follows each utility’s consent, and utility records stay utility-owned.',
    highlight: '[data-tour="access"]',
    tip: 'That is the trust model utilities sign up for — worth mentioning when you invite the next one.',
  },
];
