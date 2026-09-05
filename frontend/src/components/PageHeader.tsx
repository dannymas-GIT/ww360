import React from 'react';
import { LucideIcon } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  description: string;
  icon: LucideIcon;
  gradientFrom?: string;
  gradientTo?: string;
  iconColor?: string;
  descriptionColor?: string;
  statValue?: string | number;
  statLabel?: string;
  actions?: React.ReactNode;
}

/** Tailwind JIT requires full class strings — never interpolate color tokens. */
const GRADIENT_CLASS_BY_KEY: Record<string, string> = {
  'blue-600|blue-800': 'bg-gradient-to-r from-blue-600 to-blue-800',
  'indigo-600|purple-700': 'bg-gradient-to-r from-indigo-600 to-purple-700',
  'emerald-600|teal-700': 'bg-gradient-to-r from-emerald-600 to-teal-700',
};

const DESCRIPTION_CLASS_BY_TOKEN: Record<string, string> = {
  'blue-200': 'text-blue-200',
  'indigo-200': 'text-indigo-200',
  'emerald-100': 'text-emerald-100',
  'emerald-200': 'text-emerald-200',
};

function resolveGradientClass(from: string, to: string): string {
  return GRADIENT_CLASS_BY_KEY[`${from}|${to}`] ?? GRADIENT_CLASS_BY_KEY['blue-600|blue-800'];
}

function resolveDescriptionClass(token: string): string {
  return DESCRIPTION_CLASS_BY_TOKEN[token] ?? 'text-blue-200';
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  icon: Icon,
  gradientFrom = 'blue-600',
  gradientTo = 'blue-800',
  iconColor = 'w-8 h-8',
  descriptionColor = 'blue-200',
  statValue,
  statLabel,
  actions,
}) => {
  const gradientClass = resolveGradientClass(gradientFrom, gradientTo);
  const descriptionClass = resolveDescriptionClass(descriptionColor);

  return (
    <div className={`${gradientClass} text-white p-6 rounded-lg shadow-lg`}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center">
            <Icon className={`mr-3 ${iconColor}`} />
            {title}
          </h1>
          <p className={`${descriptionClass} mt-2`}>{description}</p>
        </div>
        <div className="flex items-center space-x-4">
          {(statValue !== undefined || statLabel) && (
            <div className="text-right">
              {statValue !== undefined && <div className="text-2xl font-bold">{statValue}</div>}
              {statLabel && <div className={`text-sm ${descriptionClass}`}>{statLabel}</div>}
            </div>
          )}
          {actions && <div className="flex items-center space-x-2">{actions}</div>}
        </div>
      </div>
    </div>
  );
};

export default PageHeader;
