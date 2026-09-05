/**
 * Plain-language detail panel shown when hovering/focusing a node in the
 * workflow overview dialog.
 */
import { ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  WORKFORCE_FLOW_NODES,
  type WorkforceFlowNode,
} from '@/components/workforce/workforceFlowModel';
import { WORKFORCE_PATHWAYS } from '@/components/workforce/workforceSampleTemplates';

export function FlowNodeDetail({
  node,
  liveMetric,
  showPathways = true,
}: {
  node: WorkforceFlowNode;
  liveMetric?: string;
  showPathways?: boolean;
}) {
  const needsLabels = node.needs.map(id => WORKFORCE_FLOW_NODES[id]?.label ?? id);
  const feedsLabels = node.feeds.map(id => WORKFORCE_FLOW_NODES[id]?.label ?? id);
  const pathways = showPathways
    ? (node.relatedPathways ?? [])
        .map(id => WORKFORCE_PATHWAYS.find(p => p.id === id))
        .filter(Boolean)
    : [];

  return (
    <div className="space-y-3 text-sm">
      <div>
        <p className="font-medium text-gray-900">{node.label}</p>
        {liveMetric ? (
          <p className="mt-0.5 text-xs font-semibold text-indigo-700">{liveMetric}</p>
        ) : null}
      </div>
      <p className="text-gray-700 leading-relaxed">{node.plainLanguage}</p>
      <p className="text-xs text-gray-600 leading-relaxed">{node.whyItMatters}</p>
      {needsLabels.length > 0 ? (
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Builds on</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {needsLabels.map(label => (
              <Badge key={label} variant="outline" className="text-[11px] font-normal">
                {label}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}
      {feedsLabels.length > 0 ? (
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Feeds</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {feedsLabels.map(label => (
              <Badge
                key={label}
                variant="secondary"
                className="text-[11px] font-normal bg-indigo-50 text-indigo-900"
              >
                {label}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}
      {pathways.length > 0 ? (
        <div className="rounded-md border border-indigo-100 bg-indigo-50/60 p-2">
          <p className="text-[11px] font-medium text-indigo-900">Related scenario</p>
          {pathways.map(p => (
            <p key={p!.id} className="mt-1 text-xs text-indigo-900/90">
              <span className="font-medium">{p!.title}:</span> {p!.scenario}
            </p>
          ))}
        </div>
      ) : null}
      {node.citation ? (
        <p className="text-[11px] text-gray-500">
          Source:{' '}
          <a
            href={node.citation.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-blue-600 hover:underline"
          >
            {node.citation.label}
            <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        </p>
      ) : null}
    </div>
  );
}
