/**
 * Tutorial capture session.
 *
 * While an in-app screen recording is running, this records the user's
 * interactions (clicks, form changes, route navigations) and grabs a screenshot
 * of the shared screen at each step from the live capture stream. The resulting
 * step log + screenshots feed the auto-generated step-by-step guide.
 */

export type StepActionType = 'click' | 'input' | 'navigate';

export interface CapturedStep {
  index: number;
  tMs: number;
  type: StepActionType;
  label: string;
  route: string;
  screenshot?: Blob;
  clickX?: number;
  clickY?: number;
}

const MAX_STEPS = 80;
const DUP_WINDOW_MS = 400;
const MAX_SHOT_WIDTH = 1280;
const MAX_LABEL_LEN = 80;

function truncate(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > MAX_LABEL_LEN ? `${clean.slice(0, MAX_LABEL_LEN - 1)}…` : clean;
}

function labelForElement(el: Element | null): string {
  let node: Element | null = el;
  for (let depth = 0; node && depth < 4; depth += 1) {
    const aria = node.getAttribute('aria-label');
    if (aria && aria.trim()) return truncate(aria);

    const labelledBy = node.getAttribute('aria-labelledby');
    if (labelledBy) {
      const ref = document.getElementById(labelledBy);
      if (ref?.textContent?.trim()) return truncate(ref.textContent);
    }

    if (
      node instanceof HTMLInputElement ||
      node instanceof HTMLTextAreaElement ||
      node instanceof HTMLSelectElement
    ) {
      if (node.id) {
        const lab = document.querySelector(`label[for="${CSS.escape(node.id)}"]`);
        if (lab?.textContent?.trim()) return truncate(lab.textContent);
      }
      const wrapLabel = node.closest('label');
      if (wrapLabel?.textContent?.trim()) return truncate(wrapLabel.textContent);
      const placeholder = node.getAttribute('placeholder');
      if (placeholder) return truncate(placeholder);
      const name = node.getAttribute('name');
      if (name) return truncate(name);
    }

    const title = node.getAttribute('title');
    if (title && title.trim()) return truncate(title);

    if (node instanceof HTMLImageElement && node.alt) return truncate(node.alt);

    const role = node.getAttribute('role');
    const tag = node.tagName.toLowerCase();
    if (
      ['button', 'a', 'menuitem', 'tab', 'option'].includes(tag) ||
      ['button', 'link', 'menuitem', 'tab'].includes(role || '')
    ) {
      const text = node.textContent?.trim();
      if (text) return truncate(text);
    }

    const testId = node.getAttribute('data-testid');
    if (testId) return truncate(testId.replace(/[-_]/g, ' '));

    node = node.parentElement;
  }

  if (el) {
    const text = el.textContent?.trim();
    if (text) return truncate(text);
    return truncate(`${el.tagName.toLowerCase()} element`);
  }
  return 'page element';
}

export class TutorialCaptureSession {
  private steps: CapturedStep[] = [];
  private startedAt = 0;
  private lastRoute = '';
  private lastLabel = '';
  private lastEventAt = 0;
  private routeTimer: ReturnType<typeof setInterval> | null = null;
  private grabVideo: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private active = false;

  constructor(
    private readonly displayStream: MediaStream | null,
    private readonly captureScreenshots = Boolean(displayStream)
  ) {}

  start(): void {
    this.active = true;
    this.startedAt = performance.now();
    this.lastRoute = window.location.pathname;

    if (this.displayStream && this.captureScreenshots) {
      this.grabVideo = document.createElement('video');
      this.grabVideo.muted = true;
      this.grabVideo.srcObject = this.displayStream;
      void this.grabVideo.play().catch(() => {});
      this.canvas = document.createElement('canvas');
    }

    document.addEventListener('click', this.handleClick, true);
    document.addEventListener('change', this.handleChange, true);
    this.routeTimer = setInterval(this.pollRoute, 700);

    const recordOpeningStep = () => {
      if (!this.active) return;
      void this.record('navigate', `Open ${this.routeName(this.lastRoute)}`, this.lastRoute);
    };
    if (this.grabVideo) {
      // Wait for the first decoded frame so the opening step captures a
      // screenshot of where the author started (videoWidth is 0 until then).
      let fired = false;
      const fire = () => {
        if (fired) return;
        fired = true;
        recordOpeningStep();
      };
      this.grabVideo.addEventListener('loadeddata', fire, { once: true });
      setTimeout(fire, 1500);
    } else {
      recordOpeningStep();
    }
  }

