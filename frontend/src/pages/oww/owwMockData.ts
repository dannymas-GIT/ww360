/**
 * One Water Workforce (OWW) executive dashboard — sample data.
 *
 * Three sources are blended here, shaped the way the live integrations will
 * deliver them so the UI does not change when real feeds are wired in:
 *
 *  1. Learning Stream (LMS system of record for OWW training) — Event Details,
 *     Registration Data and CE issuance pulled through its form-POST XML APIs.
 *  2. onewaterworkforce.org — member sign-ups, career-pipeline stages, referral
 *     sources and content engagement captured from the public site + job board.
 *  3. Water Workforce 360 — employer-side demand reported by participating New
 *     York utilities (staffing, vacancies, retirements, training needs).
 *
 * Every figure below is illustrative. Replace with API adapters, keep shapes.
 */

export type OwwRegion =
  | 'Long Island'
  | 'New York City'
  | 'Mid-Hudson'
  | 'Capital Region'
  | 'Mohawk Valley'
  | 'Central NY'
  | 'North Country'
  | 'Southern Tier'
  | 'Finger Lakes'
  | 'Western NY';

export const OWW_REGIONS: OwwRegion[] = [
  'Long Island',
  'New York City',
  'Mid-Hudson',
  'Capital Region',
  'Mohawk Valley',
  'Central NY',
  'North Country',
  'Southern Tier',
  'Finger Lakes',
  'Western NY',
];

export interface OwwSourceStatus {
  id: 'learning-stream' | 'oww-web' | 'ww360';
  label: string;
  detail: string;
  lastSyncMinutesAgo: number;
  health: 'ok' | 'degraded' | 'stale';
  recordsToday: number;
}

export const OWW_SOURCES: OwwSourceStatus[] = [
  {
    id: 'learning-stream',
    label: 'Learning Stream',
    detail: 'Event Details · Registration Data · CE issuance (XML API, 60/min)',
    lastSyncMinutesAgo: 12,
    health: 'ok',
    recordsToday: 184,
  },
  {
    id: 'oww-web',
    label: 'onewaterworkforce.org',
    detail: 'Member sign-ups · pipeline stages · job board · page analytics',
    lastSyncMinutesAgo: 41,
    health: 'ok',
    recordsToday: 57,
  },
  {
    id: 'ww360',
    label: 'Water Workforce 360 utilities',
    detail: '27 utilities reporting staffing, vacancies, retirements, training needs',
    lastSyncMinutesAgo: 3,
    health: 'ok',
    recordsToday: 9,
  },
];

/* ------------------------------------------------------------------ */
/* Learning Stream                                                     */
/* ------------------------------------------------------------------ */

export interface LsMonthlyPoint {
  month: string; // short label
  registrations: number;
  attended: number;
  ceHours: number;
  revenue: number; // USD
}

/** Trailing 12 months, Sep 2025 → Aug 2026. */
export const LS_MONTHLY: LsMonthlyPoint[] = [
  { month: 'Sep', registrations: 96, attended: 84, ceHours: 468, revenue: 8940 },
  { month: 'Oct', registrations: 128, attended: 117, ceHours: 702, revenue: 12480 },
  { month: 'Nov', registrations: 141, attended: 126, ceHours: 756, revenue: 13410 },
  { month: 'Dec', registrations: 74, attended: 66, ceHours: 330, revenue: 6270 },
  { month: 'Jan', registrations: 162, attended: 149, ceHours: 894, revenue: 15870 },
  { month: 'Feb', registrations: 187, attended: 171, ceHours: 1026, revenue: 18210 },
  { month: 'Mar', registrations: 214, attended: 196, ceHours: 1176, revenue: 20880 },
  { month: 'Apr', registrations: 203, attended: 189, ceHours: 1134, revenue: 20130 },
  { month: 'May', registrations: 176, attended: 158, ceHours: 948, revenue: 16830 },
  { month: 'Jun', registrations: 158, attended: 143, ceHours: 858, revenue: 15240 },
  { month: 'Jul', registrations: 121, attended: 109, ceHours: 654, revenue: 11610 },
  { month: 'Aug', registrations: 149, attended: 134, ceHours: 804, revenue: 14280 },
];

