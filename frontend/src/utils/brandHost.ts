import { MODULE_CORE, MODULE_WORKFORCE } from '@/services/authService';

/** Hostnames that activate Workforce Continuity branding (login chrome, logos, nav). */
const WORKFORCE_HOSTS = [
  'workforce-continuity.org',
  'waterworkforce360.org',
  'ww360.aquasafe-solutions.us',
] as const;
const WATERWORKFORCE360_HOSTS = ['waterworkforce360.org', 'ww360.aquasafe-solutions.us'] as const;
const DEV_OVERRIDE_KEY = 'dev_workforce_host';

const WORKFORCE_360_FAVICON = '/workforce-360-favicon.png';
const WORKFORCE_CONTINUITY_FAVICON = '/workforce-continuity-favicon.png';
const AQUASAFE_FAVICON = '/aquasafe-favicon.svg';

/**
 * Workforce 360 lockup sizes — brand must PREDOMINATE its row (nav / hero / login).
 * Never ship favicon-scale marks in chrome. Clear space ≥ 0.25× rendered height.
 * Floors are intentional; do not “tighten” for denser nav without an explicit brand review.
 */
export const WW360_LOGO_SIZE = {
  /** Sticky / app chrome — absolute floor (wordmark + AquaSafe tagline still readable) */
  navMinPx: 120,
  /** Preferred sticky-nav / expanded sidebar height */
  navPx: 148,
  /** Marketing hero / stage lockup — hero-level signal, not a caption mark */
  heroPx: 260,
  /** Login card / split-panel column */
  loginPx: 320,
  /** Separate "Powered by AquaSafe" caption (px) — do not shrink below this */
  poweredByMinPx: 18,
} as const;

export type BrandLogoSurface = 'light' | 'dark';

function hostnameMatchesSuffix(hostname: string, suffixes: readonly string[]): boolean {
  const host = hostname.toLowerCase();
  return suffixes.some(suffix => host === suffix || host.endsWith(`.${suffix}`));
}

function hostnameMatchesWorkforceHost(hostname: string): boolean {
  return hostnameMatchesSuffix(hostname, WORKFORCE_HOSTS);
}

/** True when the app is served on the Workforce 360 public domain. */
export function isWaterWorkforce360Host(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  // Dev override uses the same WC host switch; prefer 360 branding there.
  if (isWorkforceHost()) {
    if (import.meta.env.DEV && localStorage.getItem(DEV_OVERRIDE_KEY) === '1') {
      return true;
    }
    return hostnameMatchesSuffix(window.location.hostname, WATERWORKFORCE360_HOSTS);
  }
  return false;
}

/** True when the app is served on a Workforce Continuity public domain. */
export function isWorkforceHost(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  if (import.meta.env.DEV) {
    const params = new URLSearchParams(window.location.search);
    if (params.get('workforceHost') === '1') {
      localStorage.setItem(DEV_OVERRIDE_KEY, '1');
    }
    if (params.get('workforceHost') === '0') {
      localStorage.removeItem(DEV_OVERRIDE_KEY);
    }
    if (localStorage.getItem(DEV_OVERRIDE_KEY) === '1') {
      return true;
    }
  }

  return hostnameMatchesWorkforceHost(window.location.hostname);
}

/** Host-only WC skin (login chrome, header logo). District CEU users on AquaSafe stay AquaSafe-branded. */
export function isWorkforceBrand(): boolean {
  return isWorkforceHost();
}

export function getWorkforcePublicOrigin(): string {
  const fromEnv = import.meta.env.VITE_WORKFORCE_PUBLIC_ORIGIN;
  if (typeof fromEnv === 'string' && fromEnv.trim()) {
    return fromEnv.replace(/\/$/, '');
  }
  // Stay on whichever workforce brand host the user already opened.
  if (typeof window !== 'undefined' && hostnameMatchesWorkforceHost(window.location.hostname)) {
    return window.location.origin.replace(/\/$/, '');
  }
  return 'https://waterworkforce360.org';
}

