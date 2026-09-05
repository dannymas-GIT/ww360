/**
 * Illustrated guidance card for workforce entity tabs and sample-template areas.
 */
import { CircleHelp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConceptArtForEntity } from '@/components/workforce/workforceConceptArt';
import { getFlowCopy } from '@/components/workforce/workforceRecordDetailUtils';
import type { WorkforceEntityType } from '@/services/workforceSuccessionService';

export interface WorkforceEntityGuidanceCardProps {
  entityType: WorkforceEntityType;
  variant?: 'intro' | 'empty';
  onOpenTour?: () => void;
}

export function WorkforceEntityGuidanceCard({
  entityType,
  variant = 'intro',
  onOpenTour,
}: WorkforceEntityGuidanceCardProps) {
  const flow = getFlowCopy(entityType);
  const isEmpty = variant === 'empty';

  return (
    <div
      className={`flex flex-col gap-4 rounded-lg border sm:flex-row sm:items-start ${
        isEmpty ? 'border-indigo-200 bg-indigo-50/40 p-6' : 'border-slate-200 bg-slate-50/80 p-4'
      }`}
    >
      <ConceptArtForEntity
        entityType={entityType}
        className={
          isEmpty ? 'h-24 w-36 shrink-0 mx-auto sm:mx-0' : 'h-20 w-28 shrink-0 hidden sm:block'
        }
      />
      <div className="min-w-0 flex-1 space-y-2">
        {isEmpty ? (
          <p className="text-sm font-semibold text-indigo-900">
            No {flow.label.toLowerCase()} records yet
          </p>
        ) : (
          <p className="text-sm font-semibold text-gray-900">What goes here</p>
        )}
        <p className="text-sm text-gray-700 leading-relaxed">{flow.plainLanguage}</p>
        <p className="text-xs text-gray-600 leading-relaxed">{flow.whyItMatters}</p>
        {onOpenTour ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-1 h-8 gap-1.5 text-xs"
            onClick={onOpenTour}
          >
            <CircleHelp className="h-3.5 w-3.5" aria-hidden />
            Take a tour
          </Button>
        ) : null}
      </div>
    </div>
  );
}
