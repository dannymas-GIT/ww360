import type { WorkforceContinuityTab } from '@/components/workforce/workforceContinuityTabs';

export const WORKFORCE_TOUR_OPEN_EVENT = 'aquasafe-open-workforce-tour';

export type WorkforceTourAreaId = WorkforceContinuityTab;

export interface WorkforceTourOpenDetail {
  areaId: WorkforceTourAreaId;
  slideIndex?: number;
}

export function requestOpenWorkforceTour(
  areaId: WorkforceTourAreaId,
  slideIndex = 0
): void {
  window.dispatchEvent(
    new CustomEvent<WorkforceTourOpenDetail>(WORKFORCE_TOUR_OPEN_EVENT, {
      detail: { areaId, slideIndex },
    })
  );
}
