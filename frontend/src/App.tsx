import React from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { AppShell } from '@/components/ww360/AppShell';
import LoginPage from '@/pages/LoginPage';
import HandoffPage from '@/pages/HandoffPage';
import Workforce360Landing from '@/pages/workforce360/Workforce360Landing';
import OwwExecutiveDashboard from '@/pages/oww/OwwExecutiveDashboard';
import WorkforceContinuityPage from '@/pages/WorkforceContinuityPage';
import SdwisLandscapePage from '@/pages/sdwis/SdwisLandscapePage';
import AdminPwsidLinksPage from '@/pages/admin/AdminPwsidLinksPage';

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
        <Route path="/continuity/*" element={<WorkforceContinuityPage />} />
        <Route path="/water-systems" element={<SdwisLandscapePage />} />
        <Route path="/water-systems/watchlist" element={<SdwisLandscapePage />} />
        <Route path="/water-systems/lookup" element={<SdwisLandscapePage />} />
        <Route path="/admin/pwsid-links" element={<AdminPwsidLinksPage />} />
        <Route path="/admin/users" element={<div className="p-8">Users & access — coming soon</div>} />
        <Route path="/admin/settings" element={<div className="p-8">Settings — coming soon</div>} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
