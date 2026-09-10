/**
 * Document Studio overview — avatar PiP bottom-right + left-docked benefit card.
 * Video plays through while cards explain why Studio matters (no click-by-click steps).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CircleHelp, PlayCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  APPLICATION_STEPS_TOUR_DISMISSED_KEY,
  APPLICATION_STEPS_TOUR_OPEN_EVENT,
  APPLICATION_STEPS_TOUR_STEP_KEY,
  applicationStepsMediaFor,
  buildApplicationStepsTourSlides,
  clearPendingApplicationStepsOpen,
  takePendingApplicationStepsOpen,
  type ApplicationStepsTourSlide,
} from '@/components/doc-studio/applicationStepsTourContent';
import { tourStorageKey } from '@/components/ww360/Ww360TourOverlay';
import { useAuth } from '@/context/AuthContext';

const HIGHLIGHT_CLASS = 'ww360-tour-highlight';

function clearHighlight(): void {
  document.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach(el => el.classList.remove(HIGHLIGHT_CLASS));
}

function applyHighlight(slide: ApplicationStepsTourSlide | undefined): void {
  clearHighlight();
  if (!slide?.highlight) return;
  try {
    const el = document.querySelector(slide.highlight);
    if (el) {
      el.classList.add(HIGHLIGHT_CLASS);
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  } catch {
    /* invalid selector */
  }
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

