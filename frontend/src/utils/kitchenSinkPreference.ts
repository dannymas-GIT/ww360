/** Kitchen Sink toggle — full tool gambit vs simplified workspace (default off). */

const STORAGE_PREFIX = 'ww360_kitchen_sink';

export function kitchenSinkStorageKey(actorUserId: number | string): string {
  return `${STORAGE_PREFIX}:${actorUserId}`;
}

export function readKitchenSink(actorUserId: number | string | null | undefined): boolean {
  if (actorUserId == null) return false;
  try {
    return localStorage.getItem(kitchenSinkStorageKey(actorUserId)) === '1';
  } catch {
    return false;
  }
}

export function writeKitchenSink(actorUserId: number | string, enabled: boolean): void {
  try {
    const key = kitchenSinkStorageKey(actorUserId);
    if (enabled) localStorage.setItem(key, '1');
    else localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
