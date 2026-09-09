import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { ww360PersonalizedTitle } from '@/components/ww360/ww360Greeting';
import { ArrowRight, Droplets, Users, Workflow } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Ww360KpiTile } from '@/components/ww360/Ww360KpiTile';
import { Ww360PageHero } from '@/components/ww360/Ww360PageHero';
import { Ww360Section } from '@/components/ww360/Ww360Section';
import { OpCertProgramPanel } from '@/components/regulator/OpCertProgramPanel';
import { resolveWorkspaceMetrics, type ResolvedMetricBundle } from '@/services/metricResolver';
import {
  fetchWorkspaceLayout,
  type LayoutItem,
} from '@/services/workspaceCustomizationService';
import type { WorkspaceProfile } from '@/utils/workspaceProfile';
import type { Ww360SourceId } from '@/components/ww360/ww360SourceTokens';
import { WorkspaceChartPanel } from './WorkspaceChartPanel';
import { WorkspaceTourOverlay } from './WorkspaceTourOverlay';
import { UsajobsJobListingsPanel } from './UsajobsJobListingsPanel';
import { DocumentStudioPanel } from '@/components/doc-studio/DocumentStudioPanel';

const SOURCE_MAP: Record<string, Ww360SourceId | undefined> = {
  epa_echo_sdwis: 'sdwis',
  bls_oews: 'bls',
  bls_oep: 'bls',
  learning_stream: 'learning-stream',
  oww_web: 'oww-web',
  oww_program: 'oww-web',
  ww360_continuity: 'ww360',
  ww360_tasks: 'ww360',
  usajobs: 'usajobs',
};

function mapSources(source: string): Ww360SourceId[] {
  const mapped = SOURCE_MAP[source];
  return mapped ? [mapped] : [];
}

const PERSONA_HEADLINES: Record<string, { title: string; description: string }> = {
  'us-epa-workforce-lead': {
    title: 'EPA Office of Water — workforce initiative',
    description:
      'US headline KPIs, state comparison, and funding pipeline for national workforce coordination.',
  },
  'us-asdwa-program-director': {
    title: 'ASDWA primacy & OpCert comparison',
    description:
      'State-by-state operator certification coverage and compliance pressure for primacy agencies.',
  },
  'us-awwa-workforce-director': {
    title: 'AWWA HQ workforce program',
    description:
      'Section adoption, member utility health, and national training pipeline narrative.',
  },
  'epa-r2-opcert-coordinator': {
    title: 'EPA Region 2 OpCert coordination',
    description: 'NY/NJ renewal cliffs and regional primacy coordination.',
  },
  'ny-nysawwa-executive': {
    title: 'NYS AWWA section workforce overview',
    description: 'Statewide member utility health, CEU cliff, and regional supply gaps.',
  },
  'ny-doh-opcert-manager': {
    title: 'NYSDOH operator certification program',
    description: 'Coverage ratio, renewal cliff, and Nine Baseline Standards reporting.',
  },
  'mcwa-superintendent': {
    title: 'Monroe County Water Authority — Superintendent',
    description:
      'Own policy, users, and publish approvals. Open Continuity for readiness scorecards and author or approve the Succession Binder with your workforce manager.',
  },
  'mcwa-chief-operator': {
    title: 'MCWA Workforce manager',
    description:
      'Day-to-day Continuity — create and maintain the Succession Binder, refresh CEU packs, and keep roster coverage current.',
  },
  'mcwa-operator-1': {
    title: 'MCWA Plant operator',
    description:
      'Personal CEU hours, training signups, and assigned documentation. Binder authoring stays with your manager.',
  },
};

const PROFILE_COPY: Record<
  WorkspaceProfile,
  { eyebrow: string; title: string; description: string }
