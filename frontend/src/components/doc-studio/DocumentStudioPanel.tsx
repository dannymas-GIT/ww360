/**
 * Home / workspace Document Studio datacard — CTA plus live library counts.
 */
import type { ComponentType } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  ClipboardCheck,
  FileText,
  PenSquare,
  PlayCircle,
  Wrench,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Ww360Section } from '@/components/ww360/Ww360Section';
import { fetchAccess, fetchStats, type DocStudioStats } from '@/services/docStudioService';

export interface DocumentStudioPanelProps {
  tourId?: string;
  /** Override studio library scope (district code or program). */
  scope?: string;
  /** Studio deep-link (defaults to /studio). */
  href?: string;
  className?: string;
}

function StatCell({
  label,
  value,
  hint,
  icon: Icon,
  emphasize,
}: {
  label: string;
  value: number | string;
  hint?: string;
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  emphasize?: boolean;
}) {
  return (
    <div
      className={
        emphasize
          ? 'rounded-lg border border-sky-200 bg-sky-50/70 px-3 py-3'
          : 'rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-3'
      }
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[0.875rem] font-medium leading-snug text-slate-600">{label}</p>
        <Icon
          className={`mt-0.5 h-4 w-4 shrink-0 ${emphasize ? 'text-sky-700' : 'text-slate-500'}`}
          aria-hidden
        />
      </div>
      <p
        className={`mt-1.5 text-[1.5rem] font-semibold tabular-nums leading-none ${
          emphasize ? 'text-sky-950' : 'text-slate-900'
        }`}
      >
        {value}
      </p>
      {hint ? <p className="mt-1.5 text-[0.875rem] leading-snug text-slate-500">{hint}</p> : null}
    </div>
  );
}

function statsOrZero(s: DocStudioStats | undefined) {
  return {
    successionPublished: s?.succession_published ?? 0,
    successionDocs: s?.succession_docs ?? 0,
    pendingApproval: s?.pending_approval ?? 0,
    tutorials: s?.tutorials ?? 0,
    operations: s?.operations_docs ?? 0,
    drafts: s?.drafts ?? 0,
    published: s?.published ?? 0,
    documents: s?.documents ?? 0,
  };
}

export function DocumentStudioPanel({
  tourId = 'document-studio',
  scope,
  href = '/studio',
  className,
}: DocumentStudioPanelProps) {
  const accessQ = useQuery({
    queryKey: ['doc-studio', 'access', scope ?? 'default'],
    queryFn: () => fetchAccess(scope),
    staleTime: 60_000,
  });
  const resolvedScope = scope ?? accessQ.data?.scope;
  const statsQ = useQuery({
    queryKey: ['doc-studio', 'stats', resolvedScope ?? 'pending'],
    queryFn: () => fetchStats(resolvedScope),
    enabled: Boolean(resolvedScope),
    staleTime: 30_000,
  });

  const counts = statsOrZero(statsQ.data);
  const loading = accessQ.isLoading || statsQ.isLoading;
  const scopeLabel = accessQ.data?.scope_label;

  return (
    <Ww360Section
      tourId={tourId}
      title="Document Studio"
      eyebrow={scopeLabel || undefined}
      dataMode="live"
      className={className}
      action={
        <Button asChild className="min-h-[44px] text-[1rem]">
          <Link to={resolvedScope ? `${href}?scope=${encodeURIComponent(resolvedScope)}` : href}>
            <PenSquare className="mr-2 h-4 w-4" aria-hidden />
            Open Document Studio
          </Link>
        </Button>
      }
    >
      <p className="mb-4 text-[1rem] leading-relaxed text-slate-700">
        Author and publish succession packs, procedures, and recorded tutorials for your library.
      </p>

      {loading ? (
        <p className="text-[1rem] text-slate-600">Loading library counts…</p>
      ) : statsQ.isError ? (
        <p className="text-[1rem] text-slate-600">
          Library counts unavailable right now. You can still open Document Studio.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCell
            label="Succession docs"
            value={`${counts.successionPublished}/${counts.successionDocs}`}
            hint="Published / binder sections"
            icon={BookOpen}
          />
          <StatCell
            label="Pending approval"
            value={counts.pendingApproval}
            hint={counts.pendingApproval > 0 ? 'Submitted for publish' : 'None waiting'}
            icon={ClipboardCheck}
          />
          <StatCell
            label="Tutorials"
            value={counts.tutorials}
            hint="Recorded walkthroughs"
            icon={PlayCircle}
            emphasize
          />
          <StatCell
            label="Operations docs"
            value={counts.operations}
            hint="SOPs & procedures"
            icon={Wrench}
          />
          <StatCell
            label="Library total"
            value={counts.documents}
            hint={`${counts.published} published · ${counts.drafts} drafts`}
            icon={FileText}
          />
        </div>
      )}
    </Ww360Section>
  );
}
