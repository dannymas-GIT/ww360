/** Shared client-side sort + text-filter helpers for display tables. */

export type SortDirection = 'asc' | 'desc';

export function compareTableValues(
  a: unknown,
  b: unknown,
  direction: SortDirection
): number {
  const emptyA = a == null || a === '';
  const emptyB = b == null || b === '';
  if (emptyA && emptyB) return 0;
  if (emptyA) return 1;
  if (emptyB) return -1;

  let result = 0;
  if (typeof a === 'number' && typeof b === 'number') {
    result = a - b;
  } else if (typeof a === 'boolean' && typeof b === 'boolean') {
    result = Number(a) - Number(b);
  } else {
    const aNum = typeof a === 'string' && a.trim() !== '' && !Number.isNaN(Number(a)) ? Number(a) : null;
    const bNum = typeof b === 'string' && b.trim() !== '' && !Number.isNaN(Number(b)) ? Number(b) : null;
    if (aNum != null && bNum != null) {
      result = aNum - bNum;
    } else {
      result = String(a).localeCompare(String(b), undefined, {
        numeric: true,
        sensitivity: 'base',
      });
    }
  }
  return direction === 'asc' ? result : -result;
}

export function sortTableRows<T>(
  rows: readonly T[],
  sortKey: string | null | undefined,
  sortDir: SortDirection,
  getValue: (row: T, key: string) => unknown
): T[] {
  if (!sortKey) return [...rows];
  return [...rows].sort((a, b) =>
    compareTableValues(getValue(a, sortKey), getValue(b, sortKey), sortDir)
  );
}

export function filterTableRows<T>(
  rows: readonly T[],
  query: string,
  getSearchText: (row: T) => string
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...rows];
  return rows.filter(row => getSearchText(row).toLowerCase().includes(q));
}