  stop(): CapturedStep[] {
    this.active = false;
    document.removeEventListener('click', this.handleClick, true);
    document.removeEventListener('change', this.handleChange, true);
    if (this.routeTimer) {
      clearInterval(this.routeTimer);
      this.routeTimer = null;
    }
    if (this.grabVideo) {
      this.grabVideo.srcObject = null;
      this.grabVideo = null;
    }
    return this.steps;
  }

  getSteps(): CapturedStep[] {
    return this.steps;
  }

  updateStepScreenshot(index: number, blob: Blob): void {
    const step = this.steps.find(s => s.index === index);
    if (step) step.screenshot = blob;
  }

  setSteps(next: CapturedStep[]): void {
    this.steps = next;
  }

  private routeName(path: string): string {
    const segs = path.split('/').filter(Boolean);
    const last = segs[segs.length - 1] || 'dashboard';
    return last.replace(/[-_]/g, ' ');
  }

  private handleClick = (event: MouseEvent): void => {
    if (!this.active) return;
    const target = event.target as Element | null;
    if (target?.closest('[data-tutorial-recorder]')) return;
    const label = labelForElement(target);
    void this.record('click', `Click "${label}"`, window.location.pathname, {
      clickX: event.clientX,
      clickY: event.clientY,
    });
  };

  private handleChange = (event: Event): void => {
    if (!this.active) return;
    const target = event.target as Element | null;
    if (target?.closest('[data-tutorial-recorder]')) return;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLSelectElement ||
      target instanceof HTMLTextAreaElement
    ) {
      const label = labelForElement(target);
      const verb = target instanceof HTMLSelectElement ? 'Select an option for' : 'Fill in';
      void this.record('input', `${verb} "${label}"`, window.location.pathname);
    }
  };

  private pollRoute = (): void => {
    if (!this.active) return;
    const current = window.location.pathname;
    if (current !== this.lastRoute) {
      this.lastRoute = current;
      void this.record('navigate', `Navigate to ${this.routeName(current)}`, current);
    }
  };

  private async record(
    type: StepActionType,
    label: string,
    route: string,
    click?: { clickX: number; clickY: number }
  ): Promise<void> {
    if (this.steps.length >= MAX_STEPS) return;
    const now = performance.now();
    if (label === this.lastLabel && now - this.lastEventAt < DUP_WINDOW_MS) return;
    this.lastLabel = label;
    this.lastEventAt = now;

    const index = this.steps.length + 1;
    const step: CapturedStep = {
      index,
      tMs: Math.round(now - this.startedAt),
      type,
      label,
      route,
      clickX: click?.clickX,
      clickY: click?.clickY,
    };
    this.steps.push(step);

    if (this.captureScreenshots) {
      const shot = await this.grabFrame(click?.clickX, click?.clickY);
      if (shot) step.screenshot = shot;
    }
  }

  private async grabFrame(_clickX?: number, _clickY?: number): Promise<Blob | null> {
    const video = this.grabVideo;
    const canvas = this.canvas;
    if (!video || !canvas || !video.videoWidth || !video.videoHeight) {
      return null;
    }
    try {
      const scale = Math.min(1, MAX_SHOT_WIDTH / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      // Click markers are added as editable badge annotations in the step editor.
      return await new Promise<Blob | null>(resolve => {
        canvas.toBlob(blob => resolve(blob), 'image/png', 0.92);
      });
    } catch (err) {
      console.warn('[tutorialCapture] frame grab failed:', err);
      return null;
    }
  }
}
