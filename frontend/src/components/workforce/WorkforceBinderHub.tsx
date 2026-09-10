import { BookOpen, CloudUpload, FolderOpen, ListChecks, RefreshCw, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { WorkforceDocPackResponse } from '@/services/workforceSuccessionService';
import { binderIntakeStepLabel } from '@/components/workforce/binderIntake/BinderIntakeWizard';

export interface WorkforceBinderHubProps {
  districtCode: string;
  existingBinder: WorkforceDocPackResponse | null | undefined;
  binderLoading?: boolean;
  mode?: 'author' | 'oversight';
  previewReadOnly?: boolean;
  /** Highlight create actions when the district has no live roster yet. */
  emphasizeCreate?: boolean;
  /** Continuity scorecard is illustrative sample data. */
  sampleMode?: boolean;
  intakeDraftStep?: string | null;
  onStartGuidedIntake: () => void;
  onResumeGuidedIntake?: () => void;
  onQuickCreate: () => void;
  onRefreshCeuPack: () => void;
  ceuRefreshing?: boolean;
}

export function WorkforceBinderHub({
  districtCode,
  existingBinder,
  binderLoading,
  mode = 'author',
  previewReadOnly = false,
  emphasizeCreate = false,
  sampleMode = false,
  intakeDraftStep,
  onStartGuidedIntake,
  onResumeGuidedIntake,
  onQuickCreate,
  onRefreshCeuPack,
  ceuRefreshing,
}: WorkforceBinderHubProps) {
  const isOversight = mode === 'oversight';
  const coverId = existingBinder?.cover_document_id;
  const folderId = existingBinder?.folder_id;
  const studioBinderUrl = (() => {
    const q = new URLSearchParams();
    q.set('scope', districtCode);
    if (coverId) q.set('doc', coverId);
    if (folderId) q.set('folder', folderId);
    return `/studio?${q.toString()}`;
  })();
  const studioCustodyUrl = `${studioBinderUrl}&custody=open`;
  const studioScopeUrl = `/studio?scope=${encodeURIComponent(districtCode)}`;
  const showCreateBlock = !isOversight && (emphasizeCreate || !coverId || Boolean(intakeDraftStep));

  return (
    <Card className="border-slate-200 bg-white">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-[1.25rem] text-slate-900">
          <BookOpen className="h-5 w-5 text-sky-700" aria-hidden />
          Succession Binder
        </CardTitle>
        <p className="text-[1rem] leading-relaxed text-slate-700">
          {isOversight ? (
            <>
              Review this utility&apos;s workforce documents in Document Studio. Binders are created
              and maintained by the utility&apos;s superintendent or workforce manager
              {previewReadOnly
                ? ' — read-only preview cannot create or edit.'
                : ' — not from your section partner session.'}
            </>
          ) : sampleMode ? (
            <>
              Scorecards below are illustrative. Create a Succession Binder from Continuity, or
              import a live roster first — then refresh the binder when real data is in place.
            </>
          ) : (
            <>
              Keep your district&apos;s succession package in Document Studio. Start with the guided
              walkthrough, quick-create from Continuity, or open an existing binder.
            </>
          )}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {binderLoading ? (
          <p className="text-[1rem] text-slate-600">Checking for an existing binder…</p>
        ) : null}

        {showCreateBlock ? (
          <div className="space-y-3 rounded-lg border border-sky-100 bg-sky-50/50 p-4">
            <p className="text-[1rem] font-semibold text-sky-950">
              {intakeDraftStep ? 'Resume your binder walkthrough' : 'Create your binder'}
            </p>
            <div className="flex flex-wrap gap-2">
              {intakeDraftStep && onResumeGuidedIntake ? (
                <Button
                  type="button"
                  className="min-h-[44px] text-[1rem]"
                  onClick={onResumeGuidedIntake}
                >
                  <ListChecks className="mr-2 h-4 w-4" aria-hidden />
                  Resume walkthrough
                  <span className="ml-2 text-[0.875rem] font-normal opacity-90">
                    ({binderIntakeStepLabel(intakeDraftStep as never) || intakeDraftStep})
                  </span>
                </Button>
              ) : (
                <Button
                  type="button"
                  className="min-h-[44px] text-[1rem]"
                  onClick={onStartGuidedIntake}
                >
                  <Sparkles className="mr-2 h-4 w-4" aria-hidden />
                  Guided walkthrough
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px] text-[1rem]"
                onClick={onQuickCreate}
              >
                Quick create
              </Button>
              <Button variant="outline" asChild className="min-h-[44px] text-[1rem]">
                <Link to={studioScopeUrl}>Open Document Studio</Link>
              </Button>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {existingBinder?.cover_document_id ? (
            <Button asChild className="min-h-[44px] text-[1rem]">
              <Link to={studioBinderUrl}>
                <FolderOpen className="mr-2 h-4 w-4" aria-hidden />
                Open Succession Binder
              </Link>
            </Button>
          ) : isOversight ? (
            <p className="text-[1rem] text-slate-600">
              {previewReadOnly
                ? 'No Succession Binder yet for this utility in preview.'
                : 'No Succession Binder yet for this utility.'}
            </p>
          ) : null}

          {!isOversight && existingBinder?.cover_document_id ? (
            <>
              <Button
                variant="outline"
                className="min-h-[44px] text-[1rem]"
                onClick={onRefreshCeuPack}
                disabled={!districtCode || ceuRefreshing}
              >
                <RefreshCw
                  className={`mr-2 h-4 w-4 ${ceuRefreshing ? 'animate-spin' : ''}`}
                  aria-hidden
                />
                Refresh CEU Tracker
              </Button>

              <Button variant="outline" asChild className="min-h-[44px] text-[1rem]">
                <Link to={studioCustodyUrl}>
                  <CloudUpload className="mr-2 h-4 w-4" aria-hidden />
                  Transfer to cloud
                </Link>
              </Button>

              <Button variant="ghost" asChild className="min-h-[44px] text-[1rem] text-slate-700">
                <Link to={studioScopeUrl}>Document Studio</Link>
              </Button>
            </>
          ) : null}

          {isOversight ? (
            <Button variant="ghost" asChild className="min-h-[44px] text-[1rem] text-slate-700">
              <Link to={studioScopeUrl}>Open Document Studio</Link>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
