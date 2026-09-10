import { describe, expect, it } from 'vitest';
import { resolveHomePath, resolveWorkspaceProfile } from './workspaceProfile';

describe('resolveWorkspaceProfile', () => {
  it('maps national persona keys to national profile', () => {
    expect(
      resolveWorkspaceProfile(
        { roles: ['national_observer'], districts: [] } as never,
        'us-asdwa-program-director'
      )
    ).toBe('national');
  });

  it('maps oww partner to state_partner', () => {
    expect(
      resolveWorkspaceProfile(
        { roles: ['oww_partner', 'platform_admin'], districts: [] } as never,
        'ny-nysawwa-executive'
      )
    ).toBe('state_partner');
  });

  it('maps district manager to utility', () => {
    expect(
      resolveWorkspaceProfile(
        { roles: ['district_manager'], districts: ['HFWD'] } as never,
        null
      )
    ).toBe('utility');
  });
});

describe('resolveHomePath', () => {
  it('sends national profiles to /national', () => {
    expect(
      resolveHomePath(
        { roles: ['national_observer'], districts: [] } as never,
        'us-epa-workforce-lead'
      )
    ).toBe('/national');
  });

  it('sends state partner to /dashboard', () => {
    expect(
      resolveHomePath(
        { roles: ['oww_partner'], districts: [] } as never,
        'ny-nysawwa-executive'
      )
    ).toBe('/dashboard');
  });
});
