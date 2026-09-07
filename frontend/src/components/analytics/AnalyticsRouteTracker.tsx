import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { initGa4, trackPageView } from '@/lib/ga4';

/** Fire GA4 page_view on SPA route changes (authenticated app). */
export function AnalyticsRouteTracker() {
  const location = useLocation();

  useEffect(() => {
    initGa4();
  }, []);

  useEffect(() => {
    const path = `${location.pathname}${location.search}${location.hash}`;
    trackPageView(path);
  }, [location.pathname, location.search, location.hash]);

  return null;
}
