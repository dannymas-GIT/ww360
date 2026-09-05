import React, { useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

export default function HandoffPage() {
  const [params] = useSearchParams();
  const code = params.get('code') || '';
  const { redeemHandoffCode, isAuthenticated } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    if (!code) {
      setError('Missing handoff code');
      return;
    }
    void redeemHandoffCode(code).catch(() => setError('Handoff failed — code may be expired'));
  }, [code, redeemHandoffCode]);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
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
