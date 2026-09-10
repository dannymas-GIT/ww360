import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Eye, Users, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useImpersonation } from '@/context/ImpersonationContext';
import { useAuth } from '@/context/AuthContext';

const TIER_LABELS: Record<string, string> = {
  utility: 'Utility roles',
  state: 'State & section',
  regional: 'Regional (EPA)',
  national: 'National',
};

const WALKTHROUGH_INTRO =
  'You are a section partner — no home district. Use preview to see Monroe County Water Authority as Superintendent, Manager, and Operator. Exit anytime to return to your section home.';

const FULL_CATALOG_INTRO =
  'Preview the app as a national observer, another state partner, or a utility role. Read-only preview is the default.';

export const PersonaSwitcher: React.FC = () => {
  const { canUsePersonaSwitcher, canActAs, personas, personasLoading, loadPersonas, startPreview, startActAs } =
    useImpersonation();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'preview' | 'act'>('preview');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) void loadPersonas();
  }, [open, loadPersonas]);

  const isWalkthroughCatalog = useMemo(
    () =>
      personas.length > 0 &&
      personas.every(p => p.catalog_group === 'utility_walkthrough'),
    [personas]
  );

  const grouped = useMemo(() => {
    const map = new Map<string, typeof personas>();
    for (const p of personas) {
      const tier = p.tier || 'utility';
      if (!map.has(tier)) map.set(tier, []);
      map.get(tier)!.push(p);
    }
    return map;
  }, [personas]);

  if (!canUsePersonaSwitcher) return null;

  const handleSelect = async (personaKey: string) => {
    setBusy(personaKey);
    setError(null);
    try {
      if (mode === 'act' && canActAs) {
        await startActAs(personaKey, reason.trim());
      } else {
        await startPreview(personaKey);
      }
      setOpen(false);
      setReason('');
    } catch (err: unknown) {
      const detail =
        axios.isAxiosError(err) && err.response?.data?.detail
          ? String(err.response.data.detail)
          : err instanceof Error
            ? err.message
            : 'Could not start role preview';
      setError(detail);
    } finally {
      setBusy(null);
    }
  };

  const renderPersonaCard = (p: (typeof personas)[number]) => (
    <li key={p.persona_key}>
      <button
        type="button"
        disabled={busy === p.persona_key || (mode === 'act' && !reason.trim())}
        className="w-full rounded-lg border border-slate-200 p-3 text-left hover:border-sky-300 hover:bg-sky-50 disabled:opacity-50"
        onClick={() => void handleSelect(p.persona_key)}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-slate-900">{p.label}</span>
          <Badge variant="secondary" className="text-sm">
            {p.username}
          </Badge>
        </div>
        {p.subtitle && <p className="mt-1 text-[1rem] text-slate-600">{p.subtitle}</p>}
        <ul className="mt-2 list-disc pl-5 text-[0.875rem] text-slate-500">
          {(p.narrative_bullets || []).slice(0, 3).map(b => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      </button>
    </li>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="w-full min-h-[44px] justify-start gap-2 border-white/20 bg-white/5 text-base text-white hover:bg-white/10"
        >
          <Users className="h-4 w-4 shrink-0" />
          View as role
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto text-base">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {isWalkthroughCatalog ? 'Utility roles walkthrough' : 'View as role'}
          </DialogTitle>
        </DialogHeader>
        {isWalkthroughCatalog ? (
          <p className="text-[1.125rem] leading-relaxed text-slate-600">{WALKTHROUGH_INTRO}</p>
        ) : (
          <p className="text-[1.125rem] leading-relaxed text-slate-600">{FULL_CATALOG_INTRO}</p>
        )}
        {canActAs && (
          <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-base">
              <input
                type="radio"
                name="imp-mode"
                checked={mode === 'preview'}
                onChange={() => setMode('preview')}
              />
              Read-only preview
            </label>
            <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-base">
              <input
                type="radio"
                name="imp-mode"
                checked={mode === 'act'}
                onChange={() => setMode('act')}
              />
              Act as (writes allowed, audited)
            </label>
            {mode === 'act' && (
              <textarea
                className="min-h-[80px] w-full rounded-md border p-2 text-base"
                placeholder="Reason for act-as session (required)"
                value={reason}
                onChange={e => setReason(e.target.value)}
              />
            )}
          </div>
        )}
        {error && (
          <p className="rounded-md border border-red-200 bg-red-50 p-3 text-base text-red-800" role="alert">
            {error}
          </p>
        )}
        {personasLoading && <p className="text-slate-500">Loading personas…</p>}
        {!personasLoading && personas.length === 0 && (
          <p className="text-slate-500">No personas available. Run the demo persona seed script.</p>
        )}
        {isWalkthroughCatalog ? (
          <ul className="space-y-2">{personas.map(renderPersonaCard)}</ul>
        ) : (
          Array.from(grouped.entries()).map(([tier, items]) => (
            <div key={tier} className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                {TIER_LABELS[tier] || tier}
              </h3>
              <ul className="space-y-2">{items.map(renderPersonaCard)}</ul>
            </div>
          ))
        )}
      </DialogContent>
    </Dialog>
  );
};

export const ImpersonationBanner: React.FC = () => {
  const { isImpersonating, isPreviewMode, stop } = useImpersonation();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);

  if (!isImpersonating || !user?.impersonation?.active) return null;

  const expires = user.impersonation.expires_at
    ? new Date(user.impersonation.expires_at).toLocaleTimeString()
    : null;

  return (
    <div
      className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-3 border-b border-amber-300 bg-amber-100 px-4 py-3 text-[1.125rem]"
      role="status"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Eye className="h-5 w-5 text-amber-800" aria-hidden />
        <span>
          Viewing as <strong>{user.username}</strong>
          {user.impersonation.persona_key && (
            <span className="text-slate-600"> ({user.impersonation.persona_key})</span>
          )}
        </span>
        <Badge className="text-sm">
          {isPreviewMode ? 'Read-only preview' : 'Act-as (audited)'}
        </Badge>
        {expires && <span className="text-[0.875rem] text-slate-600">Expires {expires}</span>}
      </div>
      <Button
        variant="outline"
        size="sm"
        className="min-h-[44px] min-w-[44px] gap-1 text-base"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void stop().finally(() => setBusy(false));
        }}
      >
        <X className="h-4 w-4" />
        Exit preview
      </Button>
    </div>
  );
};
