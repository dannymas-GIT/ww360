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
  buildInsightsTourSlides,
  INSIGHTS_TOUR_DISMISSED_KEY,
  INSIGHTS_TOUR_EVENT,
  INSIGHTS_TOUR_STEP_KEY,
} from './insightsTourContent';

export function requestOpenInsightsTour(slideIndex = 0): void {
  requestOpenTour(INSIGHTS_TOUR_EVENT, slideIndex);
}

export function InsightsTourOverlay({ autoOpen = true }: { autoOpen?: boolean }) {
  const { user } = useAuth();
  const { activeState } = useJurisdiction();
  const stateCode = (activeState || 'NY').toUpperCase().slice(0, 2);

  const config: Ww360TourConfig = useMemo(
    () => ({
      id: `insights-${user?.id ?? 'anon'}`,
      label: 'Insights',
      slides: buildInsightsTourSlides(stateCode),
      dismissedKey: tourStorageKey(INSIGHTS_TOUR_DISMISSED_KEY, user?.id),
      stepKey: tourStorageKey(INSIGHTS_TOUR_STEP_KEY, user?.id),
      eventName: INSIGHTS_TOUR_EVENT,
      fabLabel: 'Insights tour',
    }),
    [user?.id, stateCode]
  );

  return <Ww360TourOverlay config={config} autoOpen={autoOpen} autoOpenDelayMs={700} />;
}
