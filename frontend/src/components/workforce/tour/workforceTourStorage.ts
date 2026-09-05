export type WorkforceTourRole = 'operator' | 'manager';

const DISMISSED_PREFIX = 'aquasafe-workforce-tour-dismissed';
const STEP_PREFIX = 'aquasafe-workforce-tour-step';

export function dismissedKey(role: WorkforceTourRole): string {
  return `${DISMISSED_PREFIX}-${role}`;
}

export function isWorkforceTourDismissed(role: WorkforceTourRole): boolean {
  try {
    return localStorage.getItem(dismissedKey(role)) === '1';
  } catch {
    return false;
  }
}

export function setWorkforceTourDismissed(role: WorkforceTourRole): void {
  try {
    localStorage.setItem(dismissedKey(role), '1');
  } catch {
    /* ignore */
  }
}

export function clearWorkforceTourDismissed(role: WorkforceTourRole): void {
  try {
    localStorage.removeItem(dismissedKey(role));
  } catch {
    /* ignore */
  }
}

export function getSavedTourStep(areaId: string): number {
  try {
    const raw = localStorage.getItem(`${STEP_PREFIX}-${areaId}`);
    const n = raw != null ? parseInt(raw, 10) : 0;
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function saveTourStep(areaId: string, index: number): void {
  try {
    localStorage.setItem(`${STEP_PREFIX}-${areaId}`, String(index));
  } catch {
    /* ignore */
  }
}