export interface LsCourseRow {
  id: string;
  course: string;
  grade: string;
  delivery: 'Live online' | 'In person' | 'Hybrid';
  nextSession: string; // ISO date
  seats: number;
  registered: number;
  waitlist: number;
  ceHours: number;
  memberPrice: number;
}

export const LS_UPCOMING_COURSES: LsCourseRow[] = [
  {
    id: 'ls-1042',
    course: 'Distribution System Operations — Grade D Renewal',
    grade: 'D',
    delivery: 'Live online',
    nextSession: '2026-09-24',
    seats: 60,
    registered: 57,
    waitlist: 11,
    ceHours: 6,
    memberPrice: 95,
  },
  {
    id: 'ls-1047',
    course: 'Water Treatment Plant Operations — Grades A & B',
    grade: 'A, B',
    delivery: 'In person',
    nextSession: '2026-10-08',
    seats: 40,
    registered: 31,
    waitlist: 0,
    ceHours: 8,
    memberPrice: 125,
  },
  {
    id: 'ls-1051',
    course: 'Cross-Connection & Backflow Awareness',
    grade: 'All grades',
    delivery: 'Hybrid',
    nextSession: '2026-10-22',
    seats: 45,
    registered: 22,
    waitlist: 0,
    ceHours: 3,
    memberPrice: 75,
  },
  {
    id: 'ls-1056',
    course: 'Emergency Response & Contamination Events',
    grade: 'IA, IB',
    delivery: 'Live online',
    nextSession: '2026-11-05',
    seats: 80,
    registered: 64,
    waitlist: 0,
    ceHours: 4,
    memberPrice: 85,
  },
  {
    id: 'ls-1060',
    course: 'Small System Operations Bootcamp (Grade C / D)',
    grade: 'C, D',
    delivery: 'In person',
    nextSession: '2026-11-18',
    seats: 30,
    registered: 30,
    waitlist: 14,
    ceHours: 12,
    memberPrice: 150,
  },
  {
    id: 'ls-1063',
    course: 'Lead & Copper Rule Improvements — Field Practice',
    grade: 'All grades',
    delivery: 'Live online',
    nextSession: '2026-12-03',
    seats: 120,
    registered: 48,
    waitlist: 0,
    ceHours: 2,
    memberPrice: 45,
  },
];

export interface LsDeliveryMix {
  name: 'Live online' | 'In person' | 'Hybrid';
  value: number; // registrations, trailing 12 mo
}

export const LS_DELIVERY_MIX: LsDeliveryMix[] = [
  { name: 'Live online', value: 1082 },
  { name: 'In person', value: 573 },
  { name: 'Hybrid', value: 154 },
];

export const LS_SUMMARY = {
  registrationsYtd: 1809,
  attendedYtd: 1642,
  ceHoursYtd: 9750,
  attendanceRate: 0.908,
  memberShare: 0.71,
  avgFillRate: 0.79,
  waitlistedSeats: 25,
  revenueYtd: 174150,
  uniqueLearners: 1213,
  uniqueUtilitiesTrained: 168,
};

/* ------------------------------------------------------------------ */
/* onewaterworkforce.org                                               */
/* ------------------------------------------------------------------ */

export interface WebMonthlySignups {
  month: string;
  signups: number;
  jobApplications: number;
}

export const WEB_MONTHLY_SIGNUPS: WebMonthlySignups[] = [
  { month: 'Sep', signups: 38, jobApplications: 21 },
  { month: 'Oct', signups: 52, jobApplications: 29 },
  { month: 'Nov', signups: 47, jobApplications: 33 },
  { month: 'Dec', signups: 29, jobApplications: 18 },
  { month: 'Jan', signups: 66, jobApplications: 41 },
  { month: 'Feb', signups: 74, jobApplications: 46 },
  { month: 'Mar', signups: 91, jobApplications: 58 },
  { month: 'Apr', signups: 83, jobApplications: 62 },
  { month: 'May', signups: 77, jobApplications: 55 },
  { month: 'Jun', signups: 69, jobApplications: 49 },
  { month: 'Jul', signups: 54, jobApplications: 37 },
  { month: 'Aug', signups: 61, jobApplications: 44 },
];

