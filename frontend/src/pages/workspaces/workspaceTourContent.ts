import type { Ww360TourSlide } from '@/components/ww360/Ww360TourOverlay';
import type { WorkspaceProfile } from '@/utils/workspaceProfile';

const PROFILE_LABELS: Record<WorkspaceProfile, string> = {
  national: 'National leadership',
  regional: 'EPA regional coordinator',
  state_partner: 'State section partner',
  regulator: 'State regulator',
  utility: 'Utility workforce',
};

const MCWA_SUPERINTENDENT_SLIDES: Ww360TourSlide[] = [
  {
    id: 'role',
    title: 'Superintendent — district admin',
    body: 'You own policy, user access, and document approvals for Monroe County Water Authority. Continuity and the Succession Binder are yours to author or delegate to your workforce manager.',
    tip: 'Use Add users and the review queue before publishing district documents.',
  },
  {
    id: 'continuity',
    title: 'Continuity & Succession Binder',
    body: 'Open Continuity for readiness scorecards, roster coverage, and succession bench. Create or open the Succession Binder from the Continuity hub — your manager can maintain it day to day.',
    highlight: '[data-tour="kitchen-sink-toggle"]',
  },
  {
    id: 'studio',
    title: 'Document Studio — district library',
    body: 'Utility binders and SOPs live in your district library (not the state program library). Approve published docs your manager submits, or open binders yourself from Continuity.',
  },
  {
    id: 'preview',
    title: 'Walkthrough with Jenny',
    body: 'Exit preview anytime to return to the section partner home. Next, preview the Workforce manager to see day-to-day binder and CEU pack maintenance.',
  },
];

const MCWA_MANAGER_SLIDES: Ww360TourSlide[] = [
  {
    id: 'role',
    title: 'Workforce manager',
    body: 'You report to the Superintendent and run day-to-day Continuity — roster, coverage, CEU packs, and the Succession Binder.',
  },
  {
    id: 'binder',
    title: 'Succession Binder & CEU Tracker',
    body: 'Create the Succession Binder once, refresh dated CEU Tracker packs each cycle, then transfer custody to your utility cloud when ready.',
  },
  {
    id: 'operators',
    title: 'Assign work to operators',
    body: 'Documentation tasks and training signups flow to plant operators. Their CEU hours feed your tracker.',
    highlight: '[data-tour="workspace-kpis"]',
  },
  {
    id: 'preview',
    title: 'Next: Operator view',
    body: 'Preview the Plant operator to see CEU logging and assigned tasks — no binder authoring from that role.',
  },
];

const MCWA_OPERATOR_SLIDES: Ww360TourSlide[] = [
  {
    id: 'role',
    title: 'Plant operator',
    body: 'You report to the Workforce manager. Your job is CEU hours, training signups, and completing assigned documentation — not binder authoring.',
  },
  {
    id: 'ceu',
    title: 'CEU & Training',
    body: 'Log contact hours, track renewal progress, and enroll in district training from CEU & Training in the sidebar.',
  },
  {
    id: 'tasks',
    title: 'Documentation tasks',
    body: 'Complete tutorials and SOP assignments from your operator home. Submissions go to your manager for review.',
    highlight: '[data-landing="operator"]',
  },
  {
    id: 'preview',
    title: 'Exit preview',
    body: 'When finished, exit preview to return Jenny to her section partner home — program Studio and landscape, not utility binders.',
  },
];

const SECTION_PARTNER_SLIDES: Ww360TourSlide[] = [
  {
    id: 'role',
    title: 'Section partner home',
    body: 'You oversee adoption across member utilities — landscape, program Document Studio, and read-only Continuity peek. You do not author utility Succession Binders in your own session.',
  },
  {
    id: 'walkthrough',
    title: 'Utility roles walkthrough',
    body: 'Use View as role to preview Monroe County Water Authority as Superintendent, Manager, and Operator — the same utility, three perspectives.',
    highlight: '[data-tour="kitchen-sink-toggle"]',
  },
  {
    id: 'continuity',
    title: 'Continuity oversight',
    body: 'Pick a member utility in Continuity to review scorecards. Binders are created by that utility’s manager or superintendent — open them read-only with the district scope.',
  },
  {
    id: 'studio',
    title: 'Program Document Studio',
    body: 'Your default Studio library is the state program (program:NY). Utility binders open only under that district’s library when previewing a utility role.',
  },
];

