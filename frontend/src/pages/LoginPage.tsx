import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getWw360LogoPath, WW360_LOGO_SIZE } from '@/utils/brandHost';
import {
  completeSsoCallback,
  fetchSsoProviders,
  getSsoAuthUrl,
  SSO_PENDING_KEY,
  type SsoProviderId,
} from '@/services/authService';

export default function LoginPage() {
  const { login, isAuthenticated, loading, applySessionUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [ssoBusy, setSsoBusy] = useState<SsoProviderId | null>(null);
  const [ssoProviders, setSsoProviders] = useState<Array<{ id: SsoProviderId; label: string }>>([]);
  const ssoHandled = useRef(false);

  const from = (location.state as { from?: { pathname?: string } })?.from?.pathname || '/dashboard';

  useEffect(() => {
    void fetchSsoProviders().then(setSsoProviders);
  }, []);

  // Complete Microsoft / Google SSO return (?code= on /login).
  useEffect(() => {
    if (ssoHandled.current || loading) return;
    const code = params.get('code');
    if (!code) return;
    const raw = sessionStorage.getItem(SSO_PENDING_KEY);
    if (!raw) return;
    ssoHandled.current = true;
    let pending: { provider: SsoProviderId; redirectUri: string; returnTo?: string };
    try {
      pending = JSON.parse(raw) as typeof pending;
    } catch {
      return;
    }
    sessionStorage.removeItem(SSO_PENDING_KEY);
    const next = new URLSearchParams(params);
    next.delete('code');
    next.delete('state');
    next.delete('session_state');
    next.delete('error');
    next.delete('error_description');
    setParams(next, { replace: true });
    setSsoBusy(pending.provider);
    setError('');
    void completeSsoCallback({
      provider: pending.provider,
      code,
      redirectUri: pending.redirectUri,
      state: params.get('state') ?? undefined,
    })
      .then(data => {
        applySessionUser(data.user);
        navigate(pending.returnTo || from, { replace: true });
      })
      .catch(err => {
        const detail =
          (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
          'SSO sign-in failed';
        setError(typeof detail === 'string' ? detail : 'SSO sign-in failed');
      })
      .finally(() => setSsoBusy(null));
  }, [applySessionUser, from, loading, navigate, params, setParams]);

  const startSso = useCallback(
    async (provider: SsoProviderId) => {
      setError('');
      setSsoBusy(provider);
      try {
        const redirectUri = `${window.location.origin}/login`;
        const state = `sso|${provider}|${Date.now()}`;
        sessionStorage.setItem(
          SSO_PENDING_KEY,
          JSON.stringify({ provider, redirectUri, returnTo: from })
        );
        const { auth_url } = await getSsoAuthUrl(provider, redirectUri, state);
        window.location.href = auth_url;
      } catch {
        sessionStorage.removeItem(SSO_PENDING_KEY);
        setError('Could not start SSO. Check that Microsoft/Google OAuth is configured.');
        setSsoBusy(null);
      }
    },
    [from]
  );

  if (!loading && isAuthenticated && !params.get('code')) {
    return <Navigate to={from} replace />;
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(username, password);
    } catch {
      setError('Invalid username or password');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{
        backgroundImage: 'linear-gradient(rgba(7,17,31,0.85), rgba(7,17,31,0.92)), url(/workforce-360-login-bg.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white/95 shadow-xl p-8">
        <div className="flex flex-col items-center mb-8">
          <img
            src={getWw360LogoPath('light')}
            alt="Water Workforce 360"
            className="mb-6 w-auto max-w-[min(100%,360px)] object-contain"
            style={{
              height: 'auto',
              maxHeight: WW360_LOGO_SIZE.loginPx,
              minHeight: WW360_LOGO_SIZE.navMinPx,
            }}
          />
          <h1 className="text-xl font-semibold text-[#07111f]">Sign in to Water Workforce 360</h1>
          <p className="text-sm text-slate-500 mt-1 text-center">One Water Workforce program workspace</p>
        </div>

        {ssoProviders.length > 0 ? (
          <div className="mb-6 space-y-2" data-testid="sso-buttons">
            {ssoProviders.map(p => (
              <Button
                key={p.id}
                type="button"
                variant="outline"
                className="w-full border-slate-300"
                disabled={!!ssoBusy || submitting}
                onClick={() => void startSso(p.id)}
                data-testid={`sso-${p.id}`}
              >
                {ssoBusy === p.id
                  ? `Continuing with ${p.label}…`
                  : `Continue with ${p.label}`}
              </Button>
            ))}
            <p className="text-center text-[11px] text-slate-500">
              Microsoft or Google sign-in also connects Document Studio to your cloud drive.
            </p>
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center" aria-hidden>
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase tracking-wide">
                <span className="bg-white px-2 text-slate-400">or</span>
              </div>
            </div>
          </div>
        ) : null}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              autoComplete="username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full bg-[#2563eb]" disabled={submitting || !!ssoBusy}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
        <p className="mt-6 text-center text-xs text-slate-500">
          <Link to="/" className="text-[#2563eb] hover:underline">
            Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
