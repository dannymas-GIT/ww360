/**
 * Document Studio overview tour — benefits-first voiceover from Mission Control slot
 * `application-steps` (see workspace docs/tour-video-scripts/ww360-application-steps.md).
 *
 * Current MP4 is HeyGen AI Studio `ww360-document-studio`
 * (`2497c7dd361b4e008199f273f7cf18e6`). Cue times stay at 0 so the clip plays
 * through while cards explain benefits.
 *
 * Avatar A/B: set `localStorage.ww360-application-steps-avatar = 'dmas' | 'abigail'`
 * (default `dmas` when the Studio dmas sample is deployed).
 */
import type { Ww360TourSlide } from '@/components/ww360/Ww360TourOverlay';

export const APPLICATION_STEPS_TOUR_OPEN_EVENT = 'ww360-open-application-steps-tour';
export const APPLICATION_STEPS_TOUR_DISMISSED_KEY = 'ww360-application-steps-tour-dismissed';
export const APPLICATION_STEPS_TOUR_STEP_KEY = 'ww360-application-steps-tour-step';
export const APPLICATION_STEPS_AVATAR_KEY = 'ww360-application-steps-avatar';

/** Catalog Abigail sample (previous default). */
export const APPLICATION_STEPS_SAMPLE_ABIGAIL_SRC = '/tutorials/application-steps-sample.mp4';
export const APPLICATION_STEPS_SAMPLE_ABIGAIL_CAPTIONS = '/tutorials/application-steps-sample.vtt';

/** HeyGen AI Studio clip — white polo / dmas (inclusion test). */
export const APPLICATION_STEPS_SAMPLE_DMAS_SRC =
  '/tutorials/application-steps-sample-dmas.mp4?v=2497c7dd';
export const APPLICATION_STEPS_SAMPLE_DMAS_CAPTIONS = '/tutorials/application-steps-sample-dmas.vtt';

/** HeyGen video id currently published for the dmas sample. */
export const APPLICATION_STEPS_HEYGEN_VIDEO_ID = '2497c7dd361b4e008199f273f7cf18e6';

export type ApplicationStepsAvatarChoice = 'dmas' | 'abigail';

export function resolveApplicationStepsAvatar(): ApplicationStepsAvatarChoice {
  try {
    const v = localStorage.getItem(APPLICATION_STEPS_AVATAR_KEY);
    if (v === 'abigail' || v === 'dmas') return v;
  } catch {
    /* ignore */
  }
  return 'dmas';
}

export function applicationStepsMediaFor(
  choice: ApplicationStepsAvatarChoice = resolveApplicationStepsAvatar()
): { src: string; captions: string; label: string; watermarked: boolean } {
  if (choice === 'abigail') {
    return {
      src: APPLICATION_STEPS_SAMPLE_ABIGAIL_SRC,
      captions: APPLICATION_STEPS_SAMPLE_ABIGAIL_CAPTIONS,
      label: 'Abigail (catalog)',
      watermarked: true,
    };
  }
  return {
    src: APPLICATION_STEPS_SAMPLE_DMAS_SRC,
    captions: APPLICATION_STEPS_SAMPLE_DMAS_CAPTIONS,
    label: 'Document Studio overview',
    watermarked: false,
  };
}

/** @deprecated Prefer applicationStepsMediaFor() — kept for older imports/tests. */
export const APPLICATION_STEPS_SAMPLE_SRC = APPLICATION_STEPS_SAMPLE_DMAS_SRC;
export const APPLICATION_STEPS_SAMPLE_CAPTIONS = APPLICATION_STEPS_SAMPLE_DMAS_CAPTIONS;

export interface ApplicationStepsTourSlide extends Ww360TourSlide {
  /** Seek position (seconds) in the sample MP4 / VTT cue start. */
  cueStart: number;
  /** Exact phrase from the card — used by Playwright to verify copy. */
  scriptQuote: string;
}

/** Producer voiceover + benefit cards → interactive tour slides. */
export function buildApplicationStepsTourSlides(): ApplicationStepsTourSlide[] {
  return [
    {
      id: 'welcome',
      title: 'What Document Studio is for',
      body: 'Document Studio is where your district keeps what the team already knows, so the next person can use it.',
      tip: 'This short overview explains the value. Use Record tutorial when you are ready to capture a real procedure.',
      cueStart: 0,
      scriptQuote: 'keeps what the team already knows',
      highlight: '[data-tour="studio-workspace"]',
      preferredSide: 'left',
      preferredDock: 'bottom',
    },
    {
      id: 'real-work',
      title: 'Real work becomes a lesson',
      body: 'When someone records a procedure, the actual screens become a lesson others can replay — not a vague memo.',
      tip: 'Staff see the same application they will use on the job.',
      cueStart: 0,
      scriptQuote: 'real work becomes a lesson',
      highlight: '[data-tour="studio-workspace"]',
      preferredSide: 'left',
      preferredDock: 'bottom',
    },
    {
      id: 'library',
      title: 'Review, publish, replay',
      body: 'Managers review and publish into the district library. Anyone on the team can open the lesson again later.',
      tip: 'Published tutorials live with your other program documents.',
      cueStart: 0,
      scriptQuote: 'district library',
      highlight: '[data-tour="studio-documents"]',
      preferredSide: 'left',
      preferredDock: 'bottom',
    },
    {
      id: 'stays',
      title: 'Knowledge stays with the district',
      body: 'That keeps know-how from walking out the door. New operators get a clear starting point instead of starting from scratch.',
      tip: 'Optional avatar videos can add a face-to-camera overview for the same topic.',
      cueStart: 0,
      scriptQuote: 'walking out the door',
      highlight: '[data-tour="studio-folders"]',
      preferredSide: 'left',
      preferredDock: 'bottom',
    },
    {
      id: 'done',
      title: 'Tribal knowledge, reusable',
      body: 'You turn tribal knowledge into a reusable lesson.',
      tip: 'Next: click Record tutorial when you are ready to capture a real procedure.',
      cueStart: 0,
      scriptQuote: 'reusable lesson',
      preferredSide: 'left',
      preferredDock: 'bottom',
    },
  ];
}

/** Last open request — flushed when the overlay mounts or re-subscribes. */
let pendingApplicationStepsOpen: number | null = null;

export function takePendingApplicationStepsOpen(): number | null {
  const v = pendingApplicationStepsOpen;
  pendingApplicationStepsOpen = null;
  return v;
}

export function requestOpenApplicationStepsTour(slideIndex = 0): void {
  pendingApplicationStepsOpen = slideIndex;
  window.dispatchEvent(
    new CustomEvent(APPLICATION_STEPS_TOUR_OPEN_EVENT, { detail: { slideIndex } })
  );
}

/** Clear a queued open after the overlay has started handling it. */
export function clearPendingApplicationStepsOpen(): void {
  pendingApplicationStepsOpen = null;
}
