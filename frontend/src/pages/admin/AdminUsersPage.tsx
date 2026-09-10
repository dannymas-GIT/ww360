import { useEffect, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { Ww360PageHero } from '@/components/ww360/Ww360PageHero';
import { Ww360Section } from '@/components/ww360/Ww360Section';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/context/AuthContext';
import {
  fetchAdminUsers,
  patchAdminUser,
  resetAdminUserPassword,
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
  const [passwordUser, setPasswordUser] = useState<AdminUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

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

  const openPasswordReset = (user: AdminUser) => {
    setPasswordUser(user);
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError(null);
    setPasswordSuccess(null);
  };

  const closePasswordReset = () => {
    if (passwordBusy) return;
    setPasswordUser(null);
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError(null);
  };

  const submitPasswordReset = async () => {
    if (!passwordUser) return;
    const pwd = newPassword.trim();
    if (pwd.length < 8) {
      setPasswordError('Password must be at least 8 characters.');
      return;
    }
    if (pwd !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }
    setPasswordBusy(true);
    setPasswordError(null);
    try {
      await resetAdminUserPassword(passwordUser.id, pwd);
      setPasswordSuccess(`Password updated for ${passwordUser.username}.`);
      setPasswordUser(null);
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      setPasswordError('Failed to reset password. Confirm you are signed in as platform admin.');
    } finally {
      setPasswordBusy(false);
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
        <p className="text-base text-amber-800 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          {error}
        </p>
      )}
      {passwordSuccess && (
        <p className="text-base text-emerald-800 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
          {passwordSuccess}
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
              <p className="text-base text-slate-500">Loading…</p>
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
                          <div className="font-medium text-base">{user.full_name || user.username}</div>
                          <div className="text-sm text-slate-500 font-mono">{user.username}</div>
                          {user.email ? (
                            <div className="text-sm text-slate-500">{user.email}</div>
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
                                  className={`rounded-full border px-2 py-0.5 text-sm min-h-[44px] md:min-h-0 ${
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
                            className={`text-sm font-medium ${
                              user.is_active ? 'text-emerald-700' : 'text-slate-400'
                            }`}
                          >
                            {user.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex flex-wrap justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="min-h-[44px] md:min-h-9 text-base"
                              disabled={!isPlatformAdmin || busyId === user.id}
                              onClick={() => openPasswordReset(user)}
                              title="Reset password"
                            >
                              <KeyRound className="mr-1.5 h-4 w-4" aria-hidden />
                              Password
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="min-h-[44px] md:min-h-9 text-base"
                              disabled={!isPlatformAdmin || busyId === user.id}
                              onClick={() => void toggleActive(user)}
                            >
                              {user.is_active ? 'Deactivate' : 'Activate'}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!users.length && !loading && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-base text-slate-500">
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

      <Dialog open={!!passwordUser} onOpenChange={open => (!open ? closePasswordReset() : null)}>
        <DialogContent className="max-w-md text-base">
          <DialogHeader>
            <DialogTitle className="text-[1.25rem]">Reset password</DialogTitle>
            <DialogDescription className="text-[1.125rem] leading-relaxed">
              Set a new password for{' '}
              <span className="font-semibold text-slate-800">
                {passwordUser?.full_name || passwordUser?.username}
              </span>{' '}
              ({passwordUser?.username}). Share it with them out of band — it is not emailed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {passwordError ? (
              <p className="text-base text-red-700 rounded-md border border-red-200 bg-red-50 px-3 py-2">
                {passwordError}
              </p>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="admin-new-password" className="text-base">
                New password
              </Label>
              <Input
                id="admin-new-password"
                type="password"
                autoComplete="new-password"
                className="text-base min-h-[44px]"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-confirm-password" className="text-base">
                Confirm password
              </Label>
              <Input
                id="admin-confirm-password"
                type="password"
                autoComplete="new-password"
                className="text-base min-h-[44px]"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                minLength={8}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] text-base"
              onClick={closePasswordReset}
              disabled={passwordBusy}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="min-h-[44px] text-base"
              onClick={() => void submitPasswordReset()}
              disabled={passwordBusy}
            >
              {passwordBusy ? 'Saving…' : 'Reset password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
