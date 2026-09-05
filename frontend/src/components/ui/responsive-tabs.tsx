import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

export type ResponsiveTabItem = {
  value: string;
  label: string;
  icon?: LucideIcon;
  /** Tailwind classes for the tab icon (e.g. text-amber-600) */
  iconClassName?: string;
};

type ResponsiveTabsListProps = {
  items: ResponsiveTabItem[];
  value: string;
  onValueChange: (value: string) => void;
  /** Additional classes for the desktop TabsList */
  listClassName?: string;
  /** Additional classes for each TabsTrigger */
  triggerClassName?: string;
  /** Label for the mobile select dropdown */
  selectLabel?: string;
};

/**
 * Renders a select dropdown on small screens and a TabsList on sm+.
 * Use inside a Radix Tabs root alongside TabsContent panels.
 */
export function ResponsiveTabsList({
  items,
  value,
  onValueChange,
  listClassName,
  triggerClassName,
  selectLabel = 'Section',
}: ResponsiveTabsListProps) {
  return (
    <>
      {/* Mobile: native select */}
      <div className="sm:hidden mb-3">
        <label className="sr-only" htmlFor="responsive-tab-select">
          {selectLabel}
        </label>
        <select
          id="responsive-tab-select"
          value={value}
          onChange={e => onValueChange(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {items.map(item => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      {/* Desktop: horizontal tab bar */}
      <TabsList className={cn('hidden sm:flex w-full h-auto flex-wrap gap-1', listClassName)}>
        {items.map(item => {
          const Icon = item.icon;
          return (
            <TabsTrigger
              key={item.value}
              value={item.value}
              className={cn(
                'flex-1 min-w-0 text-xs sm:text-sm gap-1.5 data-[state=active]:shadow-sm',
                triggerClassName
              )}
            >
              {Icon ? (
                <Icon className={cn('h-4 w-4 shrink-0', item.iconClassName ?? 'opacity-70')} />
              ) : null}
              <span className="truncate">{item.label}</span>
            </TabsTrigger>
          );
        })}
      </TabsList>
    </>
  );
}
