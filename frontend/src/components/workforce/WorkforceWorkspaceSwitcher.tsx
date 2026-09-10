import { Link } from 'react-router-dom';
import {
  buildWorkforceTabPath,
  WORKFORCE_WORKSPACE_META,
  WORKFORCE_WORKSPACE_PATHS,
  type WorkforceWorkspace,
} from '@/components/workforce/workforceContinuityTabs';
import type { WorkforceContinuityScorecard } from '@/services/workforceSuccessionService';

export interface WorkforceWorkspaceSwitcherProps {
  workspace: WorkforceWorkspace;
  scorecard?: WorkforceContinuityScorecard | null;
}

export function WorkforceWorkspaceSwitcher({
  workspace,
  scorecard,
}: WorkforceWorkspaceSwitcherProps) {
  const ceuBadge =
    (scorecard?.ceu_shortfall_count ?? 0) > 0
      ? scorecard?.ceu_shortfall_count
      : (scorecard?.cert_cliff_90d ?? 0) > 0
        ? scorecard?.cert_cliff_90d
        : null;

  const workspaces: WorkforceWorkspace[] = ['continuity', 'ceu_training'];

  return (
    <div
      className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1"
      role="tablist"
      aria-label="Workforce workspace"
    >
      {workspaces.map(id => {
        const meta = WORKFORCE_WORKSPACE_META[id];
        const active = workspace === id;
        const Icon = meta.icon;
        const href = `${WORKFORCE_WORKSPACE_PATHS[id]}?tab=${meta.defaultTab}`;
        return (
          <Link
            key={id}
            to={href}
            role="tab"
            aria-selected={active}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              active
                ? id === 'continuity'
                  ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-indigo-200'
                  : 'bg-white text-emerald-700 shadow-sm ring-1 ring-emerald-200'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {meta.title}
            {id === 'ceu_training' && ceuBadge != null ? (
              <span className="ml-0.5 rounded-full bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-800">
                {ceuBadge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}

export function WorkforceEmployeesHandoffCard() {
  return (
    <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50/80 p-3 text-sm text-emerald-900">
      Next step: record operator licenses and expiration dates in{' '}
      <Link
        to={buildWorkforceTabPath('certifications')}
        className="font-medium text-emerald-800 underline hover:text-emerald-950"
      >
        CEU & Training → Certifications
      </Link>
      .
    </div>
  );
}
