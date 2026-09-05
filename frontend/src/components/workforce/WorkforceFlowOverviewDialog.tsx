/**
 * "How this connects" — full-screen visual overview of the Workforce
 * Continuity workflow, opened on demand from a single header link.
 *
 * Written for a general audience: each phase is a colored band, each step a
 * card. Click a card to jump to that tab; hover or focus for a plain-language
 * explanation.
 */
import React, { useState } from 'react';
import { ArrowDown, Map, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { FlowNodeDetail } from '@/components/workforce/WorkforceFlowNodeDetail';
import {
  WORKFORCE_FLOW_SWIMLANES,
  WORKFORCE_FLOW_NODES,
  type WorkforceFlowNodeId,
} from '@/components/workforce/workforceFlowModel';
import {
  WORKFORCE_TAB_META,
  type WorkforceContinuityTab,
} from '@/components/workforce/workforceContinuityTabs';
import type { WorkforceContinuityScorecard } from '@/services/workforceSuccessionService';

function liveMetricForNode(
  nodeId: WorkforceFlowNodeId,
  scorecard?: WorkforceContinuityScorecard | null
): string | undefined {
  if (!scorecard) return undefined;
  switch (nodeId) {
    case 'readiness':
      return scorecard.total_employees === 0 &&
        scorecard.total_critical_functions === 0 &&
        scorecard.total_positions === 0
        ? 'Not assessed yet'
        : `${scorecard.readiness_score} / 100`;
    case 'coverage':
      return `${scorecard.coverage_pct}% covered`;
    case 'certifications':
      return `${scorecard.cert_cliff_90d} expiring in 90 days`;
    case 'ceu':
      return scorecard.ceu_shortfall_count != null
        ? `${scorecard.ceu_shortfall_count} operator(s) behind`
        : undefined;
    default:
      return undefined;
  }
}

function OverviewNodeCard({
  nodeId,
  scorecard,
  onNavigate,
}: {
  nodeId: WorkforceFlowNodeId;
  scorecard?: WorkforceContinuityScorecard | null;
  onNavigate: (nodeId: WorkforceFlowNodeId) => void;
}) {
  const node = WORKFORCE_FLOW_NODES[nodeId];
  const tabMeta =
    nodeId in WORKFORCE_TAB_META ? WORKFORCE_TAB_META[nodeId as WorkforceContinuityTab] : null;
  const Icon = tabMeta?.icon ?? Map;
  const liveMetric = liveMetricForNode(nodeId, scorecard);
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex w-40 flex-col items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-center shadow-sm transition-shadow hover:border-indigo-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          aria-label={`${node.label}. ${node.plainLanguage}`}
          onClick={() => onNavigate(nodeId)}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
        >
          <Icon
            className={`h-5 w-5 ${
              tabMeta?.activeClass?.split(' ').find(c => c.startsWith('text-')) ?? 'text-slate-600'
            }`}
            aria-hidden
          />
          <span className="text-xs font-semibold leading-tight text-gray-900">{node.label}</span>
          {liveMetric ? (
            <span className="text-[10px] leading-tight text-indigo-700">{liveMetric}</span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 sm:w-80" align="center">
        <FlowNodeDetail node={node} liveMetric={liveMetric} />
      </PopoverContent>
    </Popover>
  );
}

export interface WorkforceFlowOverviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scorecard?: WorkforceContinuityScorecard | null;
  /** Navigate to a tab (or the alerts inbox) and close the dialog. */
  onNavigate: (nodeId: WorkforceFlowNodeId) => void;
}

export function WorkforceFlowOverviewDialog({
  open,
  onOpenChange,
  scorecard,
  onNavigate,
}: WorkforceFlowOverviewDialogProps) {
  const handleNavigate = (nodeId: WorkforceFlowNodeId) => {
    onOpenChange(false);
    onNavigate(nodeId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto p-0 gap-0">
        <DialogTitle className="sr-only">How workforce continuity connects</DialogTitle>
        <DialogDescription className="sr-only">
          Visual overview of the Plan, Hire, Transition, and Sustain workflow. Click any step to
          open that tab.
        </DialogDescription>

        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b bg-gradient-to-r from-indigo-600 to-purple-700 px-6 py-4 text-white">
          <div>
            <div className="flex items-center gap-2 text-base font-semibold">
              <Map className="h-5 w-5" aria-hidden />
              How this all connects
            </div>
            <p className="mt-1 text-xs text-indigo-100">
              Every step builds on the ones before it. Click any card to go there — hover for a
              plain-language explanation.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 shrink-0 p-0 text-white hover:bg-white/20 hover:text-white"
            onClick={() => onOpenChange(false)}
            aria-label="Close overview"
          >
            <X className="h-4 w-4" aria-hidden />
          </Button>
        </div>

        <div className="space-y-1 p-6">
          {WORKFORCE_FLOW_SWIMLANES.map((swimlane, laneIndex) => (
            <React.Fragment key={swimlane.id}>
              <section
                aria-label={`${swimlane.title} workspace`}
                className={`rounded-xl border p-4 ${swimlane.band}`}
              >
                <div className="mb-3">
                  <h3
                    className={`text-sm font-bold uppercase tracking-wide ${swimlane.titleClass}`}
                  >
                    {swimlane.title}
                  </h3>
                  <p className="text-xs text-gray-600">{swimlane.subtitle}</p>
                </div>
                <div className="flex flex-wrap justify-center gap-3 sm:justify-start">
                  {swimlane.nodeIds.map(nodeId => (
                    <OverviewNodeCard
                      key={nodeId}
                      nodeId={nodeId}
                      scorecard={scorecard}
                      onNavigate={handleNavigate}
                    />
                  ))}
                </div>
              </section>
              {laneIndex < WORKFORCE_FLOW_SWIMLANES.length - 1 ? (
                <div className="flex justify-center py-1" aria-hidden>
                  <ArrowDown className="h-4 w-4 text-gray-400" />
                </div>
              ) : null}
            </React.Fragment>
          ))}

          <p className="pt-3 text-[11px] leading-relaxed text-gray-500">
            The readiness score averages critical-function coverage, certification health,
            retirement risk, and CEU completion when data exists. NYS operator renewals follow a
            fixed 3-year cycle per{' '}
            <a
              href="https://regs.health.ny.gov/content/section-5-48-renewalrecertification-requirements"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              10 NYCRR §5-4.8
            </a>
            .
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
