import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Ww360SourceChip } from './Ww360SourceChip';
import type { Ww360SourceId } from './ww360SourceTokens';

export interface Ww360SectionProps {
  tourId: string;
  title: string;
  eyebrow?: string;
  sources?: Ww360SourceId[];
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function Ww360Section({
  tourId,
  title,
  eyebrow,
  sources,
  action,
  children,
  className = '',
}: Ww360SectionProps) {
  return (
    <Card
      id={tourId}
      data-tour={tourId}
      className={`scroll-mt-20 border-slate-200 bg-white shadow-sm ${className}`}
    >
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0 border-b border-slate-100 px-5 py-4">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-600">{eyebrow}</p>
          ) : null}
          <CardTitle className="text-base font-semibold text-slate-900">{title}</CardTitle>
          {sources?.length ? (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {sources.map(s => (
                <Ww360SourceChip key={s} id={s} />
              ))}
            </div>
          ) : null}
        </div>
        {action}
      </CardHeader>
      <CardContent className="px-5 py-4">{children}</CardContent>
    </Card>
  );
}
