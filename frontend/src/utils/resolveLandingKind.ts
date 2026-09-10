/** Resolve which /dashboard surface a user should see. District membership wins. */
export type LandingKind = 'exec' | 'district' | 'operator';

const MANAGER_ROLES = new Set([
  'district_admin',
  'district_manager',
  'ceu_manager',
  'workforce_manager',
  'ceu_admin',
]);

const OPERATOR_ROLES = new Set(['ceu_user', 'district_operator', 'workforce_operator']);

const EXEC_ROLES = new Set([
  'platform_admin',
  'oww_partner',
  'state_admin',
  'global_admin',
  'national_observer',
]);

export function resolveLandingKind(user: {
  roles?: string[] | null;
  districts?: string[] | null;
} | null): LandingKind {
  const roles = new Set((user?.roles ?? []).filter(Boolean));
  const hasDistrict = (user?.districts ?? []).some(Boolean);
  const isManager = [...MANAGER_ROLES].some(r => roles.has(r));
  const isOperator =
    [...OPERATOR_ROLES].some(r => roles.has(r)) && !isManager && !roles.has('district_admin');

  // Utility-scoped accounts never land on the statewide OWW exec dashboard.
  if (hasDistrict || isManager || isOperator) {
    return isOperator ? 'operator' : 'district';
  }

  if ([...EXEC_ROLES].some(r => roles.has(r))) {
    return 'exec';
  }

  return 'district';
}
