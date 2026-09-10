/**
 * GA4 client instrumentation — loads only when VITE_GA4_MEASUREMENT_ID is set.
 * No PII in event params (paths and event names only).
 */

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const MEASUREMENT_ID = (import.meta.env.VITE_GA4_MEASUREMENT_ID as string | undefined)?.trim();

let initialized = false;

function ensureGtag(): boolean {
  if (!MEASUREMENT_ID || typeof window === 'undefined') return false;
  if (initialized && typeof window.gtag === 'function') return true;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer!.push(args);
  };
  window.gtag('js', new Date());
  window.gtag('config', MEASUREMENT_ID, { send_page_view: false });

  if (!document.getElementById('ww360-ga4-script')) {
    const script = document.createElement('script');
    script.id = 'ww360-ga4-script';
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(MEASUREMENT_ID)}`;
    document.head.appendChild(script);
  }

  initialized = true;
  return true;
}

export function isGa4Enabled(): boolean {
  return Boolean(MEASUREMENT_ID);
}

export function trackPageView(path: string, title?: string): void {
  if (!ensureGtag()) return;
  window.gtag!('event', 'page_view', {
    page_path: path,
    page_title: title || document.title,
    page_location: `${window.location.origin}${path}`,
  });
}

export function trackEvent(name: string, params?: Record<string, string | number | boolean>): void {
  if (!ensureGtag()) return;
  window.gtag!('event', name, params ?? {});
}

export function initGa4(): void {
  ensureGtag();
}
