import type { WorkspaceProfile } from '@/utils/workspaceProfile';
import type { DashboardColumnSpan, DashboardRowSpan } from './dashboardLayoutTypes';

export type WidgetCatalogKind = 'module' | 'chart' | 'metric' | 'metric_group';

export interface Ww360CatalogOption {
  module_id: string;
  label: string;
  description: string;
  category: string;
  kind: WidgetCatalogKind;
  columnSpan: DashboardColumnSpan;
  rowSpan: DashboardRowSpan;
  allowRowSpan: boolean;
  unique: boolean;
  profiles: WorkspaceProfile[];
  config?: Record<string, unknown>;
}

export interface Ww360CatalogSection {
  title: string;
  subtitle: string;
  columnSpan: DashboardColumnSpan;
  options: Ww360CatalogOption[];
}

const ALL: WorkspaceProfile[] = [
  'national',
  'regional',
  'state_partner',
  'regulator',
  'utility',
];
const WORKFORCE: WorkspaceProfile[] = ['state_partner', 'regulator', 'utility'];

/** Flat catalog — filtered by profile and grouped into picker sections. */
export const WW360_WIDGET_CATALOG: Ww360CatalogOption[] = [
  {
    module_id: 'trend_chart',
    label: 'Trend & comparison chart',
    description: 'Bar or trend views for regional gaps, pipeline stages, or state comparison.',
    category: 'charts',
    kind: 'chart',
    columnSpan: 1,
    rowSpan: 1,
    allowRowSpan: true,
    unique: false,
    profiles: ALL,
  },
  {
    module_id: 'kpi_headline',
    label: 'Headline numbers',
    description: 'Your top 3–4 measures for this role.',
    category: 'numbers',
    kind: 'module',
    columnSpan: 3,
    rowSpan: 1,
    allowRowSpan: false,
    unique: true,
    profiles: ALL,
  },
  {
    module_id: 'metric:readiness_score',
    label: 'Readiness Score',
    description: 'Composite workforce continuity health.',
    category: 'numbers',
    kind: 'metric',
    columnSpan: 1,
    rowSpan: 1,
    allowRowSpan: false,
    unique: true,
    profiles: WORKFORCE,
    config: { metricId: 'readiness_score' },
  },
  {
    module_id: 'metric:coverage_pct',
    label: 'Coverage %',
    description: 'Critical functions with qualified backup.',
    category: 'numbers',
    kind: 'metric',
    columnSpan: 1,
    rowSpan: 1,
    allowRowSpan: false,
    unique: true,
    profiles: WORKFORCE,
    config: { metricId: 'coverage_pct' },
  },
  {
    module_id: 'metric:cert_cliff_90d',
    label: 'Certs Expiring (90d)',
    description: 'Certifications expiring within 90 days.',
    category: 'numbers',
    kind: 'metric',
    columnSpan: 1,
    rowSpan: 1,
    allowRowSpan: false,
    unique: true,
    profiles: WORKFORCE,
    config: { metricId: 'cert_cliff_90d' },
  },
  {
    module_id: 'metric:vacant_positions',
    label: 'Vacant Positions',
    description: 'Active positions marked vacant.',
    category: 'numbers',
    kind: 'metric',
    columnSpan: 1,
    rowSpan: 1,
    allowRowSpan: false,
    unique: true,
    profiles: WORKFORCE,
    config: { metricId: 'vacant_positions' },
  },
  {
    module_id: 'metric:ceu_shortfall_count',
    label: 'CEU Shortfall',
    description: 'Operators behind on renewal hours.',
    category: 'numbers',
    kind: 'metric',
    columnSpan: 1,
    rowSpan: 1,
    allowRowSpan: false,
    unique: true,
    profiles: WORKFORCE,
    config: { metricId: 'ceu_shortfall_count' },
  },
  {
    module_id: 'continuity',
    label: 'Workforce continuity',
    description: 'Succession, vacancies, and CEU renewal pressure.',
    category: 'workforce',
    kind: 'module',
    columnSpan: 2,
    rowSpan: 1,
    allowRowSpan: false,
    unique: true,
    profiles: WORKFORCE,
  },
  {
    module_id: 'upcoming_training',
    label: 'Upcoming training',
    description: 'Scheduled workforce training events from Continuity.',
    category: 'workforce',
    kind: 'module',
    columnSpan: 2,
    rowSpan: 1,
    allowRowSpan: false,
    unique: true,
    profiles: WORKFORCE,
  },
  {
    module_id: 'metric_group:readiness_overview',
    label: 'Readiness Overview',
    description: 'Composite score and key component metrics.',
    category: 'workforce',
    kind: 'metric_group',
    columnSpan: 2,
    rowSpan: 1,
    allowRowSpan: false,
    unique: true,
    profiles: WORKFORCE,
    config: { groupId: 'readiness_overview' },
  },
  {
    module_id: 'metric_group:certification_health',
    label: 'Certification Health',
    description: 'Certification cliff at 30, 90, and 365 days.',
    category: 'workforce',
    kind: 'metric_group',
    columnSpan: 2,
    rowSpan: 1,
    allowRowSpan: false,
    unique: true,
    profiles: WORKFORCE,
    config: { groupId: 'certification_health' },
  },
  {
    module_id: 'metric_group:ceu_compliance',
    label: 'CEU Compliance',
    description: 'Shortfalls, completion, and missing vouchers.',
    category: 'workforce',
    kind: 'metric_group',
    columnSpan: 2,
    rowSpan: 1,
    allowRowSpan: false,
    unique: true,
    profiles: WORKFORCE,
    config: { groupId: 'ceu_compliance' },
  },
  {
    module_id: 'metric_group:coverage_succession',
    label: 'Coverage & Succession',
    description: 'Backup coverage, retirement horizon, and vacancies.',
    category: 'workforce',
    kind: 'metric_group',
    columnSpan: 2,
    rowSpan: 1,
    allowRowSpan: false,
    unique: true,
    profiles: WORKFORCE,
    config: { groupId: 'coverage_succession' },
  },
  {
    module_id: 'federal_jobs',
    label: 'Federal job openings',
    description: 'Live USAJOBS postings for water and wastewater operator roles.',
    category: 'careers',
    kind: 'module',
    columnSpan: 3,
    rowSpan: 1,
    allowRowSpan: false,
    unique: true,
    profiles: ALL,
  },
  {
    module_id: 'water_systems',
    label: 'Water systems landscape',
    description: 'SDWIS community water systems and compliance context.',
    category: 'compliance',
    kind: 'module',
    columnSpan: 2,
    rowSpan: 1,
    allowRowSpan: false,
    unique: true,
    profiles: ['national', 'regional', 'state_partner', 'regulator'],
  },
  {
    module_id: 'opcert_program',
    label: 'Operator certification program',
    description: 'Coverage, renewal cliff, and Nine Baseline Standards.',
    category: 'compliance',
    kind: 'module',
    columnSpan: 3,
    rowSpan: 1,
    allowRowSpan: false,
    unique: true,
    profiles: ['regulator', 'regional'],
  },
  {
    module_id: 'document_studio',
    label: 'Document Studio',
    description: 'Author and publish program reports and utility procedures.',
    category: 'content',
    kind: 'module',
    columnSpan: 2,
    rowSpan: 1,
    allowRowSpan: false,
    unique: true,
    profiles: ALL,
  },
  {
    module_id: 'national_overview',
    label: 'US / national overview',
    description: 'United States headline KPIs and state scorecard entry.',
    category: 'national',
    kind: 'module',
    columnSpan: 2,
    rowSpan: 1,
    allowRowSpan: false,
    unique: true,
    profiles: ['national', 'regional'],
  },
  {
    module_id: 'sources_freshness',
    label: 'Data sources & freshness',
    description: 'Which feeds are live vs illustrative.',
    category: 'trust',
    kind: 'module',
    columnSpan: 2,
    rowSpan: 1,
    allowRowSpan: false,
    unique: true,
    profiles: ['national', 'regional', 'state_partner', 'regulator'],
  },
];

