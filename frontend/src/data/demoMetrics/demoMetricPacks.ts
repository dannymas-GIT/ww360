/**
 * Illustrative demo metric packs (v1).
 *
 * Fact sheet — numbers shaped from public sources, not presented as live feeds:
 * - EPA ECHO SDWIS (community water systems, violations, SNC)
 * - BLS OEWS / Occupational Outlook (water/wastewater operator employment)
 * - Projections Central (state openings projections)
 * - NYSDOH public operator certification program summaries
 * - EPA DWSRF allotment notices (funding pipeline scale)
 *
 * Do not invent regulatory citations or non-public partner data.
 */

import type { Ww360DataMode } from '@/components/ww360/Ww360DataModeBadge';
import type { WorkspaceProfile } from '@/utils/workspaceProfile';

export interface DemoMetricPoint {
  label: string;
  value: number;
}

export interface DemoChartSeries {
  id: string;
  title: string;
  subtitle: string;
  dataMode: Ww360DataMode;
  source: string;
  sourceNote: string;
  points: DemoMetricPoint[];
}

export interface DemoKpi {
  id: string;
  label: string;
  value: string;
  sublabel: string;
  dataMode: Ww360DataMode;
  source: string;
}

export interface DemoMetricPack {
  version: string;
  profile: WorkspaceProfile;
  personaKey?: string;
  kpis: DemoKpi[];
  charts: DemoChartSeries[];
}

const NATIONAL_KPIS: DemoKpi[] = [
  {
    id: 'workforce-gap',
    label: 'Annual operator openings (US)',
    value: '12,400',
    sublabel: 'BLS employment change + retirements (illustrative blend)',
    dataMode: 'sample',
    source: 'bls_oews',
  },
  {
    id: 'cws-count',
    label: 'Active community water systems',
    value: '49,300',
    sublabel: 'EPA SDWIS universe (rounded public aggregate)',
    dataMode: 'sample',
    source: 'epa_echo_sdwis',
  },
  {
    id: 'snc-pressure',
    label: 'Systems in SNC',
    value: '1,180',
    sublabel: 'Significant non-compliance (public SDWIS roll-up)',
    dataMode: 'sample',
    source: 'epa_echo_sdwis',
  },
  {
    id: 'dwsrf-pipeline',
    label: 'DWSRF pipeline (FY)',
    value: '$2.8B',
    sublabel: 'Allotments + state match (illustrative scale)',
    dataMode: 'sample',
    source: 'epa_dwsrf',
  },
];

