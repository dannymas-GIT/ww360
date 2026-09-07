import { describe, expect, it } from 'vitest';
import { resolveLandingKind } from './resolveLandingKind';

describe('resolveLandingKind', () => {
  it('routes district manager to district dashboard', () => {
    expect(
      resolveLandingKind({
        roles: ['district_manager', 'ceu_manager', 'workforce_manager'],
        districts: ['HFWD'],
      })
    ).toBe('district');
  });

  it('routes operator to operator home', () => {
    expect(
      resolveLandingKind({
        roles: ['ceu_user', 'district_operator'],
        districts: ['HFWD'],
      })
    ).toBe('operator');
  });

  it('prefers district over exec when districts are present', () => {
    expect(
      resolveLandingKind({
        roles: ['oww_partner'],
        districts: ['HFWD'],
      })
    ).toBe('district');
  });

  it('routes platform partner without districts to exec', () => {
    expect(
      resolveLandingKind({
        roles: ['platform_admin', 'oww_partner'],
        districts: [],
      })
    ).toBe('exec');
  });
});
