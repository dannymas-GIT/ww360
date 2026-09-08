import { BookOpen, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  show: boolean;
  intakeDraftStep?: string | null;
  onStartGuidedIntake: () => void;
  onResumeGuidedIntake?: () => void;
  onQuickCreate: () => void;
}

export function WorkforceDraftBanner({
  show,
  intakeDraftStep,
  onStartGuidedIntake,
  onResumeGuidedIntake,
  onQuickCreate,
}: Props) {
  if (!show) return null;

  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-[1rem] text-indigo-950">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-[1.125rem]">Start with a Succession Binder</p>
          <p className="mt-1 leading-relaxed text-indigo-900/90">
            Use the guided walkthrough for structured questions, or quick create from Continuity
            data. You can also open Document Studio for templates, scratch authoring, or file
            upload/download.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {intakeDraftStep && onResumeGuidedIntake ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-[44px] shrink-0 text-[1rem]"
              onClick={onResumeGuidedIntake}
            >
              <Sparkles className="mr-1 h-4 w-4" aria-hidden />
              Resume walkthrough
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-[44px] shrink-0 text-[1rem]"
              onClick={onStartGuidedIntake}
            >
              <Sparkles className="mr-1 h-4 w-4" aria-hidden />
              Guided walkthrough
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-[44px] shrink-0 text-[1rem]"
            onClick={onQuickCreate}
          >
            <BookOpen className="mr-1 h-4 w-4" aria-hidden />
            Quick create
          </Button>
        </div>
      </div>
    </div>
  );
}
