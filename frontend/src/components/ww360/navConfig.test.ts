import { describe, expect, it } from 'vitest';
import { adminNavGroup, navGroupsForRoles, rolesCanManageUsers } from './navConfig';

describe('adminNavGroup', () => {
  it('returns null for non-admin roles', () => {
    expect(adminNavGroup(['district_operator'])).toBeNull();
  });

  it('includes Users & access for utility manager', () => {
    const group = adminNavGroup(['district_manager']);
    expect(group?.label).toBe('Administration');
    expect(group?.items[0]).toMatchObject({ label: 'Users & access', path: '/district/users' });
    expect(group?.items.some(i => i.path === '/admin/users')).toBe(false);
  });

  it('includes platform items for platform admin', () => {
    const group = adminNavGroup(['platform_admin']);
    expect(group?.items.map(i => i.path)).toEqual([
      '/district/users',
      '/admin/users',
      '/admin/jurisdictions',
      '/admin/pwsid-links',
      '/admin/settings',
    ]);
  });
});

describe('navGroupsForRoles simplified', () => {
  it('puts Users under Administration, not Today, for state partner', () => {
    const groups = navGroupsForRoles(['oww_partner'], [], {
      kitchenSink: false,
      workspaceProfile: 'state_partner',
    });
    const today = groups.find(g => g.id === 'today');
    const admin = groups.find(g => g.id === 'administration');
    expect(today?.items.some(i => i.path === '/district/users')).toBe(false);
    expect(admin?.items.some(i => i.path === '/district/users')).toBe(true);
  });

  it('rolesCanManageUsers includes oww_partner', () => {
    expect(rolesCanManageUsers(['oww_partner'])).toBe(true);
  });
});
