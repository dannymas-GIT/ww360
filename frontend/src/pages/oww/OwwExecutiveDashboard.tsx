import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowRight,
  BookOpen,
  CircleHelp,
  Clock3,
  Download,
  ExternalLink,
  GraduationCap,
  Lock,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/context/AuthContext';
import { OwwTourOverlay, requestOpenOwwTour } from './OwwTourOverlay';
import {
  OWW_PRIVILEGE_GROUPS,
  OWW_PRIVILEGE_STATUS_LABEL,
  type PrivilegeStatus,
} from './owwPrivileges';
import {
  EPA_MEASURES,
  EPA_REPORTING,
  LS_DELIVERY_MIX,
  LS_MONTHLY,
  LS_SUMMARY,
  LS_UPCOMING_COURSES,
  OWW_INSIGHTS,
  PIPELINE_STAGES,
  WEB_AUDIENCE,
  WEB_MONTHLY_SIGNUPS,
  WEB_REFERRALS,
  WEB_SUMMARY,
  WEB_TOP_PAGES,
  WW360_REGION_DEMAND,
  WW360_SUMMARY,
  WW360_TRAINING_NEEDS,
  formatCompact,
  formatPct,
  formatShortDate,
  formatUsd,
  regionGap,
  regionRisk,
} from './owwMockData';
import { fetchWorkforceInsights, type SDWISWorkforceInsights } from '@/services/sdwisService';
import { Ww360KpiTile } from '@/components/ww360/Ww360KpiTile';
import { Ww360PageHero } from '@/components/ww360/Ww360PageHero';
import { Ww360Section } from '@/components/ww360/Ww360Section';
import { Ww360SourceChip } from '@/components/ww360/Ww360SourceChip';
import { ww360ChartTooltipStyle } from '@/components/ww360/ww360ChartTooltip';
import { ww360Greeting } from '@/components/ww360/ww360Greeting';
import type { Ww360SourceId } from '@/components/ww360/ww360SourceTokens';
import type { Ww360DataMode } from '@/components/ww360/Ww360DataModeBadge';
import { AlertTriangle, Droplets } from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Palette (WW360 chrome: deep navy, electric blue, sky accent)         */
/* ------------------------------------------------------------------ */

const C = {
  blue: '#2563eb',
  sky: '#38bdf8',
  teal: '#0f766e',
  amber: '#f59e0b',
  red: '#ef4444',
  slate: '#94a3b8',
  navy: '#07111f',
};

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

type Range = '30d' | 'qtr' | '12mo';

interface ExecKpi {
  id: string;
  label: string;
  value: string;
  sub: string;
  delta?: number;
  invert?: boolean;
  icon: React.ReactNode;
  sources: Ww360SourceId[];
  target?: string;
  dataMode: Ww360DataMode;
}

interface SourceStatusCard {
  id: string;
  label: string;
  detail: string;
  health: 'ok' | 'degraded' | 'stale';
  statusLabel: string;
  recordsLabel: string;
}

const tooltipStyle = ww360ChartTooltipStyle;

