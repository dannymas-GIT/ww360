import { useCallback, useMemo, useState } from 'react';
import {
  filterTableRows,
  sortTableRows,
  type SortDirection,
} from '@/lib/tableControls';

export interface UseTableControlsOptions<T> {
  rows: readonly T[];
  /** Resolve a column value for sorting. */
  getValue: (row: T, key: string) => unknown;
  /** Flattened text used by the optional search filter. */
  getSearchText?: (row: T) => string;
  initialSortKey?: string | null;
  initialSortDir?: SortDirection;
  initialFilter?: string;
}

export interface TableControls<T> {
  rows: T[];
  sortKey: string | null;
  sortDir: SortDirection;
  toggleSort: (key: string) => void;
  filter: string;
  setFilter: (value: string) => void;
  resultCount: number;
  totalCount: number;
}

/**
 * Client-side sort + text filter for WW360 display tables.
 * Pair with `SortableTableHead` and optional `TableSearchFilter`.
 */
export function useTableControls<T>({
  rows,
  getValue,
  getSearchText,
  initialSortKey = null,
  initialSortDir = 'asc',
  initialFilter = '',
}: UseTableControlsOptions<T>): TableControls<T> {
  const [sortKey, setSortKey] = useState<string | null>(initialSortKey);
  const [sortDir, setSortDir] = useState<SortDirection>(initialSortDir);
  const [filter, setFilter] = useState(initialFilter);

  // Keep direction updates outside another setState updater. Nesting
  // `setSortDir(d => …)` inside `setSortKey` is double-invoked under React
  // Strict Mode, so asc↔desc cancels and the column looks stuck.
  const toggleSort = useCallback(
    (key: string) => {
      if (sortKey === key) {
        setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
      } else {
        setSortKey(key);
        setSortDir('asc');
      }
    },
    [sortKey, sortDir]
  );

  const processed = useMemo(() => {
    const filtered =
      filter.trim() && getSearchText
        ? filterTableRows(rows, filter, getSearchText)
        : [...rows];
    return sortTableRows(filtered, sortKey, sortDir, getValue);
  }, [rows, filter, getSearchText, sortKey, sortDir, getValue]);

  return {
    rows: processed,
    sortKey,
    sortDir,
    toggleSort,
    filter,
    setFilter,
    resultCount: processed.length,
    totalCount: rows.length,
  };
}
