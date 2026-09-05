import React, { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getWw360LogoPath, WW360_LOGO_SIZE } from '@/utils/brandHost';
import { Ww360PoweredBy } from '@/components/ww360/Ww360PoweredBy';

export default function LoginPage() {
  const { login, isAuthenticated, loading } = useAuth();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const from = (location.state as { from?: { pathname?: string } })?.from?.pathname || '/dashboard';

  if (!loading && isAuthenticated) {
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
            alt="Workforce 360"
            className="mb-2 w-auto max-w-[min(100%,360px)] object-contain"
            style={{
              height: 'auto',
              maxHeight: WW360_LOGO_SIZE.loginPx,
              minHeight: WW360_LOGO_SIZE.navMinPx,
            }}
          />
          <Ww360PoweredBy surface="light" className="mb-4" />
          <h1 className="text-xl font-semibold text-[#07111f]">Sign in to Workforce 360</h1>
          <p className="text-sm text-slate-500 mt-1 text-center">One Water Workforce program workspace</p>
        </div>
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
          <Button type="submit" className="w-full bg-[#2563eb]" disabled={submitting}>
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
