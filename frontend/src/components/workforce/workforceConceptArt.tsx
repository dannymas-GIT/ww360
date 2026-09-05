/**
 * Inline SVG concept illustrations for workforce planning areas.
 * Geometric style aligned with workforce-flow-map.svg phase palette.
 */
import type { ReactNode } from 'react';
import type { WorkforceEntityType } from '@/services/workforceSuccessionService';

export interface ConceptArtProps {
  className?: string;
}

function SvgFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 140 100" className={className} aria-hidden xmlns="http://www.w3.org/2000/svg">
      {children}
    </svg>
  );
}

export function PositionsArt({ className = 'h-20 w-28' }: ConceptArtProps) {
  return (
    <SvgFrame className={className}>
      <rect x="8" y="12" width="124" height="76" rx="8" fill="#eff6ff" stroke="#bfdbfe" />
      <rect x="52" y="20" width="36" height="14" rx="4" fill="#2563eb" opacity="0.9" />
      <rect x="24" y="44" width="32" height="12" rx="3" fill="#fff" stroke="#93c5fd" />
      <rect x="54" y="44" width="32" height="12" rx="3" fill="#fff" stroke="#93c5fd" />
      <rect x="84" y="44" width="32" height="12" rx="3" fill="#fff" stroke="#93c5fd" />
      <line x1="70" y1="34" x2="40" y2="44" stroke="#93c5fd" strokeWidth="1.5" />
      <line x1="70" y1="34" x2="70" y2="44" stroke="#93c5fd" strokeWidth="1.5" />
      <line x1="70" y1="34" x2="100" y2="44" stroke="#93c5fd" strokeWidth="1.5" />
      <rect x="44" y="68" width="52" height="10" rx="3" fill="#dbeafe" />
    </SvgFrame>
  );
}

export function EmployeesArt({ className = 'h-20 w-28' }: ConceptArtProps) {
  return (
    <SvgFrame className={className}>
      <rect x="8" y="12" width="124" height="76" rx="8" fill="#eff6ff" stroke="#bfdbfe" />
      {[28, 56, 84, 112].map((cx, i) => (
        <g key={cx}>
          <circle cx={cx} cy="38" r="10" fill={i === 0 ? '#2563eb' : '#93c5fd'} />
          <rect
            x={cx - 12}
            y="52"
            width="24"
            height="22"
            rx="6"
            fill={i === 0 ? '#3b82f6' : '#dbeafe'}
            stroke="#93c5fd"
          />
        </g>
      ))}
      <rect x="20" y="78" width="100" height="6" rx="2" fill="#dbeafe" />
    </SvgFrame>
  );
}

export function CertificationsArt({ className = 'h-20 w-28' }: ConceptArtProps) {
  return (
    <SvgFrame className={className}>
      <rect x="8" y="12" width="124" height="76" rx="8" fill="#eff6ff" stroke="#bfdbfe" />
      <circle cx="70" cy="42" r="22" fill="#fff" stroke="#2563eb" strokeWidth="2" />
      <path
        d="M58 42 L66 50 L84 34"
        fill="none"
        stroke="#16a34a"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="24" y="72" width="92" height="10" rx="3" fill="#fef3c7" stroke="#fbbf24" />
      <text
        x="70"
        y="80"
        textAnchor="middle"
        fontSize="7"
        fill="#92400e"
        fontFamily="system-ui,sans-serif"
      >
        EXP
      </text>
    </SvgFrame>
  );
}

export function FunctionsArt({ className = 'h-20 w-28' }: ConceptArtProps) {
  return (
    <SvgFrame className={className}>
      <rect x="8" y="12" width="124" height="76" rx="8" fill="#eff6ff" stroke="#bfdbfe" />
      <rect x="24" y="28" width="40" height="48" rx="4" fill="#dbeafe" stroke="#93c5fd" />
      <rect x="76" y="36" width="40" height="40" rx="4" fill="#fff" stroke="#2563eb" />
      <circle cx="96" cy="56" r="10" fill="none" stroke="#2563eb" strokeWidth="2" />
      <circle cx="96" cy="56" r="3" fill="#2563eb" />
      <rect x="32" y="36" width="24" height="6" rx="2" fill="#93c5fd" />
      <rect x="32" y="48" width="24" height="6" rx="2" fill="#93c5fd" />
      <rect x="32" y="60" width="24" height="6" rx="2" fill="#93c5fd" />
    </SvgFrame>
  );
}

