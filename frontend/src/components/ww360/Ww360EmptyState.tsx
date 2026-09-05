import React from 'react';
import { Button } from '@/components/ui/button';

export interface Ww360EmptyStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
  children?: React.ReactNode;
}

export function Ww360EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  actionHref,
  children,
}: Ww360EmptyStateProps) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-8 text-center">
      <p className="text-sm font-medium text-slate-800">{title}</p>
      {description ? <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto">{description}</p> : null}
      {children}
      {actionLabel && (onAction || actionHref) ? (
        <div className="mt-4">
          {actionHref ? (
            <Button size="sm" className="min-h-[44px] bg-[#2563eb] hover:bg-[#1d4ed8]" asChild>
              <a href={actionHref}>{actionLabel}</a>
            </Button>
          ) : (
            <Button
              size="sm"
              className="min-h-[44px] bg-[#2563eb] hover:bg-[#1d4ed8]"
              onClick={onAction}
            >
              {actionLabel}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
