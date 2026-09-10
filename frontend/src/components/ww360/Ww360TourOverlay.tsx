/**
 * Reusable guided tour — a docked card that highlights `[data-tour]` targets,
 * scrolls them clear of itself, and remembers progress per tour in localStorage.
 *
 * Each page supplies a `Ww360TourConfig` (slides + storage keys + event name).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CircleHelp, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { trackEvent } from '@/lib/ga4';

export interface Ww360TourSlide {
  id: string;
  title: string;
  body: string;
  tip?: string;
  /** CSS selector — usually a `[data-tour="…"]` hook on the page. */
  highlight?: string;
  /**
   * Force the tour card to the left or right of the viewport.
   * Default `auto` docks opposite the highlight (right-side targets → left card).
   */
  preferredSide?: 'auto' | 'left' | 'right';
  /** Force vertical dock. Default `auto` picks top for tall targets. */
  preferredDock?: 'auto' | 'top' | 'bottom';
  /**
   * Optional hook run before highlighting (e.g. open a dialog or switch a tab).
   * Return a promise to delay highlighting until the UI has rendered.
   */
  before?: () => void | Promise<void>;
}

export interface Ww360TourConfig {
  /** Stable id — used in the highlight class and aria labels. */
  id: string;
  /** Small label under "Workspace tour" (e.g. "One Water Workforce"). */
  label: string;
  slides: Ww360TourSlide[];
  dismissedKey: string;
  stepKey: string;
  eventName: string;
  /** Label for the minimized floating button. */
  fabLabel?: string;
}

export function requestOpenTour(eventName: string, slideIndex = 0): void {
  window.dispatchEvent(new CustomEvent(eventName, { detail: { slideIndex } }));
}

const HIGHLIGHT_CLASS = 'ww360-tour-highlight';
/** Fallback dialog footprint when the live panel has not mounted yet. */
const DIALOG_H_FALLBACK = 380;
const DIALOG_MARGIN = 16;
const DIALOG_W_FALLBACK = 384;

type DialogDock = 'top' | 'bottom';
type DialogSide = 'left' | 'right';

