import React, { useMemo } from 'react';
import { CircleHelp, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Ww360TourOverlay,
  requestOpenTour,
  type Ww360TourConfig,
} from '@/components/ww360/Ww360TourOverlay';
import { useImpersonation } from '@/context/ImpersonationContext';
import { requestEnterEditMode } from '@/services/workspaceCustomizationService';
import {
  buildCustomizeHomeTourSlides,
  CUSTOMIZE_TOUR_DISMISSED_KEY,
  CUSTOMIZE_TOUR_EVENT,
  CUSTOMIZE_TOUR_STEP_KEY,
} from '@/pages/workspaces/customizeTourContent';

/**
 * Sidebar entry for home customization.
 * Enters inline dashboard edit mode (Add Row / Add Chart / Add Widget) on the simplified home.
 */
export const CustomizeHomeButton: React.FC = () => {
  const { isPreviewMode } = useImpersonation();

  const tourConfig: Ww360TourConfig = useMemo(
    () => ({
      id: 'customize-home',
      label: 'Customize home',
      slides: buildCustomizeHomeTourSlides(),
      dismissedKey: CUSTOMIZE_TOUR_DISMISSED_KEY,
      stepKey: CUSTOMIZE_TOUR_STEP_KEY,
      eventName: CUSTOMIZE_TOUR_EVENT,
      fabLabel: 'Customize tour',
    }),
    []
  );

  return (
    <div className="space-y-2" data-tour="customize-home">
      <Button
        variant="outline"
        size="sm"
        className="w-full min-h-[44px] justify-start gap-2 border-white/20 bg-white/5 text-base text-white hover:bg-white/10"
        data-tour="customize-home-btn"
        disabled={isPreviewMode}
        onClick={() => {
          requestEnterEditMode();
          // Ensure we are on the home dashboard surface
          if (!window.location.pathname.startsWith('/dashboard')) {
            window.location.assign('/dashboard');
          }
        }}
      >
        <LayoutGrid className="h-4 w-4 shrink-0" />
        Customize home
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-full min-h-[44px] justify-start gap-2 text-base text-white/80 hover:bg-white/10 hover:text-white"
        onClick={() => requestOpenTour(CUSTOMIZE_TOUR_EVENT, 0)}
      >
        <CircleHelp className="h-4 w-4 shrink-0" />
        Customize tour
      </Button>
      <Ww360TourOverlay config={tourConfig} autoOpen={false} />
    </div>
  );
};