export default function OwwExecutiveDashboard() {
  const { userRoles } = useAuth();
  const location = useLocation();
  const [range, setRange] = useState<Range>('12mo');
  const [regionSort, setRegionSort] = useState<'gap' | 'retirements' | 'utilities'>('gap');
  const [sdwisInsights, setSdwisInsights] = useState<SDWISWorkforceInsights | null>(null);
  const [sdwisLoading, setSdwisLoading] = useState(true);

  useEffect(() => {
    const id = (location.hash || '').replace(/^#/, '');
    if (!id) return;
    const t = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    return () => window.clearTimeout(t);
  }, [location.hash, sdwisLoading]);

  useEffect(() => {
    let cancelled = false;
    void fetchWorkforceInsights('NY')
      .then(data => {
        if (!cancelled) setSdwisInsights(data);
      })
      .catch(() => {
        if (!cancelled) setSdwisInsights(null);
      })
      .finally(() => {
        if (!cancelled) setSdwisLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const sourceCards: SourceStatusCard[] = useMemo(() => {
    const sdwisOk = Boolean(sdwisInsights) && !sdwisLoading;
    const memberUtils = Number(sdwisInsights?.coverage?.member_utilities ?? 0);
    return [
      {
        id: 'sdwis',
        label: 'EPA SDWIS / ECHO',
        detail: 'NY community water systems · compliance landscape (federal open data)',
        health: sdwisOk ? 'ok' : sdwisLoading ? 'degraded' : 'stale',
        statusLabel: sdwisOk
          ? `Synced ${sdwisInsights?.last_refreshed ? new Date(sdwisInsights.last_refreshed).toLocaleString() : 'recently'}`
          : sdwisLoading
            ? 'Refreshing…'
            : 'Unavailable — run Admin → SDWIS refresh',
        recordsLabel: sdwisOk
          ? `${sdwisInsights!.active_cws_count.toLocaleString()} systems · ${memberUtils} linked members`
          : '—',
      },
      {
        id: 'learning-stream',
        label: 'Learning Stream',
        detail: 'LMS system of record — not connected yet (XML API pending)',
        health: 'stale',
        statusLabel: 'Not connected · showing sample',
        recordsLabel: 'Sample figures only',
      },
      {
        id: 'oww-web',
        label: 'onewaterworkforce.org',
        detail: 'Member sign-ups · pipeline · job board — not connected yet',
        health: 'stale',
        statusLabel: 'Not connected · showing sample',
        recordsLabel: 'Sample figures only',
      },
      {
        id: 'ww360',
        label: 'Water Workforce 360 utilities',
        detail: 'Employer staffing / vacancies / retirements from Continuity workspace',
        health: 'stale',
        statusLabel: 'Live tables empty / API pending · showing sample',
        recordsLabel: 'Sample employer demand',
      },
    ];
  }, [sdwisInsights, sdwisLoading]);

  const kpis: ExecKpi[] = useMemo(() => {
    const live: ExecKpi[] = sdwisInsights
      ? [
          {
            id: 'cws',
            label: 'NY active CWS',
            value: sdwisInsights.active_cws_count.toLocaleString(),
            sub: 'Community water systems in SDWIS landscape',
            icon: <Droplets className="h-4 w-4" />,
            sources: ['sdwis'],
            dataMode: 'live',
          },
          {
            id: 'pop',
            label: 'Population served',
            value: formatCompact(sdwisInsights.total_population_served),
            sub: 'Sum of EPA population_served_count',
            icon: <Users className="h-4 w-4" />,
            sources: ['sdwis'],
            dataMode: 'live',
          },
          {
            id: 'health-vio',
            label: 'Health-based violations',
            value: sdwisInsights.health_violation_systems.toLocaleString(),
            sub: 'Systems with open health-based flags',
            icon: <AlertTriangle className="h-4 w-4" />,
            sources: ['sdwis'],
            dataMode: 'live',
            invert: true,
          },
          {
            id: 'snc',
            label: 'Serious / SNC',
            value: sdwisInsights.snc_count.toLocaleString(),
            sub: 'Serious violators / significant non-compliers',
            icon: <ShieldCheck className="h-4 w-4" />,
            sources: ['sdwis'],
            dataMode: 'live',
            invert: true,
          },
        ]
      : [];

    const sample: ExecKpi[] = [
      {
        id: 'members',
        label: 'OWW members',
        value: WEB_SUMMARY.members.toLocaleString(),
        sub: `+${WEB_SUMMARY.newMembers30d} in 30 days (sample)`,
        delta: 0.089,
        icon: <Users className="h-4 w-4" />,
        sources: ['oww-web'],
        target: '300 enrolled in pathway · 212 so far',
        dataMode: 'sample',
      },
      {
        id: 'ce-hours',
        label: 'Contact hours (YTD)',
        value: formatCompact(LS_SUMMARY.ceHoursYtd),
        sub: `${LS_SUMMARY.attendedYtd.toLocaleString()} attendances (sample)`,
        delta: 0.174,
        icon: <GraduationCap className="h-4 w-4" />,
        sources: ['learning-stream'],
        target: '2,500 grant-attributed hrs · 1,930 so far',
        dataMode: 'sample',
      },
      {
        id: 'retirements',
        label: 'Retirements · 24 mo',
        value: `${WW360_SUMMARY.retirements24mo}`,
        sub: `${WW360_SUMMARY.criticalNoSuccessor} critical · no successor (sample)`,
        delta: 0.061,
        invert: true,
        icon: <Clock3 className="h-4 w-4" />,
        sources: ['ww360'],
        dataMode: 'sample',
      },
      {
        id: 'placements',
        label: 'Employment connections',
        value: '31',
        sub: `${WW360_SUMMARY.vacancies} open positions (sample)`,
        delta: 0.35,
        icon: <UserCheck className="h-4 w-4" />,
        sources: ['ww360', 'oww-web'],
        target: '60 placements · 52% reached',
        dataMode: 'sample',
      },
    ];

    return [...live, ...sample].slice(0, 8);
  }, [sdwisInsights]);

  const sdwisGradeSeries = useMemo(() => {
    const grades = sdwisInsights?.grade_demand_estimate || {};
    return Object.entries(grades)
      .map(([grade, systems]) => ({ grade, systems: Number(systems) || 0 }))
      .sort((a, b) => b.systems - a.systems);
  }, [sdwisInsights]);

  const sdwisSizeSeries = useMemo(() => {
    const tiers = sdwisInsights?.size_tiers || {};
    const order = ['very_small', 'small', 'medium', 'large', 'very_large'];
    const labels: Record<string, string> = {
      very_small: 'Very small',
      small: 'Small',
      medium: 'Medium',
      large: 'Large',
      very_large: 'Very large',
    };
    return order
      .filter(k => k in tiers)
      .map(k => ({ tier: labels[k] || k, systems: Number(tiers[k]) || 0 }));
  }, [sdwisInsights]);

  const countyPressure = useMemo(() => {
    const rows = [...(sdwisInsights?.compliance_pressure_by_county || [])];
    rows.sort((a, b) => Number(b.pressure_score || 0) - Number(a.pressure_score || 0));
    return rows.slice(0, 12);
  }, [sdwisInsights]);

  const lsSeries = useMemo(() => {
    if (range === '30d') return LS_MONTHLY.slice(-1);
    if (range === 'qtr') return LS_MONTHLY.slice(-3);
    return LS_MONTHLY;
  }, [range]);

  const supplyDemand = useMemo(
    () =>
      WW360_REGION_DEMAND.map(r => ({
        region: r.region.replace('New York City', 'NYC').replace('Capital Region', 'Capital'),
        Openings: r.vacancies + r.retirements24mo,
        Candidates: r.candidates,
      })),
    []
  );

  const regionRows = useMemo(() => {
    const rows = [...WW360_REGION_DEMAND];
    rows.sort((a, b) => {
      if (regionSort === 'gap') return regionGap(b) - regionGap(a);
      if (regionSort === 'retirements') return b.retirements24mo - a.retirements24mo;
      return b.utilities - a.utilities;
    });
    return rows;
  }, [regionSort]);

  const maxPipeline = PIPELINE_STAGES[0]?.count ?? 1;
  const rangeLabel =
    range === '30d' ? 'Last 30 days' : range === 'qtr' ? 'Last quarter' : 'Trailing 12 months';
  const isPlatform = userRoles.includes('platform_admin') || userRoles.includes('global_admin');
  const heroMode: Ww360DataMode = sdwisInsights ? 'mixed' : 'sample';

  return (
    <div className="ww360-app-shell mx-auto w-full max-w-[1440px] space-y-6 p-4 md:p-6">
      {/* Header */}
      <Ww360PageHero
        eyebrow="One Water Workforce · New York Section AWWA"
        title={`${ww360Greeting()}, Jenny — here is the statewide water workforce picture.`}
        description="Live EPA SDWIS compliance for New York, plus sample program metrics for Learning Stream, onewaterworkforce.org, and utility Continuity reporting until those feeds are connected."
        dataMode={heroMode}
        lastSynced={sdwisInsights?.last_refreshed}
        badges={
          isPlatform ? (
            <Badge className="border-transparent bg-white/10 text-white hover:bg-white/10">
              <ShieldCheck className="mr-1 h-3 w-3" aria-hidden /> Platform partner access
            </Badge>
          ) : null
        }
        actions={
          <>
            <div className="inline-flex rounded-lg border border-white/15 bg-white/5 p-0.5 text-xs">
              {(
                [
                  ['30d', '30d'],
                  ['qtr', 'Quarter'],
                  ['12mo', '12 mo'],
                ] as Array<[Range, string]>
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setRange(id)}
                  className={`rounded-md px-3 py-1.5 font-medium transition min-h-[44px] md:min-h-0 ${
                    range === id ? 'bg-white text-slate-900' : 'text-slate-200 hover:bg-white/10'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-white/20 bg-white/5 text-white hover:bg-white/15 hover:text-white min-h-[44px] md:min-h-9"
              onClick={() => requestOpenOwwTour(0)}
            >
              <CircleHelp className="mr-1.5 h-4 w-4" aria-hidden /> Tour
            </Button>
            <Button
              type="button"
              size="sm"
              className="bg-sky-400 text-slate-900 hover:bg-sky-300 min-h-[44px] md:min-h-9"
            >
              <Download className="mr-1.5 h-4 w-4" aria-hidden /> EPA quarterly package
            </Button>
          </>
        }
      />

      {/* Sources */}
      <div data-tour="sources" className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {sourceCards.map(s => (
          <div
            key={s.id}
            className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${
                    s.health === 'ok'
                      ? 'bg-emerald-500'
                      : s.health === 'degraded'
                        ? 'bg-amber-500'
                        : 'bg-slate-400'
                  }`}
                  aria-hidden
                />
                <p className="truncate text-sm font-semibold text-slate-900">{s.label}</p>
              </div>
              <p className="mt-0.5 text-xs leading-snug text-slate-500">{s.detail}</p>
            </div>
            <div className="shrink-0 text-right text-xs text-slate-500 max-w-[45%]">
              <p className="inline-flex items-center gap-1 justify-end">
                <RefreshCw className="h-3 w-3 shrink-0" aria-hidden /> {s.statusLabel}
              </p>
              <p className="mt-0.5 font-medium text-slate-700">{s.recordsLabel}</p>
            </div>
          </div>
        ))}
      </div>

      {/* KPIs */}
      <div data-tour="kpis" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {kpis.map(k => (
          <Ww360KpiTile
            key={k.id}
            label={k.label}
            value={k.value}
            sub={k.sub}
            delta={k.delta}
            invert={k.invert}
            icon={k.icon}
            sources={k.sources}
            target={k.target}
            dataMode={k.dataMode}
          />
        ))}
      </div>

      {/* Water System Landscape (EPA SDWIS — live data) */}
      <Ww360Section
        tourId="sdwis-landscape"
        eyebrow="EPA SDWIS · ECHO"
        title="Water system landscape"
        sources={['sdwis']}
        dataMode={sdwisInsights ? 'live' : 'sample'}
        lastSynced={sdwisInsights?.last_refreshed}
      >
        {sdwisLoading ? (
          <p className="text-sm text-slate-500">Loading state compliance landscape…</p>
        ) : sdwisInsights ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: 'Active CWS', value: sdwisInsights.active_cws_count.toLocaleString() },
                {
                  label: 'Population served',
                  value: formatCompact(sdwisInsights.total_population_served),
                },
                {
                  label: 'Health-based violations',
                  value: sdwisInsights.health_violation_systems.toLocaleString(),
                },
                { label: 'Serious / SNC', value: sdwisInsights.snc_count.toLocaleString() },
              ].map(tile => (
                <div
                  key={tile.label}
                  className="rounded-xl border border-sky-100 bg-sky-50/50 px-4 py-3"
                >
                  <p className="text-xs font-medium text-sky-800">{tile.label}</p>
                  <p className="text-2xl font-semibold tabular-nums text-[#07111f]">{tile.value}</p>
                </div>
              ))}
            </div>
            {sdwisInsights.member_watchlist.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium text-slate-800 flex items-center gap-2">
                  <Droplets className="h-4 w-4 text-sky-600" /> Member utility watchlist
                </p>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Utility</th>
                        <th className="px-3 py-2">PWSID</th>
                        <th className="px-3 py-2">Open violations</th>
                        <th className="px-3 py-2">Suggested training</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sdwisInsights.member_watchlist.slice(0, 8).map(row => (
                        <tr key={String(row.pwsid)} className="border-t">
                          <td className="px-3 py-2 font-medium">{String(row.pws_name || row.district_code)}</td>
                          <td className="px-3 py-2 font-mono text-xs">{String(row.pwsid)}</td>
                          <td className="px-3 py-2">{String(row.open_violations)}</td>
                          <td className="px-3 py-2 text-slate-600">
                            {((row.suggested_training_topics as string[]) || []).join(' · ') || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <p className="text-xs text-slate-500">
              Member coverage: {String(sdwisInsights.coverage.member_utilities)} utilities ·{' '}
              {String(sdwisInsights.coverage.coverage_pct_population)}% of state population in landscape.
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            SDWIS landscape unavailable — run state refresh from Administration or wait for nightly sync.
          </p>
        )}
      </Ww360Section>

      {/* Pipeline + Supply/Demand */}
      <div className="grid gap-6 lg:grid-cols-5">
        <Ww360Section
          tourId="pipeline"
          eyebrow="Candidate journey"
          title="Pipeline: awareness → employment"
          sources={['oww-web', 'learning-stream', 'ww360']}
          dataMode="sample"
          className="lg:col-span-2"
        >
          <ol className="space-y-2.5">
            {PIPELINE_STAGES.map((p, i) => {
              const prev = i > 0 ? PIPELINE_STAGES[i - 1].count : null;
              const conv = prev ? p.count / prev : null;
              return (
                <li key={p.stage}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium text-slate-800">{p.stage}</span>
                    <span className="tabular-nums text-slate-700">
                      {p.count.toLocaleString()}
                      {conv != null ? (
                        <span className="ml-2 text-xs text-slate-400">
                          {formatPct(conv)} of prior
                        </span>
                      ) : null}
                    </span>
                  </div>
                  <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(3, (p.count / maxPipeline) * 100)}%`,
                        background: `linear-gradient(90deg, ${C.blue}, ${C.sky})`,
                      }}
                    />
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-500">{p.description}</p>
                </li>
              );
            })}
          </ol>
          <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
            <span className="font-semibold text-slate-800">Where to push:</span> the largest drop is
            Engaged → Exploring (56%). A guided career-path assessment email to new members
            typically lifts this step; Exam-ready → Employed (26%) is the matching problem addressed
            below.
          </div>
        </Ww360Section>

        <Ww360Section
          tourId="supply-demand"
          eyebrow="Employer demand vs. candidate supply"
          title="Openings expected in 24 months vs. candidates in training, by region"
          sources={['ww360', 'oww-web']}
          dataMode="sample"
          className="lg:col-span-3"
        >
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={supplyDemand}
                margin={{ top: 8, right: 8, left: -12, bottom: 24 }}
                barGap={2}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="region"
                  tick={{ fontSize: 11, fill: '#475569' }}
                  interval={0}
                  angle={-28}
                  textAnchor="end"
                  height={54}
                />
                <YAxis tick={{ fontSize: 11, fill: '#475569' }} allowDecimals={false} />
                <Tooltip {...tooltipStyle} cursor={{ fill: 'rgba(37,99,235,0.06)' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} verticalAlign="top" align="right" />
                <Bar dataKey="Openings" fill={C.navy} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Candidates" fill={C.sky} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-red-100 bg-red-50 p-3">
              <p className="text-xs font-semibold text-red-800">Supply gaps</p>
              <p className="mt-0.5 text-xs text-red-700">
                North Country (−4), Mohawk Valley (−1) — small systems, early-stage candidates.
              </p>
            </div>
            <div className="rounded-lg border border-amber-100 bg-amber-50 p-3">
              <p className="text-xs font-semibold text-amber-800">Timing risk</p>
              <p className="mt-0.5 text-xs text-amber-700">
                Long Island: 35 openings, 46 candidates — but only 19 exam-ready before Q2
                retirements.
              </p>
            </div>
            <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3">
              <p className="text-xs font-semibold text-emerald-800">Deep bench</p>
              <p className="mt-0.5 text-xs text-emerald-700">
                NYC, Western NY, Finger Lakes — surplus candidates could be referred to adjacent
                regions.
              </p>
            </div>
          </div>
        </Ww360Section>
      </div>

      {/* Learning Stream */}
      <Ww360Section
        tourId="learning-stream"
        eyebrow="Learning Stream · system of record"
        title={`Training delivery — ${rangeLabel}`}
        sources={['learning-stream']}
        dataMode="sample"
        action={
          <a
            className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 hover:underline"
            href="https://www.learningstream.com"
            target="_blank"
            rel="noreferrer"
          >
            Open Learning Stream <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        }
      >
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ['Registrations', LS_SUMMARY.registrationsYtd.toLocaleString()],
                ['Unique learners', LS_SUMMARY.uniqueLearners.toLocaleString()],
                ['Avg fill rate', formatPct(LS_SUMMARY.avgFillRate)],
                ['Revenue', formatUsd(LS_SUMMARY.revenueYtd)],
              ].map(([l, v]) => (
                <div key={l} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">{l}</p>
                  <p className="text-lg font-semibold text-slate-900">{v}</p>
                </div>
              ))}
            </div>
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={lsSeries} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="owwReg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C.blue} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={C.blue} stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="owwCe" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C.sky} stopOpacity={0.4} />
                      <stop offset="100%" stopColor={C.sky} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#475569' }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#475569' }} />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 11, fill: '#475569' }}
                  />
                  <Tooltip {...tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="registrations"
                    name="Registrations"
                    stroke={C.blue}
                    fill="url(#owwReg)"
                    strokeWidth={2}
                  />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="attended"
                    name="Attended"
                    stroke={C.teal}
                    fill="transparent"
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                  />
                  <Area
                    yAxisId="right"
                    type="monotone"
                    dataKey="ceHours"
                    name="CE hours"
                    stroke={C.sky}
                    fill="url(#owwCe)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="lg:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Delivery mix
            </p>
            <div className="flex items-center gap-4">
              <div className="h-[150px] w-[150px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={LS_DELIVERY_MIX}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={42}
                      outerRadius={68}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {LS_DELIVERY_MIX.map((d, i) => (
                        <Cell key={d.name} fill={[C.blue, C.navy, C.sky][i % 3]} />
                      ))}
                    </Pie>
                    <Tooltip {...tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="space-y-1.5 text-sm">
                {LS_DELIVERY_MIX.map((d, i) => {
                  const total = LS_DELIVERY_MIX.reduce((s, x) => s + x.value, 0);
                  return (
                    <li key={d.name} className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-sm"
                        style={{ background: [C.blue, C.navy, C.sky][i % 3] }}
                        aria-hidden
                      />
                      <span className="text-slate-700">{d.name}</span>
                      <span className="ml-auto tabular-nums text-slate-500">
                        {formatPct(d.value / total)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Upcoming calendar · fill & waitlist
            </p>
            <ul className="mt-2 divide-y divide-slate-100 text-sm">
              {LS_UPCOMING_COURSES.map(c => {
                const fill = c.registered / c.seats;
                return (
                  <li key={c.id} className="py-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-800">{c.course}</p>
                        <p className="text-[11px] text-slate-500">
                          {formatShortDate(c.nextSession)} · {c.delivery} · Grade {c.grade} ·{' '}
                          {c.ceHours} hrs
                        </p>
                      </div>
                      <div className="shrink-0 text-right text-xs">
                        <p
                          className={`font-semibold ${fill >= 0.9 ? 'text-red-600' : 'text-slate-700'}`}
                        >
                          {c.registered}/{c.seats}
                        </p>
                        {c.waitlist ? (
                          <p className="text-amber-700">+{c.waitlist} waitlist</p>
                        ) : (
                          <p className="text-slate-400">{formatPct(fill)} full</p>
                        )}
                      </div>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, fill * 100)}%`,
                          background: fill >= 0.9 ? C.red : fill >= 0.7 ? C.amber : C.blue,
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </Ww360Section>

      {/* Website + grade demand */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Ww360Section
          tourId="web"
          eyebrow="onewaterworkforce.org"
          title="Member growth & job board"
          sources={['oww-web']}
          dataMode="sample"
        >
          <div className="h-[180px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={WEB_MONTHLY_SIGNUPS}
                margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#475569' }} />
                <YAxis tick={{ fontSize: 10, fill: '#475569' }} />
                <Tooltip {...tooltipStyle} cursor={{ fill: 'rgba(37,99,235,0.06)' }} />
                <Bar dataKey="signups" name="Member sign-ups" fill={C.teal} radius={[3, 3, 0, 0]} />
                <Bar
                  dataKey="jobApplications"
                  name="Job applications"
                  fill={C.sky}
                  radius={[3, 3, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Who is joining
          </p>
          <ul className="mt-1.5 space-y-1 text-sm">
            {WEB_AUDIENCE.map(a => {
              const total = WEB_AUDIENCE.reduce((s, x) => s + x.value, 0);
              return (
                <li key={a.name} className="flex items-center gap-2">
                  <span className="w-40 truncate text-slate-700">{a.name}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-teal-600"
                      style={{ width: `${(a.value / total) * 100}%` }}
                    />
                  </div>
                  <span className="w-10 text-right text-xs tabular-nums text-slate-500">
                    {a.value}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Top referral sources
          </p>
          <ul className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-600">
            {WEB_REFERRALS.map(r => (
              <li key={r.source} className="flex justify-between gap-2">
                <span className="truncate">{r.source}</span>
                <span className="tabular-nums text-slate-800">{formatPct(r.share)}</span>
              </li>
            ))}
          </ul>
        </Ww360Section>

        <Ww360Section
          tourId="grades"
          eyebrow="EPA SDWIS · system inventory"
          title="NY systems by size & estimated grade"
          sources={['sdwis']}
          dataMode={sdwisInsights ? 'live' : 'sample'}
          lastSynced={sdwisInsights?.last_refreshed}
        >
          {sdwisGradeSeries.length > 0 ? (
            <>
              <div className="h-[180px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={sdwisGradeSeries}
                    layout="vertical"
                    margin={{ top: 4, right: 12, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#475569' }} />
                    <YAxis
                      type="category"
                      dataKey="grade"
                      width={36}
                      tick={{ fontSize: 11, fill: '#475569' }}
                    />
                    <Tooltip {...tooltipStyle} cursor={{ fill: 'rgba(37,99,235,0.06)' }} />
                    <Bar
                      dataKey="systems"
                      name="Systems (grade proxy from size)"
                      fill={C.navy}
                      radius={[0, 3, 3, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {sdwisSizeSeries.length > 0 ? (
                <div className="mt-3 h-[120px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sdwisSizeSeries} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="tier" tick={{ fontSize: 10, fill: '#475569' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#475569' }} />
                      <Tooltip {...tooltipStyle} />
                      <Bar dataKey="systems" name="Systems" fill={C.sky} radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : null}
              <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
                Grade bands are a <span className="font-semibold text-slate-800">size-based proxy</span>{' '}
                from SDWIS population tiers (not license inventory). Link PWSIDs under Admin → PWSID
                links to build a true member watchlist.
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-500">Load SDWIS landscape to see grade and size charts.</p>
          )}
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Training needs reported by utilities <span className="font-normal text-amber-700">(sample)</span>
          </p>
          <ul className="mt-1.5 space-y-1 text-sm">
            {WW360_TRAINING_NEEDS.slice(0, 5).map(t => (
              <li key={t.topic} className="flex items-center justify-between gap-2">
                <span className="truncate text-slate-700">{t.topic}</span>
                <span className="shrink-0 text-xs text-slate-500">
                  <span className="font-medium text-slate-800">{t.utilities}</span> utilities ·{' '}
                  {t.operators} operators
                </span>
              </li>
            ))}
          </ul>
        </Ww360Section>

        <Ww360Section
          tourId="epa"
          eyebrow="EPA Area 3 · cooperative agreement"
          title="Program measures"
          sources={['ww360', 'learning-stream', 'oww-web']}
          dataMode="sample"
        >
          <ul className="space-y-3">
            {EPA_MEASURES.map(m => {
              const pct = Math.min(1, m.actual / m.target);
              return (
                <li key={m.id}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate text-slate-800">
                      <span className="mr-1.5 rounded bg-slate-100 px-1 py-0.5 text-[10px] font-semibold text-slate-600">
                        {m.task}
                      </span>
                      {m.label}
                    </span>
                    <span className="shrink-0 tabular-nums text-xs text-slate-600">
                      <span className="font-semibold text-slate-900">
                        {m.actual.toLocaleString()}
                      </span>{' '}
                      / {m.target.toLocaleString()}
                      {m.unit ? ` ${m.unit}` : ''}
                    </span>
                  </div>
                  <Progress
                    value={pct * 100}
                    className="mt-1 h-2 bg-slate-100"
                    indicatorClassName={
                      pct >= 0.66 ? 'bg-blue-600' : pct >= 0.4 ? 'bg-sky-400' : 'bg-amber-500'
                    }
                  />
                </li>
              );
            })}
          </ul>
          <div className="mt-4 rounded-lg border border-sky-100 bg-sky-50 p-3">
            <div className="flex items-center justify-between text-xs">
              <p className="font-semibold text-sky-900">{EPA_REPORTING.period}</p>
              <p className="text-sky-800">
                Due {formatShortDate(EPA_REPORTING.dueDate)} · {formatPct(EPA_REPORTING.readiness)}{' '}
                ready
              </p>
            </div>
            <ul className="mt-1.5 list-disc pl-4 text-xs text-sky-900/80">
              {EPA_REPORTING.openItems.map(i => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </div>
        </Ww360Section>
      </div>

      {/* Live county compliance pressure */}
      <Ww360Section
        tourId="county-pressure"
        eyebrow="EPA SDWIS · ECHO"
        title="County compliance pressure (NY)"
        sources={['sdwis']}
        dataMode={sdwisInsights ? 'live' : 'sample'}
        lastSynced={sdwisInsights?.last_refreshed}
      >
        {countyPressure.length === 0 ? (
          <p className="text-sm text-slate-500">
            {sdwisLoading ? 'Loading county pressure…' : 'No county pressure rows yet — refresh SDWIS.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3 font-semibold">County</th>
                  <th className="py-2 pr-3 text-right font-semibold">Systems</th>
                  <th className="py-2 pr-3 text-right font-semibold">Population</th>
                  <th className="py-2 pr-3 text-right font-semibold">Health flags</th>
                  <th className="py-2 pr-3 text-right font-semibold">SNC</th>
                  <th className="py-2 pr-3 text-right font-semibold">Serious</th>
                  <th className="py-2 text-right font-semibold">Pressure</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {countyPressure.map(row => (
                  <tr key={String(row.county)}>
                    <td className="py-2 pr-3 font-medium text-slate-900">{String(row.county)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-slate-700">
                      {Number(row.linked_systems_count || 0).toLocaleString()}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-slate-700">
                      {formatCompact(Number(row.population_served_total || 0))}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-slate-700">
                      {Number(row.health_flag_count || 0).toLocaleString()}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-slate-700">
                      {Number(row.snc_count || 0).toLocaleString()}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-slate-700">
                      {Number(row.serious_violator_count || 0).toLocaleString()}
                    </td>
                    <td className="py-2 text-right">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums ${
                          Number(row.pressure_score || 0) >= 80
                            ? 'border-red-200 bg-red-50 text-red-700'
                            : Number(row.pressure_score || 0) >= 50
                              ? 'border-amber-200 bg-amber-50 text-amber-800'
                              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        }`}
                      >
                        {Number(row.pressure_score || 0).toFixed(0)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Ww360Section>

      {/* Regions (sample employer demand until Continuity feeds are populated) */}
      <Ww360Section
        tourId="regions"
        eyebrow="Water Workforce 360 · employer reporting"
        title="Regional workforce risk"
        sources={['ww360', 'oww-web']}
        dataMode="sample"
        action={
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 text-xs">
            {(
              [
                ['gap', 'Supply gap'],
                ['retirements', 'Retirements'],
                ['utilities', 'Utilities'],
              ] as Array<[typeof regionSort, string]>
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setRegionSort(id)}
                className={`rounded-md px-2.5 py-1 font-medium ${
                  regionSort === id
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3 font-semibold">Region</th>
                <th className="py-2 pr-3 text-right font-semibold">Utilities</th>
                <th className="py-2 pr-3 text-right font-semibold">Staff</th>
                <th className="py-2 pr-3 text-right font-semibold">Vacancies</th>
                <th className="py-2 pr-3 text-right font-semibold">Retirements 24 mo</th>
                <th className="py-2 pr-3 text-right font-semibold">Critical · no successor</th>
                <th className="py-2 pr-3 text-right font-semibold">Candidates</th>
                <th className="py-2 pr-3 text-right font-semibold">Gap</th>
                <th className="py-2 font-semibold">Risk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {regionRows.map(r => {
                const gap = regionGap(r);
                const risk = regionRisk(r);
                const tone =
                  risk === 'critical'
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : risk === 'elevated'
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : risk === 'watch'
                        ? 'bg-sky-50 text-sky-800 border-sky-200'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200';
                return (
                  <tr key={r.region} className="hover:bg-slate-50/70">
                    <td className="py-2.5 pr-3 font-medium text-slate-800">
                      {r.region}
                      {r.staff / r.utilities < 40 ? (
                        <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                          small systems
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-slate-700">
                      {r.utilities}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-slate-700">
                      {r.staff}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-slate-700">
                      {r.vacancies}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-slate-700">
                      {r.retirements24mo}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-slate-700">
                      {r.criticalNoSuccessor}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-slate-700">
                      {r.candidates}
                    </td>
                    <td
                      className={`py-2.5 pr-3 text-right tabular-nums font-semibold ${
                        gap > 0 ? 'text-red-600' : 'text-emerald-700'
                      }`}
                    >
                      {gap > 0 ? `−${gap}` : `+${Math.abs(gap)}`}
                    </td>
                    <td className="py-2.5">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${tone}`}
                      >
                        {risk}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Gap = vacancies + anticipated 24-month retirements − OWW candidates in training or
          exam-ready in the same region. Utility-level drill-down is available for the{' '}
          {WW360_SUMMARY.utilitiesConsentedToShare} utilities that consented to partner visibility.
        </p>
      </Ww360Section>

      {/* Insights + access */}
      <div className="grid gap-6 lg:grid-cols-5">
        <Ww360Section
          tourId="insights"
          eyebrow="Cross-source analysis"
          title="Recommended actions this month"
          dataMode="sample"
          className="lg:col-span-3"
        >
          <ul className="grid gap-3 md:grid-cols-2">
            {OWW_INSIGHTS.map(i => (
              <li
                key={i.id}
                className={`flex flex-col rounded-xl border p-4 ${
                  i.severity === 'high'
                    ? 'border-red-100 bg-red-50/40'
                    : i.severity === 'medium'
                      ? 'border-amber-100 bg-amber-50/40'
                      : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Sparkles
                    className={`h-4 w-4 ${
                      i.severity === 'high'
                        ? 'text-red-600'
                        : i.severity === 'medium'
                          ? 'text-amber-600'
                          : 'text-sky-600'
                    }`}
                    aria-hidden
                  />
                  <p className="text-sm font-semibold text-slate-900">{i.title}</p>
                </div>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">{i.body}</p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-1">
                    {i.sources.map(s => (
                      <Ww360SourceChip key={s} id={s} />
                    ))}
                  </div>
                  <Button type="button" size="sm" variant="outline" className="h-8 text-xs">
                    {i.action} <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Ww360Section>

        <Ww360Section
          tourId="access"
          eyebrow="Your platform access"
          title="What jingrao-aman-OWW can see and do"
          dataMode="live"
          className="lg:col-span-2"
        >
          <p className="text-sm leading-relaxed text-slate-600">
            Platform-partner privileges cover the One Water Workforce program across every
            participating utility. Utility records stay utility-owned; per-utility detail follows
            each utility’s consent.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
            {userRoles.length ? (
              userRoles.map(r => (
                <span
                  key={r}
                  className="rounded-md bg-slate-900 px-2 py-0.5 font-mono text-[11px] text-white"
                >
                  {r}
                </span>
              ))
            ) : (
              <span className="rounded-md bg-slate-900 px-2 py-0.5 font-mono text-[11px] text-white">
                platform_admin · oww_partner
              </span>
            )}
          </div>
          <div className="mt-4 space-y-4">
            {OWW_PRIVILEGE_GROUPS.map(g => (
              <div key={g.id}>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {g.title}
                </p>
                <p className="text-[11px] text-slate-500">{g.blurb}</p>
                <ul className="mt-1.5 space-y-1.5">
                  {g.items.map(it => (
                    <li key={it.id} className="flex items-start gap-2 text-sm">
                      <PrivilegeIcon status={it.status} />
                      <div className="min-w-0 flex-1">
                        <p className="text-slate-800">{it.capability}</p>
                        <p className="text-[11px] text-slate-500">
                          {it.scope}
                          {it.note ? ` — ${it.note}` : ''}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                          it.status === 'granted'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                            : it.status === 'consent'
                              ? 'border-sky-200 bg-sky-50 text-sky-800'
                              : 'border-slate-200 bg-slate-50 text-slate-500'
                        }`}
                      >
                        {OWW_PRIVILEGE_STATUS_LABEL[it.status]}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Ww360Section>
      </div>

      {/* Content engagement footer */}
      <Ww360Section
        tourId="content"
        eyebrow="Content that converts"
        title="onewaterworkforce.org — top pages, last 30 days"
        sources={['oww-web']}
        dataMode="sample"
      >
        <div className="grid gap-2 md:grid-cols-5">
          {WEB_TOP_PAGES.map(p => (
            <div key={p.path} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <p className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
                <BookOpen className="h-3.5 w-3.5 text-teal-700" aria-hidden /> {p.title}
              </p>
              <p className="mt-0.5 font-mono text-[11px] text-slate-500">{p.path}</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                {p.views30d.toLocaleString()}
              </p>
              <p className="text-[11px] text-slate-500">
                views · {formatPct(p.conversion, 1)} → member profile
              </p>
            </div>
          ))}
        </div>
      </Ww360Section>

      <OwwTourOverlay autoOpen />
    </div>
  );
}

function PrivilegeIcon({ status }: { status: PrivilegeStatus }) {
  if (status === 'granted')
    return <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />;
  if (status === 'consent')
    return <UserCheck className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" aria-hidden />;
  return <Lock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />;
}
