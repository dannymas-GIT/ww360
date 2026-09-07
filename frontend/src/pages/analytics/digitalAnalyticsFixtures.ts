/**
 * Rich illustrative GA4 + SEO datasets for Jenny's Digital reach walkthrough.
 * Sep 2025 – Aug 2026 program narrative. Live adapters replace these constants later.
 */

import type {
  DigitalInsight,
  DigitalPropertyId,
  DigitalPropertyReport,
  DigitalRange,
  Ga4Block,
  SeoBlock,
} from './digitalAnalyticsTypes';

const MONTH_LABELS = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/** Expand monthly totals into daily series (deterministic spread). */
function expandMonthlyToDaily(
  monthly: number[],
  startYear = 2025,
  startMonth = 8
): { date: string; value: number }[] {
  const out: { date: string; value: number }[] = [];
  monthly.forEach((total, i) => {
    const month = (startMonth + i) % 12;
    const year = startYear + Math.floor((startMonth + i) / 12);
    const dim = daysInMonth(year, month);
    let remaining = total;
    for (let d = 1; d <= dim; d += 1) {
      const left = dim - d + 1;
      const v = d === dim ? remaining : Math.max(0, Math.round(remaining / left + (d % 3) - 1));
      remaining -= v;
      const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      out.push({ date, value: Math.max(0, v) });
    }
  });
  return out;
}

function sliceByRange<T extends { date: string }>(rows: T[], range: DigitalRange): T[] {
  if (range === '12mo') return rows;
  const days = range === '30d' ? 30 : 92;
  return rows.slice(-days);
}

function sumDaily(rows: { value: number }[]): number {
  return rows.reduce((s, r) => s + r.value, 0);
}

/* ------------------------------------------------------------------ */
/* WW360 (self)                                                        */
/* ------------------------------------------------------------------ */

const WW360_SESSIONS_MONTHLY = [412, 468, 521, 389, 612, 704, 798, 756, 689, 634, 578, 647];
const WW360_ORGANIC_MONTHLY = [890, 1020, 1180, 760, 1340, 1520, 1710, 1640, 1480, 1320, 1190, 1380];

const WW360_GA_BASE: Ga4Block = {
  summary: {
    sessions: 7208,
    users: 4891,
    newUsers: 3124,
    pageviews: 28440,
    engagementRate: 0.68,
    avgSessionDurationSec: 186,
    conversions: 94,
    bounceRate: 0.34,
  },
  daily: [],
  channels: [
    { channel: 'Direct', sessions: 2162, users: 1840, conversions: 41 },
    { channel: 'Organic Search', sessions: 1874, users: 1520, conversions: 22 },
    { channel: 'Referral', sessions: 1296, users: 980, conversions: 18 },
    { channel: 'Organic Social', sessions: 864, users: 710, conversions: 8 },
    { channel: 'Email', sessions: 612, users: 520, conversions: 5 },
  ],
  topPages: [
    { pagePath: '/', title: 'Landing — Workforce 360', pageviews: 8420, sessions: 6120, bounceRate: 0.28 },
    { pagePath: '/dashboard', title: 'Executive overview', pageviews: 4680, sessions: 2140, bounceRate: 0.12 },
    { pagePath: '/continuity', title: 'Continuity workspace', pageviews: 3920, sessions: 1680, bounceRate: 0.15 },
    { pagePath: '/water-systems', title: 'SDWIS landscape', pageviews: 3540, sessions: 1420, bounceRate: 0.18 },
    { pagePath: '/studio', title: 'Document Studio', pageviews: 2180, sessions: 890, bounceRate: 0.22 },
    { pagePath: '/login', title: 'Sign in', pageviews: 1240, sessions: 980, bounceRate: 0.41 },
  ],
  geo: [
    { region: 'New York', sessions: 4980, users: 3410 },
    { region: 'New Jersey', sessions: 412, users: 298 },
    { region: 'Connecticut', sessions: 286, users: 204 },
    { region: 'Pennsylvania', sessions: 248, users: 176 },
    { region: 'Massachusetts', sessions: 198, users: 142 },
    { region: 'Florida', sessions: 124, users: 98 },
  ],
  devices: [
    { device: 'Desktop', sessions: 4680, share: 0.649 },
    { device: 'Mobile', sessions: 1980, share: 0.275 },
    { device: 'Tablet', sessions: 548, share: 0.076 },
  ],
  conversions: [
    { event: 'access_request_submitted', count: 47, rate: 0.0065 },
    { event: 'tour_completed', count: 312, rate: 0.043 },
    { event: 'sdwis_viewed', count: 1420, rate: 0.197 },
    { event: 'studio_published', count: 86, rate: 0.012 },
  ],
};

