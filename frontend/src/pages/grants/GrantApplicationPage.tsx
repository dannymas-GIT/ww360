import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Ww360PageHero } from '@/components/ww360/Ww360PageHero';
import { Ww360Section } from '@/components/ww360/Ww360Section';
import { Badge } from '@/components/ui/badge';
import {
  fetchGrantApplication,
  patchGrantApplication,
  type GrantApplication,
  type GrantApplicationChecklist,
} from '@/services/grantsService';

export default function GrantApplicationPage() {
  const { applicationId = '' } = useParams<{ applicationId: string }>();
  const [app, setApp] = useState<GrantApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    if (!applicationId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    void fetchGrantApplication(applicationId)
      .then(row => {
        if (!cancelled) setApp(row);
      })
      .catch(err => {
        if (!cancelled) {
          setApp(null);
          setError(err instanceof Error ? err.message : 'Failed to load application');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  async function toggleChecklistItem(itemId: string, done: boolean) {
    if (!app) return;
    const nextChecklist: GrantApplicationChecklist = {
      ...(app.checklist || {}),
      [itemId]: {
        ...(app.checklist?.[itemId] || {}),
        done,
      },
    };
    setSavingId(itemId);
    setError(null);
    try {
      const updated = await patchGrantApplication(app.id, { checklist: nextChecklist });
      setApp(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update checklist');
    } finally {
      setSavingId(null);
    }
  }

  const checklistEntries = Object.entries(app?.checklist || {});

  return (
    <div
      className="mx-auto w-full max-w-[1200px] space-y-6 p-4 md:p-6"
      data-tour="grant-application"
    >
      <Ww360PageHero
        eyebrow="Application tracker"
        title={app ? `Application · ${app.program_id}` : loading ? 'Loading…' : 'Application'}
        description={
          app
            ? `${app.owner_scope}/${app.owner_code} · cycle ${app.cycle_key}`
            : 'Track status and readiness checklist for this funding packet.'
        }
        dataMode="live"
        actions={
          <div className="flex flex-wrap gap-3">
            <Link to="/grants" className="text-base text-white underline">
              ← Catalog
            </Link>
            {app?.program_id && (
              <Link
                to={`/grants/${app.program_id}`}
                className="text-base text-white underline"
              >
                Program detail
              </Link>
            )}
          </div>
        }
      />

      {loading && <p className="text-[1.125rem] text-slate-500">Loading application…</p>}
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-[1.125rem] text-red-800">
          {error}
        </p>
      )}

      {app && !loading && (
        <>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="min-h-[28px] text-sm capitalize">
              Status: {app.status}
            </Badge>
            {app.due_date && (
              <Badge variant="outline" className="min-h-[28px] text-sm">
                Due {app.due_date}
              </Badge>
            )}
            {app.fit_score != null && (
              <Badge
                variant="outline"
                className="min-h-[28px] border-sky-200 bg-sky-50 text-sm text-sky-900"
              >
                {Math.round(Number(app.fit_score))}% fit
              </Badge>
            )}
          </div>

          {app.notes && (
            <p className="text-[1.125rem] leading-relaxed text-slate-700">{app.notes}</p>
          )}

          <Ww360Section tourId="grant-app-checklist" title="Readiness checklist" dataMode="live">
            {checklistEntries.length === 0 ? (
              <p className="text-[1.125rem] text-slate-600">No checklist items on this application.</p>
            ) : (
              <ul className="space-y-2">
                {checklistEntries.map(([id, item]) => {
                  const done = Boolean(item.done);
                  const busy = savingId === id;
                  return (
                    <li key={id}>
                      <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-md border border-slate-100 px-3 py-2 hover:bg-slate-50">
                        <input
                          type="checkbox"
                          className="h-5 w-5 shrink-0 rounded border-slate-300"
                          checked={done}
                          disabled={busy}
                          onChange={e => void toggleChecklistItem(id, e.target.checked)}
                        />
                        <span className="text-[1.125rem] text-slate-900">
                          {item.label || id}
                          {item.required ? (
                            <span className="ml-2 text-sm text-slate-500">Required</span>
                          ) : null}
                          {busy ? (
                            <span className="ml-2 text-sm text-slate-500">Saving…</span>
                          ) : null}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </Ww360Section>

          {app.program_id === 'epa-iwiwd-2026' && (
            <Ww360Section tourId="grant-app-studio" title="Document Studio" dataMode="mixed">
              <Link
                to="/studio?template=epa-iwiwd-2026-narrative"
                className="inline-flex min-h-[44px] items-center rounded-md bg-sky-700 px-4 text-base font-medium text-white hover:bg-sky-800"
              >
                Open EPA IWIWD narrative template
              </Link>
            </Ww360Section>
          )}
        </>
      )}
    </div>
  );
}
