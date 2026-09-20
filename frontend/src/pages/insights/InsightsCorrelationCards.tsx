import React from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp } from 'lucide-react';
import type { InsightsCorrelationCard } from '@/services/insightsService';

export function InsightsCorrelationCards({
  cards,
  emptyMessage = 'No correlation insights yet for this view.',
  compact = false,
  preferredOnly = false,
}: {
  cards: InsightsCorrelationCard[];
  emptyMessage?: string;
  compact?: boolean;
  /** When true, prefer persona_match cards if any are flagged. */
  preferredOnly?: boolean;
}) {
  const visible = preferredOnly
    ? cards.some(c => c.persona_match)
      ? cards.filter(c => c.persona_match)
      : cards
    : cards;

  if (!visible.length) {
    return (
      <p className={`${compact ? 'text-base' : 'text-[1.125rem]'} text-slate-600`}>
        {emptyMessage}
      </p>
    );
  }

  return (
    <ul
      className={`grid gap-3 ${compact ? 'sm:grid-cols-1' : 'sm:grid-cols-2 lg:grid-cols-3'}`}
      data-tour="insights-card-grid"
    >
      {visible.map(card => (
        <li
          key={card.id}
          data-tour={`insights-card-${card.id}`}
          className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div className="flex items-start gap-2">
            <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" aria-hidden />
            <div className="min-w-0 space-y-2">
              <h3 className="text-base font-semibold text-slate-900">{card.title}</h3>
              <p
                className={`${compact ? 'text-base' : 'text-[1.125rem]'} leading-relaxed text-slate-700`}
              >
                {card.summary}
              </p>
              {card.data_mode && (
                <p className="text-sm text-slate-500">Data: {card.data_mode}</p>
              )}
              {card.strength != null && (
                <p className="text-sm text-slate-500">
                  Strength {Math.round(Number(card.strength) * 100) / 100}
                </p>
              )}
              {(card.metrics?.length || 0) > 0 && (
                <dl className="grid grid-cols-2 gap-2">
                  {card.metrics!.map(m => (
                    <div key={`${card.id}-${m.label}`}>
                      <dt className="text-sm text-slate-500">{m.label}</dt>
                      <dd className="text-base font-medium tabular-nums text-slate-900">
                        {m.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
              {!compact && (card.notes?.length || 0) > 0 && (
                <ul className="list-disc space-y-1 pl-5 text-base text-slate-600">
                  {card.notes!.slice(0, 3).map(n => (
                    <li key={n.slice(0, 40)}>{n}</li>
                  ))}
                </ul>
              )}
              {!compact && (card.counties?.length || 0) > 0 && (
                <p className="text-sm text-slate-500">
                  {card.counties!.length} count
                  {card.counties!.length === 1 ? 'y' : 'ies'} in detail
                </p>
              )}
              {card.href && (
                <Link
                  to={card.href}
                  className="inline-flex min-h-[44px] items-center text-base font-medium text-sky-800 underline-offset-2 hover:underline"
                >
                  Explore
                </Link>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