const WW360_SEO_BASE: SeoBlock = {
  summary: { clicks: 1842, impressions: 48200, ctr: 0.0382, avgPosition: 14.6 },
  daily: [],
  topQueries: [
    { query: 'water workforce 360', clicks: 186, impressions: 4200, ctr: 0.044, position: 4.2, branded: true },
    { query: 'NY water utility succession planning', clicks: 142, impressions: 6100, ctr: 0.023, position: 8.8, branded: false },
    { query: 'water operator shortage New York', clicks: 118, impressions: 8900, ctr: 0.013, position: 11.4, branded: false },
    { query: 'workforce continuity water utility', clicks: 96, impressions: 3200, ctr: 0.03, position: 6.1, branded: false },
    { query: 'EPA SDWIS workforce', clicks: 74, impressions: 2100, ctr: 0.035, position: 9.2, branded: false },
    { query: 'water operator retirement planning', clicks: 68, impressions: 5400, ctr: 0.013, position: 15.8, branded: false },
  ],
  topLandings: [
    { page: 'https://ww360.aquasafe-solutions.us/', title: 'Workforce 360 home', clicks: 920, impressions: 18400, ctr: 0.05, position: 8.4 },
    { page: 'https://ww360.aquasafe-solutions.us/login', title: 'Sign in', clicks: 210, impressions: 4200, ctr: 0.05, position: 6.2 },
    { page: 'https://waterworkforce360.org/', title: 'Production home (pending DNS)', clicks: 48, impressions: 980, ctr: 0.049, position: 12.1 },
  ],
  devices: [
    { device: 'Desktop', clicks: 1210, impressions: 28400 },
    { device: 'Mobile', clicks: 498, impressions: 16200 },
    { device: 'Tablet', clicks: 134, impressions: 3600 },
  ],
};

const WW360_INSIGHTS: DigitalInsight[] = [
  {
    id: 'ww360-sdwis',
    severity: 'high',
    title: 'SDWIS landscape drives 19% of in-app engagement',
    body: '1,420 sdwis_viewed events trail only the executive dashboard. Partners who land from organic “water operator shortage” queries spend 2.4× longer on /water-systems than direct visitors.',
    action: 'Add SDWIS county deep-link to outreach emails',
  },
  {
    id: 'ww360-access',
    severity: 'medium',
    title: 'Access requests convert at 0.65% — above B2G benchmark',
    body: '47 enrollment requests in 12 months with strongest lift from utility referral traffic (+18 conversions). Organic branded queries (“water workforce 360”) click at 4.4% CTR.',
    action: 'Publish utility referral UTM template',
  },
  {
    id: 'ww360-studio',
    severity: 'info',
    title: 'Document Studio publish events growing MoM',
    body: '86 studio_published events since launch; 62% from platform_admin sessions. Tour completion correlates with first publish within 7 days.',
    action: 'Highlight Studio in partner onboarding tour',
  },
];

/* ------------------------------------------------------------------ */
/* OWW web                                                             */
/* ------------------------------------------------------------------ */

const OWW_SESSIONS_MONTHLY = [2840, 3120, 3380, 2180, 3640, 3980, 4420, 4180, 3860, 3520, 3180, 3460];
const OWW_ORGANIC_MONTHLY = [4200, 4680, 5120, 3100, 5840, 6420, 7180, 6840, 6240, 5680, 5120, 5580];

