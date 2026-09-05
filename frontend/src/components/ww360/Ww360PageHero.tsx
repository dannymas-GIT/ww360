import React from 'react';
import { Ww360DataModeBadge, type Ww360DataMode } from './Ww360DataModeBadge';

export interface Ww360PageHeroProps {
  eyebrow?: string;
  title: string;
  description?: string;
  /** Sample / live / mixed fidelity indicator */
  dataMode?: Ww360DataMode;
  lastSynced?: string | null;
  badges?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function Ww360PageHero({
  eyebrow,
  title,
  description,
  dataMode,
  lastSynced,
  badges,
  actions,
  className = '',
}: Ww360PageHeroProps) {
  return (
    <header
      className={`relative overflow-hidden rounded-2xl bg-[#07111f] px-6 py-6 text-white shadow-md md:px-8 md:py-8 ${className}`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            'radial-gradient(60% 80% at 85% 20%, rgba(56,189,248,0.35), transparent 60%), radial-gradient(50% 70% at 10% 90%, rgba(37,99,235,0.35), transparent 60%)',
        }}
      />
      <div className="relative flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0 max-w-3xl">
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">{eyebrow}</p>
          ) : null}
          <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
          {description ? (
            <p className="mt-3 text-sm leading-relaxed text-slate-300 md:text-[15px]">{description}</p>
          ) : null}
          {(dataMode || badges) && (
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
              {dataMode ? <Ww360DataModeBadge mode={dataMode} lastSynced={lastSynced} /> : null}
              {badges}
            </div>
          )}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
