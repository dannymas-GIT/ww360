import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

type EntitlementInfo = {
  status?: string;
  access_mode?: string;
  allows_write?: boolean;
  allows_read?: boolean;
  grace_until?: string | null;
};

export const EntitlementGraceBanner: React.FC = () => {
  const { user } = useAuth();
  const ent = (user as { entitlement?: EntitlementInfo } | null)?.entitlement;
  if (!ent) return null;

  const mode = ent.access_mode || 'none';
  if (mode !== 'grace' && mode !== 'readonly') return null;

  if (mode === 'grace') {
    const until = ent.grace_until
      ? new Date(ent.grace_until).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      : 'soon';
    return (
      <div
        role="status"
        className="sticky top-0 z-40 border-b border-amber-700/40 bg-amber-100 px-4 py-3 text-amber-950"
      >
        <p className="text-lg leading-relaxed">
          Membership payment is past due. Full access continues until <strong>{until}</strong>.
          Please ask your billing contact to update payment with One Water Workforce.
        </p>
      </div>
    );
  }

  return (
    <div
      role="status"
      className="sticky top-0 z-40 border-b border-slate-400/50 bg-slate-200 px-4 py-3 text-slate-900"
    >
      <p className="text-lg leading-relaxed">
        Membership is read-only. You can still export CEU, DOH-352, and SOP records for 90 days —
        compliance history is never wiped.{' '}
        <Link
          to="/continuity"
          className="inline-flex min-h-[44px] items-center text-base font-semibold text-sky-800 underline underline-offset-2"
        >
          Open Continuity exports
        </Link>
      </p>
    </div>
  );
};
