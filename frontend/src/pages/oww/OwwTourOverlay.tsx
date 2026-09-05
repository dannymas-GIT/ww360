/**
 * One Water Workforce executive-dashboard tour — thin wrapper over the shared
 * `Ww360TourOverlay` so the dashboard API stays unchanged.
 */
import { requestOpenTour, Ww360TourOverlay, type Ww360TourConfig } from '@/components/ww360/Ww360TourOverlay';
import { OWW_TOUR_DISMISSED_KEY, OWW_TOUR_SLIDES, OWW_TOUR_STEP_KEY } from './owwTourContent';

export const OWW_TOUR_OPEN_EVENT = 'ww360-open-oww-tour';

export const OWW_TOUR_CONFIG: Ww360TourConfig = {
  id: 'oww',
  label: 'One Water Workforce',
  slides: OWW_TOUR_SLIDES,
  dismissedKey: OWW_TOUR_DISMISSED_KEY,
  stepKey: OWW_TOUR_STEP_KEY,
  eventName: OWW_TOUR_OPEN_EVENT,
};

export function requestOpenOwwTour(slideIndex = 0): void {
  requestOpenTour(OWW_TOUR_OPEN_EVENT, slideIndex);
}

export interface OwwTourOverlayProps {
  /** Auto-open on first visit unless dismissed permanently. */
  autoOpen?: boolean;
}

export function OwwTourOverlay({ autoOpen = true }: OwwTourOverlayProps) {
  return <Ww360TourOverlay config={OWW_TOUR_CONFIG} autoOpen={autoOpen} />;
}
