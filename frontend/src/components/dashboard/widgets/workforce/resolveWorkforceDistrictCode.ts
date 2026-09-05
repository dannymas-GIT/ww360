import type { AccessibleDistrict } from '@/services/districtService';

/**
 * Pick the district code for workforce API calls.
 * Prefers JWT Working-in (actingDistrictCode) when it appears in the accessible list.
 */
export function resolveWorkforceDistrictCode(
  districts: Array<Pick<AccessibleDistrict, 'district_code'>> | undefined,
  options: {
    actingDistrictCode?: string | null;
    currentDistrictCode?: string;
    preferActing?: boolean;
  } = {}
): string {
  const codes = (districts ?? []).map(d => d.district_code);
  if (codes.length === 0) return '';

  const acting = (options.actingDistrictCode ?? '').trim();
  const preferActing = options.preferActing !== false;

  if (preferActing && acting && codes.includes(acting)) {
    return acting;
  }

  const current = (options.currentDistrictCode ?? '').trim();
  if (current && codes.includes(current)) {
    return current;
  }

  return codes[0];
}

/** GA/system admin with Working-in set — API rejects other districts. */
export function isWorkforceDistrictLocked(
  actingDistrictCode: string | null | undefined,
  isGlobalAdmin: boolean,
  isSystemAdmin: boolean
): boolean {
  const acting = (actingDistrictCode ?? '').trim();
  return Boolean(acting && (isGlobalAdmin || isSystemAdmin));
}