interface DialogPlacement {
  dock: DialogDock;
  side: DialogSide;
}

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeFlag(key: string, v: boolean): void {
  try {
    if (v) localStorage.setItem(key, '1');
    else localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function readStep(key: string, max: number): number {
  try {
    const n = parseInt(localStorage.getItem(key) ?? '0', 10);
    return Number.isFinite(n) && n >= 0 && n < max ? n : 0;
  } catch {
    return 0;
  }
}

function writeStep(key: string, i: number): void {
  try {
    localStorage.setItem(key, String(i));
  } catch {
    /* ignore */
  }
}

function sessionAutoKey(tourId: string): string {
  return `ww360-tour-session-auto:${tourId}`;
}

function readSessionFlag(key: string): boolean {
  try {
    return sessionStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeSessionFlag(key: string, v = true): void {
  try {
    if (v) sessionStorage.setItem(key, '1');
    else sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** Scope tour storage to the signed-in user so accounts don't share progress. */
export function tourStorageKey(base: string, userId?: string | number | null): string {
  if (userId == null || userId === '') return base;
  return `${base}:u${userId}`;
}

const TOUR_STORAGE_PREFIXES = [
  'ww360-studio-tour-',
  'ww360-oww-tour-',
  'ww360-tour-session-auto:',
];

/** Clear tour progress/dismiss flags (call on logout so the next account starts fresh). */
export function clearWw360TourStorage(): void {
  const sweep = (store: Storage) => {
    const keys: string[] = [];
    for (let i = 0; i < store.length; i += 1) {
      const k = store.key(i);
      if (k && TOUR_STORAGE_PREFIXES.some(p => k.startsWith(p))) keys.push(k);
    }
    keys.forEach(k => store.removeItem(k));
  };
  try {
    sweep(localStorage);
    sweep(sessionStorage);
  } catch {
    /* ignore */
  }
}

function clearHighlight(): void {
  document.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach(el => el.classList.remove(HIGHLIGHT_CLASS));
}

function getScrollParent(el: Element): HTMLElement | Window {
  let node: HTMLElement | null = el.parentElement;
  while (node) {
    const style = window.getComputedStyle(node);
    const oy = style.overflowY;
    if ((oy === 'auto' || oy === 'scroll' || oy === 'overlay') && node.scrollHeight > node.clientHeight + 8) {
      return node;
    }
    node = node.parentElement;
  }
  return window;
}

function measureDialog(dialogEl: HTMLElement | null): { h: number; w: number } {
  if (!dialogEl) return { h: DIALOG_H_FALLBACK, w: DIALOG_W_FALLBACK };
  const r = dialogEl.getBoundingClientRect();
  return { h: Math.max(r.height, 240), w: Math.max(r.width, 280) };
}

function scrollByDelta(el: Element, delta: number): void {
  if (Math.abs(delta) <= 4) return;
  const parent = getScrollParent(el);
  if (parent === window) window.scrollBy({ top: delta, behavior: 'smooth' });
  else (parent as HTMLElement).scrollBy({ top: delta, behavior: 'smooth' });
}

/**
 * Pick a dock/side and scroll so the highlight is not buried under the tour panel.
 * Tall sections prefer a top-docked dialog; targets on the right half dock the card left.
 */
function scrollHighlightClearOfDialog(
  el: Element,
  dialogEl: HTMLElement | null,
  preferredSide: Ww360TourSlide['preferredSide'] = 'auto',
  preferredDock: Ww360TourSlide['preferredDock'] = 'auto'
): DialogPlacement {
  const rect = el.getBoundingClientRect();
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const { h: dialogH } = measureDialog(dialogEl);
  const reserve = dialogH + DIALOG_MARGIN * 2;
  const clearBand = Math.max(140, vh - reserve - DIALOG_MARGIN);

  const tall = rect.height > clearBand * 0.85;
  const bottomInDialogZone = rect.bottom > vh - reserve;
  let dock: DialogDock = tall || bottomInDialogZone ? 'top' : 'bottom';
  if (preferredDock === 'top' || preferredDock === 'bottom') dock = preferredDock;

  let side: DialogSide = 'right';
  if (preferredSide === 'left' || preferredSide === 'right') {
    side = preferredSide;
  } else {
    // Auto: keep the card opposite the highlight so right-side panels stay visible.
    const targetCenterX = rect.left + rect.width / 2;
    side = targetCenterX > vw * 0.55 ? 'left' : 'right';
  }

  const clearTop = dock === 'top' ? reserve : DIALOG_MARGIN + 8;
  const clearBottom = dock === 'bottom' ? reserve : DIALOG_MARGIN + 8;
  const band = Math.max(120, vh - clearTop - clearBottom);

  let delta: number;
  if (rect.height <= band) {
    const desiredTop = clearTop + (band - rect.height) / 2;
    delta = rect.top - desiredTop;
  } else if (dock === 'top') {
    const desiredBottom = vh - clearBottom - 8;
    delta = rect.bottom - desiredBottom;
  } else {
    const desiredTop = clearTop + 12;
    delta = rect.top - desiredTop;
  }

  // Elements inside fixed dialogs (e.g. a modal) shouldn't scroll the page.
  const inFixedLayer = !!(el as HTMLElement).closest('[role="dialog"]:not([data-ww360-tour])');
  if (!inFixedLayer) scrollByDelta(el, delta);
  return { dock, side };
}

function fallbackPlacement(slide: Ww360TourSlide | undefined): DialogPlacement {
  const side: DialogSide =
    slide?.preferredSide === 'left' || slide?.preferredSide === 'right'
      ? slide.preferredSide
      : 'right';
  const dock: DialogDock =
    slide?.preferredDock === 'top' || slide?.preferredDock === 'bottom'
      ? slide.preferredDock
      : 'bottom';
  return { dock, side };
}

function applyHighlight(
  slide: Ww360TourSlide | undefined,
  dialogEl: HTMLElement | null
): DialogPlacement {
  clearHighlight();
  if (!slide?.highlight) return fallbackPlacement(slide);
  try {
    const el = document.querySelector(slide.highlight);
    if (!el) return fallbackPlacement(slide);
    el.classList.add(HIGHLIGHT_CLASS);
    return scrollHighlightClearOfDialog(el, dialogEl, slide.preferredSide, slide.preferredDock);
  } catch {
    return fallbackPlacement(slide);
  }
}

export interface Ww360TourOverlayProps {
  config: Ww360TourConfig;
  /** Auto-open on first visit unless dismissed permanently. */
  autoOpen?: boolean;
  /** Delay before auto-open (ms) — allow data to render first. */
  autoOpenDelayMs?: number;
  /** Notified when the tour card opens/closes (pages can relax modal dialogs while touring). */
  onOpenChange?: (open: boolean) => void;
}

export function Ww360TourOverlay({
  config,
  autoOpen = true,
  autoOpenDelayMs = 600,
  onOpenChange,
}: Ww360TourOverlayProps) {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [index, setIndex] = useState(0);
  const [placement, setPlacement] = useState<DialogPlacement>({ dock: 'bottom', side: 'right' });
  const highlightTimer = useRef<number | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  useEffect(() => {
    onOpenChangeRef.current?.(open);
  }, [open]);

  const { slides, dismissedKey, stepKey, eventName } = config;
  const slide = slides[index];
  const total = slides.length;

  const scheduleHighlight = useCallback(
    (slideIdx: number, delay = 50) => {
      if (highlightTimer.current) window.clearTimeout(highlightTimer.current);
      const run = () => {
        const next = applyHighlight(slides[slideIdx], dialogRef.current);
        setPlacement(next);
        highlightTimer.current = window.setTimeout(() => {
          const sel = slides[slideIdx]?.highlight;
          const el = sel ? document.querySelector(sel) : null;
          if (el) {
            setPlacement(
              scrollHighlightClearOfDialog(
                el,
                dialogRef.current,
                slides[slideIdx]?.preferredSide,
                slides[slideIdx]?.preferredDock
              )
            );
          }
        }, 380);
      };
      highlightTimer.current = window.setTimeout(() => {
        const before = slides[slideIdx]?.before;
        if (before) {
          Promise.resolve(before()).then(() => {
            const settleMs = slides[slideIdx]?.preferredSide && slides[slideIdx]?.preferredSide !== 'auto' ? 220 : 120;
            highlightTimer.current = window.setTimeout(run, settleMs);
          });
        } else {
          run();
        }
      }, delay);
    },
    [slides]
  );

  const openAt = useCallback(
    (i: number) => {
      const idx = Math.max(0, Math.min(i, total - 1));
      writeFlag(dismissedKey, false);
      setIndex(idx);
      setOpen(true);
      setMinimized(false);
      writeStep(stepKey, idx);
      scheduleHighlight(idx, 50);
    },
    [dismissedKey, scheduleHighlight, stepKey, total]
  );

  const dismiss = useCallback(
    (permanent: boolean) => {
      if (highlightTimer.current) window.clearTimeout(highlightTimer.current);
      clearHighlight();
      setOpen(false);
      if (permanent) {
        writeFlag(dismissedKey, true);
        writeStep(stepKey, 0);
        setMinimized(false);
      } else {
        setMinimized(true);
      }
    },
    [dismissedKey, stepKey]
  );

  const go = useCallback(
    (delta: number) => {
      const next = index + delta;
      if (next < 0) return;
      if (next >= total) {
        writeStep(stepKey, 0);
        trackEvent('tour_completed', { tour_id: config.id });
        dismiss(false);
        return;
      }
      setIndex(next);
      writeStep(stepKey, next);
      scheduleHighlight(next, 30);
    },
    [dismiss, index, scheduleHighlight, stepKey, total, config.id]
  );

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ slideIndex?: number }>).detail;
      openAt(detail?.slideIndex ?? readStep(stepKey, total));
    };
    window.addEventListener(eventName, handler);
    return () => window.removeEventListener(eventName, handler);
  }, [eventName, openAt, stepKey, total]);

  // Auto-open once per browser tab session. Always start at slide 0 so a prior
  // mid-tour (or another account's cached step) never lands users on step 4+.
  // Same-page hash nav remounts must not pop the tour again — sessionStorage is
  // the gate (not a component ref), so remounts after #regions / #epa stay quiet.
  const openAtRef = useRef(openAt);
  openAtRef.current = openAt;
  useEffect(() => {
    if (!autoOpen) return;
    if (readFlag(dismissedKey)) return;
    const autoKey = sessionAutoKey(config.id);
    if (readSessionFlag(autoKey)) {
      setMinimized(true);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(() => {
      if (cancelled) return;
      writeSessionFlag(autoKey);
      writeStep(stepKey, 0);
      openAtRef.current(0);
    }, autoOpenDelayMs);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [autoOpen, autoOpenDelayMs, dismissedKey, stepKey, config.id]);

  useEffect(
    () => () => {
      if (highlightTimer.current) window.clearTimeout(highlightTimer.current);
      clearHighlight();
    },
    []
  );

  // Keep highlight clear of the dialog on resize / orientation change.
  useEffect(() => {
    if (!open || !slide?.highlight) return;
    const onResize = () => scheduleHighlight(index, 0);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [index, open, scheduleHighlight, slide?.highlight]);

  if (typeof document === 'undefined') return null;

  if (!open) {
    if (!minimized) return null;
    return createPortal(
      <button
        type="button"
        className="fixed bottom-4 right-4 z-[10000] inline-flex min-h-[44px] items-center gap-2 rounded-full border border-sky-200 bg-white px-4 py-2 text-sm font-medium text-sky-800 shadow-lg hover:bg-sky-50"
        onClick={() => openAt(readStep(stepKey, total))}
        aria-label={`Open ${config.label} tour`}
      >
        <CircleHelp className="h-4 w-4" aria-hidden />
        {config.fabLabel ?? 'Tour'}
      </button>,
      document.body
    );
  }

  if (!slide) return null;
  const isLast = index + 1 >= total;

  return createPortal(
    <>
      <style>{`
        .${HIGHLIGHT_CLASS} {
          outline: 2px solid rgb(14 165 233);
          outline-offset: 4px;
          border-radius: 0.75rem;
          box-shadow: 0 0 0 9999px rgba(7, 17, 31, 0.28);
          position: relative;
          z-index: 55;
          transition: box-shadow 200ms ease;
          scroll-margin-top: ${DIALOG_H_FALLBACK + DIALOG_MARGIN * 2}px;
          scroll-margin-bottom: ${DIALOG_H_FALLBACK + DIALOG_MARGIN * 2}px;
        }
        /* Targets inside a modal dialog already sit above the page; keep them visible. */
        [role="dialog"] .${HIGHLIGHT_CLASS} { box-shadow: 0 0 0 4px rgba(14,165,233,0.25); z-index: auto; }
      `}</style>
      <aside
        ref={dialogRef}
        data-ww360-tour={config.id}
        data-tour-side={placement.side}
        data-tour-dock={placement.dock}
        className={`fixed z-[10000] w-[min(100vw-2rem,24rem)] max-h-[min(70vh,28rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl`}
        style={{
          top: placement.dock === 'top' ? 16 : 'auto',
          bottom: placement.dock === 'bottom' ? 16 : 'auto',
          left: placement.side === 'left' ? 16 : 'auto',
          right: placement.side === 'right' ? 16 : 'auto',
        }}
        role="dialog"
        aria-label={`${config.label} tour`}
        aria-modal="false"
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-2 border-b border-slate-100 bg-white px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">
              Workspace tour · {index + 1}/{total}
            </p>
            <p className="truncate text-sm font-medium text-slate-700">{config.label}</p>
          </div>
          <button
            type="button"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            onClick={() => dismiss(false)}
            aria-label="Close tour"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="space-y-2 px-4 py-3">
          <h3 className="text-base font-semibold text-slate-900">{slide.title}</h3>
          <p className="text-sm leading-relaxed text-slate-600">{slide.body}</p>
          {slide.tip ? (
            <p className="text-xs leading-relaxed text-slate-500">
              <span className="font-semibold text-slate-700">Tip:</span> {slide.tip}
            </p>
          ) : null}
        </div>
        <div className="flex gap-1 px-4" aria-hidden>
          {slides.map((s, i) => (
            <span key={s.id} className={`h-1 flex-1 rounded-full ${i <= index ? 'bg-sky-500' : 'bg-slate-200'}`} />
          ))}
        </div>
        <footer className="sticky bottom-0 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-white px-4 py-3">
          <button
            type="button"
            className="min-h-[44px] text-xs text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
            onClick={() => dismiss(true)}
          >
            Don&apos;t show again
          </button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" disabled={index === 0} onClick={() => go(-1)} className="min-h-[44px]">
              Back
            </Button>
            <Button type="button" size="sm" onClick={() => go(1)} className="min-h-[44px]">
              {isLast ? 'Finish' : 'Next'}
            </Button>
          </div>
        </footer>
      </aside>
    </>,
    document.body
  );
}