const OWW_GA_BASE: Ga4Block = {
  summary: {
    sessions: 41780,
    users: 28940,
    newUsers: 18420,
    pageviews: 126400,
    engagementRate: 0.72,
    avgSessionDurationSec: 224,
    conversions: 741,
    bounceRate: 0.29,
  },
  daily: [],
  channels: [
    { channel: 'Organic Search', sessions: 12120, users: 9840, conversions: 214 },
    { channel: 'Referral', sessions: 9180, users: 7120, conversions: 163 },
    { channel: 'Organic Social', sessions: 5840, users: 4980, conversions: 81 },
    { channel: 'Direct', sessions: 5420, users: 4210, conversions: 98 },
    { channel: 'Email', sessions: 4680, users: 3920, conversions: 126 },
    { channel: 'Paid Search', sessions: 2540, users: 2180, conversions: 59 },
  ],
  topPages: [
    { pagePath: '/careers/operator', title: 'Become a water operator', pageviews: 28480, sessions: 19240, bounceRate: 0.24 },
    { pagePath: '/certification', title: 'NYS certification explained', pageviews: 22140, sessions: 16820, bounceRate: 0.31 },
    { pagePath: '/jobs', title: 'Job board', pageviews: 19860, sessions: 14280, bounceRate: 0.22 },
    { pagePath: '/scholarships', title: 'Scholarships & stipends', pageviews: 11240, sessions: 8640, bounceRate: 0.28 },
    { pagePath: '/employers', title: 'For utilities', pageviews: 6840, sessions: 4920, bounceRate: 0.35 },
    { pagePath: '/pathways/grade-d', title: 'Grade D pathway', pageviews: 5620, sessions: 4180, bounceRate: 0.26 },
  ],
  geo: [
    { region: 'New York', sessions: 31240, users: 21840 },
    { region: 'New Jersey', sessions: 2840, users: 1980 },
    { region: 'Connecticut', sessions: 1920, users: 1340 },
    { region: 'Pennsylvania', sessions: 1680, users: 1180 },
    { region: 'Massachusetts', sessions: 1240, users: 860 },
  ],
  devices: [
    { device: 'Mobile', sessions: 22180, share: 0.531 },
    { device: 'Desktop', sessions: 16280, share: 0.39 },
    { device: 'Tablet', sessions: 3320, share: 0.079 },
  ],
  conversions: [
    { event: 'member_profile_created', count: 741, rate: 0.0177 },
    { event: 'career_assessment_completed', count: 412, rate: 0.0099 },
    { event: 'job_application_submitted', count: 528, rate: 0.0126 },
    { event: 'newsletter_signup', count: 892, rate: 0.0214 },
  ],
};

const OWW_SEO_BASE: SeoBlock = {
  summary: { clicks: 6840, impressions: 284000, ctr: 0.0241, avgPosition: 12.8 },
  daily: [],
  topQueries: [
    { query: 'become a water operator NY', clicks: 420, impressions: 18400, ctr: 0.023, position: 7.4, branded: false },
    { query: 'NYS water operator certification', clicks: 386, impressions: 22100, ctr: 0.017, position: 9.8, branded: false },
    { query: 'water operator salary New York', clicks: 312, impressions: 14200, ctr: 0.022, position: 11.2, branded: false },
    { query: 'one water workforce', clicks: 284, impressions: 3200, ctr: 0.089, position: 2.1, branded: true },
    { query: 'water treatment operator jobs NY', clicks: 248, impressions: 9800, ctr: 0.025, position: 8.6, branded: false },
    { query: 'Grade D water operator training', clicks: 196, impressions: 7600, ctr: 0.026, position: 10.4, branded: false },
  ],
  topLandings: [
    { page: 'https://onewaterworkforce.org/careers/operator', title: 'Become a water operator', clicks: 1840, impressions: 68400, ctr: 0.027, position: 8.2 },
    { page: 'https://onewaterworkforce.org/certification', title: 'Certification guide', clicks: 1420, impressions: 52800, ctr: 0.027, position: 9.6 },
    { page: 'https://onewaterworkforce.org/jobs', title: 'Job board', clicks: 980, impressions: 28400, ctr: 0.035, position: 7.8 },
  ],
  devices: [
    { device: 'Mobile', clicks: 3980, impressions: 168400 },
    { device: 'Desktop', clicks: 2420, impressions: 98400 },
    { device: 'Tablet', clicks: 440, impressions: 17200 },
  ],
};

