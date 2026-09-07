import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowLeft,
  Globe,
  MousePointerClick,
  Search,
  Smartphone,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Ww360KpiTile } from '@/components/ww360/Ww360KpiTile';
import { Ww360PageHero } from '@/components/ww360/Ww360PageHero';
import { Ww360Section } from '@/components/ww360/Ww360Section';
import { ww360ChartTooltipStyle } from '@/components/ww360/ww360ChartTooltip';
import type { Ww360SourceId } from '@/components/ww360/ww360SourceTokens';
import { formatCompact, formatPct, formatLastSynced } from '@/lib/format';
import { getWw360LogoPath, WW360_LOGO_SIZE } from '@/utils/brandHost';
import {
  DIGITAL_PROPERTY_LABELS,
  type DigitalPropertyId,
  type DigitalPropertyReport,
  type DigitalRange,
} from './digitalAnalyticsTypes';
import { fetchDigitalPropertyReport } from '@/services/digitalAnalyticsService';

const C = { blue: '#2563eb', sky: '#38bdf8', teal: '#0f766e', amber: '#f59e0b' };
const tooltipStyle = ww360ChartTooltipStyle;

const PROPERTY_TABS: { id: DigitalPropertyId; source: Ww360SourceId }[] = [
  { id: 'ww360', source: 'ww360' },
  { id: 'oww-web', source: 'oww-web' },
  { id: 'learning-stream', source: 'learning-stream' },
];

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function PropertyReportView({ report }: { report: DigitalPropertyReport }) {
  const { ga, seo } = report;
  const trendData = useMemo(() => {
    const byDate = new Map<string, { date: string; sessions: number; organicClicks: number }>();
    ga.daily.forEach(d => {
      byDate.set(d.date, { date: d.date.slice(5), sessions: d.sessions, organicClicks: 0 });
    });
    seo.daily.forEach(d => {
      const existing = byDate.get(d.date);
      if (existing) existing.organicClicks = d.clicks;
      else byDate.set(d.date, { date: d.date.slice(5), sessions: 0, organicClicks: d.clicks });
    });
    return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [ga.daily, seo.daily]);

  const sourceId: Ww360SourceId =
    report.property === 'ww360'
      ? 'ww360'
      : report.property === 'oww-web'
        ? 'oww-web'
        : 'learning-stream';

  const dataMode = report.dataMode === 'live' ? 'live' : 'sample';

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Ww360KpiTile
          label="Sessions"
          value={formatCompact(ga.summary.sessions)}
          sub={`${formatCompact(ga.summary.users)} users`}
          delta={0.12}
          icon={<Users className="h-4 w-4" />}
          sources={[sourceId]}
          dataMode={dataMode}
        />
        <Ww360KpiTile
          label="Pageviews"
          value={formatCompact(ga.summary.pageviews)}
          sub={`${formatPct(ga.summary.engagementRate, 0)} engaged`}
          delta={0.09}
          icon={<TrendingUp className="h-4 w-4" />}
          sources={[sourceId]}
          dataMode={dataMode}
        />
        <Ww360KpiTile
          label="Organic clicks"
          value={formatCompact(seo.summary.clicks)}
          sub={`${formatCompact(seo.summary.impressions)} impressions`}
          delta={0.14}
          icon={<MousePointerClick className="h-4 w-4" />}
          sources={[sourceId]}
          dataMode={dataMode}
        />
        <Ww360KpiTile
          label="Avg position"
          value={seo.summary.avgPosition.toFixed(1)}
          sub={`CTR ${formatPct(seo.summary.ctr, 1)}`}
          invert
          delta={-0.04}
          icon={<Search className="h-4 w-4" />}
          sources={[sourceId]}
          dataMode={dataMode}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Ww360KpiTile
          label="New users"
          value={formatCompact(ga.summary.newUsers)}
          sub="First-time visitors"
          icon={<Users className="h-4 w-4" />}
          sources={[sourceId]}
          dataMode={dataMode}
        />
        <Ww360KpiTile
          label="Avg session"
          value={formatDuration(ga.summary.avgSessionDurationSec)}
          sub={`Bounce ${formatPct(ga.summary.bounceRate, 0)}`}
          icon={<Globe className="h-4 w-4" />}
          sources={[sourceId]}
          dataMode={dataMode}
        />
        <Ww360KpiTile
          label="Conversions"
          value={formatCompact(ga.summary.conversions)}
          sub="Key events (GA4)"
          delta={0.08}
          icon={<MousePointerClick className="h-4 w-4" />}
          sources={[sourceId]}
          dataMode={dataMode}
        />
        <Ww360KpiTile
          label="SEO impressions"
          value={formatCompact(seo.summary.impressions)}
          sub="Google Search Console"
          icon={<Search className="h-4 w-4" />}
          sources={[sourceId]}
          dataMode={dataMode}
        />
      </div>

      <Ww360Section
        tourId="digital-trend"
        eyebrow="Traffic + organic search"
        title="Sessions and organic clicks over time"
        sources={[sourceId]}
        dataMode={dataMode}
        lastSynced={report.lastSynced}
      >
        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#475569' }} />
              <YAxis tick={{ fontSize: 10, fill: '#475569' }} />
              <Tooltip {...tooltipStyle} />
              <Legend />
              <Area
                type="monotone"
                dataKey="sessions"
                name="Sessions (GA4)"
                stroke={C.blue}
                fill={C.blue}
                fillOpacity={0.15}
              />
              <Area
                type="monotone"
                dataKey="organicClicks"
                name="Organic clicks (GSC)"
                stroke={C.teal}
                fill={C.teal}
                fillOpacity={0.12}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Ww360Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Ww360Section
          tourId="digital-channels"
          eyebrow="Acquisition"
          title="Sessions by channel"
          sources={[sourceId]}
          dataMode={dataMode}
        >
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ga.channels} layout="vertical" margin={{ left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="channel" width={100} tick={{ fontSize: 10 }} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="sessions" fill={C.blue} radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Ww360Section>

        <Ww360Section
          tourId="digital-devices"
          eyebrow="Devices"
          title="Session share by device"
          sources={[sourceId]}
          dataMode={dataMode}
        >
          <ul className="space-y-3">
            {ga.devices.map(d => (
              <li key={d.device}>
                <div className="flex items-center justify-between text-sm">
                  <span className="inline-flex items-center gap-2 text-slate-700">
                    <Smartphone className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                    {d.device}
                  </span>
                  <span className="tabular-nums text-slate-600">
                    {formatCompact(d.sessions)} · {formatPct(d.share, 0)}
                  </span>
                </div>
                <Progress value={d.share * 100} className="mt-1 h-1.5" />
              </li>
            ))}
          </ul>
        </Ww360Section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Ww360Section
          tourId="digital-pages"
          eyebrow="GA4"
          title="Top pages"
          sources={[sourceId]}
          dataMode={dataMode}
        >
          <ul className="divide-y divide-slate-100">
            {ga.topPages.map(p => (
              <li key={p.pagePath} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-slate-800">{p.title}</p>
                  <p className="truncate text-xs text-slate-500">{p.pagePath}</p>
                </div>
                <div className="shrink-0 text-right text-xs tabular-nums text-slate-600">
                  <p>{formatCompact(p.pageviews)} views</p>
                  <p className="text-slate-400">Bounce {formatPct(p.bounceRate, 0)}</p>
                </div>
              </li>
            ))}
          </ul>
        </Ww360Section>

        <Ww360Section
          tourId="digital-queries"
          eyebrow="Search Console"
          title="Top organic queries"
          sources={[sourceId]}
          dataMode={dataMode}
        >
          <ul className="divide-y divide-slate-100">
            {seo.topQueries.map(q => (
              <li key={q.query} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-slate-800">{q.query}</p>
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {q.branded ? (
                      <Badge variant="outline" className="text-[10px]">
                        Branded
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">
                        Non-branded
                      </Badge>
                    )}
                    <span className="text-xs text-slate-500">Pos {q.position.toFixed(1)}</span>
                  </div>
                </div>
                <div className="shrink-0 text-right text-xs tabular-nums text-slate-600">
                  <p>{q.clicks.toLocaleString()} clicks</p>
                  <p className="text-slate-400">{formatPct(q.ctr, 1)} CTR</p>
                </div>
              </li>
            ))}
          </ul>
        </Ww360Section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Ww360Section
          tourId="digital-geo"
          eyebrow="Audience"
          title="Sessions by region"
          sources={[sourceId]}
          dataMode={dataMode}
        >
          <ul className="space-y-2">
            {ga.geo.map(g => {
              const max = ga.geo[0]?.sessions || 1;
              return (
                <li key={g.region} className="flex items-center gap-2 text-sm">
                  <span className="w-28 truncate text-slate-700">{g.region}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-sky-600"
                      style={{ width: `${(g.sessions / max) * 100}%` }}
                    />
                  </div>
                  <span className="w-14 text-right text-xs tabular-nums text-slate-500">
                    {formatCompact(g.sessions)}
                  </span>
                </li>
              );
            })}
          </ul>
        </Ww360Section>

        <Ww360Section
          tourId="digital-conversions"
          eyebrow="Conversions"
          title="Key events"
          sources={[sourceId]}
          dataMode={dataMode}
        >
          <ul className="divide-y divide-slate-100">
            {ga.conversions.map(c => (
              <li key={c.event} className="flex items-center justify-between py-2.5 text-sm">
                <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">
                  {c.event}
                </code>
                <span className="tabular-nums text-slate-600">
                  {c.count.toLocaleString()} · {formatPct(c.rate, 2)}
                </span>
              </li>
            ))}
          </ul>
        </Ww360Section>
      </div>

      <Ww360Section
        tourId="digital-insights"
        eyebrow="Recommended actions"
        title="What the numbers suggest"
        sources={[sourceId]}
        dataMode={dataMode}
      >
        <ul className="space-y-3">
          {report.insights.map(ins => (
            <li
              key={ins.id}
              className={`rounded-lg border px-4 py-3 ${
                ins.severity === 'high'
                  ? 'border-red-200 bg-red-50/50'
                  : ins.severity === 'medium'
                    ? 'border-amber-200 bg-amber-50/50'
                    : 'border-sky-100 bg-sky-50/30'
              }`}
            >
              <p className="text-sm font-semibold text-slate-900">{ins.title}</p>
              <p className="mt-1 text-sm text-slate-600">{ins.body}</p>
              <p className="mt-2 text-xs font-medium text-sky-700">{ins.action}</p>
            </li>
          ))}
        </ul>
      </Ww360Section>
    </div>
  );
}

export default function DigitalReachPage() {
  const [property, setProperty] = useState<DigitalPropertyId>('ww360');
  const [range, setRange] = useState<DigitalRange>('12mo');
  const [report, setReport] = useState<DigitalPropertyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchDigitalPropertyReport(property, range)
      .then(data => {
        if (!cancelled) setReport(data);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load digital reach report.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [property, range]);

  const heroMode = report?.dataMode === 'live' ? 'live' : 'sample';

  return (
    <div className="ww360-app-shell mx-auto w-full max-w-[1440px] space-y-6 p-4 md:p-6">
      <Ww360PageHero
        eyebrow="Digital reach · GA4 + SEO"
        title="How the program shows up online"
        description="Google Analytics for each program site — Water Workforce 360, onewaterworkforce.org, and Learning Stream — covering page visits, time on site, traffic sources, and Search Console organic queries. WW360 can report live when GA4 is configured; OWW and Learning Stream use illustrative data until their feeds connect."
        dataMode={heroMode}
        lastSynced={report?.lastSynced}
        actions={
          <>
            <div className="inline-flex rounded-lg border border-white/15 bg-white/5 p-0.5 text-xs">
              {(
                [
                  ['30d', '30d'],
                  ['qtr', 'Quarter'],
                  ['12mo', '12 mo'],
                ] as Array<[DigitalRange, string]>
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
              asChild
            >
              <Link to="/dashboard">
                <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden /> Executive overview
              </Link>
            </Button>
          </>
        }
      />

      <div
        data-tour="digital-tabs"
        className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm"
        role="tablist"
        aria-label="Digital properties"
      >
        {PROPERTY_TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={property === tab.id}
            onClick={() => setProperty(tab.id)}
            className={`rounded-lg px-4 py-2.5 text-sm font-medium transition min-h-[44px] ${
              property === tab.id
                ? 'bg-[#07111f] text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {DIGITAL_PROPERTY_LABELS[tab.id]}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading digital reach…</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : report ? (
        <PropertyReportView report={report} />
      ) : null}

      {report?.lastSynced ? (
        <p className="text-center text-xs text-slate-400">
          Last synced {formatLastSynced(report.lastSynced)}
        </p>
      ) : null}
    </div>
  );
}
