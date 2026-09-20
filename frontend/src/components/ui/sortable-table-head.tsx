import type { ReactNode, ThHTMLAttributes } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { TableHead } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { SortDirection } from '@/lib/tableControls';

export interface SortableTableHeadProps
  extends Omit<ThHTMLAttributes<HTMLTableCellElement>, 'onClick'> {
  column: string;
  label: ReactNode;
  sortKey: string | null;
  sortDir: SortDirection;
  onSort: (column: string) => void;
  /** Right-align numeric columns. */
  align?: 'left' | 'right';
}

/**
 * Clickable column header with sort affordance (44px touch target).
 */
export function SortableTableHead({
  column,
  label,
  sortKey,
  sortDir,
  onSort,
  align = 'left',
  className,
  ...props
}: SortableTableHeadProps) {
  const active = sortKey === column;
  const ariaSort = active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none';
  const Icon = !active ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown;

  return (
    <TableHead
      aria-sort={ariaSort}
      className={cn(align === 'right' && 'text-right', className)}
      {...props}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn(
          'inline-flex min-h-[44px] items-center gap-1.5 rounded-md px-1 text-[1rem] font-semibold text-slate-700',
          'hover:bg-slate-200/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500',
          align === 'right' && 'ml-auto flex-row-reverse',
          active && 'text-slate-900'
        )}
      >
        <span>{label}</span>
        <Icon
          className={cn('h-4 w-4 shrink-0', active ? 'text-sky-700' : 'text-slate-400')}
          aria-hidden
        />
        <span className="sr-only">
          {active
            ? `Sorted ${sortDir === 'asc' ? 'ascending' : 'descending'}. Activate to reverse.`
            : 'Activate to sort'}
        </span>
      </button>
    </TableHead>
  );
}