const OWW_INSIGHTS: DigitalInsight[] = [
  {
    id: 'oww-mobile',
    severity: 'high',
    title: '53% of career traffic is mobile — job board converts best',
    body: 'Mobile sessions on /jobs convert at 8.7% to applications vs 4.1% on certification pages. “Become a water operator NY” is position 7.4 with rising impressions (+18% QoQ).',
    action: 'Shorten mobile member sign-up flow',
  },
  {
    id: 'oww-organic',
    severity: 'medium',
    title: 'Organic search is the #1 member acquisition channel',
    body: '214 of 741 members attribute to organic search in the referral mix. Branded query CTR is 8.9% — protect brand SERP with structured FAQ on certification page.',
    action: 'Add FAQ schema to /certification',
  },
  {
    id: 'oww-grade-d',
    severity: 'info',
    title: 'Grade D pathway page gaining traction',
    body: '/pathways/grade-d added 5,620 pageviews in 12 months, mostly from non-branded CEU queries. Cross-link from Learning Stream waitlist email could lift conversions.',
    action: 'Cross-link LS Grade D waitlist email',
  },
];

/* ------------------------------------------------------------------ */
/* Learning Stream                                                     */
/* ------------------------------------------------------------------ */

const LS_SESSIONS_MONTHLY = [1620, 1840, 1980, 1240, 2140, 2380, 2640, 2520, 2280, 2060, 1880, 2040];
const LS_ORGANIC_MONTHLY = [2840, 3120, 3480, 1980, 3840, 4180, 4620, 4380, 3960, 3580, 3240, 3520];

const LS_GA_BASE: Ga4Block = {
  summary: {
    sessions: 24640,
    users: 16820,
    newUsers: 9840,
    pageviews: 68420,
    engagementRate: 0.74,
    avgSessionDurationSec: 198,
    conversions: 1809,
    bounceRate: 0.27,
  },
  daily: [],
  channels: [
    { channel: 'Email', sessions: 8640, users: 7120, conversions: 612 },
    { channel: 'Referral', sessions: 6420, users: 4980, conversions: 498 },
    { channel: 'Organic Search', sessions: 5840, users: 4680, conversions: 384 },
    { channel: 'Direct', sessions: 2180, users: 1840, conversions: 186 },
    { channel: 'Organic Social', sessions: 980, users: 820, conversions: 72 },
    { channel: 'Paid Search', sessions: 580, users: 480, conversions: 57 },
  ],
  topPages: [
    { pagePath: '/courses/grade-d-renewal', title: 'Grade D Renewal — Sep 24', pageviews: 12480, sessions: 9840, bounceRate: 0.18 },
    { pagePath: '/courses/wtp-grades-ab', title: 'WTP Operations A & B', pageviews: 8420, sessions: 6240, bounceRate: 0.21 },
    { pagePath: '/catalog', title: 'Course catalog', pageviews: 7840, sessions: 6120, bounceRate: 0.24 },
    { pagePath: '/courses/backflow-awareness', title: 'Cross-connection awareness', pageviews: 4680, sessions: 3840, bounceRate: 0.26 },
    { pagePath: '/register', title: 'Registration checkout', pageviews: 3920, sessions: 3180, bounceRate: 0.12 },
    { pagePath: '/ceu-tracker', title: 'CEU tracker', pageviews: 2840, sessions: 2140, bounceRate: 0.19 },
  ],
  geo: [
    { region: 'New York', sessions: 19840, users: 13620 },
    { region: 'New Jersey', sessions: 1840, users: 1280 },
    { region: 'Connecticut', sessions: 980, users: 680 },
    { region: 'Pennsylvania', sessions: 820, users: 560 },
  ],
  devices: [
    { device: 'Desktop', sessions: 14280, share: 0.58 },
    { device: 'Mobile', sessions: 8640, share: 0.35 },
    { device: 'Tablet', sessions: 1720, share: 0.07 },
  ],
  conversions: [
    { event: 'course_registration_started', count: 2140, rate: 0.087 },
    { event: 'course_registration_completed', count: 1809, rate: 0.073 },
    { event: 'waitlist_joined', count: 186, rate: 0.0075 },
    { event: 'catalog_download', count: 420, rate: 0.017 },
  ],
};

