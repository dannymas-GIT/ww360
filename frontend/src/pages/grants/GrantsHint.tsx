import React from 'react';
import { CircleHelp } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';

export interface GrantsHintProps {
  text: string;
  /** When false, render children only (no icon / tooltip). */
  enabled?: boolean;
  /** Optional label wrapped with the hint trigger (e.g. checklist title). */
  children?: React.ReactNode;
  /** Called from the tooltip footer so users can shut hints off globally. */
  onDisableHints?: () => void;
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
}

/**
 * Hover / focus hint for Grants Studio jargon. Respects the page-level
 * hints toggle; includes a one-click "Turn off hints" in the tooltip.
 */
export function GrantsHint({
  text,
  enabled = true,
  children,
  onDisableHints,
  side = 'top',
  className = '',
}: GrantsHintProps) {
  if (!enabled || !text.trim()) {
    return children ? <>{children}</> : null;
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-md text-slate-500 hover:bg-slate-100 hover:text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${className}`}
            aria-label={`More about: ${text.slice(0, 80)}`}
          >
            {children}
            <CircleHelp className="h-4 w-4 shrink-0" aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side={side}
          className="max-w-sm border-slate-200 bg-white p-3 text-slate-800 shadow-lg"
        >
          <p className="text-sm leading-relaxed text-slate-800">{text}</p>
          {onDisableHints ? (
            <div className="mt-2 border-t border-slate-100 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 min-h-[36px] px-2 text-sm text-slate-600 hover:text-slate-900"
                onClick={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDisableHints();
                }}
              >
                Turn off hints
              </Button>
            </div>
          ) : null}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** Compact inline label + hint icon for checklist rows. */
export function GrantsHintLabel({
  label,
  hint,
  enabled,
  onDisableHints,
  trailing,
}: {
  label: React.ReactNode;
  hint?: string;
  enabled?: boolean;
  onDisableHints?: () => void;
  trailing?: React.ReactNode;
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1 text-[1.125rem] text-slate-900">
      <span>{label}</span>
      {hint ? (
        <GrantsHint text={hint} enabled={enabled} onDisableHints={onDisableHints} className="min-h-9 min-w-9" />
      ) : null}
      {trailing}
    </span>
  );
}
