// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { DocDetail } from '@/services/docStudioService';
import { TutorialPlayer } from './TutorialPlayer';
import {
  buildPlainTextTranscript,
  buildStepScreenshotAlt,
  buildWebVttFromTutorial,
  formatVttTimestamp,
} from './tutorialPlayerUtils';

type PlayerDoc = Pick<DocDetail, 'title' | 'tutorial_data' | 'content_markdown'>;

const baseDoc: PlayerDoc = {
  title: 'Enroll a New York Utility',
  content_markdown: 'Fallback walkthrough markdown.',
  tutorial_data: {
    mode: 'studio-recorder',
    video_asset_id: 'vid-123',
    steps: [
      {
        id: 'step-1',
        order: 1,
        title: 'Find the utility',
        caption: 'Find the utility',
        description: 'Open Admin -> Utilities and search by PWSID or utility name.',
        screenshot_url: 'https://example.test/step-1.png',
        tMs: 0,
      },
      {
        id: 'step-2',
        order: 2,
        title: 'Send the invite',
        caption: 'Step 2',
        body: 'Click Invite to enroll and choose the district admin contact.',
        screenshot_url: 'https://example.test/step-2.png',
        timestamp_seconds: 12,
      },
    ],
  },
};

describe('tutorialPlayerUtils', () => {
  it('formats WebVTT timestamps accurately', () => {
    expect(formatVttTimestamp(0)).toBe('00:00:00.000');
    expect(formatVttTimestamp(12.5)).toBe('00:00:12.500');
    expect(formatVttTimestamp(3661.25)).toBe('01:01:01.250');
  });

  it('builds valid WebVTT cues from timed steps and escapes arrow sequences', () => {
    const vtt = buildWebVttFromTutorial(baseDoc.tutorial_data, baseDoc.tutorial_data!.steps);
    expect(vtt).not.toBeNull();
    expect(vtt?.startsWith('WEBVTT\n\n')).toBe(true);
    expect(vtt).toContain('00:00:00.000 --> 00:00:12.000');
    expect(vtt).toContain('00:00:12.000 --> 00:00:17.000');
    // Raw "-->" in cue text must be escaped so it cannot break cue parsing
    const arrowVtt = buildWebVttFromTutorial(
      {
        steps: [
          {
            id: 's1',
            order: 1,
            caption: 'Navigate',
            description: 'Go to Admin --> Utilities',
            tMs: 0,
          },
        ],
      },
      [
        {
          id: 's1',
          order: 1,
          caption: 'Navigate',
          description: 'Go to Admin --> Utilities',
          tMs: 0,
        },
      ]
    );
    expect(arrowVtt).toContain('Go to Admin → Utilities');
  });

  it('returns null WebVTT when no caption cues or transcript text exist', () => {
    const vtt = buildWebVttFromTutorial({ steps: [], video_asset_id: 'v1' }, []);
    expect(vtt).toBeNull();
  });

  it('builds descriptive non-empty alt text for screenshots', () => {
    const explicit = buildStepScreenshotAlt(
      { id: 's1', order: 1, screenshot_alt: 'Utilities search table filtered by PWSID' },
      0,
      2,
      'Enroll a Utility'
    );
    expect(explicit).toBe('Utilities search table filtered by PWSID');

    const genericCaption = buildStepScreenshotAlt(
      {
        id: 's2',
        order: 2,
        caption: 'Step 2',
        body: 'Click Invite to enroll and choose the district admin contact.',
      },
      1,
      2,
      'Enroll a Utility'
    );
    expect(genericCaption).toContain('Step 2 of 2');
    expect(genericCaption).toContain('Click Invite to enroll');

    const minimal = buildStepScreenshotAlt({ id: 's3', order: 3 }, 2, 3, 'Enroll a Utility');
    expect(minimal).toBe('Screenshot for Step 3 of 3 of Enroll a Utility');
  });

  it('builds structured plain-text transcript from steps including timestamps and body fallback', () => {
    const text = buildPlainTextTranscript(baseDoc.tutorial_data, baseDoc.tutorial_data!.steps);
    expect(text).toContain('[0:00] Step 1: Find the utility');
    expect(text).toContain('Open Admin -> Utilities and search by PWSID or utility name.');
    expect(text).toContain('[0:12] Step 2');
    expect(text).toContain('Click Invite to enroll and choose the district admin contact.');
  });
});