const LS_SEO_BASE: SeoBlock = {
  summary: { clicks: 4280, impressions: 168400, ctr: 0.0254, avgPosition: 11.2 },
  daily: [],
  topQueries: [
    { query: 'NYS water operator CEU', clicks: 312, impressions: 12400, ctr: 0.025, position: 8.4, branded: false },
    { query: 'Grade D renewal course', clicks: 284, impressions: 9800, ctr: 0.029, position: 8.2, branded: false },
    { query: 'backflow prevention course NY', clicks: 196, impressions: 6200, ctr: 0.032, position: 9.6, branded: false },
    { query: 'Learning Stream NYSAWWA', clicks: 168, impressions: 2100, ctr: 0.08, position: 3.4, branded: true },
    { query: 'water treatment plant operator training', clicks: 142, impressions: 8400, ctr: 0.017, position: 12.8, branded: false },
    { query: 'cross connection control CEU', clicks: 118, impressions: 4800, ctr: 0.025, position: 10.2, branded: false },
  ],
  topLandings: [
    { page: 'https://learningstream.com/courses/grade-d-renewal', title: 'Grade D Renewal', clicks: 840, impressions: 28400, ctr: 0.03, position: 8.2 },
    { page: 'https://learningstream.com/catalog', title: 'Course catalog', clicks: 620, impressions: 22400, ctr: 0.028, position: 9.4 },
    { page: 'https://learningstream.com/courses/wtp-grades-ab', title: 'WTP A & B', clicks: 480, impressions: 16800, ctr: 0.029, position: 10.1 },
  ],
  devices: [
    { device: 'Desktop', clicks: 2680, impressions: 98400 },
    { device: 'Mobile', clicks: 1280, impressions: 58400 },
    { device: 'Tablet', clicks: 320, impressions: 11600 },
  ],
};

const LS_INSIGHTS: DigitalInsight[] = [
  {
    id: 'ls-grade-d-seo',
    severity: 'high',
    title: 'Grade D renewal query at position 8.2 with rising impressions',
    body: '“Grade D renewal course” impressions up 24% QoQ while the Sep 24 section is 95% full with 11 waitlisted. A landing title emphasizing “Long Island” could capture spillover search demand.',
    action: 'A/B test Long Island in page title',
  },
  {
    id: 'ls-email',
    severity: 'medium',
    title: 'Email drives 35% of catalog sessions but under-indexes on SEO',
    body: 'Email channel converts at 7.1% vs 6.6% organic. Non-branded CEU queries still average position 11.2 — content refresh on /catalog would lift organic registrations.',
    action: 'Refresh catalog meta descriptions',
  },
  {
    id: 'ls-waitlist',
    severity: 'info',
    title: '186 waitlist joins — digital demand exceeds seated capacity',
    body: 'waitlist_joined events correlate with /courses/grade-d-renewal pageviews. OWW referral traffic to LS catalog converts 1.8× vs direct.',
    action: 'Add second Grade D section landing page',
  },
];

function buildGaBlock(base: Ga4Block, sessionsMonthly: number[], range: DigitalRange): Ga4Block {
  const sessionDaily = expandMonthlyToDaily(sessionsMonthly);
  const sliced = sliceByRange(sessionDaily, range);
  const totalSessions = sumDaily(sliced);
  const factor = totalSessions / base.summary.sessions;

  const daily: Ga4Block['daily'] = sliced.map(({ date, value }) => ({
    date,
    sessions: value,
    users: Math.round(value * 0.72),
    pageviews: Math.round(value * 3.8),
  }));

  return {
    summary: {
      sessions: totalSessions,
      users: Math.round(base.summary.users * factor),
      newUsers: Math.round(base.summary.newUsers * factor),
      pageviews: Math.round(base.summary.pageviews * factor),
      engagementRate: base.summary.engagementRate,
      avgSessionDurationSec: base.summary.avgSessionDurationSec,
      conversions: Math.round(base.summary.conversions * factor),
      bounceRate: base.summary.bounceRate,
    },
    daily,
    channels: base.channels.map(c => ({
      ...c,
      sessions: Math.round(c.sessions * factor),
      users: Math.round(c.users * factor),
      conversions: Math.round(c.conversions * factor),
    })),
    topPages: base.topPages.map(p => ({
      ...p,
      pageviews: Math.round(p.pageviews * factor),
      sessions: Math.round(p.sessions * factor),
    })),
    geo: base.geo.map(g => ({
      ...g,
      sessions: Math.round(g.sessions * factor),
      users: Math.round(g.users * factor),
    })),
    devices: base.devices,
    conversions: base.conversions.map(c => ({
      ...c,
      count: Math.round(c.count * factor),
    })),
  };
}

