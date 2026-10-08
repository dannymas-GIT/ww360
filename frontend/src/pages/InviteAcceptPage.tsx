import { FormEvent, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/AuthContext';
import { API_BASE_URL } from '@/lib/constants';
import { AUTH_TOKEN_KEY } from '@/services/authService';

export default function InviteAcceptPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const { isAuthenticated, applySessionUser } = useAuth();
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (!token) {
      setError('Missing invite token');
      return;
    }
    setBusy(true);
    try {
      const { data } = await axios.post(`${API_BASE_URL}/auth/invite/accept`, {
        token,
        username,
        password,
        full_name: fullName || undefined,
      });
      localStorage.setItem(AUTH_TOKEN_KEY, data.access_token);
      applySessionUser(data.user);
    } catch {
      setError('Invite could not be accepted. It may be expired or already used.');
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#EEF3F9] p-6">
      <form
        onSubmit={e => void onSubmit(e)}
        className="w-full max-w-md space-y-4 rounded-xl border bg-white p-6 shadow-sm"
      >
        <h1 className="text-2xl font-semibold text-slate-900">Accept invitation</h1>
        <p className="text-base text-slate-600">Create your Water Workforce 360 account.</p>
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
            minLength={3}
            className="min-h-[44px] text-base"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fullName">Full name</Label>
          <Input
            id="fullName"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            className="min-h-[44px] text-base"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={8}
            className="min-h-[44px] text-base"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm password</Label>
          <Input
            id="confirm"
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            required
            minLength={8}
            className="min-h-[44px] text-base"
          />
        </div>
        {error ? <p className="text-base text-red-600">{error}</p> : null}
        <Button type="submit" disabled={busy} className="min-h-[44px] w-full text-base">
          {busy ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </div>
  );
}
