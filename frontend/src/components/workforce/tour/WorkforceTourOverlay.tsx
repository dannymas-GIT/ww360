import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CircleHelp, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  WORKFORCE_TOUR_OPEN_EVENT,
  requestOpenWorkforceTour,
  type WorkforceTourAreaId,
  type WorkforceTourOpenDetail,
} from './workforceTourApi';
import {
  getTourAreaLabel,
  getTourSlides,
  tourRoleFromFlags,
  type WorkforceTourSlide,
} from './workforceTourContent';
import {
  clearWorkforceTourDismissed,
  getSavedTourStep,
  isWorkforceTourDismissed,
  saveTourStep,
  setWorkforceTourDismissed,
  type WorkforceTourRole,
} from './workforceTourStorage';

export interface WorkforceTourOverlayProps {
  isWorkforceOperator: boolean;
}

function applyHighlight(slide: WorkforceTourSlide | undefined): void {
  document.querySelectorAll('.workforce-tour-highlight').forEach(el => {
    el.classList.remove('workforce-tour-highlight');
  });
  if (!slide?.highlight) return;
  try {
    const el = document.querySelector(slide.highlight);
    if (el) {
      el.classList.add('workforce-tour-highlight');
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  } catch {
    /* invalid selector */
  }
}

function clearHighlight(): void {
  document.querySelectorAll('.workforce-tour-highlight').forEach(el => {
    el.classList.remove('workforce-tour-highlight');
  });
}

export function WorkforceTourOverlay({ isWorkforceOperator }: WorkforceTourOverlayProps) {
  const role: WorkforceTourRole = tourRoleFromFlags(isWorkforceOperator);
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [areaId, setAreaId] = useState<WorkforceTourAreaId>('certifications');
  const [slideIndex, setSlideIndex] = useState(0);

  const slides = getTourSlides(areaId, role);
  const slide = slides[slideIndex];
  const total = slides.length;

  const openTour = useCallback(
    (nextAreaId: WorkforceTourAreaId, startIndex = 0) => {
      clearWorkforceTourDismissed(role);
      const nextSlides = getTourSlides(nextAreaId, role);
      if (!nextSlides.length) return;
      const idx = Math.max(0, Math.min(startIndex, nextSlides.length - 1));
      setAreaId(nextAreaId);
      setSlideIndex(idx);
      setOpen(true);
      setMinimized(false);
      saveTourStep(nextAreaId, idx);
      applyHighlight(nextSlides[idx]);
    },
    [role]
  );

  const dismiss = useCallback(
    (permanent: boolean) => {
      clearHighlight();
      if (permanent) {
        setWorkforceTourDismissed(role);
        setOpen(false);
        setMinimized(false);
      } else {
        setOpen(false);
        setMinimized(true);
      }
    },
    [role]
  );

  const go = useCallback(
    (delta: number) => {
      if (!slides.length) return;
      const next = slideIndex + delta;
      if (next < 0) return;
      if (next >= slides.length) {
        dismiss(false);
        return;
      }
      setSlideIndex(next);
      saveTourStep(areaId, next);
      applyHighlight(slides[next]);
    },
    [areaId, dismiss, slideIndex, slides]
  );

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<WorkforceTourOpenDetail>).detail;
      if (!detail?.areaId) return;
      const saved = getSavedTourStep(detail.areaId);
      openTour(detail.areaId, detail.slideIndex ?? saved);
    };
    window.addEventListener(WORKFORCE_TOUR_OPEN_EVENT, handler);
    return () => window.removeEventListener(WORKFORCE_TOUR_OPEN_EVENT, handler);
  }, [openTour]);

  useEffect(() => () => clearHighlight(), []);

  if (typeof document === 'undefined') return null;

  if (minimized && !open) {
    return createPortal(
      <button
        type="button"
        className="fixed bottom-4 right-4 z-[60] inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-medium text-emerald-800 shadow-lg hover:bg-emerald-50"
        onClick={() => openTour(areaId, slideIndex)}
        aria-label="Open workforce tour"
      >
        <CircleHelp className="h-4 w-4" aria-hidden />
        Tour
      </button>,
      document.body
    );
  }

  if (!open || !slide || !total) return null;

  const areaLabel = getTourAreaLabel(areaId);
  const isLast = slideIndex + 1 >= total;

  return createPortal(
    <>
      <style>{`
        .workforce-tour-highlight {
          outline: 2px solid rgb(16 185 129);
          outline-offset: 2px;
          border-radius: 0.375rem;
        }
      `}</style>
      <aside
        className="fixed bottom-4 right-4 z-[60] w-[min(100vw-2rem,22rem)] rounded-lg border border-slate-200 bg-white shadow-xl"
        role="dialog"
        aria-label="Workforce tour"
        aria-modal="false"
      >
        <header className="flex items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-600">
              Tour · {slideIndex + 1}/{total}
            </p>
            <p className="truncate text-sm font-semibold text-slate-900">{areaLabel}</p>
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
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3">
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
              disabled={slideIndex === 0}
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

/** Auto-open tour once per role unless permanently dismissed. */
export function useWorkforceTourAutoOpen(
  areaId: WorkforceTourAreaId,
  isWorkforceOperator: boolean,
  enabled: boolean
): void {
  const role = tourRoleFromFlags(isWorkforceOperator);
  const firedRef = React.useRef(false);

  useEffect(() => {
    if (!enabled || firedRef.current) return;
    if (isWorkforceTourDismissed(role)) return;
    const slides = getTourSlides(areaId, role);
    if (!slides.length) return;
    firedRef.current = true;
    requestOpenWorkforceTour(areaId, getSavedTourStep(areaId));
  }, [areaId, enabled, role]);
}

export { requestOpenWorkforceTour };