function defaultSlides(profile: WorkspaceProfile, personaKey?: string | null): Ww360TourSlide[] {
  const label = PROFILE_LABELS[profile];
  const personaNote = personaKey ? ` (${personaKey})` : '';

  return [
    {
      id: 'welcome',
      title: `Welcome to your ${label} workspace${personaNote}`,
      body: 'This simplified view highlights the KPIs, charts, and actions most relevant to your role. Every metric is tagged Live or Sample (illustrative) with its source.',
      tip: 'Use Kitchen Sink in the sidebar to reveal the full navigation and tools.',
    },
    {
      id: 'nav',
      title: 'Your navigation',
      body: 'With Kitchen Sink off, you see Today, key workspace links, and Document Studio. Turn Kitchen Sink on to expose Water Systems, Reporting, Admin, and the full program tool set.',
      highlight: '[data-tour="kitchen-sink-toggle"]',
    },
    {
      id: 'kpis',
      title: 'Headline KPIs',
      body: 'Top cards mix live public adapters (SDWIS, BLS) with illustrative demo packs when live data is empty or when illustrative better carries the story.',
      highlight: '[data-tour="workspace-kpis"]',
      tip: 'Check the badge on each tile: Live, Sample, or Mixed.',
    },
    {
      id: 'charts',
      title: 'Charts & trends',
      body: 'Role-flavored charts show primacy comparison, renewal cliffs, regional gaps, or utility CEU status depending on your workspace.',
      highlight: '[data-tour="workspace-charts"]',
    },
    {
      id: 'reporting',
      title: 'Reporting & export',
      body:
        profile === 'national' || profile === 'regional'
          ? 'Open US overview for state scorecards and KPI brief PDF export from the national layer.'
          : profile === 'regulator'
            ? 'Use Document Studio for Nine Baseline Standards and OpCert annual report templates.'
            : 'Export grant packages and program reports from the executive dashboard when Kitchen Sink is on.',
      highlight: '[data-tour="workspace-actions"]',
    },
    {
      id: 'customize',
      title: 'Customize your home',
      body: 'Open Customize home in the sidebar to pick panels from the library, match them to your KPIs, and save the layout for your next visit.',
      highlight: '[data-tour="customize-home-btn"]',
      tip: 'Start the customize tour from that dialog for a guided walkthrough.',
    },
    {
      id: 'jobs',
      title: 'Federal job openings',
      body: 'Live USAJOBS announcements for water and wastewater operator roles — available to every signed-in user, not just national personas.',
      highlight: '[data-tour="federal-jobs"]',
      tip: 'Municipal utility jobs are usually on GovernmentJobs.com or state boards; this panel is federal only.',
    },
    {
      id: 'studio',
      title: 'Document Studio',
      body: 'Every role has access to Document Studio — author, publish, and connect Microsoft or Google libraries for program documents.',
      tip: 'Open Document Studio from the sidebar or the action bar below the charts.',
    },
  ];
}

export function buildWorkspaceTourSlides(
  profile: WorkspaceProfile,
  personaKey?: string | null
): Ww360TourSlide[] {
  if (personaKey === 'mcwa-superintendent') return MCWA_SUPERINTENDENT_SLIDES;
  if (personaKey === 'mcwa-chief-operator') return MCWA_MANAGER_SLIDES;
  if (personaKey === 'mcwa-operator-1') return MCWA_OPERATOR_SLIDES;
  if (profile === 'state_partner' && !personaKey) return SECTION_PARTNER_SLIDES;
  return defaultSlides(profile, personaKey);
}
