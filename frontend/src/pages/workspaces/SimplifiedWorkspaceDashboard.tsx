import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useAuth } from '@/context/AuthContext';
import { useImpersonation } from '@/context/ImpersonationContext';
import { ww360PersonalizedTitle } from '@/components/ww360/ww360Greeting';
import { ArrowRight, Droplets, Plus, Users, Workflow } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Ww360KpiTile } from '@/components/ww360/Ww360KpiTile';
import { Ww360PageHero } from '@/components/ww360/Ww360PageHero';
import { Ww360Section } from '@/components/ww360/Ww360Section';
import { OpCertProgramPanel } from '@/components/regulator/OpCertProgramPanel';
import { resolveWorkspaceMetrics, type ResolvedMetricBundle } from '@/services/metricResolver';
import {
  fetchWorkspaceLayout,
  resetWorkspaceLayout,
  saveWorkspaceLayout,
  EDIT_MODE_EVENT,
  LAYOUT_SAVED_EVENT,
} from '@/services/workspaceCustomizationService';
import type { WorkspaceProfile } from '@/utils/workspaceProfile';
import type { Ww360SourceId } from '@/components/ww360/ww360SourceTokens';
import { WorkspaceChartPanel } from './WorkspaceChartPanel';
import { WorkspaceTourOverlay } from './WorkspaceTourOverlay';
import { UsajobsJobListingsPanel } from './UsajobsJobListingsPanel';
import { DocumentStudioPanel } from '@/components/doc-studio/DocumentStudioPanel';
import { WorkforceMetricCard } from '@/components/dashboard/widgets/workforce/WorkforceMetricCard';
import { WorkforceMetricGroupCard } from '@/components/dashboard/widgets/workforce/WorkforceMetricGroupCard';
import { UpcomingTrainingWidget } from '@/components/dashboard/widgets/workforce/UpcomingTrainingWidget';
import type {
  WorkforceMetricGroupId,
  WorkforceMetricId,
} from '@/components/dashboard/widgets/workforce/workforceMetricCatalog';
import { DashboardEditChrome } from '@/components/dashboard/layout/DashboardEditChrome';
import { SortableDashboardRow } from '@/components/dashboard/layout/SortableDashboardRow';
import { WidgetPickerDialog } from '@/components/dashboard/layout/WidgetPickerDialog';
import {
  canFitWidgetInRow,
  createChartBlock,
  createEmptyRowWithChart,
  emptyLayout,
  newId,
  usedUniqueModuleIds,
  type DashboardBlock,
  type DashboardLayoutV2,
} from '@/components/dashboard/layout/dashboardLayoutTypes';
import {
  findCatalogOption,
  type Ww360CatalogOption,
} from '@/components/dashboard/layout/ww360WidgetCatalog';

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

function blockFromOption(option: Ww360CatalogOption): DashboardBlock {
  return {
    id: newId('blk'),
    type: option.kind,
    module_id: option.module_id,
    columnSpan: option.columnSpan,
    rowSpan: option.rowSpan,
    config: { ...(option.config || {}) },
  };
}

