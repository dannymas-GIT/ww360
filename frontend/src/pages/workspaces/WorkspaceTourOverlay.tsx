import React, { useMemo } from 'react';
import { Ww360TourOverlay, type Ww360TourConfig } from '@/components/ww360/Ww360TourOverlay';
import { buildWorkspaceTourSlides } from './workspaceTourContent';
import type { WorkspaceProfile } from '@/utils/workspaceProfile';

interface WorkspaceTourOverlayProps {
  profile: WorkspaceProfile;
  personaKey?: string | null;
  autoOpen?: boolean;
}

export const WorkspaceTourOverlay: React.FC<WorkspaceTourOverlayProps> = ({
  profile,
  personaKey,
  autoOpen = false,
}) => {
  const config: Ww360TourConfig = useMemo(() => {
    const slides = buildWorkspaceTourSlides(profile, personaKey);
    const tourId = personaKey ? `workspace-${personaKey}` : `workspace-${profile}`;
    return {
      id: tourId,
      label: 'Role workspace',
      slides,
      dismissedKey: `ww360-${tourId}-dismissed`,
      stepKey: `ww360-${tourId}-step`,
      eventName: `ww360-open-tour-${tourId}`,
      fabLabel: 'Role tour',
    };
  }, [profile, personaKey]);

  return <Ww360TourOverlay config={config} autoOpen={autoOpen} autoOpenDelayMs={800} />;
};