const SECTION_META: {
  category: string;
  title: string;
  subtitle: string;
  columnSpan: DashboardColumnSpan;
}[] = [
  {
    category: 'charts',
    title: 'Charts',
    subtitle: 'Add a graph — auto-sizes with other charts in the row',
    columnSpan: 1,
  },
  {
    category: 'numbers',
    title: 'Numbers',
    subtitle: 'Headline KPIs and compact metric cards',
    columnSpan: 1,
  },
  {
    category: 'workforce',
    title: 'Workforce',
    subtitle: 'Continuity, training, and metric groups (half / full width)',
    columnSpan: 2,
  },
  {
    category: 'compliance',
    title: 'Compliance',
    subtitle: 'Water systems and OpCert program panels',
    columnSpan: 2,
  },
  {
    category: 'careers',
    title: 'Careers',
    subtitle: 'Federal job openings',
    columnSpan: 3,
  },
  {
    category: 'content',
    title: 'Content',
    subtitle: 'Document Studio',
    columnSpan: 2,
  },
  {
    category: 'national',
    title: 'National',
    subtitle: 'US overview entry',
    columnSpan: 2,
  },
  {
    category: 'trust',
    title: 'Trust',
    subtitle: 'Data sources and freshness',
    columnSpan: 2,
  },
];

export function catalogForProfile(profile: WorkspaceProfile): Ww360CatalogOption[] {
  return WW360_WIDGET_CATALOG.filter(o => o.profiles.includes(profile));
}

export function catalogSectionsForProfile(profile: WorkspaceProfile): Ww360CatalogSection[] {
  const options = catalogForProfile(profile);
  return SECTION_META.map(meta => ({
    title: meta.title,
    subtitle: meta.subtitle,
    columnSpan: meta.columnSpan,
    options: options.filter(o => o.category === meta.category),
  })).filter(s => s.options.length > 0);
}

export function findCatalogOption(moduleId: string): Ww360CatalogOption | undefined {
  return WW360_WIDGET_CATALOG.find(o => o.module_id === moduleId);
}
