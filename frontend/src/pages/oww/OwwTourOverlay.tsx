/**
 * One Water Workforce executive-dashboard tour — thin wrapper over the shared
 * `Ww360TourOverlay` so the dashboard API stays unchanged.
 */
import { useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useJurisdiction, jurisdictionNyFallback } from '@/context/JurisdictionContext';
import {
  requestOpenTour,
  tourStorageKey,
  Ww360TourOverlay,
  type Ww360TourConfig,
} from '@/components/ww360/Ww360TourOverlay';
import { OWW_TOUR_DISMISSED_KEY, OWW_TOUR_STEP_KEY, buildOwwTourSlides } from './owwTourContent';

export const OWW_TOUR_OPEN_EVENT = 'ww360-open-oww-tour';

export function requestOpenOwwTour(slideIndex = 0): void {
  requestOpenTour(OWW_TOUR_OPEN_EVENT, slideIndex);
}

export interface OwwTourOverlayProps {
  /** Auto-open on first visit unless dismissed permanently. */
  autoOpen?: boolean;
}

export function OwwTourOverlay({ autoOpen = true }: OwwTourOverlayProps) {
  const { user } = useAuth();
  const { pack } = useJurisdiction();
  const config: Ww360TourConfig = useMemo(
    () => ({
      id: `oww-${user?.id ?? 'anon'}`,
      label: pack?.partner_name ?? 'Workforce program',
      slides: buildOwwTourSlides(pack ?? jurisdictionNyFallback),
      dismissedKey: tourStorageKey(OWW_TOUR_DISMISSED_KEY, user?.id),
      stepKey: tourStorageKey(OWW_TOUR_STEP_KEY, user?.id),
      eventName: OWW_TOUR_OPEN_EVENT,
    }),
    [user?.id, pack]
  );
  return <Ww360TourOverlay config={config} autoOpen={autoOpen} />;
}