export interface PipelineStage {
  stage: string;
  count: number;
  description: string;
}

/** Candidate journey captured on the website + Learning Stream + WW360 placements. */
export const PIPELINE_STAGES: PipelineStage[] = [
  { stage: 'Aware', count: 2140, description: 'Visited career pages / attended outreach' },
  { stage: 'Engaged', count: 741, description: 'Created an OWW member profile' },
  { stage: 'Exploring', count: 412, description: 'Completed career-path assessment' },
  { stage: 'In training', count: 212, description: 'Enrolled in Learning Stream course track' },
  { stage: 'Exam-ready', count: 118, description: 'Contact hours met · exam scheduled' },
  { stage: 'Employed', count: 31, description: 'Hired at a participating utility' },
];

export interface AudienceSlice {
  name: string;
  value: number;
}

export const WEB_AUDIENCE: AudienceSlice[] = [
  { name: 'Students (HS / BOCES / P-TECH)', value: 236 },
  { name: 'Career changers', value: 198 },
  { name: 'Incumbent operators', value: 171 },
  { name: 'Veterans', value: 64 },
  { name: 'Educators & employers', value: 72 },
];

export interface ReferralSource {
  source: string;
  members: number;
  share: number;
}

export const WEB_REFERRALS: ReferralSource[] = [
  { source: 'Organic search', members: 214, share: 0.29 },
  { source: 'Utility referral', members: 163, share: 0.22 },
  { source: 'BOCES / P-TECH partners', members: 126, share: 0.17 },
  { source: 'NYSAWWA events', members: 104, share: 0.14 },
  { source: 'Social', members: 81, share: 0.11 },
  { source: 'Job fairs & workforce boards', members: 53, share: 0.07 },
];

export interface TopPage {
  path: string;
  title: string;
  views30d: number;
  conversion: number; // to member profile
}

export const WEB_TOP_PAGES: TopPage[] = [
  {
    path: '/careers/operator',
    title: 'Become a water operator',
    views30d: 4812,
    conversion: 0.062,
  },
  {
    path: '/certification',
    title: 'NYS certification explained',
    views30d: 3597,
    conversion: 0.041,
  },
  { path: '/jobs', title: 'Job board', views30d: 3211, conversion: 0.087 },
  { path: '/scholarships', title: 'Scholarships & stipends', views30d: 1874, conversion: 0.055 },
  { path: '/employers', title: 'For utilities', views30d: 1136, conversion: 0.033 },
];

export const WEB_SUMMARY = {
  members: 741,
  newMembers30d: 61,
  activeJobPostings: 44,
  applications30d: 44,
  employerPartners: 27,
  educationPartners: 12,
  upcomingOutreachEvents: 5,
};

/* ------------------------------------------------------------------ */
/* Water Workforce 360 (employer demand)                               */
/* ------------------------------------------------------------------ */

export interface RegionDemandRow {
  region: OwwRegion;
  utilities: number;
  staff: number;
  vacancies: number;
  retirements24mo: number;
  criticalNoSuccessor: number;
  candidates: number; // OWW pipeline (In training + Exam-ready) in region
}

