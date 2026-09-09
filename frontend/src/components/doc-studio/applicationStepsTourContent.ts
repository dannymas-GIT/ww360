/**
 * Script-driven Application Steps tour — voiceover from Mission Control slot
 * `application-steps` (see workspace docs/tour-video-scripts/ww360-application-steps.md).
 *
 * Each slide maps to a spoken cue in application-steps-sample.vtt and a UI highlight.
 *
 * Avatar A/B: set `localStorage.ww360-application-steps-avatar = 'dmas' | 'abigail'`
 * (default `dmas` when the watermarked dmas sample is deployed).
 */
import type { Ww360TourSlide } from '@/components/ww360/Ww360TourOverlay';

export const APPLICATION_STEPS_TOUR_OPEN_EVENT = 'ww360-open-application-steps-tour';
export const APPLICATION_STEPS_TOUR_DISMISSED_KEY = 'ww360-application-steps-tour-dismissed';
export const APPLICATION_STEPS_TOUR_STEP_KEY = 'ww360-application-steps-tour-step';
export const APPLICATION_STEPS_AVATAR_KEY = 'ww360-application-steps-avatar';

/** Catalog Abigail sample (previous default). */
export const APPLICATION_STEPS_SAMPLE_ABIGAIL_SRC = '/tutorials/application-steps-sample.mp4';
export const APPLICATION_STEPS_SAMPLE_ABIGAIL_CAPTIONS = '/tutorials/application-steps-sample.vtt';

/** Watermarked Instant Avatar look `Professional in beige blazer` + voice `dmas`. */
export const APPLICATION_STEPS_SAMPLE_DMAS_SRC = '/tutorials/application-steps-sample-dmas.mp4';
export const APPLICATION_STEPS_SAMPLE_DMAS_CAPTIONS = '/tutorials/application-steps-sample-dmas.vtt';

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
    label: 'dmas — beige blazer (watermarked WIP)',
    watermarked: true,
  };
}

/** @deprecated Prefer applicationStepsMediaFor() — kept for older imports/tests. */
export const APPLICATION_STEPS_SAMPLE_SRC = APPLICATION_STEPS_SAMPLE_DMAS_SRC;
export const APPLICATION_STEPS_SAMPLE_CAPTIONS = APPLICATION_STEPS_SAMPLE_DMAS_CAPTIONS;

export interface ApplicationStepsTourSlide extends Ww360TourSlide {
  /** Seek position (seconds) in the sample MP4 / VTT cue start. */
  cueStart: number;
  /** Exact phrase from the voiceover — used by Playwright to verify copy. */
  scriptQuote: string;
}

function closeRecorderModal(): void {
  const closeBtn = document.querySelector(
    '[data-tutorial-recorder] button[aria-label="Close"]'
  ) as HTMLButtonElement | null;
  closeBtn?.click();
}

function openRecorderModal(): Promise<void> {
  closeRecorderModal();
  const btn = document.querySelector('[data-tour="studio-record"]') as HTMLButtonElement | null;
  btn?.click();
  return new Promise(resolve => {
    window.setTimeout(resolve, 280);
  });
}

