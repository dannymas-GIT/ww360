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
    body: 'This is the executive view of the whole pipeline — from a student discovering water careers on onewaterworkforce.org, through Learning Stream training, to a hire at a New York utility. Three sources feed it; you read one screen.',
    tip: 'You can reopen this tour any time from the Tour button in the header.',
  },
  {
    id: 'sources',
    title: 'Three live sources, one picture',
    body: 'Learning Stream stays your LMS system of record. The website keeps capturing members. Water Workforce 360 adds the employer side — vacancies, retirements and training needs reported by utilities. The strip shows when each last synced.',
    highlight: '[data-tour="sources"]',
  },
  {
    id: 'kpis',
    title: 'The six numbers that matter',
    body: 'Members, utilities enrolled, contact hours delivered, exam-ready candidates, anticipated retirements and employment connections. Each card carries its trend and the EPA target it rolls up to.',
    highlight: '[data-tour="kpis"]',
    tip: 'Hover a card to see which source it comes from.',
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
    body: 'Every region with utilities enrolled, ranked by supply gap and critical roles without a named successor. Small systems are flagged so rural needs are not lost in statewide totals.',
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
    body: 'Where the three sources disagree or line up, the dashboard says so in plain language and proposes a next step — add a course section, launch a referral campaign, open candidate matching.',
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
