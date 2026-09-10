/**
 * Profile — account details + self-service password change (AquaSafe-style).
 */
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { User } from 'lucide-react';
import { Ww360PageHero } from '@/components/ww360/Ww360PageHero';
import { Ww360Section } from '@/components/ww360/Ww360Section';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/AuthContext';
import { changePassword } from '@/services/authService';
import { userDisplayName } from '@/components/ww360/ww360Greeting';

function roleLabel(role: string): string {
  return role.replace(/_/g, ' ');
}

function apiErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const detail = (err as { response?: { data?: { detail?: unknown } } }).response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg);
  }
  if (err instanceof Error) return err.message;
  return 'Could not update password.';
}

export default function ProfilePage() {
  const { user } = useAuth();
  const location = useLocation();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (location.hash !== '#password') return;
    const el = document.getElementById('password');
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [location.hash]);

  const impersonating = Boolean(user?.impersonation?.active);
  const roles = user?.roles ?? [];
  const districts = user?.districts ?? [];
  const orgs = user?.orgs ?? [];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const next = newPassword.trim();
    const confirm = confirmPassword.trim();
    if (next.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (next !== confirm) {
      setError('New password and confirmation do not match.');
      return;
    }
    if (impersonating) {
      setError('Exit impersonation before changing your password.');
      return;
    }
    setBusy(true);
    try {
      await changePassword({
        current_password: currentPassword,
        new_password: next,
        confirm_password: confirm,
      });
      setSuccess('Password updated. Use the new password the next time you sign in.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ww360-app-shell mx-auto w-full max-w-[720px] space-y-6 p-4 md:p-6">
      <Ww360PageHero
        eyebrow="Account"
        title="Profile"
        description="Manage your Water Workforce 360 account and login password."
        dataMode="live"
      />

      <Ww360Section tourId="profile-account" title="Account">
        {!user ? (
          <p className="text-[1.125rem] text-slate-600">Loading account information…</p>
        ) : (
          <dl className="space-y-3 text-[1.125rem]">
            <div className="flex flex-wrap justify-between gap-2 border-b border-slate-100 pb-3">
              <dt className="text-slate-600">Name</dt>
              <dd className="font-medium text-slate-900">{userDisplayName(user)}</dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2 border-b border-slate-100 pb-3">
              <dt className="text-slate-600">Username</dt>
              <dd className="font-mono text-base text-slate-900">{user.username}</dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2 border-b border-slate-100 pb-3">
              <dt className="text-slate-600">Email</dt>
              <dd className="text-slate-900">{user.email || '—'}</dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2 border-b border-slate-100 pb-3">
              <dt className="text-slate-600">Roles</dt>
              <dd className="text-right capitalize text-slate-900">
                {roles.length ? roles.map(roleLabel).join(', ') : '—'}
              </dd>
            </div>
            {districts.length ? (
              <div className="flex flex-wrap justify-between gap-2 border-b border-slate-100 pb-3">
                <dt className="text-slate-600">Districts</dt>
                <dd className="text-right text-slate-900">{districts.join(', ')}</dd>
              </div>
            ) : null}
            {orgs.length ? (
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-slate-600">Organizations</dt>
                <dd className="text-right text-slate-900">
                  {orgs.map(o => o.name || o.org_code).join(', ')}
                </dd>
              </div>
            ) : null}
            {user.active_state_code ? (
              <div className="flex flex-wrap justify-between gap-2 border-t border-slate-100 pt-3">
                <dt className="text-slate-600">Active state</dt>
                <dd className="font-medium text-slate-900">{user.active_state_code}</dd>
              </div>
            ) : null}
          </dl>
        )}
      </Ww360Section>

      <div id="password" className="scroll-mt-24">
        <Ww360Section tourId="profile-password" title="Password">
          <p className="mb-4 text-[1.125rem] leading-relaxed text-slate-600">
            Update the password you use to sign in to Water Workforce 360.
          </p>
          {impersonating ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[1.125rem] text-amber-900">
              You are viewing as another persona. Exit impersonation to change your own password.
            </p>
          ) : (
            <form onSubmit={e => void submit(e)} className="space-y-4 max-w-md">
              {error ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-base text-red-800">
                  {error}
                </p>
              ) : null}
              {success ? (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-base text-emerald-800">
                  {success}
                </p>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="current-password" className="text-base">
                  Current password
                </Label>
                <Input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  className="min-h-[44px] text-base"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-base">
                  New password
                </Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  className="min-h-[44px] text-base"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  minLength={8}
                  required
                />
                <p className="text-sm text-slate-500">At least 8 characters.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-base">
                  Confirm new password
                </Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  className="min-h-[44px] text-base"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  minLength={8}
                  required
                />
              </div>
              <Button type="submit" className="min-h-[44px] text-base" disabled={busy}>
                {busy ? 'Saving…' : 'Update password'}
              </Button>
            </form>
          )}
        </Ww360Section>
      </div>

      <p className="flex items-center gap-2 text-sm text-slate-500">
        <User className="h-4 w-4" aria-hidden />
        Signed in as {user?.username || '…'}
      </p>
    </div>
  );
}
