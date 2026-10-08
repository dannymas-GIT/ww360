import React, { useEffect, useState } from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/dashboard';
  return raw;
}

export default function HandoffPage() {
  const [params] = useSearchParams();
  const location = useLocation();
  const code = params.get('code') || '';
  const next = safeNextPath(params.get('next'));
  const { redeemHandoffCode, redeemOwwHandoffCode, isAuthenticated } = useAuth();
  const [error, setError] = useState('');
  const fromOww = location.pathname.includes('/auth/oww');

  useEffect(() => {
    if (!code) {
      setError('Missing handoff code');
      return;
    }
    const redeem = fromOww ? redeemOwwHandoffCode : redeemHandoffCode;
    void redeem(code).catch(() =>
      setError(
        fromOww
          ? 'Handoff failed — code may be expired or payment is required'
          : 'Handoff failed — code may be expired'
      )
    );
  }, [code, fromOww, redeemHandoffCode, redeemOwwHandoffCode]);

  if (isAuthenticated) {
    return <Navigate to={next} replace />;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#EEF3F9]">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#EEF3F9] text-slate-600">
      Completing sign-in…
    </div>
  );
}