/** Producer step list + VO script → interactive tour slides. */
export function buildApplicationStepsTourSlides(): ApplicationStepsTourSlide[] {
  return [
    {
      id: 'welcome',
      title: 'Record application steps',
      body: 'Welcome to Water Workforce 360. Today you will record application steps so your team can follow a real procedure.',
      tip: 'This tour follows the same script as the avatar overview. The avatar stays bottom-right while we highlight each control.',
      cueStart: 0.26,
      scriptQuote: 'Welcome to Water Workforce 360',
      highlight: '[data-tour="studio-workspace"]',
      preferredSide: 'left',
      preferredDock: 'bottom',
      before: () => {
        closeRecorderModal();
      },
    },
    {
      id: 'open-studio',
      title: 'You are in Document Studio',
      body: 'Open Document Studio from Content. You are already here — folders, documents, and the editor make up your district library workspace.',
      tip: 'Operators and managers open Content → Document Studio before recording.',
      cueStart: 7.89,
      scriptQuote: 'Open Document Studio from Content',
      highlight: '[data-tour="studio-workspace"]',
      preferredSide: 'left',
      preferredDock: 'bottom',
      before: () => {
        closeRecorderModal();
      },
    },
    {
      id: 'record-tutorial',
      title: 'Choose Record tutorial',
      body: 'Choose Record tutorial in the header. That starts the capture flow used for plant and app walkthroughs.',
      tip: 'Look for the Record tutorial button next to Import and New document.',
      cueStart: 10.54,
      scriptQuote: 'Choose Record tutorial',
      highlight: '[data-tour="studio-record"]',
      preferredSide: 'left',
      preferredDock: 'bottom',
      before: () => {
        closeRecorderModal();
      },
    },
    {
      id: 'pick-mode',
      title: 'Pick a capture mode',
      body: 'Pick a capture mode. Screen plus mic works for most plant walkthroughs. Screenshots only works when video is blocked.',
      tip: 'Screen + Camera is available when face presence helps trust; Screenshots mode still logs clicks.',
      cueStart: 12.76,
      scriptQuote: 'Screen plus mic works for most plant',
      highlight: '[data-tour="studio-mode-picker"]',
      preferredSide: 'left',
      preferredDock: 'bottom',
      before: () => openRecorderModal(),
    },
    {
      id: 'start-recording',
      title: 'Start and walk the procedure',
      body: 'Start recording. Click through the application the way you would on the job. Each click becomes a step. Stop when the procedure is done.',
      tip: 'This tour does not start the browser share dialog — click Start yourself when you are ready to record for real.',
      cueStart: 19.69,
      scriptQuote: 'Each click becomes a step',
      highlight: '[data-tour="studio-mode-picker"]',
      preferredSide: 'left',
      preferredDock: 'bottom',
      before: () => openRecorderModal(),
    },
    {
      id: 'review-steps',
      title: 'Review steps and callouts',
      body: 'Review the step list. Fix captions. Add callouts where someone might get stuck.',
      tip: 'After Stop, the recorder opens a review phase for titles, screenshots, and annotations.',
      cueStart: 26.79,
      scriptQuote: 'Review the step list',
      highlight: '[data-tour="studio-documents"]',
      preferredSide: 'left',
      preferredDock: 'bottom',
      before: () => {
        closeRecorderModal();
      },
    },
    {
      id: 'generate-publish',
      title: 'Generate the guide, then save',
      body: 'Generate the written guide, then save or submit for your manager to publish.',
      tip: 'Operators often submit for review; managers can publish into the district library.',
      cueStart: 32.04,
      scriptQuote: 'Generate the written guide',
      highlight: '[data-tour="studio-documents"]',
      preferredSide: 'left',
      preferredDock: 'bottom',
      before: () => {
        closeRecorderModal();
      },
    },
    {
      id: 'library-replay',
      title: 'Lives in your district library',
      body: 'That tutorial now lives in your district library. Staff can replay it anytime. Partners can also ship short avatar videos for the same topic when you want a face-to-camera overview.',
      tip: 'Open a published tutorial to see the in-editor player above the written guide.',
      cueStart: 36.09,
      scriptQuote: 'That tutorial now lives in your district library',
      highlight: '[data-tour="studio-folders"]',
      preferredSide: 'left',
      preferredDock: 'bottom',
      before: () => {
        closeRecorderModal();
      },
    },
    {
      id: 'done',
      title: 'Tribal knowledge, reusable',
      body: 'You just turned tribal knowledge into a reusable lesson.',
      tip: 'Next: click Record tutorial when you are ready to capture a real procedure.',
      cueStart: 46.56,
      scriptQuote: 'tribal knowledge into a reusable lesson',
      preferredSide: 'left',
      preferredDock: 'bottom',
      before: () => {
        closeRecorderModal();
      },
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
