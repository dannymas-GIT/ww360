import { useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  requestOpenTour,
  tourStorageKey,
  Ww360TourOverlay,
  type Ww360TourConfig,
} from '@/components/ww360/Ww360TourOverlay';
import {
  buildGrantsDetailTourSlides,
  buildGrantsListTourSlides,
  GRANTS_TOUR_DISMISSED_KEY,
  GRANTS_TOUR_EVENT,
  GRANTS_TOUR_STEP_KEY,
} from './grantsTourContent';

export function requestOpenGrantsTour(slideIndex = 0): void {
  requestOpenTour(GRANTS_TOUR_EVENT, slideIndex);
}

export interface GrantsTourOverlayProps {
  /** List catalog tour vs program-detail tour (different highlights). */
  view: 'list' | 'detail';
  autoOpen?: boolean;
  programName?: string;
  isEpa?: boolean;
}

export function GrantsTourOverlay({
  view,
  autoOpen = true,
  programName,
  isEpa = false,
}: GrantsTourOverlayProps) {
  const { user } = useAuth();

  const config: Ww360TourConfig = useMemo(
    () => ({
      id: `grants-${view}-${user?.id ?? 'anon'}`,
      label: 'Grants Studio',
      slides:
        view === 'list'
          ? buildGrantsListTourSlides()
          : buildGrantsDetailTourSlides({ programName, isEpa }),
      dismissedKey: tourStorageKey(GRANTS_TOUR_DISMISSED_KEY, user?.id),
      stepKey: tourStorageKey(`${GRANTS_TOUR_STEP_KEY}-${view}`, user?.id),
      eventName: GRANTS_TOUR_EVENT,
      fabLabel: 'Grants tour',
    }),
    [user?.id, view, programName, isEpa]
  );

  return <Ww360TourOverlay config={config} autoOpen={autoOpen} autoOpenDelayMs={700} />;
}
