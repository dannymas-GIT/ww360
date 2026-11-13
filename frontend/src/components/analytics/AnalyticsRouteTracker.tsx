import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { initGa4, isPublicPath, trackPageView } from '@/lib/ga4';

/**
 * Fire GA4 page_view on public SPA routes only (government-facing policy).
 * Do not mount inside authenticated shells — authenticated paths are skipped
 * even if this component is present.
 */
export function AnalyticsRouteTracker() {
  const location = useLocation();

  useEffect(() => {
    initGa4();
  }, []);

  useEffect(() => {
    const path = location.pathname;
    if (!isPublicPath(path)) return;
    trackPageView(path);
  }, [location.pathname]);

  return null;
}