export function CoverageArt({ className = 'h-20 w-28' }: ConceptArtProps) {
  return (
    <SvgFrame className={className}>
      <rect x="8" y="12" width="124" height="76" rx="8" fill="#eff6ff" stroke="#bfdbfe" />
      <path
        d="M70 24 L92 34 L92 58 L70 72 L48 58 L48 34 Z"
        fill="#2563eb"
        opacity="0.15"
        stroke="#2563eb"
        strokeWidth="2"
      />
      <circle cx="70" cy="46" r="8" fill="#2563eb" />
      <circle cx="48" cy="58" r="6" fill="#93c5fd" />
      <circle cx="92" cy="58" r="6" fill="#16a34a" />
      <text
        x="70"
        y="88"
        textAnchor="middle"
        fontSize="7"
        fill="#1e40af"
        fontFamily="system-ui,sans-serif"
      >
        primary · backup
      </text>
    </SvgFrame>
  );
}

export function SuccessionArt({ className = 'h-20 w-28' }: ConceptArtProps) {
  return (
    <SvgFrame className={className}>
      <rect x="8" y="12" width="124" height="76" rx="8" fill="#fffbeb" stroke="#fde68a" />
      <rect x="32" y="58" width="76" height="10" rx="2" fill="#fde68a" opacity="0.5" />
      <rect x="40" y="48" width="60" height="10" rx="2" fill="#fbbf24" opacity="0.6" />
      <rect x="48" y="38" width="44" height="10" rx="2" fill="#f59e0b" opacity="0.7" />
      <circle cx="70" cy="32" r="8" fill="#d97706" />
      <path d="M70 40 L70 48" stroke="#d97706" strokeWidth="2" />
    </SvgFrame>
  );
}

export function KnowledgeArt({ className = 'h-20 w-28' }: ConceptArtProps) {
  return (
    <SvgFrame className={className}>
      <rect x="8" y="12" width="124" height="76" rx="8" fill="#faf5ff" stroke="#e9d5ff" />
      <path
        d="M36 28 L36 72 L70 62 L104 72 L104 28 L70 38 Z"
        fill="#fff"
        stroke="#9333ea"
        strokeWidth="1.5"
      />
      <line x1="70" y1="38" x2="70" y2="62" stroke="#c4b5fd" strokeWidth="1" />
      <rect x="44" y="44" width="20" height="3" rx="1" fill="#ddd6fe" />
      <rect x="44" y="52" width="16" height="3" rx="1" fill="#ddd6fe" />
      <path d="M88 48 L108 38 L108 58 Z" fill="#9333ea" opacity="0.3" />
    </SvgFrame>
  );
}

export function MilestonesArt({ className = 'h-20 w-28' }: ConceptArtProps) {
  return (
    <SvgFrame className={className}>
      <rect x="8" y="12" width="124" height="76" rx="8" fill="#faf5ff" stroke="#e9d5ff" />
      <line x1="24" y1="68" x2="116" y2="68" stroke="#c4b5fd" strokeWidth="2" />
      <circle cx="36" cy="68" r="5" fill="#9333ea" />
      <circle cx="70" cy="68" r="5" fill="#a855f7" />
      <circle cx="104" cy="68" r="5" fill="#c4b5fd" />
      <line x1="36" y1="68" x2="36" y2="40" stroke="#9333ea" strokeWidth="2" />
      <path d="M30 40 L36 28 L42 40 Z" fill="#9333ea" />
      <rect x="62" y="48" width="16" height="20" rx="2" fill="#ede9fe" stroke="#a855f7" />
    </SvgFrame>
  );
}

export function CeuArt({ className = 'h-20 w-28' }: ConceptArtProps) {
  return (
    <SvgFrame className={className}>
      <rect x="8" y="12" width="124" height="76" rx="8" fill="#f0fdf4" stroke="#bbf7d0" />
      <circle cx="70" cy="46" r="24" fill="none" stroke="#e2e8f0" strokeWidth="6" />
      <circle
        cx="70"
        cy="46"
        r="24"
        fill="none"
        stroke="#16a34a"
        strokeWidth="6"
        strokeDasharray="100"
        strokeDashoffset="35"
        transform="rotate(-90 70 46)"
      />
      <rect x="58" y="22" width="24" height="14" rx="3" fill="#16a34a" />
      <polygon points="70,18 64,22 76,22" fill="#16a34a" />
      <text
        x="70"
        y="52"
        textAnchor="middle"
        fontSize="9"
        fill="#166534"
        fontFamily="system-ui,sans-serif"
      >
        CEU
      </text>
    </SvgFrame>
  );
}

const ENTITY_ART: Record<WorkforceEntityType, (props: ConceptArtProps) => ReactNode> = {
  positions: PositionsArt,
  employees: EmployeesArt,
  certifications: CertificationsArt,
  critical_functions: FunctionsArt,
  role_coverage: CoverageArt,
  succession_candidates: SuccessionArt,
  knowledge_artifacts: KnowledgeArt,
  transition_milestones: MilestonesArt,
};

export function ConceptArtForEntity({
  entityType,
  className,
}: {
  entityType: WorkforceEntityType;
  className?: string;
}) {
  const Art = ENTITY_ART[entityType];
  return <Art className={className} />;
}
