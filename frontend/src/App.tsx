import React, { Suspense, lazy } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { AppShell } from '@/components/ww360/AppShell';
import LoginPage from '@/pages/LoginPage';
import HandoffPage from '@/pages/HandoffPage';
import Workforce360Landing from '@/pages/workforce360/Workforce360Landing';
import OwwExecutiveDashboard from '@/pages/oww/OwwExecutiveDashboard';
import WorkforceContinuityPage from '@/pages/WorkforceContinuityPage';
import SdwisLandscapePage from '@/pages/sdwis/SdwisLandscapePage';
import SdwisWatchlistPage from '@/pages/sdwis/SdwisWatchlistPage';
import SdwisLookupPage from '@/pages/sdwis/SdwisLookupPage';
import SdwisCompliancePage from '@/pages/sdwis/SdwisCompliancePage';
import AdminPwsidLinksPage from '@/pages/admin/AdminPwsidLinksPage';
import AdminUsersPage from '@/pages/admin/AdminUsersPage';
import AdminSettingsPage from '@/pages/admin/AdminSettingsPage';

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

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Workforce360Landing />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/handoff" element={<HandoffPage />} />
      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<OwwExecutiveDashboard />} />
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
        <Route path="/admin/pwsid-links" element={<AdminPwsidLinksPage />} />
        <Route path="/admin/users" element={<AdminUsersPage />} />
        <Route path="/admin/settings" element={<AdminSettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