export function ApplicationStepsTourOverlay() {
  const { user } = useAuth();
  const slides = useMemo(() => buildApplicationStepsTourSlides(), []);
  const media = useMemo(() => applicationStepsMediaFor(), []);
  const dismissedKey = tourStorageKey(APPLICATION_STEPS_TOUR_DISMISSED_KEY, user?.id);
  const stepKey = tourStorageKey(APPLICATION_STEPS_TOUR_STEP_KEY, user?.id);

  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [videoOpen, setVideoOpen] = useState(true);
  const [index, setIndex] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const slide = slides[index];
  const total = slides.length;

  const seekAvatar = useCallback((cueStart: number) => {
    const video = videoRef.current;
    if (!video) return;
    const apply = () => {
      try {
        video.currentTime = Math.max(0, cueStart);
        void video.play().catch(() => {
          /* autoplay policies — still show frame */
        });
      } catch {
        /* ignore seek errors */
      }
    };
    if (video.readyState >= 1) apply();
    else video.addEventListener('loadedmetadata', apply, { once: true });
  }, []);

  const openAt = useCallback(
    async (i: number) => {
      const idx = Math.max(0, Math.min(i, total - 1));
      writeFlag(dismissedKey, false);
      const nextSlide = slides[idx];
      if (nextSlide?.before) await Promise.resolve(nextSlide.before());
      setIndex(idx);
      setOpen(true);
      setMinimized(false);
      setVideoOpen(true);
      writeStep(stepKey, idx);
      window.setTimeout(() => {
        applyHighlight(slides[idx]);
        seekAvatar(slides[idx].cueStart);
      }, 60);
    },
    [dismissedKey, seekAvatar, slides, stepKey, total]
  );

  const hideVideo = useCallback(() => {
    videoRef.current?.pause();
    setVideoOpen(false);
  }, []);

  const showVideo = useCallback(() => {
    setVideoOpen(true);
    window.setTimeout(() => seekAvatar(slides[index]?.cueStart ?? 0), 60);
  }, [index, seekAvatar, slides]);

  const dismiss = useCallback(
    (permanent: boolean) => {
      clearHighlight();
      const closeBtn = document.querySelector(
        '[data-tutorial-recorder] button[aria-label="Close"]'
      ) as HTMLButtonElement | null;
      closeBtn?.click();
      videoRef.current?.pause();
      setOpen(false);
      setVideoOpen(true);
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
    async (delta: number) => {
      const next = index + delta;
      if (next < 0) return;
      if (next >= total) {
        writeStep(stepKey, 0);
        dismiss(false);
        return;
      }
      const nextSlide = slides[next];
      if (nextSlide?.before) await Promise.resolve(nextSlide.before());
      setIndex(next);
      writeStep(stepKey, next);
      window.setTimeout(() => {
        applyHighlight(slides[next]);
        const nextCue = slides[next].cueStart;
        if (nextCue !== slides[index].cueStart) seekAvatar(nextCue);
      }, 60);
    },
    [dismiss, index, seekAvatar, slides, stepKey, total]
  );

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ slideIndex?: number }>).detail;
      clearPendingApplicationStepsOpen();
      void openAt(detail?.slideIndex ?? 0);
    };
    window.addEventListener(APPLICATION_STEPS_TOUR_OPEN_EVENT, handler);
    const pending = takePendingApplicationStepsOpen();
    if (pending !== null) void openAt(pending);
    return () => window.removeEventListener(APPLICATION_STEPS_TOUR_OPEN_EVENT, handler);
  }, [openAt]);

  useEffect(
    () => () => {
      clearHighlight();
    },
    []
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      if (videoOpen) hideVideo();
      else dismiss(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dismiss, hideVideo, open, videoOpen]);

  if (typeof document === 'undefined') return null;

  if (!open) {
    if (!minimized || readFlag(dismissedKey)) return null;
    return createPortal(
      <button
        type="button"
        className="fixed bottom-4 right-4 z-[10000] inline-flex min-h-[44px] items-center gap-2 rounded-full border border-sky-200 bg-white px-4 py-2 text-[1rem] font-medium text-sky-800 shadow-lg hover:bg-sky-50"
        onClick={() => void openAt(readStep(stepKey, total))}
        aria-label="Resume Document Studio overview"
        data-tour="application-steps-tour-fab"
      >
        <CircleHelp className="h-4 w-4" aria-hidden />
        Studio overview
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
        }
        [role="dialog"] .${HIGHLIGHT_CLASS},
        [data-tutorial-recorder] .${HIGHLIGHT_CLASS} {
          box-shadow: 0 0 0 4px rgba(14,165,233,0.25);
          z-index: auto;
        }
      `}</style>

      {/* Step card — left bottom so avatar owns bottom-right */}
      <aside
        data-tour="application-steps-tour-card"
        data-tour-side="left"
        data-tour-dock="bottom"
        data-step-id={slide.id}
        className={`fixed bottom-4 left-4 z-[10000] flex w-[min(100vw-2rem,24rem)] max-h-[min(58vh,32rem)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl max-sm:left-3 max-sm:right-3 max-sm:w-auto ${
          videoOpen ? 'max-sm:bottom-[calc(1rem+min(92vw,22rem)*9/16+3.5rem)]' : ''
        }`}
        role="dialog"
        aria-label="Document Studio overview"
        aria-modal="false"
      >
        <header className="flex shrink-0 items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[0.875rem] font-semibold uppercase tracking-wide text-sky-700">
              Studio overview · {index + 1}/{total}
            </p>
            <p className="truncate text-[1rem] font-medium text-slate-700">Document Studio</p>
          </div>
          <button
            type="button"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded p-1 text-slate-500 hover:bg-slate-100"
            onClick={() => dismiss(false)}
            aria-label="Close overview"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3">
          <h3 className="text-[1.125rem] font-semibold text-slate-900">{slide.title}</h3>
          <p className="text-[1.125rem] leading-relaxed text-slate-700">{slide.body}</p>
          {slide.tip ? (
            <p className="text-[1rem] leading-relaxed text-slate-600">
              <span className="font-semibold text-slate-800">Tip:</span> {slide.tip}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-1 px-4" aria-hidden>
          {slides.map((s, i) => (
            <span
              key={s.id}
              className={`h-1.5 flex-1 rounded-full ${i <= index ? 'bg-sky-500' : 'bg-slate-200'}`}
            />
          ))}
        </div>
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3">
          <div className="flex min-h-[44px] flex-wrap items-center gap-x-3">
            <button
              type="button"
              className="text-[1rem] text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
              onClick={() => dismiss(true)}
            >
              Don&apos;t show again
            </button>
            {!videoOpen ? (
              <button
                type="button"
                className="text-[1rem] font-medium text-sky-800 underline-offset-2 hover:underline"
                onClick={showVideo}
                data-tour="application-steps-show-video"
              >
                Show video
              </button>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={index === 0}
              onClick={() => void go(-1)}
              className="min-h-[44px] text-[1rem]"
            >
              Back
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void go(1)}
              className="min-h-[44px] text-[1rem]"
              data-tour="application-steps-tour-next"
            >
              {isLast ? 'Finish' : 'Next'}
            </Button>
          </div>
        </footer>
      </aside>

      {videoOpen ? (
        <div
          data-tour="application-steps-avatar"
          className="fixed bottom-4 right-4 z-[9990] w-[min(92vw,22rem)] overflow-hidden rounded-xl border border-slate-200 bg-black shadow-2xl max-sm:left-1/2 max-sm:right-auto max-sm:-translate-x-1/2 sm:w-[min(44vw,26rem)] lg:w-[min(40vw,32rem)]"
        >
          <div className="flex items-center gap-1.5 border-b border-white/10 bg-slate-900 pl-2 pr-1">
            <PlayCircle className="h-3.5 w-3.5 shrink-0 text-sky-300" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-[0.875rem] font-medium text-slate-100">
              {media.label}
            </span>
            <button
              type="button"
              className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded text-slate-200 hover:bg-white/10 hover:text-white"
              onClick={hideVideo}
              aria-label="Close video"
              data-tour="application-steps-close-video"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <video
            key={media.src}
            ref={videoRef}
            className="aspect-video w-full"
            playsInline
            preload="metadata"
            crossOrigin="anonymous"
            muted={false}
            controls
            aria-label="Document Studio overview video"
          >
            <source src={media.src} type="video/mp4" />
            <track kind="captions" src={media.captions} srcLang="en" label="English" default />
          </video>
        </div>
      ) : null}
    </>,
    document.body
  );
}
