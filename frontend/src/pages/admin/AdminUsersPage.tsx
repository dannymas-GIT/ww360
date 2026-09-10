import { useEffect, useState } from 'react';
import { Ww360PageHero } from '@/components/ww360/Ww360PageHero';
import { Ww360Section } from '@/components/ww360/Ww360Section';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/context/AuthContext';
import {
  fetchAdminUsers,
  patchAdminUser,
  type AdminUser,
} from '@/services/adminUsersService';
import {
  fetchImpersonationSessions,
  type ImpersonationSession,
} from '@/services/impersonationService';

const ROLE_PRESETS = [
  'platform_admin',
  'state_admin',
  'oww_partner',
  'ceu_admin',
  'workforce_operator',
] as const;

export default function AdminUsersPage() {
  const { isPlatformAdmin } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [auditSessions, setAuditSessions] = useState<ImpersonationSession[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    void fetchAdminUsers()
      .then(setUsers)
      .catch(() => setError('Could not load users (platform admin required).'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isPlatformAdmin) load();
    else {
      setLoading(false);
      setError('Platform admin role required to manage users.');
    }
  }, [isPlatformAdmin]);

  const loadAudit = () => {
    setAuditLoading(true);
    void fetchImpersonationSessions(200)
      .then(setAuditSessions)
      .catch(() => setAuditSessions([]))
      .finally(() => setAuditLoading(false));
  };

  const toggleActive = async (user: AdminUser) => {
    setBusyId(user.id);
    try {
      const updated = await patchAdminUser(user.id, { is_active: !user.is_active });
      setUsers(prev => prev.map(u => (u.id === updated.id ? updated : u)));
    } catch {
      setError('Failed to update user status.');
    } finally {
      setBusyId(null);
    }
  };

  const toggleRole = async (user: AdminUser, role: string) => {
    const has = user.roles.includes(role);
    const roles = has ? user.roles.filter(r => r !== role) : [...user.roles, role];
    setBusyId(user.id);
    try {
      const updated = await patchAdminUser(user.id, { roles });
      setUsers(prev => prev.map(u => (u.id === updated.id ? updated : u)));
    } catch {
      setError('Failed to update roles.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="ww360-app-shell mx-auto w-full max-w-[1440px] space-y-6 p-4 md:p-6">
      <Ww360PageHero
        eyebrow="Administration"
        title="Users & access"
        description="WW360 local accounts. AquaSafe IdP handoff will map into these roles later."
        dataMode="live"
        actions={
          isPlatformAdmin ? (
            <Button
              variant="outline"
              size="sm"
              className="border-white/20 bg-white/5 text-white hover:bg-white/15 min-h-[44px] md:min-h-9"
              onClick={load}
              disabled={loading}
            >
              Reload
            </Button>
          ) : null
        }
      />

      {error && (
        <p className="text-sm text-amber-800 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          {error}
        </p>
      )}

      <Tabs defaultValue="accounts" onValueChange={v => v === 'audit' && loadAudit()}>
        <TabsList className="min-h-[44px] text-base">
          <TabsTrigger value="accounts" className="text-base px-4 py-2">
            Accounts
          </TabsTrigger>
          <TabsTrigger value="audit" className="text-base px-4 py-2">
            Impersonation audit
          </TabsTrigger>
        </TabsList>
        <TabsContent value="accounts">
      <Ww360Section tourId="admin-users" title="Accounts">
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map(user => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="font-medium">{user.full_name || user.username}</div>
                      <div className="text-xs text-slate-500 font-mono">{user.username}</div>
                      {user.email ? (
                        <div className="text-xs text-slate-500">{user.email}</div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {ROLE_PRESETS.map(role => {
                          const on = user.roles.includes(role);
                          return (
                            <button
                              key={role}
                              type="button"
                              disabled={!isPlatformAdmin || busyId === user.id}
                              onClick={() => void toggleRole(user, role)}
                              className={`rounded-full border px-2 py-0.5 text-[11px] min-h-[44px] md:min-h-0 ${
                                on
                                  ? 'bg-sky-50 border-sky-200 text-sky-900'
                                  : 'bg-white border-slate-200 text-slate-400'
                              }`}
                            >
                              {role}
                            </button>
                          );
                        })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`text-xs font-medium ${
                          user.is_active ? 'text-emerald-700' : 'text-slate-400'
                        }`}
                      >
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-h-[44px] md:min-h-9"
                        disabled={!isPlatformAdmin || busyId === user.id}
                        onClick={() => void toggleActive(user)}
                      >
                        {user.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!users.length && !loading && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-sm text-slate-500">
                      No users found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </Ww360Section>
        </TabsContent>
        <TabsContent value="audit">
          <Ww360Section title="Impersonation sessions">
            {auditLoading ? (
              <p className="text-base text-slate-500">Loading audit log…</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Started</TableHead>
                      <TableHead>Actor</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Persona</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditSessions.map(s => (
                      <TableRow key={s.id}>
                        <TableCell className="text-base">{s.started_at}</TableCell>
                        <TableCell className="font-mono text-sm">#{s.actor_user_id}</TableCell>
                        <TableCell className="font-mono text-sm">#{s.target_user_id}</TableCell>
                        <TableCell>{s.mode}</TableCell>
                        <TableCell>{s.persona_key || '—'}</TableCell>
                        <TableCell className="max-w-xs truncate">{s.reason || '—'}</TableCell>
                      </TableRow>
                    ))}
                    {!auditSessions.length && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-base text-slate-500">
                          No impersonation sessions recorded yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </Ww360Section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
