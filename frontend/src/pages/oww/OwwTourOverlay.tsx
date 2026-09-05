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

function applyHighlight(slide: OwwTourSlide | undefined): void {
  clearHighlight();
  if (!slide?.highlight) return;
  try {
    const el = document.querySelector(slide.highlight);
    if (el) {
      el.classList.add(HIGHLIGHT_CLASS);
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  } catch {
    /* invalid selector */
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
  const firedRef = useRef(false);

  const slides = OWW_TOUR_SLIDES;
  const slide = slides[index];
  const total = slides.length;

  const openAt = useCallback(
    (i: number) => {
      const idx = Math.max(0, Math.min(i, total - 1));
      writeDismissed(false);
      setIndex(idx);
      setOpen(true);
      setMinimized(false);
      writeStep(idx);
      // Let the dashboard paint before we measure/scroll.
      window.setTimeout(() => applyHighlight(slides[idx]), 50);
    },
    [slides, total]
  );

  const dismiss = useCallback((permanent: boolean) => {
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
      applyHighlight(slides[next]);
    },
    [dismiss, index, slides, total]
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

  useEffect(() => () => clearHighlight(), []);

  if (typeof document === 'undefined') return null;

  if (!open) {
    if (!minimized) return null;
    return createPortal(
      <button
        type="button"
        className="fixed bottom-4 right-4 z-[60] inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white px-4 py-2 text-sm font-medium text-sky-800 shadow-lg hover:bg-sky-50"
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
        }
      `}</style>
      <aside
        className="fixed bottom-4 right-4 z-[60] w-[min(100vw-2rem,24rem)] rounded-xl border border-slate-200 bg-white shadow-2xl"
        role="dialog"
        aria-label="One Water Workforce workspace tour"
        aria-modal="false"
      >
        <header className="flex items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">
              Workspace tour · {index + 1}/{total}
            </p>
            <p className="truncate text-sm font-medium text-slate-700">One Water Workforce</p>
          </div>
          <button
            type="button"
            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
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
        <footer className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <button
            type="button"
            className="text-xs text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
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
            >
              Back
            </Button>
            <Button type="button" size="sm" onClick={() => go(1)}>
              {isLast ? 'Finish' : 'Next'}
            </Button>
          </div>
        </footer>
      </aside>
    </>,
    document.body
  );
}
