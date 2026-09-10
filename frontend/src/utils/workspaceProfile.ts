/** Workspace profile for persona-scoped dashboards, nav, and tours. */
import type { WW360User } from '@/services/authService';

export type WorkspaceProfile =
  | 'national'
  | 'regional'
  | 'state_partner'
  | 'regulator'
  | 'utility';

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

const NATIONAL_PERSONA_KEYS = new Set([
  'aquasafe-admin',
  'ww360-national',
  'us-epa-workforce-lead',
  'us-asdwa-program-director',
  'us-awwa-workforce-director',
]);

const REGIONAL_PERSONA_KEYS = new Set(['epa-r2-opcert-coordinator']);

const REGULATOR_PERSONA_KEYS = new Set(['ny-doh-opcert-manager']);

const STATE_PARTNER_PERSONA_KEYS = new Set(['ny-nysawwa-executive', 'nj-state-admin']);

export function personaKeyFromUser(user: WW360User | null | undefined): string | null {
  return user?.impersonation?.persona_key ?? null;
}

export function resolveWorkspaceProfile(
  user: WW360User | null | undefined,
  personaKey?: string | null
): WorkspaceProfile {
  const roles = new Set((user?.roles ?? []).filter(Boolean));
  const districts = (user?.districts ?? []).filter(Boolean);
  const hasDistrict = districts.length > 0;
  const key = personaKey ?? personaKeyFromUser(user);
  const orgCode = (user?.active_org_code ?? '').toUpperCase();

  if (key && NATIONAL_PERSONA_KEYS.has(key)) return 'national';
  if (key && REGIONAL_PERSONA_KEYS.has(key)) return 'regional';
  if (key && REGULATOR_PERSONA_KEYS.has(key)) return 'regulator';
  if (key && STATE_PARTNER_PERSONA_KEYS.has(key)) return 'state_partner';

  if (hasDistrict || [...MANAGER_ROLES].some(r => roles.has(r))) {
    return 'utility';
  }

  if ([...OPERATOR_ROLES].some(r => roles.has(r)) && !roles.has('district_admin')) {
    return 'utility';
  }

  if (orgCode === 'NY_DOH_BWSP' || (roles.has('state_admin') && orgCode.includes('DOH'))) {
    return 'regulator';
  }

  if (roles.has('national_observer') && !roles.has('oww_partner')) {
    return key && REGIONAL_PERSONA_KEYS.has(key) ? 'regional' : 'national';
  }

  if (roles.has('platform_admin') && (user?.is_national_admin || orgCode === 'US_PLATFORM')) {
    return 'national';
  }

  if (roles.has('oww_partner') || roles.has('state_admin')) {
    return 'state_partner';
  }

  if (roles.has('platform_admin')) {
    return 'state_partner';
  }

  if ([...EXEC_ROLES].some(r => roles.has(r))) {
    return 'state_partner';
  }

  return 'utility';
}

export function resolveHomePath(
  user: WW360User | null | undefined,
  personaKey?: string | null
): string {
  const profile = resolveWorkspaceProfile(user, personaKey);
  if (profile === 'national') return '/national';
  return '/dashboard';
}

export function isOperatorUser(user: WW360User | null | undefined): boolean {
  const roles = new Set((user?.roles ?? []).filter(Boolean));
  const isManager = [...MANAGER_ROLES].some(r => roles.has(r));
  return (
    [...OPERATOR_ROLES].some(r => roles.has(r)) &&
    !isManager &&
    !roles.has('district_admin')
  );
}
