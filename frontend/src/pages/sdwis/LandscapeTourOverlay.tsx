import { useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useJurisdiction } from '@/context/JurisdictionContext';
import {
  requestOpenTour,
  tourStorageKey,
  Ww360TourOverlay,
  type Ww360TourConfig,
} from '@/components/ww360/Ww360TourOverlay';
import {
  buildLandscapeTourSlides,
  LANDSCAPE_TOUR_DISMISSED_KEY,
  LANDSCAPE_TOUR_EVENT,
  LANDSCAPE_TOUR_STEP_KEY,
} from './landscapeTourContent';

export function requestOpenLandscapeTour(slideIndex = 0): void {
  requestOpenTour(LANDSCAPE_TOUR_EVENT, slideIndex);
}

export function LandscapeTourOverlay({ autoOpen = true }: { autoOpen?: boolean }) {
  const { user } = useAuth();
  const { pack, activeState } = useJurisdiction();
  const stateName =
    pack?.state_code === 'NY'
      ? 'New York'
      : pack?.state_code === 'NJ'
        ? 'New Jersey'
        : activeState || 'your state';

  const config: Ww360TourConfig = useMemo(
    () => ({
      id: `landscape-${user?.id ?? 'anon'}`,
      label: 'Water system landscape',
      slides: buildLandscapeTourSlides(stateName),
      dismissedKey: tourStorageKey(LANDSCAPE_TOUR_DISMISSED_KEY, user?.id),
      stepKey: tourStorageKey(LANDSCAPE_TOUR_STEP_KEY, user?.id),
      eventName: LANDSCAPE_TOUR_EVENT,
      fabLabel: 'Landscape tour',
    }),
    [user?.id, stateName]
  );

  return <Ww360TourOverlay config={config} autoOpen={autoOpen} autoOpenDelayMs={700} />;
}