describe('TutorialPlayer', () => {
  let createdBlobs: Blob[];
  let createObjectUrlSpy: ReturnType<typeof vi.fn>;
  let revokeObjectUrlSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createdBlobs = [];
    createObjectUrlSpy = vi.fn((blob: Blob) => {
      createdBlobs.push(blob);
      return `blob:mock-vtt-${createdBlobs.length}`;
    });
    revokeObjectUrlSpy = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectUrlSpy,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectUrlSpy,
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('enforces WW360 accessible typography scale, 44px touch targets, focus rings, and reduced motion', () => {
    const { container } = render(<TutorialPlayer document={baseDoc} compact />);

    // No text-xs anywhere in the player
    expect(container.querySelector('.text-xs')).toBeNull();

    // Headings remain larger than body even in compact mode
    const playerHeading = screen.getByRole('heading', { name: 'Enroll a New York Utility' });
    expect(playerHeading.className).toContain('text-xl');

    // Step counter uses text-sm floor (0.875rem)
    const stepCounter = screen.getByText('Step 1 of 2');
    expect(stepCounter.className).toContain('text-sm');

    // Body step description uses >= 1.125rem (text-lg)
    const description = screen.getByText(
      'Open Admin -> Utilities and search by PWSID or utility name.'
    );
    expect(description.className).toContain('text-lg');

    // Every interactive button meets >= 44x44px touch target, >= text-base, focus ring, and reduced motion
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThanOrEqual(7);
    buttons.forEach(button => {
      expect(button.className).toContain('min-h-[44px]');
      expect(button.className).toContain('min-w-[44px]');
      expect(button.className).toContain('text-base');
      expect(button.className).toContain('focus-visible:ring-2');
      expect(button.className).toContain('motion-reduce:transition-none');
    });
  });

  it('generates and cleans up a client-side WebVTT blob track when no sidecar captions URL exists', async () => {
    const { container, unmount } = render(<TutorialPlayer document={baseDoc} />);

    await waitFor(() => {
      const track = container.querySelector('video track');
      expect(track).not.toBeNull();
      expect(track).toHaveAttribute('kind', 'captions');
      expect(track).toHaveAttribute('src', 'blob:mock-vtt-1');
      expect(track).toHaveAttribute('srclang', 'en');
      expect(track).toHaveAttribute('label', 'English');
      expect(track?.hasAttribute('default')).toBe(true);
    });

    expect(createObjectUrlSpy).toHaveBeenCalledTimes(1);
    expect(createdBlobs[0]?.type).toContain('text/vtt');
    const vttContent = await createdBlobs[0].text();
    expect(vttContent).toContain('WEBVTT');
    expect(vttContent).toContain('00:00:00.000 --> 00:00:12.000');

    unmount();
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:mock-vtt-1');
  });

  it('uses explicit captions_url directly without creating a blob URL', () => {
    const docWithCaptions: PlayerDoc = {
      ...baseDoc,
      tutorial_data: {
        ...baseDoc.tutorial_data!,
        captions_url: 'https://cdn.example.test/enroll-utility.vtt',
      },
    };
    const { container } = render(<TutorialPlayer document={docWithCaptions} />);

    const track = container.querySelector('video track');
    expect(track).not.toBeNull();
    expect(track).toHaveAttribute('src', 'https://cdn.example.test/enroll-utility.vtt');
    expect(track).toHaveAttribute('srclang', 'en');
    expect(track).toHaveAttribute('label', 'English');
    expect(createObjectUrlSpy).not.toHaveBeenCalled();
  });

  it('does not render an empty <track> when no caption source or cue text exists', () => {
    const videoOnlyDoc: PlayerDoc = {
      title: 'Raw Clip',
      content_markdown: '',
      tutorial_data: {
        video_asset_id: 'vid-only',
        steps: [],
      },
    };
    const { container } = render(<TutorialPlayer document={videoOnlyDoc} />);
    expect(container.querySelector('video')).not.toBeNull();
    expect(container.querySelector('video track')).toBeNull();
  });

  it('wires 0.75x, 1x, and 1.25x playback speed buttons to video.playbackRate and aria-pressed', () => {
    const { container } = render(<TutorialPlayer document={baseDoc} />);
    const video = container.querySelector('video') as HTMLVideoElement;
    expect(video).not.toBeNull();

    const btnSlow = screen.getByRole('button', { name: /0\.75x/i });
    const btnNormal = screen.getByRole('button', { name: /1x/i });
    const btnFast = screen.getByRole('button', { name: /1\.25x/i });

    expect(btnNormal).toHaveAttribute('aria-pressed', 'true');
    expect(btnSlow).toHaveAttribute('aria-pressed', 'false');
    expect(btnFast).toHaveAttribute('aria-pressed', 'false');
    expect(video.playbackRate).toBe(1);

    fireEvent.click(btnSlow);
    expect(btnSlow).toHaveAttribute('aria-pressed', 'true');
    expect(btnNormal).toHaveAttribute('aria-pressed', 'false');
    expect(video.playbackRate).toBe(0.75);

    fireEvent.click(btnFast);
    expect(btnFast).toHaveAttribute('aria-pressed', 'true');
    expect(btnSlow).toHaveAttribute('aria-pressed', 'false');
    expect(video.playbackRate).toBe(1.25);
  });

  it('provides an expandable plain-text transcript at >= 1.125rem with copy and polite announcement', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    const docWithTranscript: PlayerDoc = {
      ...baseDoc,
      tutorial_data: {
        ...baseDoc.tutorial_data!,
        transcript: 'Welcome to Water Workforce 360.\nSearch Admin Utilities to enroll a utility.',
      },
    };

    render(<TutorialPlayer document={docWithTranscript} />);

    const toggleBtn = screen.getByRole('button', { name: /show full transcript/i });
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('region', { name: /full plain-text transcript/i })).toBeNull();

    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');

    const transcriptRegion = screen.getByRole('region', { name: /full plain-text transcript/i });
    const transcriptBody = transcriptRegion.querySelector('div');
    expect(transcriptBody?.className).toContain('text-lg');
    expect(transcriptRegion).toHaveTextContent('Welcome to Water Workforce 360.');

    const copyBtn = screen.getByRole('button', { name: /copy transcript/i });
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        'Welcome to Water Workforce 360.\nSearch Admin Utilities to enroll a utility.'
      );
      expect(screen.getByRole('status')).toHaveTextContent('Transcript copied to clipboard.');
    });
  });

  it('renders descriptive alt text on step screenshots and navigates steps cleanly', () => {
    const onStepChange = vi.fn();
    render(<TutorialPlayer document={baseDoc} onStepChange={onStepChange} />);

    const firstImg = screen.getByRole('img');
    expect(firstImg).toHaveAttribute(
      'alt',
      'Screenshot for Step 1 of 2: Find the utility — Open Admin -> Utilities and search by PWSID or utility name.'
    );

    const nextBtn = screen.getByRole('button', { name: /next/i });
    fireEvent.click(nextBtn);

    expect(onStepChange).toHaveBeenCalledWith(1);
    const secondImg = screen.getByRole('img');
    expect(secondImg).toHaveAttribute(
      'alt',
      'Screenshot for Step 2 of 2: Click Invite to enroll and choose the district admin contact.'
    );

    // Seeded `body` field is displayed as step description
    expect(
      screen.getByText('Click Invite to enroll and choose the district admin contact.')
    ).toBeInTheDocument();
  });

  it('navigates steps with Arrow keys without hijacking input or video elements', () => {
    const { container } = render(
      <div>
        <input aria-label="Test input" />
        <TutorialPlayer document={baseDoc} />
      </div>
    );

    const input = screen.getByLabelText('Test input');
    fireEvent.keyDown(input, { key: 'ArrowRight' });
    expect(screen.getByText('Step 1 of 2')).toBeInTheDocument();

    const video = container.querySelector('video')!;
    fireEvent.keyDown(video, { key: 'ArrowRight' });
    expect(screen.getByText('Step 1 of 2')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByText('Step 2 of 2')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByText('Step 1 of 2')).toBeInTheDocument();
  });
});