export const SimplifiedWorkspaceDashboard: React.FC<SimplifiedWorkspaceDashboardProps> = ({
  profile,
  personaKey,
}) => {
  const { user } = useAuth();
  const { isPreviewMode } = useImpersonation();
  const [metrics, setMetrics] = useState<ResolvedMetricBundle | null>(null);
  const [layout, setLayout] = useState<DashboardLayoutV2>(emptyLayout());
  const [savedSnapshot, setSavedSnapshot] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [layoutTick, setLayoutTick] = useState(0);
  const [isEditMode, setIsEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [pickerRowId, setPickerRowId] = useState<string | null>(null);

  const baseCopy = PROFILE_COPY[profile];
  const personaCopy = personaKey ? PERSONA_HEADLINES[personaKey] : undefined;
  const copy = {
    eyebrow: baseCopy.eyebrow,
    title: personaCopy?.title ?? baseCopy.title,
    description: personaCopy?.description ?? baseCopy.description,
  };

  const dirty = useMemo(
    () => JSON.stringify(layout) !== savedSnapshot,
    [layout, savedSnapshot]
  );

  const usedIds = useMemo(() => usedUniqueModuleIds(layout), [layout]);

  const reloadLayout = useCallback(() => {
    void fetchWorkspaceLayout(profile, personaKey)
      .then(res => {
        setLayout(res.layout);
        setSavedSnapshot(JSON.stringify(res.layout));
      })
      .catch(() => {
        setLayout(emptyLayout());
        setSavedSnapshot(JSON.stringify(emptyLayout()));
      });
  }, [profile, personaKey]);

  useEffect(() => {
    const onSaved = () => setLayoutTick(t => t + 1);
    window.addEventListener(LAYOUT_SAVED_EVENT, onSaved);
    return () => window.removeEventListener(LAYOUT_SAVED_EVENT, onSaved);
  }, []);

  useEffect(() => {
    const onEdit = (e: Event) => {
      const detail = (e as CustomEvent<{ edit?: boolean }>).detail;
      if (detail?.edit) setIsEditMode(true);
    };
    window.addEventListener(EDIT_MODE_EVENT, onEdit);
    return () => window.removeEventListener(EDIT_MODE_EVENT, onEdit);
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSavedNote(null);
    try {
      const res = await saveWorkspaceLayout(profile, layout, personaKey);
      setLayout(res.layout);
      setSavedSnapshot(JSON.stringify(res.layout));
      setSavedNote('Saved. Your home will use this layout next visit.');
      window.dispatchEvent(new CustomEvent(LAYOUT_SAVED_EVENT));
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (err instanceof Error ? err.message : 'Save failed');
      setError(String(detail));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await resetWorkspaceLayout(profile, personaKey);
      setLayout(res.layout);
      setSavedSnapshot(JSON.stringify(res.layout));
      setSavedNote('Reset to the default layout for this role.');
      window.dispatchEvent(new CustomEvent(LAYOUT_SAVED_EVENT));
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (err instanceof Error ? err.message : 'Reset failed');
      setError(String(detail));
    } finally {
      setSaving(false);
    }
  };

  const addRow = () => {
    setLayout(prev => ({
      ...prev,
      rows: [...prev.rows, createEmptyRowWithChart()],
    }));
  };

  const addChartToRow = (rowId: string) => {
    setLayout(prev => ({
      ...prev,
      rows: prev.rows.map(row => {
        if (row.id !== rowId) return row;
        if (!canFitWidgetInRow(row.blocks, 1)) return row;
        const blocks = row.blocks.map(b =>
          isLoneFullChart(b, row.blocks) ? { ...b, columnSpan: 1 as const } : b
        );
        return { ...row, blocks: [...blocks, createChartBlock(1)] };
      }),
    }));
  };

  const addWidgetOption = (option: Ww360CatalogOption, targetRowId: string | null) => {
    const block = blockFromOption(option);
    setLayout(prev => {
      if (option.unique && usedUniqueModuleIds(prev).has(option.module_id)) {
        return prev;
      }
      const target = targetRowId ? prev.rows.find(r => r.id === targetRowId) : null;
      if (target && canFitWidgetInRow(target.blocks, option.columnSpan)) {
        return {
          ...prev,
          rows: prev.rows.map(r =>
            r.id === target.id ? { ...r, blocks: [...r.blocks, block] } : r
          ),
        };
      }
      return {
        ...prev,
        rows: [...prev.rows, { id: newId('row'), blocks: [block] }],
      };
    });
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setLayout(prev => {
      const rowIds = prev.rows.map(r => r.id);
      if (rowIds.includes(String(active.id)) && rowIds.includes(String(over.id))) {
        const oldIndex = rowIds.indexOf(String(active.id));
        const newIndex = rowIds.indexOf(String(over.id));
        return { ...prev, rows: arrayMove(prev.rows, oldIndex, newIndex) };
      }

      // Block reorder within same row
      for (const row of prev.rows) {
        const ids = row.blocks.map(b => b.id);
        if (ids.includes(String(active.id)) && ids.includes(String(over.id))) {
          const oldIndex = ids.indexOf(String(active.id));
          const newIndex = ids.indexOf(String(over.id));
          return {
            ...prev,
            rows: prev.rows.map(r =>
              r.id === row.id ? { ...r, blocks: arrayMove(r.blocks, oldIndex, newIndex) } : r
            ),
          };
        }
      }
      return prev;
    });
  };

  const allowRowSpanFor = (block: DashboardBlock) => {
    const opt = findCatalogOption(block.module_id);
    return Boolean(opt?.allowRowSpan || block.type === 'chart');
  };

  const renderBlock = (block: DashboardBlock): React.ReactNode => {
    const tall = block.rowSpan >= 2;

    if (block.type === 'chart' || block.module_id === 'trend_chart') {
      const charts = metrics?.charts || [];
      if (charts.length === 0) {
        return (
          <Ww360Section title="Trend chart" tourId="workspace-chart-empty">
            <p className="text-base text-slate-500">
              No chart data for this role yet. Metrics will appear when available.
            </p>
          </Ww360Section>
        );
      }
      const chartBlocks = layout.rows
        .flatMap(r => r.blocks)
        .filter(b => b.type === 'chart' || b.module_id === 'trend_chart');
      const idx = Math.max(0, chartBlocks.findIndex(b => b.id === block.id)) % charts.length;
      return (
        <WorkspaceChartPanel
          chart={charts[idx]}
          color={idx % 2 === 0 ? '#2563eb' : '#0f766e'}
          tourId={idx === 0 ? 'workspace-charts' : `workspace-chart-${idx}`}
          tall={tall}
        />
      );
    }

    if (block.type === 'metric') {
      const metricId = String(block.config?.metricId || block.module_id.replace(/^metric:/, ''));
      return <WorkforceMetricCard metricId={metricId as WorkforceMetricId} />;
    }

    if (block.type === 'metric_group') {
      const groupId = String(
        block.config?.groupId || block.module_id.replace(/^metric_group:/, '')
      );
      return <WorkforceMetricGroupCard groupId={groupId as WorkforceMetricGroupId} />;
    }

    switch (block.module_id) {
      case 'kpi_headline':
        if (!metrics) return null;
        return (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" data-tour="workspace-kpis">
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
        );
      case 'federal_jobs':
        return <UsajobsJobListingsPanel tourId="federal-jobs" />;
      case 'water_systems':
        return (
          <Ww360Section
            title="Water systems landscape"
            tourId="water-systems"
            dataMode="live"
          >
            <p className="mb-4 text-[1.125rem] text-slate-600">
              EPA SDWIS community water systems and compliance context for your state.
            </p>
            <Button asChild className="min-h-[44px] text-base">
              <Link to="/water-systems">
                <Droplets className="mr-2 h-4 w-4" />
                Open landscape
              </Link>
            </Button>
          </Ww360Section>
        );
      case 'continuity':
        return (
          <Ww360Section
            title="Workforce continuity"
            tourId="continuity"
            dataMode="mixed"
          >
            <p className="mb-4 text-[1.125rem] text-slate-600">
              Succession, vacancies, and CEU renewal pressure.
            </p>
            <Button asChild variant="outline" className="min-h-[44px] text-base">
              <Link to="/continuity">
                <Workflow className="mr-2 h-4 w-4" />
                Open Continuity
              </Link>
            </Button>
          </Ww360Section>
        );
      case 'upcoming_training':
        return (
          <Ww360Section
            title="Upcoming training"
            tourId="upcoming-training"
            dataMode="mixed"
          >
            <p className="mb-4 text-[1.125rem] text-slate-600">
              Scheduled workforce training events from Continuity.
            </p>
            <UpcomingTrainingWidget />
          </Ww360Section>
        );
      case 'document_studio':
        return <DocumentStudioPanel tourId="document-studio" />;
      case 'opcert_program':
        return <OpCertProgramPanel />;
      case 'national_overview':
        return (
          <Ww360Section
            title="US / national overview"
            tourId="national-overview"
            dataMode="mixed"
          >
            <p className="mb-4 text-[1.125rem] text-slate-600">
              United States headline KPIs and state scorecards.
            </p>
            <Button asChild variant="outline" className="min-h-[44px] text-base">
              <Link to="/national">
                US overview
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </Ww360Section>
        );
      case 'sources_freshness':
        return (
          <Ww360Section
            title="Data sources & freshness"
            tourId="sources-freshness"
            dataMode="mixed"
          >
            <p className="mb-4 text-[1.125rem] text-slate-600">
              Live public adapters vs illustrative demo packs — every tile is labeled.
            </p>
            <ul className="space-y-2 text-[1rem] text-slate-600">
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
        );
      default:
        return (
          <div className="rounded-lg border border-slate-200 bg-white p-4 text-base text-slate-500">
            Unknown panel: {block.module_id}
          </div>
        );
    }
  };

  const pickerTargetBlocks =
    layout.rows.find(r => r.id === pickerRowId)?.blocks || [];

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 p-4 md:p-6" data-tour="simplified-dashboard">
      <WorkspaceTourOverlay
        profile={profile}
        {...(personaKey != null ? { personaKey } : {})}
        autoOpen
      />
      <Ww360PageHero
        eyebrow={copy.eyebrow}
        title={ww360PersonalizedTitle(user, copy.title)}
        description={copy.description}
        dataMode={metrics?.headlineMode ?? 'sample'}
      />

      <DashboardEditChrome
        isEditMode={isEditMode}
        saving={saving}
        isPreviewMode={isPreviewMode}
        dirty={dirty}
        savedNote={savedNote}
        error={error}
        onEnterEdit={() => setIsEditMode(true)}
        onExitEdit={() => setIsEditMode(false)}
        onSave={() => void handleSave()}
        onReset={() => void handleReset()}
      />

      {loading && (
        <p className="text-[1.125rem] text-slate-500">Loading workspace metrics…</p>
      )}

      {!loading && layout.rows.length === 0 && !isEditMode && (
        <p className="text-[1.125rem] text-slate-600">
          No panels are on your home yet. Click <strong>Enter Edit Mode</strong> or{' '}
          <strong>Customize home</strong> in the sidebar to add rows and panels.
        </p>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext
          items={layout.rows.map(r => r.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-6">
            {layout.rows.map(row => (
              <SortableDashboardRow
                key={row.id}
                row={row}
                isEditMode={isEditMode}
                renderBlock={renderBlock}
                allowRowSpanFor={allowRowSpanFor}
                onAddChart={addChartToRow}
                onAddWidget={rowId => setPickerRowId(rowId)}
                onRemoveRow={rowId =>
                  setLayout(prev => ({
                    ...prev,
                    rows: prev.rows.filter(r => r.id !== rowId),
                  }))
                }
                onRemoveBlock={(rowId, blockId) =>
                  setLayout(prev => ({
                    ...prev,
                    rows: prev.rows
                      .map(r =>
                        r.id === rowId
                          ? { ...r, blocks: r.blocks.filter(b => b.id !== blockId) }
                          : r
                      )
                      .filter(r => r.blocks.length > 0 || isEditMode),
                  }))
                }
                onColumnSpanChange={(rowId, blockId, span) =>
                  setLayout(prev => ({
                    ...prev,
                    rows: prev.rows.map(r =>
                      r.id === rowId
                        ? {
                            ...r,
                            blocks: r.blocks.map(b =>
                              b.id === blockId ? { ...b, columnSpan: span } : b
                            ),
                          }
                        : r
                    ),
                  }))
                }
                onRowSpanChange={(rowId, blockId, span) =>
                  setLayout(prev => ({
                    ...prev,
                    rows: prev.rows.map(r =>
                      r.id === rowId
                        ? {
                            ...r,
                            blocks: r.blocks.map(b =>
                              b.id === blockId ? { ...b, rowSpan: span } : b
                            ),
                          }
                        : r
                    ),
                  }))
                }
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {isEditMode && (
        <Button
          type="button"
          variant="outline"
          className="min-h-[44px] w-full gap-2 border-dashed text-base"
          onClick={addRow}
          data-tour="add-row"
        >
          <Plus className="h-4 w-4" />
          Add Row
        </Button>
      )}

      <WidgetPickerDialog
        open={pickerRowId !== null}
        onOpenChange={open => {
          if (!open) setPickerRowId(null);
        }}
        profile={profile}
        targetBlocks={pickerTargetBlocks}
        usedModuleIds={usedIds}
        onSelect={option => addWidgetOption(option, pickerRowId)}
      />
    </div>
  );
};

function isLoneFullChart(block: DashboardBlock, blocks: DashboardBlock[]): boolean {
  return (
    blocks.length === 1 &&
    block.columnSpan === 3 &&
    (block.type === 'chart' || block.module_id === 'trend_chart')
  );
}
