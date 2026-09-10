import React, { Suspense, lazy } from 'react';
import { Navigate, Route, Routes, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { JurisdictionProvider, PublicJurisdictionProvider } from '@/context/JurisdictionContext';
import { AppShell } from '@/components/ww360/AppShell';
import { AnalyticsRouteTracker } from '@/components/analytics/AnalyticsRouteTracker';
import LoginPage from '@/pages/LoginPage';
import HandoffPage from '@/pages/HandoffPage';
import Workforce360Landing from '@/pages/workforce360/Workforce360Landing';
import OwwExecutiveDashboard from '@/pages/oww/OwwExecutiveDashboard';
import DistrictDashboardPage from '@/pages/district/DistrictDashboardPage';
import OperatorHomePage from '@/pages/district/OperatorHomePage';
import DigitalReachPage from '@/pages/analytics/DigitalReachPage';
import WorkforceContinuityPage from '@/pages/WorkforceContinuityPage';
import SdwisLandscapePage from '@/pages/sdwis/SdwisLandscapePage';
import SdwisWatchlistPage from '@/pages/sdwis/SdwisWatchlistPage';
import SdwisLookupPage from '@/pages/sdwis/SdwisLookupPage';
import SdwisCompliancePage from '@/pages/sdwis/SdwisCompliancePage';
import SdwisAnalysisPage from '@/pages/sdwis/SdwisAnalysisPage';
import AdminPwsidLinksPage from '@/pages/admin/AdminPwsidLinksPage';
import AdminUsersPage from '@/pages/admin/AdminUsersPage';
import AdminSettingsPage from '@/pages/admin/AdminSettingsPage';
import AdminJurisdictionsPage from '@/pages/admin/AdminJurisdictionsPage';
import { resolveLandingKind } from '@/utils/resolveLandingKind';

// Document Studio carries the TipTap editor bundle — load it only when visited.
const DocumentStudioPage = lazy(() => import('@/pages/studio/DocumentStudioPage'));

function StudioFallback() {
  return (
    <div className="flex h-full min-h-[50vh] items-center justify-center text-sm text-slate-500">
      Loading Document Studio…
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#EEF3F9] text-slate-600">
        Loading…
      </div>
    );
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <>{children}</>;
}

function RoleLanding() {
  const { user, loading } = useAuth();
  if (loading || !user) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500">
        Loading your workspace…
      </div>
    );
  }
  const kind = resolveLandingKind(user);
  if (kind === 'operator') return <OperatorHomePage />;
  if (kind === 'district') return <DistrictDashboardPage />;
  return <OwwExecutiveDashboard />;
}

function LandingRoute() {
  const [params] = useSearchParams();
  const state = (params.get('state') || 'NY').toUpperCase().slice(0, 2);
  return (
    <PublicJurisdictionProvider stateCode={state}>
      <Workforce360Landing />
    </PublicJurisdictionProvider>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingRoute />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/handoff" element={<HandoffPage />} />
      <Route
        element={
          <ProtectedRoute>
            <JurisdictionProvider>
              <AnalyticsRouteTracker />
              <AppShell />
            </JurisdictionProvider>
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<RoleLanding />} />
        <Route path="/analytics" element={<DigitalReachPage />} />
        <Route path="/continuity" element={<WorkforceContinuityPage workspace="continuity" />} />
        <Route
          path="/continuity/ceu-training"
          element={<WorkforceContinuityPage workspace="ceu_training" />}
        />
        <Route path="/water-systems" element={<SdwisLandscapePage />} />
        <Route path="/water-systems/watchlist" element={<SdwisWatchlistPage />} />
        <Route path="/water-systems/lookup" element={<SdwisLookupPage />} />
        <Route path="/water-systems/compliance" element={<SdwisCompliancePage />} />
        <Route path="/water-systems/analysis" element={<SdwisAnalysisPage />} />
        <Route
          path="/studio"
          element={
            <Suspense fallback={<StudioFallback />}>
              <DocumentStudioPage />
            </Suspense>
          }
        />
        <Route path="/admin/pwsid-links" element={<AdminPwsidLinksPage />} />
        <Route path="/admin/users" element={<AdminUsersPage />} />
        <Route path="/admin/jurisdictions" element={<AdminJurisdictionsPage />} />
        <Route path="/admin/settings" element={<AdminSettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
