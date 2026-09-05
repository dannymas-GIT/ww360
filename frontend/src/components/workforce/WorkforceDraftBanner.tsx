import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  onOpenWizard: () => void;
  show: boolean;
}

export function WorkforceDraftBanner({ show, onOpenWizard }: Props) {
  if (!show) return null;

  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-950">
      <div className="flex flex-wrap items-start gap-3 justify-between">
        <div>
          <p className="font-medium">Get started with workforce continuity</p>
          <p className="mt-1 text-indigo-900/90">
            Use the guided setup wizard to add positions, employees, certifications, and coverage.
            Everything you enter is saved live and appears in the tabs below.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onOpenWizard}>
          <Sparkles className="mr-1 h-4 w-4" />
          Open guided setup
        </Button>
      </div>
    </div>
  );
}
