import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface TableSearchFilterProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  resultCount?: number;
  totalCount?: number;
  id?: string;
}

/** Text filter for display tables (pairs with `useTableControls`). */
export function TableSearchFilter({
  value,
  onChange,
  placeholder = 'Filter table…',
  className,
  resultCount,
  totalCount,
  id = 'table-search-filter',
}: TableSearchFilterProps) {
  const showCount =
    typeof resultCount === 'number' &&
    typeof totalCount === 'number' &&
    (value.trim().length > 0 || resultCount !== totalCount);

  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      <label htmlFor={id} className="sr-only">
        Filter table
      </label>
      <div className="relative min-w-[12rem] flex-1 sm:max-w-sm">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          aria-hidden
        />
        <Input
          id={id}
          type="search"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="min-h-[44px] pl-9 text-base"
          autoComplete="off"
        />
      </div>
      {showCount ? (
        <p className="text-[0.875rem] text-slate-600" aria-live="polite">
          Showing {resultCount.toLocaleString()} of {totalCount.toLocaleString()}
        </p>
      ) : null}
    </div>
  );
}
