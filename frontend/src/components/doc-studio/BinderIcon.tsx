/**
 * Simple 3-ring binder icon — matches the physical-binder mental model users
 * bring to Document Studio (spine on the left, three rings, pages inside).
 */
export function BinderIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {/* Cover */}
      <rect x="4" y="3" width="16" height="18" rx="2" />
      {/* Spine */}
      <line x1="8.5" y1="3" x2="8.5" y2="21" />
      {/* Rings */}
      <circle cx="8.5" cy="7" r="1.4" />
      <circle cx="8.5" cy="12" r="1.4" />
      <circle cx="8.5" cy="17" r="1.4" />
      {/* Page lines */}
      <line x1="12" y1="8" x2="17" y2="8" />
      <line x1="12" y1="12" x2="17" y2="12" />
    </svg>
  );
}
