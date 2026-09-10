/**
 * Live-vs-illustrative metric resolver.
 *
 * Policy:
 * 1. Try live national/state API when available and non-empty.
 * 2. If empty, stale, or demo narrative needs polish → illustrative pack.
 * 3. UI must badge Live / Sample (illustrative) / Mixed with source id.
 */

import type { Ww360DataMode } from '@/components/ww360/Ww360DataModeBadge';
import {
  getDemoMetricPack,
  type DemoChartSeries,
  type DemoKpi,
  type DemoMetricPack,
} from '@/data/demoMetrics/demoMetricPacks';
import { fetchNationalOverview, type NationalOverview } from '@/services/nationalService';
import type { WorkspaceProfile } from '@/utils/workspaceProfile';

export interface ResolvedKpi extends DemoKpi {
  resolvedMode: Ww360DataMode;
}

export interface ResolvedChart extends DemoChartSeries {
  resolvedMode: Ww360DataMode;
}

export interface ResolvedMetricBundle {
  pack: DemoMetricPack;
  kpis: ResolvedKpi[];
  charts: ResolvedChart[];
  headlineMode: Ww360DataMode;
}

function mapLiveNationalKpis(overview: NationalOverview | null): DemoKpi[] | null {
  const h = overview?.headline_kpis;
  if (!h) return null;
  const gap = h.workforce_replacement_gap;
  const compliance = h.compliance_pressure;
  const funding = h.funding_pipeline;
  if (!gap && !compliance) return null;

  const kpis: DemoKpi[] = [];
  if (gap?.annual_openings != null) {
    kpis.push({
      id: 'live-workforce-gap',
      label: 'Projected annual openings (BLS)',
      value: String(gap.annual_openings),
      sublabel: `BLS employment ${gap.employment_2024 ?? '—'} → ${gap.employment_2034 ?? '—'} (projections, not live postings)`,
      dataMode: 'live',
      source: 'bls_oep',
    });
  }
  if (compliance?.health_violation_systems != null) {
    kpis.push({
      id: 'live-compliance',
      label: 'Health violation systems',
      value: String(compliance.health_violation_systems),
      sublabel: `${compliance.snc_systems ?? '—'} SNC systems`,
      dataMode: 'live',
      source: 'epa_echo_sdwis',
    });
  }
  if (funding?.dwsrf_allotment_usd != null) {
    kpis.push({
      id: 'live-dwsrf',
      label: 'DWSRF pipeline',
      value: `$${(Number(funding.dwsrf_allotment_usd) / 1e9).toFixed(1)}B`,
      sublabel: 'Federal allotment scale',
      dataMode: 'live',
      source: 'epa_dwsrf',
    });
  }
  return kpis.length ? kpis : null;
}

export async function resolveWorkspaceMetrics(
  profile: WorkspaceProfile,
  personaKey?: string | null
): Promise<ResolvedMetricBundle> {
  const pack = getDemoMetricPack(profile, personaKey);
  let liveKpis: DemoKpi[] | null = null;

  if (profile === 'national' || profile === 'regional') {
    try {
      const overview = await fetchNationalOverview();
      liveKpis = mapLiveNationalKpis(overview);
    } catch {
      liveKpis = null;
    }
  }

  const mergedKpis: ResolvedKpi[] = liveKpis
    ? [
        ...liveKpis.map(k => ({ ...k, resolvedMode: 'live' as const })),
        ...pack.kpis
          .filter(k => !liveKpis!.some(l => l.label === k.label))
          .slice(0, Math.max(0, 4 - liveKpis.length))
          .map(k => ({ ...k, resolvedMode: k.dataMode })),
      ]
    : pack.kpis.map(k => ({ ...k, resolvedMode: k.dataMode }));

  const charts: ResolvedChart[] = pack.charts.map(c => ({
    ...c,
    resolvedMode: c.dataMode,
  }));

  const hasLive = mergedKpis.some(k => k.resolvedMode === 'live');
  const hasSample = mergedKpis.some(k => k.resolvedMode === 'sample');
  const headlineMode: Ww360DataMode =
    hasLive && hasSample ? 'mixed' : hasLive ? 'live' : 'sample';

  return { pack, kpis: mergedKpis.slice(0, 4), charts, headlineMode };
}