> = {
  national: {
    eyebrow: 'National leadership',
    title: 'US water workforce at a glance',
    description:
      'Headline KPIs for EPA, ASDWA, and AWWA partners — live public data where available, illustrative where it tells the story better.',
  },
  regional: {
    eyebrow: 'EPA Region 2',
    title: 'Regional OpCert & workforce coordination',
    description:
      'Region 2 primacy states — renewal cliffs, system coverage, and coordination tools.',
  },
  state_partner: {
    eyebrow: 'State section partner',
    title: 'Statewide workforce program overview',
    description:
      'Landscape, program Document Studio, and Continuity oversight — preview member utilities as Superintendent, Manager, or Operator.',
  },
  regulator: {
    eyebrow: 'State regulator',
    title: 'Operator certification program dashboard',
    description: 'Coverage, renewal cliff, and reporting — aggregate public roster metrics only.',
  },
  utility: {
    eyebrow: 'Utility workforce',
    title: 'District workforce & compliance overview',
    description: 'Succession, CEU status, and documentation tasks for your utility team.',
  },
};

interface SimplifiedWorkspaceDashboardProps {
  profile: WorkspaceProfile;
  personaKey?: string | null;
}

function PanelShell({
  item,
  children,
}: {
  item: LayoutItem;
  children: React.ReactNode;
}) {
  if (!item.visible) return null;
  return (
    <div className={item.size === 'half' ? 'lg:col-span-1' : 'lg:col-span-2'}>{children}</div>
  );
}

