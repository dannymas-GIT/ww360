import { Button } from '@/components/ui/button';
import { getAuthHeader } from '@/services/authService';
import { normalizeUtcIso } from '@/utils/districtTime';
import { History } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

type Row = { source: string; id: string; summary: string; occurred_at?: string | null };

export interface ActivityAuditFeedProps {
  embedded?: boolean;
}

export function ActivityAuditFeed({ embedded = false }: ActivityAuditFeedProps) {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/activity/feed?limit=100', {
        headers: { ...getAuthHeader() },
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(data.items || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load feed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className={embedded ? 'space-y-4' : 'p-6 max-w-4xl mx-auto space-y-4'}>
      <div className="flex items-center justify-between gap-4">
        {!embedded ? (
          <div className="flex items-center gap-2">
            <History className="h-6 w-6 text-slate-600" />
            <div>
              <h2 className="text-xl font-semibold">Activity &amp; audit</h2>
              <p className="text-sm text-muted-foreground">
                Tenant audit, schedule changes, chain of custody
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Recent district activity across schedules, COC, and audit events.
          </p>
        )}
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          Refresh
        </Button>
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <div className="border rounded-lg divide-y bg-background">
        {loading && <p className="p-4 text-sm text-muted-foreground">Loading…</p>}
        {!loading &&
          items.map(row => (
            <div key={`${row.source}-${row.id}`} className="p-3 text-sm">
              <div className="flex justify-between gap-2">
                <span className="font-medium">{row.summary}</span>
                <span className="text-xs text-muted-foreground shrink-0">{row.source}</span>
              </div>
              {row.occurred_at && (
                <div className="text-xs text-muted-foreground mt-1">
                  {new Date(normalizeUtcIso(row.occurred_at)).toLocaleString()}
                </div>
              )}
            </div>
          ))}
        {!loading && !items.length && (
          <div className="p-4 text-muted-foreground text-sm">
            No activity rows returned (tables may be empty).
          </div>
        )}
      </div>
    </div>
  );
}