function buildSeoBlock(base: SeoBlock, organicMonthly: number[], range: DigitalRange): SeoBlock {
  const clickDaily = expandMonthlyToDaily(organicMonthly.map(v => Math.round(v * 0.42)));
  const impressionDaily = expandMonthlyToDaily(organicMonthly);
  const slicedC = sliceByRange(clickDaily, range);
  const slicedI = sliceByRange(impressionDaily, range);
  const clicks = sumDaily(slicedC);
  const impressions = sumDaily(slicedI);
  const factor = clicks / base.summary.clicks;

  const daily: SeoBlock['daily'] = slicedC.map((c, i) => ({
    date: c.date,
    clicks: c.value,
    impressions: slicedI[i]?.value ?? c.value * 2,
  }));

  return {
    summary: {
      clicks,
      impressions,
      ctr: impressions > 0 ? clicks / impressions : base.summary.ctr,
      avgPosition: base.summary.avgPosition,
    },
    daily,
    topQueries: base.topQueries.map(q => ({
      ...q,
      clicks: Math.round(q.clicks * factor),
      impressions: Math.round(q.impressions * factor),
    })),
    topLandings: base.topLandings.map(l => ({
      ...l,
      clicks: Math.round(l.clicks * factor),
      impressions: Math.round(l.impressions * factor),
    })),
    devices: base.devices.map(d => ({
      ...d,
      clicks: Math.round(d.clicks * factor),
      impressions: Math.round(d.impressions * factor),
    })),
  };
}

const PROPERTY_BASE: Record<
  DigitalPropertyId,
  { ga: Ga4Block; seo: SeoBlock; insights: DigitalInsight[]; sessions: number[]; organic: number[] }
> = {
  ww360: {
    ga: WW360_GA_BASE,
    seo: WW360_SEO_BASE,
    insights: WW360_INSIGHTS,
    sessions: WW360_SESSIONS_MONTHLY,
    organic: WW360_ORGANIC_MONTHLY,
  },
  'oww-web': {
    ga: OWW_GA_BASE,
    seo: OWW_SEO_BASE,
    insights: OWW_INSIGHTS,
    sessions: OWW_SESSIONS_MONTHLY,
    organic: OWW_ORGANIC_MONTHLY,
  },
  'learning-stream': {
    ga: LS_GA_BASE,
    seo: LS_SEO_BASE,
    insights: LS_INSIGHTS,
    sessions: LS_SESSIONS_MONTHLY,
    organic: LS_ORGANIC_MONTHLY,
  },
};

export function buildDigitalPropertyReport(
  property: DigitalPropertyId,
  range: DigitalRange,
  dataMode: 'live' | 'sample' = 'sample',
  lastSynced: string | null = null
): DigitalPropertyReport {
  const base = PROPERTY_BASE[property];
  return {
    property,
    label:
      property === 'ww360'
        ? 'Water Workforce 360'
        : property === 'oww-web'
          ? 'onewaterworkforce.org'
          : 'Learning Stream',
    dataMode,
    range,
    lastSynced,
    ga: buildGaBlock(base.ga, base.sessions, range),
    seo: buildSeoBlock(base.seo, base.organic, range),
    insights: base.insights,
  };
}

export function buildDigitalTeaser(): {
  ww360Sessions30d: number;
  owwOrganicClicks30d: number;
  lsCatalogSessions30d: number;
  blendedSeoImpressions30d: number;
} {
  const ww360 = buildDigitalPropertyReport('ww360', '30d');
  const oww = buildDigitalPropertyReport('oww-web', '30d');
  const ls = buildDigitalPropertyReport('learning-stream', '30d');
  return {
    ww360Sessions30d: ww360.ga.summary.sessions,
    owwOrganicClicks30d: oww.seo.summary.clicks,
    lsCatalogSessions30d: ls.ga.summary.sessions,
    blendedSeoImpressions30d:
      ww360.seo.summary.impressions + oww.seo.summary.impressions + ls.seo.summary.impressions,
  };
}

/** Monthly chart labels for bar charts when range is 12mo. */
export function monthlyLabelsForRange(range: DigitalRange): string[] {
  if (range === '30d') return MONTH_LABELS.slice(-1);
  if (range === 'qtr') return MONTH_LABELS.slice(-3);
  return MONTH_LABELS;
}