export const SimplifiedWorkspaceDashboard: React.FC<SimplifiedWorkspaceDashboardProps> = ({
  profile,
  personaKey,
}) => {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<ResolvedMetricBundle | null>(null);
  const [layout, setLayout] = useState<LayoutItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [layoutTick, setLayoutTick] = useState(0);
  const baseCopy = PROFILE_COPY[profile];
  const personaCopy = personaKey ? PERSONA_HEADLINES[personaKey] : undefined;
  const copy = {
    eyebrow: baseCopy.eyebrow,
    title: personaCopy?.title ?? baseCopy.title,
    description: personaCopy?.description ?? baseCopy.description,
  };

  const reloadLayout = useCallback(() => {
    void fetchWorkspaceLayout(profile, personaKey)
      .then(res => setLayout(res.layout))
      .catch(() => setLayout([]));
  }, [profile, personaKey]);

  useEffect(() => {
    const onSaved = () => setLayoutTick(t => t + 1);
    window.addEventListener('ww360-workspace-layout-saved', onSaved);
    return () => window.removeEventListener('ww360-workspace-layout-saved', onSaved);
  }, []);

  useEffect(() => {
    reloadLayout();
  }, [reloadLayout, layoutTick]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void resolveWorkspaceMetrics(profile, personaKey)
      .then(bundle => {
        if (!cancelled) setMetrics(bundle);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profile, personaKey]);

  const visible = layout.filter(l => l.visible);
  const orderedIds = visible.map(l => l.module_id);

  const renderModule = (item: LayoutItem) => {
    switch (item.module_id) {
      case 'kpi_headline':
        if (!metrics) return null;
        return (
          <PanelShell key={item.module_id} item={item}>
            <div
              className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
              data-tour="workspace-kpis"
            >
              {metrics.kpis.map(kpi => (
                <Ww360KpiTile
                  key={kpi.id}
                  label={kpi.label}
                  value={kpi.value}
                  sub={kpi.sublabel}
                  sources={mapSources(kpi.source)}
                  dataMode={kpi.resolvedMode}
                  icon={
                    kpi.source.includes('sdwis') ? (
                      <Droplets className="h-4 w-4" />
                    ) : (
                      <Users className="h-4 w-4" />
                    )
                  }
                />
              ))}
            </div>
          </PanelShell>
        );
      case 'trend_chart':
        if (!metrics) return null;
        return (
          <React.Fragment key={item.module_id}>
            {metrics.charts.map((chart, i) => (
              <PanelShell
                key={chart.id}
                item={{ ...item, size: item.size === 'full' && metrics.charts.length > 1 ? 'half' : item.size }}
              >
                <div data-tour={i === 0 ? 'workspace-charts' : undefined}>
                  <WorkspaceChartPanel
                    chart={chart}
                    color={i === 0 ? '#2563eb' : '#0f766e'}
                    tourId={`workspace-chart-${i}`}
                  />
                </div>
              </PanelShell>
            ))}
          </React.Fragment>
        );
      case 'federal_jobs':
        return (
          <PanelShell key={item.module_id} item={item}>
            <UsajobsJobListingsPanel tourId="federal-jobs" />
          </PanelShell>
        );
      case 'water_systems':
        return (
          <PanelShell key={item.module_id} item={item}>
            <Ww360Section
              title="Water systems landscape"
              description="EPA SDWIS community water systems and compliance context for your state."
              dataMode="live"
            >
              <div className="px-5 pb-5">
                <Button asChild className="min-h-[44px] text-base">
                  <Link to="/water-systems">
                    <Droplets className="mr-2 h-4 w-4" />
                    Open landscape
                  </Link>
                </Button>
              </div>
            </Ww360Section>
          </PanelShell>
        );
      case 'continuity':
        return (
          <PanelShell key={item.module_id} item={item}>
            <Ww360Section
              title="Workforce continuity"
              description="Succession, vacancies, and CEU renewal pressure."
              dataMode="mixed"
            >
              <div className="px-5 pb-5">
                <Button asChild variant="outline" className="min-h-[44px] text-base">
                  <Link to="/continuity">
                    <Workflow className="mr-2 h-4 w-4" />
                    Open Continuity
                  </Link>
                </Button>
              </div>
            </Ww360Section>
          </PanelShell>
        );
      case 'document_studio':
        return (
          <PanelShell key={item.module_id} item={item}>
            <DocumentStudioPanel tourId="document-studio" />
          </PanelShell>
        );
      case 'opcert_program':
        return (
          <PanelShell key={item.module_id} item={item}>
            <OpCertProgramPanel />
          </PanelShell>
        );
      case 'national_overview':
        return (
          <PanelShell key={item.module_id} item={item}>
            <Ww360Section
              title="US / national overview"
              description="United States headline KPIs and state scorecards."
              dataMode="mixed"
            >
              <div className="px-5 pb-5">
                <Button asChild variant="outline" className="min-h-[44px] text-base">
                  <Link to="/national">
                    US overview
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </Ww360Section>
          </PanelShell>
        );
      case 'quick_actions':
        // Retired — Document Studio / Continuity panels already cover these links.
        return null;
      case 'sources_freshness':
        return (
          <PanelShell key={item.module_id} item={item}>
            <Ww360Section
              title="Data sources & freshness"
              description="Live public adapters vs illustrative demo packs — every tile is labeled."
              dataMode="mixed"
            >
              <ul className="space-y-2 px-5 pb-5 text-[1rem] text-slate-600">
                <li>
                  <strong>Live</strong> — EPA SDWIS, BLS projections, USAJOBS when configured
                </li>
                <li>
                  <strong>Sample</strong> — demo packs shaped from public sources (not live feeds)
                </li>
                <li>
                  <strong>Mixed</strong> — both appear on the same home screen
                </li>
              </ul>
            </Ww360Section>
          </PanelShell>
        );
      default:
        return null;
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 p-4 md:p-6">
      <WorkspaceTourOverlay profile={profile} personaKey={personaKey} autoOpen />
      <Ww360PageHero
        eyebrow={copy.eyebrow}
        title={ww360PersonalizedTitle(user, copy.title)}
        description={copy.description}
        dataMode={metrics?.headlineMode ?? 'sample'}
        tourId="workspace-hero"
      />

      {loading && (
        <p className="text-[1.125rem] text-slate-500">Loading workspace metrics…</p>
      )}

      {!loading && orderedIds.length === 0 && (
        <p className="text-[1.125rem] text-slate-600">
          No panels are on your home yet. Open <strong>Customize home</strong> in the sidebar to
          add panels from the library.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {visible.map(item => renderModule(item))}
      </div>
    </div>
  );
};
