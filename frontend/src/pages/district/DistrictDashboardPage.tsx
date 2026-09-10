import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Circle,
  ClipboardList,
  FileWarning,
  GraduationCap,
  Users,
  Workflow,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Ww360KpiTile } from '@/components/ww360/Ww360KpiTile';
import { Ww360PageHero } from '@/components/ww360/Ww360PageHero';
import { Ww360Section } from '@/components/ww360/Ww360Section';
import { ww360PersonalizedTitle } from '@/components/ww360/ww360Greeting';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  fetchWorkforceScorecards,
  fetchCeuSummary,
  fetchWorkforceBinder,
  type WorkforceCeuOperatorSummary,
  type WorkforceContinuityScorecard,
} from '@/services/workforceSuccessionService';
import {
  approveTask,
  fetchDistrictTasks,
  fetchTaskSummary,
  requestTaskChanges,
  type DocumentationTask,
  type DocumentationTaskSummary,
} from '@/services/documentationTaskService';
import { UsajobsJobListingsPanel } from '@/pages/workspaces/UsajobsJobListingsPanel';

type ChecklistStatus = 'done' | 'attention' | 'todo';

interface ChecklistItem {
  id: string;
  title: string;
  detail: string;
  status: ChecklistStatus;
  href: string;
  cta: string;
}

function statusIcon(status: ChecklistStatus) {
  if (status === 'done') return <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />;
  if (status === 'attention') return <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />;
  return <Circle className="h-5 w-5 text-slate-400 shrink-0" />;
}

