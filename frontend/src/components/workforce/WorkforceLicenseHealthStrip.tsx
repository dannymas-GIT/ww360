import { Link } from 'react-router-dom';
import { BadgeCheck, FileText, GraduationCap } from 'lucide-react';
import { buildWorkforceTabPath } from '@/components/workforce/workforceContinuityTabs';
import type { WorkforceContinuityScorecard } from '@/services/workforceSuccessionService';

export interface WorkforceLicenseHealthStripProps {
  scorecard: WorkforceContinuityScorecard;
}

export function WorkforceLicenseHealthStrip({ scorecard }: WorkforceLicenseHealthStripProps) {
  const items = [
    {
      label: 'Certs expiring (90d)',
      value: scorecard.cert_cliff_90d,
      tone:
        scorecard.cert_cliff_90d > 0
          ? 'text-amber-700 bg-amber-50 border-amber-200'
          : 'text-emerald-700 bg-emerald-50 border-emerald-200',
      icon: BadgeCheck,
      href: buildWorkforceTabPath('certifications', { certExpiring: 90 }),
    },
    {
      label: 'CEU shortfall',
      value: scorecard.ceu_shortfall_count ?? 0,
      tone:
        (scorecard.ceu_shortfall_count ?? 0) > 0
          ? 'text-amber-700 bg-amber-50 border-amber-200'
          : 'text-emerald-700 bg-emerald-50 border-emerald-200',
      icon: GraduationCap,
      href: buildWorkforceTabPath('ceu'),
    },
    {
      label: 'DOH-352 ready',
      value: scorecard.doh352_ready_count ?? 0,
      tone: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      icon: FileText,
      href: buildWorkforceTabPath('ceu'),
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {items.map(item => {
        const Icon = item.icon;
        return (
          <Link
            key={item.label}
            to={item.href}
            className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-shadow hover:shadow-sm ${item.tone}`}
          >
            <Icon className="h-5 w-5 shrink-0 opacity-80" aria-hidden />
            <div className="min-w-0">
              <div className="text-xs font-medium opacity-80">{item.label}</div>
              <div className="text-lg font-semibold leading-tight">{item.value}</div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
