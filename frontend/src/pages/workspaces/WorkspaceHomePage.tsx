import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { useKitchenSink } from '@/context/KitchenSinkContext';
import { personaKeyFromUser, resolveWorkspaceProfile } from '@/utils/workspaceProfile';
import { resolveLandingKind } from '@/utils/resolveLandingKind';
import OwwExecutiveDashboard from '@/pages/oww/OwwExecutiveDashboard';
import DistrictDashboardPage from '@/pages/district/DistrictDashboardPage';
import OperatorHomePage from '@/pages/district/OperatorHomePage';
import { SimplifiedWorkspaceDashboard } from './SimplifiedWorkspaceDashboard';
import { OpCertProgramPanel } from '@/components/regulator/OpCertProgramPanel';

/** Routes authenticated users to the correct workspace dashboard. */
export default function WorkspaceHomePage() {
  const { user } = useAuth();
  const { kitchenSink, personaKey } = useKitchenSink();
  const key = personaKey ?? personaKeyFromUser(user);
  const profile = resolveWorkspaceProfile(user, key);
  const kind = resolveLandingKind(user);

  if (kind === 'operator') {
    return <OperatorHomePage />;
  }

  if (kind === 'district') {
    if (!kitchenSink) {
      return <SimplifiedWorkspaceDashboard profile="utility" personaKey={key} />;
    }
    return <DistrictDashboardPage />;
  }

  if (!kitchenSink) {
    return (
      <div className="space-y-6">
        <SimplifiedWorkspaceDashboard profile={profile} personaKey={key} />
        {profile === 'regulator' && (
          <div className="mx-auto max-w-[1440px] px-4 pb-6 md:px-6">
            <OpCertProgramPanel />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-0">
      <OwwExecutiveDashboard />
      {profile === 'regulator' && (
        <div className="mx-auto max-w-[1440px] px-4 pb-6 md:px-6">
          <OpCertProgramPanel />
        </div>
      )}
    </div>
  );
}
