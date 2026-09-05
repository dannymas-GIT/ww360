import type { BrandLogoSurface } from '@/utils/brandHost';
import { WW360_LOGO_SIZE } from '@/utils/brandHost';

/**
 * Large, high-contrast AquaSafe attribution — partners with low vision
 * should not rely on the tiny tagline baked into the logo PNG.
 */
export function Ww360PoweredBy({
  surface = 'dark',
  className = '',
}: {
  surface?: BrandLogoSurface;
  className?: string;
}) {
  const tone = surface === 'dark' ? 'text-slate-200' : 'text-slate-700';
  const brand = surface === 'dark' ? 'text-sky-300' : 'text-sky-700';

  return (
    <p
      className={`text-center font-semibold leading-snug tracking-wide ${tone} ${className}`}
      style={{ fontSize: `${WW360_LOGO_SIZE.poweredByMinPx}px` }}
    >
      Powered by <span className={`${brand} font-bold`}>AquaSafe</span>
    </p>
  );
}
