import type { Ww360TourSlide } from '@/components/ww360/Ww360TourOverlay';

export function buildCustomizeHomeTourSlides(): Ww360TourSlide[] {
  return [
    {
      title: 'Customize your home',
      body: 'Open Customize home or Enter Edit Mode on your dashboard to rearrange rows of charts and panels.',
      tip: 'Kitchen Sink still controls the full tool menu; Customize controls what sits on your home.',
    },
    {
      title: 'Add a row',
      body: 'Click Add Row to start a new horizontal band. Each row holds up to three columns of panels.',
      tip: 'Rows auto-size: one chart fills the width; two or three share the row.',
    },
    {
      title: 'Add Chart or Widget',
      body: 'On each row, use Add Chart for another graph, or Add Widget to pick from categorized panels — numbers, workforce, compliance, and more.',
      tip: 'If a panel does not fit the current row, it opens in a new row automatically.',
    },
    {
      title: 'Column and row spans',
      body: 'In edit mode, set Col (1–3) and Row (1–2) on a block. Row span 2 makes charts taller for vertical bars.',
      tip: 'Drag the grip handles to reorder rows and blocks.',
    },
    {
      title: 'Save your layout',
      body: 'Click Save Changes when you are done. Your layout is stored for your role and next visit — not just this browser.',
      tip: 'Reset restores the default layout for your workspace profile.',
    },
  ];
}

export const CUSTOMIZE_TOUR_DISMISSED_KEY = 'ww360-customize-home-dismissed';
export const CUSTOMIZE_TOUR_STEP_KEY = 'ww360-customize-home-step';
export const CUSTOMIZE_TOUR_EVENT = 'ww360-customize-home-tour';
