import React from 'react';

/** Placeholder until @aquasafe/doc-editor is packaged for WW360. */
export function DocViewerEmbed({
  content,
  title,
}: {
  content?: string;
  title?: string;
  documentId?: number;
}) {
  return (
    <div className="rounded-md border bg-slate-50 p-4 text-sm text-slate-700">
      {title && <p className="font-medium mb-2">{title}</p>}
      <pre className="whitespace-pre-wrap text-xs">{content || 'Document preview unavailable.'}</pre>
    </div>
  );
}