export const DEMO_METRIC_PACKS: Record<string, DemoMetricPack> = {
  national: {
    version: '1.0.0',
    profile: 'national',
    kpis: NATIONAL_KPIS,
    charts: [
      {
        id: 'state-opcert-coverage',
        title: 'OpCert coverage by state (index)',
        subtitle: 'Primacy states with public roster aggregates',
        dataMode: 'sample',
        source: 'nysdoh_roster',
        sourceNote: 'Illustrative index from NYSDOH public roster patterns; not a live 50-state roster.',
        points: [
          { label: 'NY', value: 92 },
          { label: 'NJ', value: 88 },
          { label: 'PA', value: 85 },
          { label: 'OH', value: 81 },
          { label: 'TX', value: 76 },
          { label: 'CA', value: 74 },
        ],
      },
      {
        id: 'workforce-openings',
        title: 'Projected openings (water operators)',
        subtitle: '2024–2034 illustrative trend from BLS/Projections Central patterns',
        dataMode: 'sample',
        source: 'bls_oews',
        sourceNote: 'Illustrative series; live BLS used when national API returns fresh data.',
        points: [
          { label: '2024', value: 11800 },
          { label: '2026', value: 12100 },
          { label: '2028', value: 12400 },
          { label: '2030', value: 12750 },
          { label: '2032', value: 13000 },
          { label: '2034', value: 13200 },
        ],
      },
    ],
  },
  regional: {
    version: '1.0.0',
    profile: 'regional',
    personaKey: 'epa-r2-opcert-coordinator',
    kpis: [
      {
        id: 'r2-states',
        label: 'EPA Region 2 primacy states',
        value: '6',
        sublabel: 'NY, NJ, PR, VI + territories in region',
        dataMode: 'sample',
        source: 'epa_region_map',
      },
      {
        id: 'r2-cws',
        label: 'Region 2 CWS (approx.)',
        value: '3,420',
        sublabel: 'SDWIS regional slice (illustrative)',
        dataMode: 'sample',
        source: 'epa_echo_sdwis',
      },
      {
        id: 'r2-renewals',
        label: 'Certs expiring · 12 mo',
        value: '840',
        sublabel: 'NY + NJ public roster cliff (illustrative)',
        dataMode: 'sample',
        source: 'nysdoh_roster',
      },
    ],
    charts: [
      {
        id: 'r2-opcert',
        title: 'OpCert renewals by quarter (R2)',
        subtitle: 'NY-anchored illustrative cliff',
        dataMode: 'sample',
        source: 'nysdoh_roster',
        sourceNote: 'Based on public NYSDOH renewal cycle patterns.',
        points: [
          { label: 'Q1', value: 210 },
          { label: 'Q2', value: 280 },
          { label: 'Q3', value: 190 },
          { label: 'Q4', value: 160 },
        ],
      },
    ],
  },
  state_partner: {
    version: '1.0.0',
    profile: 'state_partner',
    kpis: [
      {
        id: 'member-utils',
        label: 'Section member utilities',
        value: '186',
        sublabel: 'Enrolled in workforce program (illustrative)',
        dataMode: 'sample',
        source: 'oww_program',
      },
      {
        id: 'ceu-cliff',
        label: 'CEU renewals · 90 days',
        value: '142',
        sublabel: 'Operators needing contact hours',
        dataMode: 'sample',
        source: 'learning_stream',
      },
      {
        id: 'retirements',
        label: 'Retirements · 24 mo',
        value: '67',
        sublabel: 'Critical roles without successor (illustrative)',
        dataMode: 'sample',
        source: 'ww360_continuity',
      },
    ],
    charts: [
      {
        id: 'regional-gap',
        title: 'Supply vs demand by region',
        subtitle: 'Openings vs candidates in training',
        dataMode: 'sample',
        source: 'ww360_continuity',
        sourceNote: 'Illustrative regional gaps for NY economic regions.',
        points: [
          { label: 'Capital', value: 18 },
          { label: 'Finger Lakes', value: 12 },
          { label: 'Western NY', value: 22 },
          { label: 'Mid-Hudson', value: 9 },
          { label: 'Long Island', value: 15 },
        ],
      },
      {
        id: 'pipeline',
        title: 'Candidate pipeline stages',
        subtitle: 'Awareness → employment (illustrative)',
        dataMode: 'sample',
        source: 'oww_web',
        sourceNote: 'Sample funnel aligned with OWW grant reporting categories.',
        points: [
          { label: 'Aware', value: 420 },
          { label: 'Enrolled', value: 212 },
          { label: 'Training', value: 98 },
          { label: 'Cert prep', value: 44 },
          { label: 'Placed', value: 31 },
        ],
      },
    ],
  },
  regulator: {
    version: '1.0.0',
    profile: 'regulator',
    kpis: [
      {
        id: 'active-certs',
        label: 'Active certifications',
        value: '8,240',
        sublabel: 'NY public roster aggregate (illustrative)',
        dataMode: 'sample',
        source: 'nysdoh_roster',
      },
      {
        id: 'coverage',
        label: 'Systems per certified operator',
        value: '1.8',
        sublabel: 'Coverage ratio (illustrative)',
        dataMode: 'sample',
        source: 'nysdoh_roster',
      },
      {
        id: 'renewal-cliff',
        label: 'Renewals · next 90 days',
        value: '312',
        sublabel: 'Expiration window (illustrative)',
        dataMode: 'sample',
        source: 'nysdoh_roster',
      },
    ],
    charts: [
      {
        id: 'grade-mix',
        title: 'Certifications by grade',
        subtitle: 'Distribution from public roster patterns',
        dataMode: 'sample',
        source: 'nysdoh_roster',
        sourceNote: 'Aggregate-only; no PII.',
        points: [
          { label: 'A', value: 1240 },
          { label: 'B', value: 3180 },
          { label: 'C', value: 2890 },
          { label: 'D', value: 930 },
        ],
      },
    ],
  },
  utility: {
    version: '1.0.0',
    profile: 'utility',
    kpis: [
      {
        id: 'succession',
        label: 'Succession readiness',
        value: '72%',
        sublabel: 'Critical roles with named backup',
        dataMode: 'sample',
        source: 'ww360_continuity',
      },
      {
        id: 'ceu-current',
        label: 'CEU current',
        value: '86%',
        sublabel: 'Operators meeting renewal window',
        dataMode: 'sample',
        source: 'learning_stream',
      },
      {
        id: 'open-tasks',
        label: 'Documentation tasks',
        value: '4',
        sublabel: 'Open compliance documentation items',
        dataMode: 'sample',
        source: 'ww360_tasks',
      },
    ],
    charts: [
      {
        id: 'ceu-by-operator',
        title: 'CEU hours by operator',
        subtitle: 'YTD contact hours (illustrative when live empty)',
        dataMode: 'sample',
        source: 'learning_stream',
        sourceNote: 'Illustrative utility roster; live when CEU API returns data.',
        points: [
          { label: 'Lead', value: 18 },
          { label: 'Op 1', value: 12 },
          { label: 'Op 2', value: 8 },
          { label: 'Op 3', value: 14 },
        ],
      },
    ],
  },
};

export function getDemoMetricPack(profile: WorkspaceProfile, personaKey?: string | null): DemoMetricPack {
  if (personaKey === 'epa-r2-opcert-coordinator') {
    return DEMO_METRIC_PACKS.regional;
  }
  return DEMO_METRIC_PACKS[profile] ?? DEMO_METRIC_PACKS.state_partner;
}
