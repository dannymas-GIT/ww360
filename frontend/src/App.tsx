import React, { Suspense, lazy } from 'react';
import { Navigate, Route, Routes, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { JurisdictionProvider, PublicJurisdictionProvider } from '@/context/JurisdictionContext';
import { ImpersonationProvider } from '@/context/ImpersonationContext';
import { KitchenSinkProvider } from '@/context/KitchenSinkContext';
import { AppShell } from '@/components/ww360/AppShell';
import { AnalyticsRouteTracker } from '@/components/analytics/AnalyticsRouteTracker';
import LoginPage from '@/pages/LoginPage';
import HandoffPage from '@/pages/HandoffPage';
import Workforce360Landing from '@/pages/workforce360/Workforce360Landing';
import WorkspaceHomePage from '@/pages/workspaces/WorkspaceHomePage';
import DigitalReachPage from '@/pages/analytics/DigitalReachPage';
import WorkforceContinuityPage from '@/pages/WorkforceContinuityPage';
import SdwisLandscapePage from '@/pages/sdwis/SdwisLandscapePage';
import SdwisWatchlistPage from '@/pages/sdwis/SdwisWatchlistPage';
import SdwisLookupPage from '@/pages/sdwis/SdwisLookupPage';
import SdwisCompliancePage from '@/pages/sdwis/SdwisCompliancePage';
import AdminPwsidLinksPage from '@/pages/admin/AdminPwsidLinksPage';
import AdminUsersPage from '@/pages/admin/AdminUsersPage';
import AdminSettingsPage from '@/pages/admin/AdminSettingsPage';
import AdminJurisdictionsPage from '@/pages/admin/AdminJurisdictionsPage';
import NationalOverviewPage from '@/pages/national/NationalOverviewPage';
import StateScorecardPage from '@/pages/national/StateScorecardPage';
import JobOpeningsPage from '@/pages/jobs/JobOpeningsPage';

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

function DashboardRoute() {
  const { user, loading } = useAuth();
  if (loading || !user) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-[1.125rem] text-slate-500">
        Loading your workspace…
      </div>
    );
  }
  return <WorkspaceHomePage />;
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
              <ImpersonationProvider>
                <KitchenSinkProvider>
                  <AnalyticsRouteTracker />
                  <AppShell />
                </KitchenSinkProvider>
              </ImpersonationProvider>
            </JurisdictionProvider>
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardRoute />} />
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
        <Route
          path="/studio"
          element={
            <Suspense fallback={<StudioFallback />}>
              <DocumentStudioPage />
            </Suspense>
          }
        />
        <Route path="/national" element={<NationalOverviewPage />} />
        <Route path="/national/states/:st" element={<StateScorecardPage />} />
        <Route path="/jobs" element={<JobOpeningsPage />} />
        <Route path="/admin/pwsid-links" element={<AdminPwsidLinksPage />} />
        <Route path="/admin/users" element={<AdminUsersPage />} />
        <Route path="/admin/jurisdictions" element={<AdminJurisdictionsPage />} />
        <Route path="/admin/settings" element={<AdminSettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
