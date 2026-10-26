import React, { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Newspaper, RefreshCw } from 'lucide-react';
import { Ww360Section } from '@/components/ww360/Ww360Section';
import { Button } from '@/components/ui/button';
import { fetchOwwBlog, type OwwBlogItem, type OwwBlogResponse } from '@/services/owwBlogService';
import { useJurisdiction } from '@/context/JurisdictionContext';

interface OwwBlogFeedWidgetProps {
  tourId?: string;
  limit?: number;
}

function formatDate(iso?: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

export const OwwBlogFeedWidget: React.FC<OwwBlogFeedWidgetProps> = ({
  tourId = 'oww-blog',
  limit = 5,
}) => {
  const { activeState } = useJurisdiction();
  const [data, setData] = useState<OwwBlogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken(t => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const res = await fetchOwwBlog(activeState || 'NY', limit);
        if (cancelled) return;
        setData(res);
        if (res.data_mode === 'error') {
          setError(res.message || 'Could not load updates');
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Could not load updates');
        setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeState, limit, reloadToken]);

  const items: OwwBlogItem[] = data?.items || [];

  return (
    <Ww360Section
      title="One Water Workforce updates"
      tourId={tourId}
      dataMode={data?.data_mode === 'live' ? 'live' : 'mixed'}
      action={
        <Button
          type="button"
          variant="outline"
          className="min-h-[44px] text-base"
          onClick={reload}
          disabled={loading}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      }
    >
      <p className="mb-4 text-[1.125rem] text-slate-600">
        Published blog posts from One Water Workforce — the same updates shared on social channels.
      </p>

      {loading && !items.length ? (
        <p className="text-base text-slate-600">Loading updates…</p>
      ) : null}
      {error ? <p className="text-base text-rose-700">{error}</p> : null}
      {!loading && !error && items.length === 0 ? (
        <p className="text-base text-slate-600">{data?.message || 'No published updates yet.'}</p>
      ) : null}

      <ul className="space-y-4">
        {items.map(item => (
          <li key={item.id} className="flex gap-3 border-b border-slate-100 pb-4 last:border-0">
            {item.cover_image_url ? (
              <img
                src={item.cover_image_url}
                alt=""
                className="h-16 w-16 shrink-0 rounded-lg object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                <Newspaper className="h-6 w-6" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-slate-900">{item.title}</p>
              {item.published_at ? (
                <p className="text-sm text-slate-500">{formatDate(item.published_at)}</p>
              ) : null}
              {item.excerpt ? (
                <p className="mt-1 line-clamp-2 text-[1rem] text-slate-600">{item.excerpt}</p>
              ) : null}
              {item.url ? (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex min-h-[44px] items-center gap-1 text-base text-sky-800 hover:underline"
                >
                  Read on OWW
                  <ExternalLink className="h-4 w-4" />
                </a>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </Ww360Section>
  );
};

export default OwwBlogFeedWidget;