export const WW360_REGION_DEMAND: RegionDemandRow[] = [
  {
    region: 'Long Island',
    utilities: 6,
    staff: 318,
    vacancies: 14,
    retirements24mo: 21,
    criticalNoSuccessor: 9,
    candidates: 46,
  },
  {
    region: 'New York City',
    utilities: 1,
    staff: 146,
    vacancies: 5,
    retirements24mo: 8,
    criticalNoSuccessor: 2,
    candidates: 38,
  },
  {
    region: 'Mid-Hudson',
    utilities: 4,
    staff: 171,
    vacancies: 9,
    retirements24mo: 14,
    criticalNoSuccessor: 6,
    candidates: 27,
  },
  {
    region: 'Capital Region',
    utilities: 3,
    staff: 128,
    vacancies: 6,
    retirements24mo: 11,
    criticalNoSuccessor: 4,
    candidates: 22,
  },
  {
    region: 'Mohawk Valley',
    utilities: 2,
    staff: 54,
    vacancies: 4,
    retirements24mo: 6,
    criticalNoSuccessor: 3,
    candidates: 9,
  },
  {
    region: 'Central NY',
    utilities: 3,
    staff: 117,
    vacancies: 7,
    retirements24mo: 9,
    criticalNoSuccessor: 4,
    candidates: 24,
  },
  {
    region: 'North Country',
    utilities: 2,
    staff: 41,
    vacancies: 5,
    retirements24mo: 5,
    criticalNoSuccessor: 3,
    candidates: 6,
  },
  {
    region: 'Southern Tier',
    utilities: 2,
    staff: 63,
    vacancies: 4,
    retirements24mo: 7,
    criticalNoSuccessor: 2,
    candidates: 14,
  },
  {
    region: 'Finger Lakes',
    utilities: 2,
    staff: 72,
    vacancies: 3,
    retirements24mo: 6,
    criticalNoSuccessor: 2,
    candidates: 19,
  },
  {
    region: 'Western NY',
    utilities: 2,
    staff: 74,
    vacancies: 6,
    retirements24mo: 9,
    criticalNoSuccessor: 2,
    candidates: 25,
  },
];

export interface GradeDemandRow {
  grade: string;
  openings24mo: number;
  pipeline: number;
}

export const WW360_GRADE_DEMAND: GradeDemandRow[] = [
  { grade: 'D', openings24mo: 46, pipeline: 84 },
  { grade: 'C', openings24mo: 31, pipeline: 52 },
  { grade: 'IIA / IIB', openings24mo: 22, pipeline: 41 },
  { grade: 'IA / IB', openings24mo: 27, pipeline: 38 },
  { grade: 'B', openings24mo: 19, pipeline: 24 },
  { grade: 'A', openings24mo: 14, pipeline: 11 },
];

export interface TrainingNeed {
  topic: string;
  utilities: number;
  operators: number;
}

export const WW360_TRAINING_NEEDS: TrainingNeed[] = [
  { topic: 'Lead & Copper Rule Improvements', utilities: 22, operators: 341 },
  { topic: 'SCADA & cybersecurity basics', utilities: 19, operators: 286 },
  { topic: 'Grade C → B advancement prep', utilities: 15, operators: 97 },
  { topic: 'Cross-connection control', utilities: 14, operators: 212 },
  { topic: 'Supervisory / lead operator skills', utilities: 12, operators: 74 },
  { topic: 'PFAS treatment operations', utilities: 11, operators: 158 },
];

export const WW360_SUMMARY = {
  utilitiesEnrolled: 27,
  utilitiesTarget: 40,
  utilitiesConsentedToShare: 19,
  smallSystems: 15,
  staffCovered: 1184,
  vacancies: 63,
  retirements12mo: 48,
  retirements24mo: 96,
  retirements2to5yr: 141,
  criticalNoSuccessor: 37,
  avgTimeToFillDays: 127,
};

/* ------------------------------------------------------------------ */
/* EPA Area 3 program measures                                         */
/* ------------------------------------------------------------------ */

export interface ProgramMeasure {
  id: string;
  label: string;
  task: string;
  target: number;
  actual: number;
  unit?: string;
}

