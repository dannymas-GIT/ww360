/**
 * Users & access — AquaSafe layout patterns on WW360 site theme (Ww360PageHero).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Edit,
  Eye,
  Filter,
  Lock,
  Search,
  Shield,
  Unlock,
  UserPlus,
  Users,
  Video,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Ww360PageHero } from '@/components/ww360/Ww360PageHero';
import { useAuth } from '@/context/AuthContext';
import { fetchAccessibleDistricts } from '@/services/districtService';
import {
  createDistrictUser,
  fetchAssignableRoles,
  fetchDistrictUsers,
  fetchRoleCatalog,
  patchDistrictRoleSettings,
  patchDistrictUser,
  type DistrictUser,
  type RoleCatalog,
  type RoleCatalogEntry,
  type UtilityRoleCategory,
} from '@/services/districtUsersService';
import {
  createRecorderGrant,
  deleteRecorderGrant,
  fetchRecorderGrants,
  type DocumentationGrant,
} from '@/services/documentationTaskService';

const ROLE_LABELS: Record<string, string> = {
  district_admin: 'Utility admin',
  district_manager: 'Manager',
  district_operator: 'Operator',
  district_viewer: 'Viewer',
  ceu_admin: 'CEU admin',
  ceu_manager: 'CEU manager',
  ceu_user: 'CEU learner',
  workforce_manager: 'Workforce manager',
  workforce_operator: 'Workforce operator',
};

const ROLE_CHIP_CLASS: Record<string, string> = {
  district_admin: 'bg-indigo-100 text-indigo-800 ring-indigo-200',
  district_manager: 'bg-blue-100 text-blue-800 ring-blue-200',
  workforce_manager: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  workforce_operator: 'bg-teal-100 text-teal-800 ring-teal-200',
  ceu_admin: 'bg-violet-100 text-violet-800 ring-violet-200',
  ceu_manager: 'bg-purple-100 text-purple-800 ring-purple-200',
  ceu_user: 'bg-fuchsia-100 text-fuchsia-800 ring-fuchsia-200',
  district_operator: 'bg-sky-100 text-sky-800 ring-sky-200',
  district_viewer: 'bg-slate-100 text-slate-700 ring-slate-200',
};

const CATEGORY_LABELS: Record<UtilityRoleCategory, string> = {
  administration: 'Administration',
  workforce: 'Workforce',
  ceu: 'CEU & training',
  operator: 'Operator & viewer',
};

const CATEGORY_ORDER: UtilityRoleCategory[] = ['administration', 'workforce', 'ceu', 'operator'];

function roleLabel(key: string): string {
  return ROLE_LABELS[key] || key.replace(/_/g, ' ');
}

function avatarClass(id: number): string {
  const palette = [
    'bg-blue-100 text-blue-700',
    'bg-emerald-100 text-emerald-700',
    'bg-violet-100 text-violet-700',
    'bg-amber-100 text-amber-700',
    'bg-rose-100 text-rose-700',
    'bg-cyan-100 text-cyan-700',
  ];
  return palette[id % palette.length];
}

function initials(user: DistrictUser): string {
  const name = user.full_name?.trim();
  if (name) {
    const parts = name.split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  return user.username.slice(0, 2).toUpperCase();
}

export default function DistrictUsersPage() {
  const { user, actingDistrictCode, canManageUsers, isPlatformAdmin, isStateAdmin } = useAuth();
  const [districtOptions, setDistrictOptions] = useState<Array<{ code: string; name: string }>>([]);
  const [district, setDistrict] = useState(actingDistrictCode ?? user?.districts?.[0] ?? '');

  const [users, setUsers] = useState<DistrictUser[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [catalog, setCatalog] = useState<RoleCatalog | null>(null);
  const [grants, setGrants] = useState<DocumentationGrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'users' | 'roles'>('users');

  const [createOpen, setCreateOpen] = useState(false);
  const [detailsUser, setDetailsUser] = useState<DistrictUser | null>(null);
  const [editUser, setEditUser] = useState<DistrictUser | null>(null);
  const [rolesUser, setRolesUser] = useState<DistrictUser | null>(null);

  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    full_name: '',
    password: '',
    roles: [] as string[],
  });
  const [editForm, setEditForm] = useState({
    full_name: '',
    email: '',
    roles: [] as string[],
    is_active: true,
  });

  const grantsByUser = useMemo(() => {
    const map = new Map<number, DocumentationGrant>();
    for (const g of grants) map.set(g.user_id, g);
    return map;
  }, [grants]);

  const filteredUsers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      u =>
        u.username.toLowerCase().includes(q) ||
        (u.email ?? '').toLowerCase().includes(q) ||
        (u.full_name ?? '').toLowerCase().includes(q)
    );
  }, [users, searchTerm]);

  const utilityByCategory = useMemo(() => {
    const grouped = new Map<UtilityRoleCategory, RoleCatalogEntry[]>();
    for (const cat of CATEGORY_ORDER) grouped.set(cat, []);
    for (const entry of catalog?.utility ?? []) {
      const cat = entry.category ?? 'operator';
      grouped.get(cat)?.push(entry);
    }
    return grouped;
  }, [catalog?.utility]);

  useEffect(() => {
    void fetchAccessibleDistricts()
      .then(list => {
        const opts = list.map(d => ({
          code: d.district_code,
          name: d.district_name || d.district_code,
        }));
        setDistrictOptions(opts);
        if (!district && opts[0]) setDistrict(opts[0].code);
        if (district && opts.length && !opts.some(o => o.code === district) && opts[0]) {
          setDistrict(opts[0].code);
        }
      })
      .catch(() => setDistrictOptions([]));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(() => {
    if (!canManageUsers) {
      setLoading(false);
      return;
    }
    if (!district) {
      setLoading(false);
      setUsers([]);
      return;
    }
    setLoading(true);
    setError(null);
    void Promise.all([
      fetchDistrictUsers(district),
      fetchAssignableRoles(district),
      fetchRecorderGrants(district),
      fetchRoleCatalog(district),
    ])
      .then(([u, r, g, c]) => {
        setUsers(u);
        setRoles(r);
        setGrants(g);
        setCatalog(c);
      })
      .catch(() => setError('Could not load users. Confirm you have admin access for this utility.'))
      .finally(() => setLoading(false));
  }, [district, canManageUsers]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleRole = async (row: DistrictUser, role: string) => {
    const has = row.roles.includes(role);
    const next = has ? row.roles.filter(r => r !== role) : [...row.roles, role];
    setBusyId(row.id);
    try {
      const updated = await patchDistrictUser(district, row.id, { roles: next });
      setUsers(prev => prev.map(u => (u.id === updated.id ? updated : u)));
      if (rolesUser?.id === updated.id) setRolesUser(updated);
    } catch {
      setError('Failed to update roles.');
    } finally {
      setBusyId(null);
    }
  };

  const toggleActive = async (row: DistrictUser) => {
    setBusyId(row.id);
    try {
      const updated = await patchDistrictUser(district, row.id, { is_active: !row.is_active });
      setUsers(prev => prev.map(u => (u.id === updated.id ? updated : u)));
    } catch {
      setError('Failed to update status.');
    } finally {
      setBusyId(null);
    }
  };

  const toggleGrant = async (row: DistrictUser) => {
    setBusyId(row.id);
    try {
      const existing = grantsByUser.get(row.id);
      if (existing) {
        await deleteRecorderGrant(existing.id);
      } else {
        const expires = new Date();
        expires.setDate(expires.getDate() + 90);
        await createRecorderGrant({
          district_code: district,
          user_id: row.id,
          expires_at: expires.toISOString(),
          allowed_modes: 'screen,screenshots,voice',
        });
      }
      setGrants(await fetchRecorderGrants(district));
      setUsers(await fetchDistrictUsers(district));
    } catch {
      setError('Failed to update recorder grant.');
    } finally {
      setBusyId(null);
    }
  };

  const toggleCatalogRole = async (roleKey: string) => {
    if (!catalog?.can_fine_tune) return;
    const on = catalog.utility_enabled.includes(roleKey);
    const next = on
      ? catalog.utility_enabled.filter(r => r !== roleKey)
      : [...catalog.utility_enabled, roleKey];
    if (next.length === 0) {
      setError('Keep at least one utility role enabled.');
      return;
    }
    try {
      const updated = await patchDistrictRoleSettings(district, next);
      setCatalog(updated);
      setRoles(updated.utility_enabled);
    } catch {
      setError('Failed to save role pack for this utility.');
    }
  };

  const selectAllCategory = async (category: UtilityRoleCategory, enable: boolean) => {
    if (!catalog?.can_fine_tune) return;
    const keys = (utilityByCategory.get(category) ?? []).map(r => r.key);
    let next = [...catalog.utility_enabled];
    if (enable) {
      next = [...new Set([...next, ...keys])];
    } else {
      next = next.filter(k => !keys.includes(k));
    }
    if (next.length === 0) {
      setError('Keep at least one utility role enabled.');
      return;
    }
    try {
      const updated = await patchDistrictRoleSettings(district, next);
      setCatalog(updated);
      setRoles(updated.utility_enabled);
    } catch {
      setError('Failed to save role pack for this utility.');
    }
  };

  const submitCreate = async () => {
    if (!newUser.username.trim() || !newUser.password) {
      setError('Username and password are required.');
      return;
    }
    try {
      await createDistrictUser(district, {
        username: newUser.username.trim(),
        email: newUser.email.trim() || undefined,
        full_name: newUser.full_name.trim() || undefined,
        password: newUser.password,
        roles: newUser.roles.length ? newUser.roles : roles.slice(0, 1),
      });
      setCreateOpen(false);
      setNewUser({ username: '', email: '', full_name: '', password: '', roles: [] });
      load();
    } catch {
      setError('Could not create user (username/email may already exist).');
    }
  };

  const openEdit = (row: DistrictUser) => {
    setEditForm({
      full_name: row.full_name ?? '',
      email: row.email ?? '',
      roles: [...row.roles],
      is_active: row.is_active,
    });
    setEditUser(row);
  };

  const submitEdit = async () => {
    if (!editUser) return;
    try {
      const updated = await patchDistrictUser(district, editUser.id, {
        full_name: editForm.full_name.trim() || undefined,
        email: editForm.email.trim() || undefined,
        roles: editForm.roles,
        is_active: editForm.is_active,
      });
      setUsers(prev => prev.map(u => (u.id === updated.id ? updated : u)));
      setEditUser(null);
    } catch {
      setError('Failed to save user.');
    }
  };

  if (!canManageUsers) {
    return (
      <div className="ww360-app-shell mx-auto w-full max-w-[1440px] space-y-6 p-4 md:p-6">
        <Ww360PageHero
          eyebrow="Administration"
          title="Users & access"
          description="National, state, or utility admin roles are required to manage users."
        />
      </div>
    );
  }

  return (
    <div className="ww360-app-shell mx-auto w-full max-w-[1440px] space-y-6 p-4 md:p-6">
      <Ww360PageHero
        eyebrow="Administration"
        title="Users & access"
        description="National and state define default role packs. This utility fine-tunes which roles are offered, assigns people, and grants Document Studio recording case by case."
        badges={
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-sm text-slate-200 ring-1 ring-white/15">
            National → State → Utility
          </span>
        }
        actions={
          isPlatformAdmin ? (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="min-h-[44px] border-white/20 bg-white/5 text-base text-white hover:bg-white/15"
            >
              <Link to="/admin/users">Platform accounts</Link>
            </Button>
          ) : null
        }
      />

      {/* Underline tabs — AquaSafe pattern, WW360 accent */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-6" aria-label="Users and roles">
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`min-h-[44px] border-b-2 px-1 py-2 text-base font-medium transition-colors ${
              activeTab === 'users'
                ? 'border-sky-600 text-sky-800'
                : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900'
            }`}
          >
            <Users className="mr-2 inline h-4 w-4" aria-hidden />
            Users
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('roles')}
            className={`min-h-[44px] border-b-2 px-1 py-2 text-base font-medium transition-colors ${
              activeTab === 'roles'
                ? 'border-sky-600 text-sky-800'
                : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900'
            }`}
          >
            <Shield className="mr-2 inline h-4 w-4" aria-hidden />
            Roles & permissions
          </button>
        </nav>
      </div>

      {error ? (
        <p className="text-base text-amber-800" role="alert">
          {error}
        </p>
      ) : null}

      {activeTab === 'users' ? (
        <>
          {/* Toolbar */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative min-w-[12rem] flex-1 max-w-md">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden
                />
                <Input
                  type="search"
                  placeholder="Search users…"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="h-11 min-h-[44px] pl-10 text-base"
                  aria-label="Search users"
                />
              </div>
              <div className="min-w-[14rem]">
                <Select value={district || undefined} onValueChange={setDistrict}>
                  <SelectTrigger className="h-11 min-h-[44px] text-base" aria-label="Utility">
                    <SelectValue placeholder="Select utility" />
                  </SelectTrigger>
                  <SelectContent>
                    {districtOptions.map(d => (
                      <SelectItem key={d.code} value={d.code} className="text-base">
                        {d.name} ({d.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              type="button"
              className="min-h-[44px] text-base"
              disabled={!district}
              onClick={() => setCreateOpen(true)}
            >
              <UserPlus className="mr-2 h-4 w-4" aria-hidden />
              Add User
            </Button>
          </div>

          {(isPlatformAdmin || isStateAdmin) && !districtOptions.length ? (
            <p className="text-base text-amber-800">No utilities linked yet for this jurisdiction.</p>
          ) : null}

          {/* Card + table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-lg">
                <span>Users ({filteredUsers.length})</span>
                <span className="flex items-center text-sm font-normal text-slate-500">
                  <Filter className="mr-1 h-4 w-4" aria-hidden />
                  {searchTerm.trim() ? 'Filtered' : 'All users'}
                </span>
              </CardTitle>
              <CardDescription className="text-base">
                Assign utility roles from this district&apos;s enabled pack. Grant recording access
                for tutorials without an open documentation task.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-lg text-slate-600">Loading…</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px]">
                    <thead>
                      <tr className="border-b border-slate-200 text-left">
                        <th className="px-4 py-3 text-base font-medium text-slate-700">User</th>
                        <th className="px-4 py-3 text-base font-medium text-slate-700">Roles</th>
                        <th className="px-4 py-3 text-base font-medium text-slate-700">Status</th>
                        <th className="px-4 py-3 text-right text-base font-medium text-slate-700">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map(row => {
                        const grant = grantsByUser.get(row.id);
                        return (
                          <tr
                            key={row.id}
                            className="border-b border-slate-100 hover:bg-slate-50/80"
                          >
                            <td className="px-4 py-4 align-top">
                              <div className="flex items-start gap-3">
                                <div
                                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${avatarClass(row.id)}`}
                                >
                                  {initials(row)}
                                </div>
                                <div>
                                  <div className="text-base font-medium text-slate-900">
                                    {row.full_name || row.username}
                                  </div>
                                  <div className="text-sm text-slate-500">@{row.username}</div>
                                  {row.email ? (
                                    <div className="text-sm text-slate-500">{row.email}</div>
                                  ) : null}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4 align-top">
                              <div className="flex flex-wrap gap-1.5">
                                {row.roles.length ? (
                                  row.roles.map(role => (
                                    <Badge
                                      key={role}
                                      variant="outline"
                                      className={`text-sm ring-1 ${ROLE_CHIP_CLASS[role] ?? 'bg-slate-100 text-slate-700'}`}
                                    >
                                      {roleLabel(role)}
                                    </Badge>
                                  ))
                                ) : (
                                  <span className="text-sm text-slate-500">No roles</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-4 align-top">
                              <Badge
                                variant="outline"
                                className={
                                  row.is_active
                                    ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
                                    : 'bg-slate-100 text-slate-600 ring-slate-200'
                                }
                              >
                                {row.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                              {grant ? (
                                <p className="mt-1 text-sm text-slate-500">
                                  Recording until{' '}
                                  {grant.expires_at
                                    ? new Date(grant.expires_at).toLocaleDateString()
                                    : '—'}
                                </p>
                              ) : null}
                            </td>
                            <td className="px-4 py-4 align-top">
                              <div className="flex justify-end gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-11 w-11"
                                  aria-label={`View ${row.username}`}
                                  onClick={() => setDetailsUser(row)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-11 w-11"
                                  aria-label={`Edit ${row.username}`}
                                  onClick={() => openEdit(row)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-11 w-11"
                                  aria-label={`Roles for ${row.username}`}
                                  disabled={busyId === row.id}
                                  onClick={() => setRolesUser(row)}
                                >
                                  <Shield className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-11 w-11"
                                  aria-label={
                                    grant
                                      ? `Revoke recording for ${row.username}`
                                      : `Grant recording for ${row.username}`
                                  }
                                  disabled={busyId === row.id}
                                  onClick={() => void toggleGrant(row)}
                                >
                                  <Video className={`h-4 w-4 ${grant ? 'text-blue-600' : ''}`} />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-11 w-11"
                                  aria-label={
                                    row.is_active
                                      ? `Deactivate ${row.username}`
                                      : `Activate ${row.username}`
                                  }
                                  disabled={busyId === row.id}
                                  onClick={() => void toggleActive(row)}
                                >
                                  {row.is_active ? (
                                    <Lock className="h-4 w-4" />
                                  ) : (
                                    <Unlock className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-base text-slate-600">
                            {users.length === 0
                              ? 'No users in this utility yet. Use Add User to create one.'
                              : 'No users match your search.'}
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <div className="space-y-6">
          <div className="min-w-[14rem] max-w-xs">
            <Label htmlFor="roles-district" className="mb-1 block text-base text-slate-700">
              Utility
            </Label>
            <Select value={district || undefined} onValueChange={setDistrict}>
              <SelectTrigger id="roles-district" className="h-11 min-h-[44px] text-base">
                <SelectValue placeholder="Select utility" />
              </SelectTrigger>
              <SelectContent>
                {districtOptions.map(d => (
                  <SelectItem key={d.code} value={d.code} className="text-base">
                    {d.name} ({d.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Lock className="h-5 w-5 text-slate-500" aria-hidden />
                  National (locked)
                </CardTitle>
                <CardDescription className="text-base">
                  Platform-wide roles — assigned by national admins only.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(catalog?.national ?? []).map(r => (
                  <div
                    key={r.key}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex items-center gap-2 text-base font-medium text-slate-900">
                      <Lock className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                      {r.label}
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{r.description}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Lock className="h-5 w-5 text-slate-500" aria-hidden />
                  State (locked)
                </CardTitle>
                <CardDescription className="text-base">
                  State primacy roles — assigned by state partners, not utility managers.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(catalog?.state ?? []).map(r => (
                  <div
                    key={r.key}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex items-center gap-2 text-base font-medium text-slate-900">
                      <Lock className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                      {r.label}
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{r.description}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Utility fine-tune</CardTitle>
              <CardDescription className="text-base">
                Choose which utility roles appear when assigning access for{' '}
                {district || 'this utility'}. Group by function; enable or disable per role.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {CATEGORY_ORDER.map(category => {
                const entries = utilityByCategory.get(category) ?? [];
                if (!entries.length) return null;
                const allOn = entries.every(e => catalog?.utility_enabled.includes(e.key));
                const someOn = entries.some(e => catalog?.utility_enabled.includes(e.key));
                return (
                  <div key={category} className="rounded-lg border border-slate-200 p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-base font-semibold text-slate-900">
                        {CATEGORY_LABELS[category]}
                      </h3>
                      {catalog?.can_fine_tune ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="min-h-[44px] text-base"
                          onClick={() => void selectAllCategory(category, !allOn)}
                        >
                          {allOn ? 'Disable all' : someOn ? 'Enable all' : 'Select all'}
                        </Button>
                      ) : null}
                    </div>
                    <ul className="space-y-3">
                      {entries.map(r => {
                        const on = (catalog?.utility_enabled ?? []).includes(r.key);
                        return (
                          <li
                            key={r.key}
                            className="flex items-start justify-between gap-4 rounded-md border border-slate-100 bg-white p-3"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-base font-medium text-slate-900">{r.label}</p>
                              <p className="text-sm text-slate-600">{r.description}</p>
                            </div>
                            <Switch
                              checked={on}
                              disabled={!catalog?.can_fine_tune}
                              onCheckedChange={() => void toggleCatalogRole(r.key)}
                              aria-label={`${on ? 'Disable' : 'Enable'} ${r.label}`}
                            />
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Create user dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg">Add User</DialogTitle>
            <DialogDescription className="text-base">
              Create a new account for this utility.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              className="h-11 text-base"
              placeholder="Username"
              value={newUser.username}
              onChange={e => setNewUser(s => ({ ...s, username: e.target.value }))}
            />
            <Input
              className="h-11 text-base"
              placeholder="Full name"
              value={newUser.full_name}
              onChange={e => setNewUser(s => ({ ...s, full_name: e.target.value }))}
            />
            <Input
              className="h-11 text-base"
              placeholder="Email"
              type="email"
              value={newUser.email}
              onChange={e => setNewUser(s => ({ ...s, email: e.target.value }))}
            />
            <Input
              className="h-11 text-base"
              type="password"
              placeholder="Temporary password"
              value={newUser.password}
              onChange={e => setNewUser(s => ({ ...s, password: e.target.value }))}
            />
            <div>
              <Label className="mb-2 block text-base">Roles</Label>
              <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-slate-200 p-3">
                {roles.map(role => {
                  const on = newUser.roles.includes(role);
                  return (
                    <label
                      key={role}
                      className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-md border border-slate-100 px-3 py-2 hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={e => {
                          setNewUser(s => ({
                            ...s,
                            roles: e.target.checked
                              ? [...s.roles, role]
                              : s.roles.filter(r => r !== role),
                          }));
                        }}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      <span className="text-base">{roleLabel(role)}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] text-base"
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" className="min-h-[44px] text-base" onClick={() => void submitCreate()}>
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details dialog */}
      <Dialog open={!!detailsUser} onOpenChange={open => !open && setDetailsUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">{detailsUser?.full_name || detailsUser?.username}</DialogTitle>
            <DialogDescription className="text-base">@{detailsUser?.username}</DialogDescription>
          </DialogHeader>
          {detailsUser ? (
            <dl className="space-y-2 text-base">
              <div>
                <dt className="text-sm text-slate-500">Email</dt>
                <dd>{detailsUser.email || '—'}</dd>
              </div>
              <div>
                <dt className="text-sm text-slate-500">Status</dt>
                <dd>{detailsUser.is_active ? 'Active' : 'Inactive'}</dd>
              </div>
              <div>
                <dt className="text-sm text-slate-500">Roles</dt>
                <dd className="flex flex-wrap gap-1 pt-1">
                  {detailsUser.roles.map(r => (
                    <Badge key={r} variant="outline" className="text-sm">
                      {roleLabel(r)}
                    </Badge>
                  ))}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-slate-500">Recording grant</dt>
                <dd>{detailsUser.has_recorder_grant ? 'Yes' : 'No'}</dd>
              </div>
            </dl>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editUser} onOpenChange={open => !open && setEditUser(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg">Edit user</DialogTitle>
            <DialogDescription className="text-base">@{editUser?.username}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              className="h-11 text-base"
              placeholder="Full name"
              value={editForm.full_name}
              onChange={e => setEditForm(s => ({ ...s, full_name: e.target.value }))}
            />
            <Input
              className="h-11 text-base"
              placeholder="Email"
              type="email"
              value={editForm.email}
              onChange={e => setEditForm(s => ({ ...s, email: e.target.value }))}
            />
            <div className="flex min-h-[44px] items-center justify-between rounded-md border border-slate-200 px-3">
              <Label htmlFor="edit-active" className="text-base">
                Active account
              </Label>
              <Switch
                id="edit-active"
                checked={editForm.is_active}
                onCheckedChange={v => setEditForm(s => ({ ...s, is_active: v }))}
              />
            </div>
            <div>
              <Label className="mb-2 block text-base">Roles</Label>
              <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-slate-200 p-3">
                {roles.map(role => {
                  const on = editForm.roles.includes(role);
                  return (
                    <label
                      key={role}
                      className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-md border border-slate-100 px-3 py-2 hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={e => {
                          setEditForm(s => ({
                            ...s,
                            roles: e.target.checked
                              ? [...s.roles, role]
                              : s.roles.filter(r => r !== role),
                          }));
                        }}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      <span className="text-base">{roleLabel(role)}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] text-base"
              onClick={() => setEditUser(null)}
            >
              Cancel
            </Button>
            <Button type="button" className="min-h-[44px] text-base" onClick={() => void submitEdit()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Roles quick-edit dialog */}
      <Dialog open={!!rolesUser} onOpenChange={open => !open && setRolesUser(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg">Assign roles</DialogTitle>
            <DialogDescription className="text-base">
              {rolesUser?.full_name || rolesUser?.username}
            </DialogDescription>
          </DialogHeader>
          {rolesUser ? (
            <div className="flex flex-wrap gap-2">
              {roles.map(role => {
                const on = rolesUser.roles.includes(role);
                return (
                  <Button
                    key={role}
                    type="button"
                    size="sm"
                    variant={on ? 'default' : 'outline'}
                    className="min-h-[44px] text-base"
                    disabled={busyId === rolesUser.id}
                    onClick={() => void toggleRole(rolesUser, role)}
                  >
                    {roleLabel(role)}
                  </Button>
                );
              })}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