export default function DistrictDashboardPage() {
  const { user, actingDistrictCode, canManageWorkforce } = useAuth();
  const district = actingDistrictCode ?? user?.districts?.[0] ?? 'HFWD';
  const [summary, setSummary] = useState<DocumentationTaskSummary>({
    open: 0,
    due_soon: 0,
    overdue: 0,
    review_queue: 0,
  });
  const [tasks, setTasks] = useState<DocumentationTask[]>([]);
  const [scorecard, setScorecard] = useState<WorkforceContinuityScorecard | null>(null);
  const [operators, setOperators] = useState<WorkforceCeuOperatorSummary[]>([]);
  const [hasBinder, setHasBinder] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoadError(null);
    try {
      const [s, t, sc, ceu, binder] = await Promise.all([
        fetchTaskSummary(district),
        fetchDistrictTasks(district),
        fetchWorkforceScorecards([district]).catch(() => []),
        fetchCeuSummary(district).catch(() => null),
        canManageWorkforce
          ? fetchWorkforceBinder(district).catch(() => null)
          : Promise.resolve(null),
      ]);
      setSummary(s);
      setTasks(t);
      setScorecard(sc[0] ?? null);
      setOperators(ceu?.operators ?? []);
      setHasBinder(Boolean(binder?.cover_document_id));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load district dashboard');
    }
  }, [district, canManageWorkforce]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const reviewQueue = tasks.filter(t => t.status === 'submitted');
  const shortfallOps = operators.filter(o => o.is_shortfall);
  const uncovered = scorecard?.functions_without_backup ?? 0;
  const retirement = scorecard?.employees_retirement_eligible_24mo ?? 0;
  const certCliff = (scorecard?.cert_cliff_90d ?? 0) + (scorecard?.cert_cliff_30d ?? 0);
  const readiness = scorecard?.readiness_score;

  const checklist: ChecklistItem[] = useMemo(() => {
    const hasRoster = (scorecard?.total_employees ?? 0) > 0;
    const hasPositions = (scorecard?.total_positions ?? 0) > 0;
    const hasFunctions = (scorecard?.total_critical_functions ?? 0) > 0;
    const coverageOk = hasFunctions && uncovered === 0;
    const ceuOk = operators.length > 0 && shortfallOps.length === 0;
    const docsOk = summary.open === 0 && summary.overdue === 0 && summary.review_queue === 0;

    const items: ChecklistItem[] = [
      {
        id: 'roster',
        title: 'Confirm positions & employee roster',
        detail: hasRoster
          ? `${scorecard?.total_employees} employees · ${scorecard?.total_positions} positions`
          : 'Add positions and people so coverage and CEU tracking can start.',
        status: hasRoster && hasPositions ? 'done' : 'todo',
        href: '/continuity?tab=employees',
        cta: 'Open roster',
      },
      {
        id: 'functions',
        title: 'Map critical functions & coverage',
        detail: coverageOk
          ? 'Every critical function has a primary and backup.'
          : hasFunctions
            ? `${uncovered} critical function(s) lack qualified backup.`
            : 'Define critical ops functions, then assign primary/backup (creates documentation tasks).',
        status: coverageOk ? 'done' : hasFunctions ? 'attention' : 'todo',
        href: '/continuity?tab=coverage',
        cta: 'Assign coverage',
      },
      {
        id: 'succession',
        title: 'Build succession bench for at-risk roles',
        detail:
          retirement > 0
            ? `${retirement} employee(s) retirement-eligible within 24 months — name successors.`
            : 'Review bench readiness for chief / Grade IIA roles.',
        status: retirement > 0 ? 'attention' : hasRoster ? 'done' : 'todo',
        href: '/continuity?tab=succession',
        cta: 'Succession board',
      },
      {
        id: 'ceu',
        title: 'Close CEU shortfalls before renewal',
        detail:
          operators.length === 0
            ? 'Log CEU hours against operator grades for the current cycle.'
            : shortfallOps.length
              ? `${shortfallOps.length} operator(s) below required hours.`
              : `${operators.length} operators on track for renewal.`,
        status: ceuOk ? 'done' : operators.length ? 'attention' : 'todo',
        href: '/continuity/ceu-training?tab=ceu',
        cta: 'CEU & training',
      },
      {
        id: 'certs',
        title: 'Clear certification cliffs',
        detail:
          certCliff > 0
            ? `${certCliff} credential(s) expire within 90 days.`
            : 'No near-term certification expirations flagged.',
        status: certCliff > 0 ? 'attention' : hasRoster ? 'done' : 'todo',
        href: '/continuity/ceu-training?tab=certifications',
        cta: 'View certifications',
      },
      {
        id: 'docs',
        title: 'Document critical responsibilities',
        detail:
          summary.overdue > 0
            ? `${summary.overdue} overdue documentation task(s).`
            : summary.review_queue > 0
              ? `${summary.review_queue} tutorial(s) waiting for your review.`
              : summary.open > 0
                ? `${summary.open} open documentation assignment(s).`
                : 'No open documentation tasks.',
        status: docsOk ? 'done' : summary.overdue > 0 || summary.review_queue > 0 ? 'attention' : 'todo',
        href: '/continuity?tab=knowledge',
        cta: 'Knowledge & docs',
      },
      {
        id: 'doh352',
        title: 'Prepare DOH-352 renewal package',
        detail: 'Assemble vouchers and CEU evidence for operators approaching cycle end.',
        status: shortfallOps.length ? 'attention' : operators.length ? 'done' : 'todo',
        href: '/continuity/ceu-training?tab=ceu',
        cta: 'DOH-352 readiness',
      },
    ];

    if (canManageWorkforce) {
      items.splice(3, 0, {
        id: 'binder',
        title: 'Create or open Succession Binder',
        detail: hasBinder
          ? 'Succession Binder is in Document Studio — refresh CEU packs as cycles change.'
          : 'Start the Succession Binder in Continuity so roster and CEU evidence stay in one place.',
        status: hasBinder ? 'done' : hasRoster ? 'attention' : 'todo',
        href: '/continuity?tab=dashboard',
        cta: hasBinder ? 'Open binder hub' : 'Create binder',
      });
    }

    return items;
  }, [
    scorecard,
    uncovered,
    retirement,
    operators,
    shortfallOps.length,
    summary,
    certCliff,
    canManageWorkforce,
    hasBinder,
  ]);

  const doneCount = checklist.filter(c => c.status === 'done').length;

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-6 p-4 md:p-6 pb-12" data-landing="district">
      <Ww360PageHero
        eyebrow={`${district} · Utility workspace`}
        title={ww360PersonalizedTitle(user, 'your compliance path')}
        description="CEU renewal, succession coverage, and documentation tasks for this utility only. Complete the checklist to stay workforce-compliant."
      />

      {loadError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Ww360KpiTile
          label="Continuity readiness"
          value={readiness != null ? `${readiness}` : '—'}
          sub="Score / 100 for this district"
          icon={<Workflow className="h-5 w-5" />}
        />
        <Ww360KpiTile
          label="Uncovered functions"
          value={String(uncovered)}
          sub="Need primary/backup"
          icon={<Users className="h-5 w-5" />}
          invert
        />
        <Ww360KpiTile
          label="CEU shortfalls"
          value={String(shortfallOps.length)}
          sub="Operators below hours"
          icon={<GraduationCap className="h-5 w-5" />}
          invert
        />
        <Ww360KpiTile
          label="Docs needing action"
          value={String(summary.open + summary.review_queue)}
          sub={`${summary.review_queue} in review queue`}
          icon={<ClipboardList className="h-5 w-5" />}
        />
      </div>

      <Ww360Section
        tourId="district-compliance"
        title="Path to compliance"
        eyebrow={`${doneCount} of ${checklist.length} complete`}
      >
        <ul className="divide-y px-1">
          {checklist.map(item => (
            <li key={item.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-3 min-w-0">
                {statusIcon(item.status)}
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{item.title}</p>
                  <p className="text-sm text-slate-600">{item.detail}</p>
                </div>
              </div>
              <Button asChild size="sm" variant={item.status === 'done' ? 'outline' : 'default'} className="shrink-0">
                <Link to={item.href}>{item.cta}</Link>
              </Button>
            </li>
          ))}
        </ul>
      </Ww360Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Ww360Section tourId="district-ceu-detail" title="CE renewals this cycle">
          {operators.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-slate-500">No CEU operators tracked yet for {district}.</p>
          ) : (
            <ul className="space-y-2 px-5 pb-5">
              {operators.slice(0, 6).map(op => (
                <li key={op.employee_code} className="flex items-center justify-between gap-2 text-sm border-b last:border-0 py-2">
                  <span>
                    {op.employee_name}
                    {op.certification_grade ? (
                      <span className="text-slate-500"> · Grade {op.certification_grade}</span>
                    ) : null}
                  </span>
                  <Badge variant={op.is_shortfall ? 'destructive' : 'secondary'}>
                    {op.earned_hours.toFixed(0)}/{op.required_hours} hrs
                  </Badge>
                </li>
              ))}
            </ul>
          )}
          <div className="px-5 pb-5">
            <Button asChild variant="outline" size="sm">
              <Link to="/continuity/ceu-training?tab=ceu">Manage CEUs</Link>
            </Button>
          </div>
        </Ww360Section>

        <Ww360Section tourId="district-review" title="Documentation review queue">
          {reviewQueue.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-slate-500">No tutorials awaiting your review.</p>
          ) : (
            <ul className="space-y-3 px-5 pb-5">
              {reviewQueue.map(task => (
                <li
                  key={task.id}
                  className="rounded-lg border bg-slate-50 p-4 flex flex-wrap gap-3 justify-between"
                >
                  <div>
                    <p className="font-medium">{task.title}</p>
                    <p className="text-xs text-slate-500">Due {task.due_at?.slice(0, 10) ?? '—'}</p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {task.document_id ? (
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/studio?doc=${task.document_id}`}>Open draft</Link>
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        void requestTaskChanges(
                          task.id,
                          'Please add safety checks and handoff notes.'
                        ).then(reload)
                      }
                    >
                      Request changes
                    </Button>
                    <Button size="sm" onClick={() => void approveTask(task.id).then(reload)}>
                      Approve
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {summary.overdue > 0 ? (
            <p className="px-5 pb-5 text-sm text-amber-800 flex items-center gap-2">
              <FileWarning className="h-4 w-4" />
              {summary.overdue} overdue documentation task(s) for operators.
            </p>
          ) : null}
        </Ww360Section>
      </div>

      <UsajobsJobListingsPanel tourId="district-federal-jobs" />
    </div>
  );
}