export const EPA_MEASURES: ProgramMeasure[] = [
  {
    id: 'enrolled',
    label: 'Individuals enrolled in OWW pathway',
    task: 'Task 1',
    target: 300,
    actual: 212,
  },
  {
    id: 'utilities',
    label: 'Utilities reporting in Water Workforce 360',
    task: 'Task 2',
    target: 40,
    actual: 27,
  },
  {
    id: 'referrals',
    label: 'Referrals into Learning Stream training',
    task: 'Task 3',
    target: 150,
    actual: 98,
  },
  {
    id: 'ce-hours',
    label: 'Contact hours delivered',
    task: 'Task 3',
    target: 2500,
    actual: 1930,
    unit: 'hrs',
  },
  {
    id: 'placements',
    label: 'Employment connections at utilities',
    task: 'Task 4',
    target: 60,
    actual: 31,
  },
  {
    id: 'collab',
    label: 'Regional collaborations formalized',
    task: 'Task 1',
    target: 10,
    actual: 7,
  },
];

export const EPA_REPORTING = {
  period: 'FY26 Q4 (Jul – Sep 2026)',
  dueDate: '2026-10-30',
  readiness: 0.82,
  openItems: [
    'Utility consent confirmations (8 pending)',
    'Q4 Learning Stream attendance reconciliation',
  ],
};

/* ------------------------------------------------------------------ */
/* Insights                                                            */
/* ------------------------------------------------------------------ */

export interface OwwInsight {
  id: string;
  severity: 'high' | 'medium' | 'info';
  title: string;
  body: string;
  action: string;
  sources: Array<OwwSourceStatus['id']>;
}

export const OWW_INSIGHTS: OwwInsight[] = [
  {
    id: 'li-grade-d',
    severity: 'high',
    title: 'Long Island Grade D demand outpaces the fall calendar',
    body: '21 anticipated retirements and 14 open seats across 6 Long Island utilities in the next 24 months. The Grade D renewal on Sep 24 is 95% full with 11 waitlisted — a second Long Island section would clear the waitlist and seat 20 more candidates before renewal windows close.',
    action: 'Add Grade D section (Hauppauge, Oct)',
    sources: ['ww360', 'learning-stream'],
  },
  {
    id: 'north-country',
    severity: 'high',
    title: 'North Country: 5 vacancies, 6 candidates in pipeline',
    body: 'Smallest bench in the state. Two systems serve under 3,300 people each and report no successor for their chief operator. Candidates are early-stage (Exploring). Consider a hybrid Small System Bootcamp with travel stipends.',
    action: 'Schedule regional bootcamp + stipend',
    sources: ['ww360', 'oww-web'],
  },
  {
    id: 'lcri',
    severity: 'medium',
    title: 'Lead & Copper Rule Improvements is the #1 requested topic',
    body: '22 of 27 utilities flagged LCRI field practice for 341 operators. The Dec 3 live-online session has 72 seats open. A utility-referral email through onewaterworkforce.org historically converts at 8.7%.',
    action: 'Send utility referral campaign',
    sources: ['ww360', 'learning-stream', 'oww-web'],
  },
  {
    id: 'placements',
    severity: 'info',
    title: 'Employment connections tracking to 52% of EPA target',
    body: '31 of 60 placements with 118 candidates exam-ready. Matching exam-ready candidates against the 63 open positions by region would accelerate Q4 numbers — 46 Long Island candidates alone map to 14 open seats.',
    action: 'Open candidate ↔ vacancy matching',
    sources: ['ww360', 'oww-web'],
  },
];

/* ------------------------------------------------------------------ */
/* Derived helpers                                                     */
/* ------------------------------------------------------------------ */

export function regionGap(row: RegionDemandRow): number {
  // Positive = more openings than candidates (supply gap).
  return row.vacancies + row.retirements24mo - row.candidates;
}

export function regionRisk(row: RegionDemandRow): 'critical' | 'elevated' | 'watch' | 'healthy' {
  const gap = regionGap(row);
  const successorRatio = row.criticalNoSuccessor / Math.max(1, row.utilities);
  if (gap > 8 || successorRatio >= 1.5) return 'critical';
  if (gap > 0 || successorRatio >= 1) return 'elevated';
  if (gap > -10) return 'watch';
  return 'healthy';
}

export {
  formatCompact,
  formatPct,
  formatUsd,
  formatShortDate,
} from '@/lib/format';
