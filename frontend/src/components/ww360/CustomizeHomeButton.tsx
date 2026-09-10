import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  CircleHelp,
  LayoutGrid,
  Loader2,
  RotateCcw,
  Save,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Ww360TourOverlay,
  requestOpenTour,
  type Ww360TourConfig,
} from '@/components/ww360/Ww360TourOverlay';
import { useKitchenSink } from '@/context/KitchenSinkContext';
import { useImpersonation } from '@/context/ImpersonationContext';
import {
  fetchModuleFoundry,
  fetchWorkspaceLayout,
  resetWorkspaceLayout,
  saveWorkspaceLayout,
  type FoundryModule,
  type LayoutItem,
} from '@/services/workspaceCustomizationService';
import {
  buildCustomizeHomeTourSlides,
  CUSTOMIZE_TOUR_DISMISSED_KEY,
  CUSTOMIZE_TOUR_EVENT,
  CUSTOMIZE_TOUR_STEP_KEY,
} from '@/pages/workspaces/customizeTourContent';

export const CustomizeHomeButton: React.FC = () => {
  const { workspaceProfile, personaKey } = useKitchenSink();
  const { isPreviewMode } = useImpersonation();
  const [open, setOpen] = useState(false);
  const [modules, setModules] = useState<FoundryModule[]>([]);
  const [layout, setLayout] = useState<LayoutItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  const tourConfig: Ww360TourConfig = useMemo(
    () => ({
      id: 'customize-home',
      label: 'Customize home',
      slides: buildCustomizeHomeTourSlides(),
      dismissedKey: CUSTOMIZE_TOUR_DISMISSED_KEY,
      stepKey: CUSTOMIZE_TOUR_STEP_KEY,
      eventName: CUSTOMIZE_TOUR_EVENT,
      fabLabel: 'Customize tour',
    }),
    []
  );

  const moduleMap = useMemo(() => {
    const m = new Map<string, FoundryModule>();
    for (const mod of modules) m.set(mod.module_id, mod);
    return m;
  }, [modules]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [foundry, saved] = await Promise.all([
        fetchModuleFoundry(workspaceProfile),
        fetchWorkspaceLayout(workspaceProfile, personaKey),
      ]);
      setModules(foundry.modules);
      setLayout(saved.layout);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not load panel library');
    } finally {
      setLoading(false);
    }
  }, [workspaceProfile, personaKey]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const move = (index: number, dir: -1 | 1) => {
    setLayout(prev => {
      const next = [...prev];
      const j = index + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  };

  const toggleVisible = (moduleId: string) => {
    setLayout(prev =>
      prev.map(item =>
        item.module_id === moduleId ? { ...item, visible: !item.visible } : item
      )
    );
  };

  const toggleSize = (moduleId: string) => {
    setLayout(prev =>
      prev.map(item =>
        item.module_id === moduleId
          ? { ...item, size: item.size === 'full' ? 'half' : 'full' }
          : item
      )
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSavedNote(null);
    try {
      await saveWorkspaceLayout(workspaceProfile, layout, personaKey);
      setSavedNote('Saved. Your home will use this layout next visit.');
      window.dispatchEvent(new CustomEvent('ww360-workspace-layout-saved'));
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (err instanceof Error ? err.message : 'Save failed');
      setError(String(detail));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await resetWorkspaceLayout(workspaceProfile, personaKey);
      setLayout(res.layout);
      setSavedNote('Reset to the default layout for this role.');
      window.dispatchEvent(new CustomEvent('ww360-workspace-layout-saved'));
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (err instanceof Error ? err.message : 'Reset failed');
      setError(String(detail));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="w-full min-h-[44px] justify-start gap-2 border-white/20 bg-white/5 text-base text-white hover:bg-white/10"
          data-tour="customize-home-btn"
        >
          <LayoutGrid className="h-4 w-4 shrink-0" />
          Customize home
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto text-base">
        <DialogHeader>
          <DialogTitle className="text-xl">Customize your home</DialogTitle>
        </DialogHeader>

        <div
          className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-[1.125rem] leading-relaxed text-slate-800"
          data-tour="customize-kpi-guide"
        >
          <p className="font-semibold text-slate-900">How to choose panels</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>
              <strong>Identify your KPIs</strong> — 3–5 numbers you must see every visit.
            </li>
            <li>
              <strong>Match them to panels</strong> — headlines for top measures, charts for
              comparisons, Continuity / OpCert for workforce and certification.
            </li>
            <li>
              <strong>Save</strong> — your layout is stored for next time (not just this browser).
            </li>
          </ol>
          <Button
            type="button"
            variant="outline"
            className="mt-3 min-h-[44px] gap-2 text-base"
            onClick={() => requestOpenTour(CUSTOMIZE_TOUR_EVENT, 0)}
          >
            <CircleHelp className="h-4 w-4" />
            Start customize tour
          </Button>
        </div>

        {isPreviewMode && (
          <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-[1rem] text-amber-900">
            You are in read-only preview. Exit preview to save customizations to your own account.
          </p>
        )}

        {loading && (
          <p className="flex items-center gap-2 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading panel library…
          </p>
        )}

        {error && (
          <p className="rounded-md border border-red-200 bg-red-50 p-3 text-red-800" role="alert">
            {error}
          </p>
        )}
        {savedNote && (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-emerald-900">
            {savedNote}
          </p>
        )}

        <div className="space-y-3" data-tour="customize-foundry">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Panel library
          </h3>
          <ul className="space-y-3">
            {layout.map((item, index) => {
              const mod = moduleMap.get(item.module_id);
              if (!mod) return null;
              return (
                <li
                  key={item.module_id}
                  className={`rounded-lg border p-3 ${
                    item.visible ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-70'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-900">{mod.label}</span>
                        <Badge variant="secondary" className="text-sm">
                          {mod.category}
                        </Badge>
                        <Badge variant="outline" className="text-sm">
                          {item.size === 'full' ? 'Full width' : 'Half width'}
                        </Badge>
                      </div>
                      <p className="mt-1 text-[1rem] text-slate-600">{mod.description}</p>
                      {mod.kpi_hints?.length > 0 && (
                        <ul className="mt-2 list-disc pl-5 text-[0.875rem] text-slate-500">
                          {mod.kpi_hints.map(h => (
                            <li key={h}>
                              <span className="font-medium text-slate-600">Good for KPIs:</span> {h}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-h-[44px] min-w-[44px]"
                        onClick={() => move(index, -1)}
                        aria-label="Move up"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-h-[44px] min-w-[44px]"
                        onClick={() => move(index, 1)}
                        aria-label="Move down"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant={item.visible ? 'default' : 'outline'}
                      size="sm"
                      className="min-h-[44px] text-base"
                      onClick={() => toggleVisible(item.module_id)}
                    >
                      {item.visible ? 'On home' : 'Hidden'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-[44px] text-base"
                      onClick={() => toggleSize(item.module_id)}
                    >
                      {item.size === 'full' ? 'Use half width' : 'Use full width'}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex flex-wrap gap-2 border-t pt-4" data-tour="customize-save">
          <Button
            type="button"
            className="min-h-[44px] gap-2 text-base"
            disabled={saving || isPreviewMode}
            onClick={() => void handleSave()}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save layout
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px] gap-2 text-base"
            disabled={saving || isPreviewMode}
            onClick={() => void handleReset()}
          >
            <RotateCcw className="h-4 w-4" />
            Reset to defaults
          </Button>
        </div>

        {open && <Ww360TourOverlay config={tourConfig} autoOpen={false} />}
      </DialogContent>
    </Dialog>
  );
};
