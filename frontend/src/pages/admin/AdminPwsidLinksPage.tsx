import { useCallback } from 'react';
import { useSDWISLinkedSystems } from '@/hooks/useSDWIS';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { TableSearchFilter } from '@/components/ui/table-search-filter';
import { useTableControls } from '@/hooks/useTableControls';
import { Ww360PageHero } from '@/components/ww360/Ww360PageHero';
import { Ww360Section } from '@/components/ww360/Ww360Section';
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

/** Platform read-only overview of utility-linked PWSIDs (utilities link their own systems). */
type LinkedSystemRow = NonNullable<ReturnType<typeof useSDWISLinkedSystems>['data']>[number];

export default function AdminPwsidLinksPage() {
  const { data: systems, isLoading } = useSDWISLinkedSystems();

  const getValue = useCallback((row: LinkedSystemRow, key: string) => {
    switch (key) {
      case 'pwsid':
        return row.pwsid;
      case 'name':
        return row.pws_name;
      case 'district':
        return row.district_code;
      case 'state':
        return row.state_code;
      case 'population':
        return row.population_served;
      case 'synced':
        return row.last_synced_at;
      default:
        return null;
    }
  }, []);

  const getSearchText = useCallback(
    (row: LinkedSystemRow) =>
      [
        row.pwsid,
        row.pws_name,
        row.district_code,
        row.state_code,
        row.population_served,
        row.last_synced_at,
      ]
        .filter(v => v != null && v !== '')
        .join(' '),
    []
  );

  const table = useTableControls({
    rows: systems ?? [],
    getValue,
    getSearchText,
    initialSortKey: 'pwsid',
    initialSortDir: 'asc',
  });

  return (
    <div className="ww360-app-shell mx-auto w-full max-w-[1440px] space-y-6 p-4 md:p-6">
      <Ww360PageHero
        eyebrow="Administration"
        title="Linked utilities overview"
        description="Utilities link their own EPA PWSIDs. Platform and state reviewers use lookup preview and analysis sets — not this link workflow."
        dataMode="live"
      />
      <Ww360Section tourId="pwsid-admin" title="District-linked systems" sources={['ww360']}>
        {isLoading ? (
          <p className="text-base text-slate-600">Loading linked systems…</p>
        ) : !systems?.length ? (
          <p className="text-base text-slate-600">
            No utilities have linked a PWSID yet. District admins link from Water Systems → Our
            water system.
          </p>
        ) : (
          <div className="space-y-3">
            <TableSearchFilter
              id="pwsid-links-filter"
              value={table.filter}
              onChange={table.setFilter}
              placeholder="Filter linked systems…"
              resultCount={table.resultCount}
              totalCount={table.totalCount}
            />
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableTableHead
                      column="pwsid"
                      label="PWSID"
                      sortKey={table.sortKey}
                      sortDir={table.sortDir}
                      onSort={table.toggleSort}
                    />
                    <SortableTableHead
                      column="name"
                      label="Name"
                      sortKey={table.sortKey}
                      sortDir={table.sortDir}
                      onSort={table.toggleSort}
                    />
                    <SortableTableHead
                      column="district"
                      label="District"
                      sortKey={table.sortKey}
                      sortDir={table.sortDir}
                      onSort={table.toggleSort}
                    />
                    <SortableTableHead
                      column="state"
                      label="State"
                      sortKey={table.sortKey}
                      sortDir={table.sortDir}
                      onSort={table.toggleSort}
                    />
                    <SortableTableHead
                      column="population"
                      label="Population"
                      sortKey={table.sortKey}
                      sortDir={table.sortDir}
                      onSort={table.toggleSort}
                    />
                    <SortableTableHead
                      column="synced"
                      label="Last synced"
                      sortKey={table.sortKey}
                      sortDir={table.sortDir}
                      onSort={table.toggleSort}
                    />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {table.rows.map(s => (
                  <TableRow key={s.pwsid}>
                    <TableCell className="font-mono text-base">{s.pwsid}</TableCell>
                    <TableCell className="text-base">{s.pws_name || '—'}</TableCell>
                    <TableCell className="font-mono text-base">{s.district_code || '—'}</TableCell>
                    <TableCell className="text-base">{s.state_code || '—'}</TableCell>
                    <TableCell className="text-base">{s.population_served ?? '—'}</TableCell>
                    <TableCell className="text-base whitespace-nowrap">
                      {s.last_synced_at || '—'}
                    </TableCell>
                  </TableRow>
                  ))}
                  {!table.rows.length && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-base text-slate-500">
                        No systems match your filter.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </Ww360Section>
    </div>
  );
}