export function getAquasafePublicOrigin(): string {
  const fromEnv = import.meta.env.VITE_AQUASAFE_PUBLIC_ORIGIN;
  if (typeof fromEnv === 'string' && fromEnv.trim()) {
    return fromEnv.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined') {
    return window.location.origin.replace(/\/$/, '');
  }
  return 'https://staging.aquasafe-solutions.us';
}

export function getBrandTitle(): string {
  if (!isWorkforceBrand()) {
    return 'Aquasafe Solutions';
  }
  return isWaterWorkforce360Host() ? 'Workforce 360' : 'Workforce Continuity';
}

export function getBrandSubtitle(): string {
  if (!isWorkforceBrand()) {
    return 'Water District Management System';
  }
  return isWaterWorkforce360Host()
    ? 'Powered by AquaSafe'
    : 'Training & Succession Management';
}

export function getDocumentTitle(): string {
  if (!isWorkforceBrand()) {
    return 'AquaSafe';
  }
  return isWaterWorkforce360Host() ? 'Workforce 360' : 'Workforce Continuity';
}

/**
 * Brand lockup path.
 * @param forDarkSurface When true, return the on-dark (white/blue) mark for navy chrome.
 *   Historical callers used `light=true` to mean "logo for dark UI" — keep that boolean.
 */
export function getBrandLogoPath(forDarkSurface = false): string {
  if (!isWorkforceBrand()) {
    return '/aquasafe-logo.svg';
  }
  if (isWaterWorkforce360Host()) {
    return forDarkSurface
      ? '/workforce-360-logo-on-dark.png'
      : '/workforce-360-logo.png';
  }
  return forDarkSurface
    ? '/workforce-continuity-logo-dark.png'
    : '/workforce-continuity-logo.png';
}

/** Prefer this at WW360 call sites: surface = background behind the logo.
 *  - light → navy ink lockup (`workforce-360-logo.png`) for cream/white surfaces
 *  - dark  → white ink lockup (`workforce-360-logo-on-dark.png`) for navy/black chrome
 */
export function getWw360LogoPath(surface: BrandLogoSurface): string {
  return surface === 'dark'
    ? '/workforce-360-logo-on-dark.png'
    : '/workforce-360-logo.png';
}

export function getBrandFaviconPath(): string {
  if (!isWorkforceBrand()) {
    return AQUASAFE_FAVICON;
  }
  return isWaterWorkforce360Host() ? WORKFORCE_360_FAVICON : WORKFORCE_CONTINUITY_FAVICON;
}

/** Where this user should browse based on tenant modules (null = stay on current host). */
export function resolvePreferredBrandOrigin(
  modules: string[],
  isGlobalAdmin: boolean,
  isSystemAdmin: boolean
): string | null {
  if (isGlobalAdmin || isSystemAdmin) {
    return null;
  }

  const hasCore = modules.includes(MODULE_CORE);
  const hasWorkforce = modules.includes(MODULE_WORKFORCE);

  if (hasWorkforce && !hasCore) {
    return getWorkforcePublicOrigin();
  }
  if (hasCore && isWorkforceHost()) {
    return getAquasafePublicOrigin();
  }
  return null;
}

export function isOnWrongBrandHost(
  modules: string[],
  isGlobalAdmin: boolean,
  isSystemAdmin: boolean
): boolean {
  const preferred = resolvePreferredBrandOrigin(modules, isGlobalAdmin, isSystemAdmin);
  if (!preferred || typeof window === 'undefined') {
    return false;
  }
  return preferred.replace(/\/$/, '') !== window.location.origin.replace(/\/$/, '');
}

/** Swap document title and favicon when the WC host skin is active. */
export function applyBrandDocumentHead(): void {
  if (typeof document === 'undefined') {
    return;
  }
  document.title = getDocumentTitle();
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.type = isWorkforceBrand() ? 'image/png' : 'image/svg+xml';
  link.href = getBrandFaviconPath();
}
