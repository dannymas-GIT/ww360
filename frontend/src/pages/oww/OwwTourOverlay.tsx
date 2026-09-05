import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CircleHelp, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  OWW_TOUR_DISMISSED_KEY,
  OWW_TOUR_SLIDES,
  OWW_TOUR_STEP_KEY,
  type OwwTourSlide,
} from './owwTourContent';

export const OWW_TOUR_OPEN_EVENT = 'ww360-open-oww-tour';

export function requestOpenOwwTour(slideIndex = 0): void {
  window.dispatchEvent(new CustomEvent(OWW_TOUR_OPEN_EVENT, { detail: { slideIndex } }));
}

const HIGHLIGHT_CLASS = 'oww-tour-highlight';
/** Fallback dialog footprint when the live panel has not mounted yet. */
const DIALOG_H_FALLBACK = 380;
const DIALOG_MARGIN = 16;
/** Approximate width of the fixed tour panel (right-docked). */
const DIALOG_W_FALLBACK = 384;

type DialogDock = 'top' | 'bottom';

function readDismissed(): boolean {
  try {
    return localStorage.getItem(OWW_TOUR_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

function writeDismissed(v: boolean): void {
  try {
    if (v) localStorage.setItem(OWW_TOUR_DISMISSED_KEY, '1');
    else localStorage.removeItem(OWW_TOUR_DISMISSED_KEY);
  } catch {
    /* ignore */
  }
}

function readStep(): number {
  try {
    const n = parseInt(localStorage.getItem(OWW_TOUR_STEP_KEY) ?? '0', 10);
    return Number.isFinite(n) && n >= 0 && n < OWW_TOUR_SLIDES.length ? n : 0;
  } catch {
    return 0;
  }
}

function writeStep(i: number): void {
  try {
    localStorage.setItem(OWW_TOUR_STEP_KEY, String(i));
  } catch {
    /* ignore */
  }
}

function clearHighlight(): void {
  document
    .querySelectorAll(`.${HIGHLIGHT_CLASS}`)
    .forEach(el => el.classList.remove(HIGHLIGHT_CLASS));
}

function getScrollParent(el: Element): HTMLElement | Window {
  let node: HTMLElement | null = el.parentElement;
  while (node) {
    const style = window.getComputedStyle(node);
    const oy = style.overflowY;
    if (
      (oy === 'auto' || oy === 'scroll' || oy === 'overlay') &&
      node.scrollHeight > node.clientHeight + 8
    ) {
      return node;
    }
    node = node.parentElement;
  }
  return window;
}

function measureDialog(dialogEl: HTMLElement | null): { h: number; w: number } {
  if (!dialogEl) return { h: DIALOG_H_FALLBACK, w: DIALOG_W_FALLBACK };
  const r = dialogEl.getBoundingClientRect();
  return {
    h: Math.max(r.height, 240),
    w: Math.max(r.width, 280),
  };
}

function scrollByDelta(el: Element, delta: number): void {
  if (Math.abs(delta) <= 4) return;
  const parent = getScrollParent(el);
  if (parent === window) {
    window.scrollBy({ top: delta, behavior: 'smooth' });
  } else {
    (parent as HTMLElement).scrollBy({ top: delta, behavior: 'smooth' });
  }
}

/**
 * Pick a dock and scroll so the highlight is not buried under the tour panel.
 * Tall sections (chart + callout cards) prefer a top-docked dialog so the
 * bottom of the section — usually the insight cards — stays readable.
 */
function scrollHighlightClearOfDialog(
  el: Element,
  dialogEl: HTMLElement | null
): DialogDock {
  const rect = el.getBoundingClientRect();
  const vh = window.innerHeight;
  const { h: dialogH } = measureDialog(dialogEl);
  const reserve = dialogH + DIALOG_MARGIN * 2;
  const clearBand = Math.max(140, vh - reserve - DIALOG_MARGIN);

  // Prefer top dock when the section is taller than the clear band or its
  // bottom already sits in the bottom-dialog zone (insight cards under charts).
  const tall = rect.height > clearBand * 0.85;
  const bottomInDialogZone = rect.bottom > vh - reserve;
  const dock: DialogDock = tall || bottomInDialogZone ? 'top' : 'bottom';

  const clearTop = dock === 'top' ? reserve : DIALOG_MARGIN + 8;
  const clearBottom = dock === 'bottom' ? reserve : DIALOG_MARGIN + 8;
  const band = Math.max(120, vh - clearTop - clearBottom);

  let delta: number;
  if (rect.height <= band) {
    // Fit the whole section into the clear band, centered.
    const desiredTop = clearTop + (band - rect.height) / 2;
    delta = rect.top - desiredTop;
  } else if (dock === 'top') {
    // Tall + top dock: pin the bottom of the section into the lower clear
    // band so callout cards under charts stay visible.
    const desiredBottom = vh - clearBottom - 8;
    delta = rect.bottom - desiredBottom;
  } else {
    // Tall + bottom dock: pin the top into the upper clear band.
    const desiredTop = clearTop + 12;
    delta = rect.top - desiredTop;
  }

  scrollByDelta(el, delta);
  return dock;
}

function applyHighlight(
  slide: OwwTourSlide | undefined,
  dialogEl: HTMLElement | null
): DialogDock {
  clearHighlight();
  if (!slide?.highlight) return 'bottom';
  try {
    const el = document.querySelector(slide.highlight);
    if (!el) return 'bottom';
    el.classList.add(HIGHLIGHT_CLASS);
    return scrollHighlightClearOfDialog(el, dialogEl);
  } catch {
    return 'bottom';
  }
}

export interface OwwTourOverlayProps {
  /** Auto-open on first visit unless dismissed permanently. */
  autoOpen?: boolean;
}

export function OwwTourOverlay({ autoOpen = true }: OwwTourOverlayProps) {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [index, setIndex] = useState(0);
  const [dock, setDock] = useState<DialogDock>('bottom');
  const firedRef = useRef(false);
  const highlightTimer = useRef<number | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);

  const slides = OWW_TOUR_SLIDES;
  const slide = slides[index];
  const total = slides.length;

  const scheduleHighlight = useCallback((slideIdx: number, delay = 50) => {
    if (highlightTimer.current) window.clearTimeout(highlightTimer.current);
    highlightTimer.current = window.setTimeout(() => {
      const nextDock = applyHighlight(slides[slideIdx], dialogRef.current);
      setDock(nextDock);
      // After smooth scroll + dock flip settle, measure the live dialog and nudge again.
      highlightTimer.current = window.setTimeout(() => {
        const el = slides[slideIdx]?.highlight
          ? document.querySelector(slides[slideIdx].highlight!)
          : null;
        if (el) setDock(scrollHighlightClearOfDialog(el, dialogRef.current));
      }, 380);
    }, delay);
  }, [slides]);

  const openAt = useCallback(
    (i: number) => {
      const idx = Math.max(0, Math.min(i, total - 1));
      writeDismissed(false);
      setIndex(idx);
      setOpen(true);
      setMinimized(false);
      writeStep(idx);
      scheduleHighlight(idx, 50);
    },
    [scheduleHighlight, total]
  );

  const dismiss = useCallback((permanent: boolean) => {
    if (highlightTimer.current) window.clearTimeout(highlightTimer.current);
    clearHighlight();
    setOpen(false);
    if (permanent) {
      writeDismissed(true);
      setMinimized(false);
    } else {
      setMinimized(true);
    }
  }, []);

  const go = useCallback(
    (delta: number) => {
      const next = index + delta;
      if (next < 0) return;
      if (next >= total) {
        writeStep(0);
        dismiss(false);
        return;
      }
      setIndex(next);
      writeStep(next);
      scheduleHighlight(next, 30);
    },
    [dismiss, index, scheduleHighlight, total]
  );

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ slideIndex?: number }>).detail;
      openAt(detail?.slideIndex ?? readStep());
    };
    window.addEventListener(OWW_TOUR_OPEN_EVENT, handler);
    return () => window.removeEventListener(OWW_TOUR_OPEN_EVENT, handler);
  }, [openAt]);

  useEffect(() => {
    if (!autoOpen || firedRef.current) return;
    firedRef.current = true;
    if (readDismissed()) {
      setMinimized(true);
      return;
    }
    const t = window.setTimeout(() => openAt(readStep()), 600);
    return () => window.clearTimeout(t);
  }, [autoOpen, openAt]);

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
        className="fixed bottom-4 right-4 z-[60] inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white px-4 py-2 text-sm font-medium text-sky-800 shadow-lg hover:bg-sky-50 min-h-[44px]"
        onClick={() => openAt(readStep())}
        aria-label="Open workspace tour"
      >
        <CircleHelp className="h-4 w-4" aria-hidden />
        Tour
      </button>,
      document.body
    );
  }

  if (!slide) return null;
  const isLast = index + 1 >= total;
  const dockClass =
    dock === 'top' ? 'top-4 bottom-auto' : 'bottom-4 top-auto';

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
      `}</style>
      <aside
        ref={dialogRef}
        className={`fixed right-4 ${dockClass} z-[60] w-[min(100vw-2rem,24rem)] max-h-[min(70vh,28rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl`}
        role="dialog"
        aria-label="One Water Workforce workspace tour"
        aria-modal="false"
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-2 border-b border-slate-100 bg-white px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">
              Workspace tour · {index + 1}/{total}
            </p>
            <p className="truncate text-sm font-medium text-slate-700">One Water Workforce</p>
          </div>
          <button
            type="button"
            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
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
            <span
              key={s.id}
              className={`h-1 flex-1 rounded-full ${i <= index ? 'bg-sky-500' : 'bg-slate-200'}`}
            />
          ))}
        </div>
        <footer className="sticky bottom-0 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-white px-4 py-3">
          <button
            type="button"
            className="text-xs text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline min-h-[44px]"
            onClick={() => dismiss(true)}
          >
            Don&apos;t show again
          </button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={index === 0}
              onClick={() => go(-1)}
              className="min-h-[44px]"
            >
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
