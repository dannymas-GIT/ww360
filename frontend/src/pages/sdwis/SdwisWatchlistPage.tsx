import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Ww360EmptyState } from '@/components/ww360/Ww360EmptyState';
import { Ww360PageHero } from '@/components/ww360/Ww360PageHero';
import { Ww360Section } from '@/components/ww360/Ww360Section';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { TableSearchFilter } from '@/components/ui/table-search-filter';
import { useTableControls } from '@/hooks/useTableControls';
import { useSDWISEnforcement, useSDWISViolations } from '@/hooks/useSDWIS';
import { useJurisdiction } from '@/context/JurisdictionContext';
import { fetchWorkforceInsights } from '@/services/sdwisService';
import type { SDWISEnforcement, SDWISViolation } from '@/services/sdwisService';

type WatchRow = {
  pwsid: string;
  pws_name?: string;
  district_code?: string;
  open_violations?: number;
  suggested_training_topics?: string[];
};

function ViolationsTable({ rows }: { rows: SDWISViolation[] }) {
  const getValue = useCallback((row: SDWISViolation, key: string) => {
    switch (key) {
      case 'rule':
        return row.contaminant_name || row.rule_name;
      case 'status':
        return row.status;
      default:
        return null;
    }
  }, []);

  const getSearchText = useCallback(
    (row: SDWISViolation) =>
      [row.contaminant_name, row.rule_name, row.status, row.category_desc, row.category_code]
        .filter(v => v != null && v !== '')
        .join(' '),
    []
  );

  const {
    rows: displayRows,
    sortKey,
    sortDir,
    toggleSort,
    filter,
    setFilter,
    resultCount,
    totalCount,
  } = useTableControls({
    rows: rows.slice(0, 50),
    getValue,
    getSearchText,
    initialSortKey: 'rule',
    initialSortDir: 'asc',
  });

  return (
    <div className="space-y-3">
      <TableSearchFilter
        id="watch-violations-filter"
        value={filter}
        onChange={setFilter}
        placeholder="Filter violations…"
        resultCount={resultCount}
        totalCount={totalCount}
      />
      <Table>
        <TableHeader>
          <TableRow>
            <SortableTableHead
              column="rule"
              label="Contaminant / rule"
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={toggleSort}
            />
            <SortableTableHead
              column="status"
              label="Status"
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={toggleSort}
            />
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayRows.map(v => (
            <TableRow key={v.id}>
              <TableCell className="text-sm">
                {v.contaminant_name || v.rule_name || '—'}
              </TableCell>
              <TableCell className="text-xs">{v.status || '—'}</TableCell>
            </TableRow>
          ))}
          {!displayRows.length && (
            <TableRow>
              <TableCell colSpan={2} className="text-sm text-slate-500">
                {rows.length ? 'No rows match your filter.' : 'No violation rows (system may not be linked yet).'}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function EnforcementTable({ rows }: { rows: SDWISEnforcement[] }) {
  const getValue = useCallback((row: SDWISEnforcement, key: string) => {
    switch (key) {
      case 'date':
        return row.action_date;
      case 'type':
        return row.enforcement_type;
      default:
        return null;
    }
  }, []);

  const getSearchText = useCallback(
    (row: SDWISEnforcement) =>
      [row.action_date, row.enforcement_type, row.action_description, row.agency]
        .filter(v => v != null && v !== '')
        .join(' '),
    []
  );

  const {
    rows: displayRows,
    sortKey,
    sortDir,
    toggleSort,
    filter,
    setFilter,
    resultCount,
    totalCount,
  } = useTableControls({
    rows: rows.slice(0, 50),
    getValue,
    getSearchText,
    initialSortKey: 'date',
    initialSortDir: 'desc',
  });

  return (
    <div className="space-y-3">
      <TableSearchFilter
        id="watch-enforcement-filter"
        value={filter}
        onChange={setFilter}
        placeholder="Filter enforcement…"
        resultCount={resultCount}
        totalCount={totalCount}
      />
      <Table>
        <TableHeader>
          <TableRow>
            <SortableTableHead
              column="date"
              label="Date"
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={toggleSort}
            />
            <SortableTableHead
              column="type"
              label="Type"
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={toggleSort}
            />
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayRows.map(e => (
            <TableRow key={e.id}>
              <TableCell className="text-xs whitespace-nowrap">
                {e.action_date || '—'}
              </TableCell>
              <TableCell className="text-xs">{e.enforcement_type || '—'}</TableCell>
            </TableRow>
          ))}
          {!displayRows.length && (
            <TableRow>
              <TableCell colSpan={2} className="text-sm text-slate-500">
                {rows.length ? 'No rows match your filter.' : 'No enforcement rows.'}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export default function SdwisWatchlistPage() {
  const { activeState } = useJurisdiction();
  const [rows, setRows] = useState<WatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPwsid, setSelectedPwsid] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    void fetchWorkforceInsights(activeState)
      .then(data => {
        setLastSynced(data.last_refreshed ?? null);
        const list: WatchRow[] = (data.member_watchlist || [])
          .map(r => {
            const pwsid = String(r.pwsid || '');
            const row: WatchRow = { pwsid, open_violations: Number(r.open_violations ?? 0) };
            if (r.pws_name) row.pws_name = String(r.pws_name);
            if (r.district_code) row.district_code = String(r.district_code);
            if (Array.isArray(r.suggested_training_topics)) {
              row.suggested_training_topics = r.suggested_training_topics as string[];
            }
            return row;
          })
          .filter(r => r.pwsid);
        setRows(list);
        if (list.length && !selectedPwsid) setSelectedPwsid(list[0].pwsid);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeState]);

  const selected = useMemo(
    () => rows.find(r => r.pwsid === selectedPwsid) || null,
    [rows, selectedPwsid]
  );
  const { data: violations, isLoading: vLoading } = useSDWISViolations(selectedPwsid);
  const { data: enforcement, isLoading: eLoading } = useSDWISEnforcement(selectedPwsid);

  const getValue = useCallback((row: WatchRow, key: string) => {
    switch (key) {
      case 'utility':
        return row.pws_name || row.district_code;
      case 'pwsid':
        return row.pwsid;
      case 'violations':
        return row.open_violations ?? 0;
      case 'training':
        return (row.suggested_training_topics || []).join(' · ');
      default:
        return null;
    }
  }, []);

  const getSearchText = useCallback(
    (row: WatchRow) =>
      [
        row.pws_name,
        row.district_code,
        row.pwsid,
        row.open_violations,
        ...(row.suggested_training_topics || []),
      ]
        .filter(v => v != null && v !== '')
        .join(' '),
    []
  );

  const {
    rows: tableRows,
    sortKey,
    sortDir,
    toggleSort,
    filter,
    setFilter,
    resultCount,
    totalCount,
  } = useTableControls({
    rows,
    getValue,
    getSearchText,
    initialSortKey: 'violations',
    initialSortDir: 'desc',
  });

  return (
    <div className="ww360-app-shell mx-auto w-full max-w-[1440px] space-y-6 p-4 md:p-6">
      <Ww360PageHero
        eyebrow="Member utilities"
        title="Member utility watchlist"
        description="Linked PWSIDs with open compliance pressure and suggested training topics from the SDWIS landscape."
        dataMode="live"
        lastSynced={lastSynced}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-white/20 bg-white/5 text-white hover:bg-white/15 min-h-[44px] md:min-h-9"
              asChild
            >
              <Link to="/water-systems">Landscape</Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-white/20 bg-white/5 text-white hover:bg-white/15 min-h-[44px] md:min-h-9"
              asChild
            >
              <Link to="/admin/pwsid-links">PWSID links</Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-white/20 bg-white/5 text-white hover:bg-white/15 min-h-[44px] md:min-h-9"
              asChild
            >
              <Link to="/water-systems/compliance">Compliance detail</Link>
            </Button>
          </div>
        }
      />

      <Ww360Section tourId="watchlist" title="Watchlist" sources={['ww360']}>
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : !rows.length ? (
          <Ww360EmptyState
            title="No member utilities on the watchlist yet"
            description={`Link PWSIDs under Administration, then refresh the ${activeState} landscape.`}
            actionLabel="Link a PWSID"
            actionHref="/admin/pwsid-links"
          />
        ) : (
          <div className="space-y-3">
            <TableSearchFilter
              id="watchlist-filter"
              value={filter}
              onChange={setFilter}
              placeholder="Filter watchlist…"
              resultCount={resultCount}
              totalCount={totalCount}
            />
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableTableHead
                      column="utility"
                      label="Utility"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={toggleSort}
                    />
                    <SortableTableHead
                      column="pwsid"
                      label="PWSID"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={toggleSort}
                    />
                    <SortableTableHead
                      column="violations"
                      label="Open violations"
                      align="right"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={toggleSort}
                    />
                    <SortableTableHead
                      column="training"
                      label="Suggested training"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={toggleSort}
                    />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableRows.map(row => (
                    <TableRow
                      key={row.pwsid}
                      className={selectedPwsid === row.pwsid ? 'bg-sky-50/50' : 'cursor-pointer'}
                      onClick={() => setSelectedPwsid(row.pwsid)}
                    >
                      <TableCell className="font-medium">
                        {row.pws_name || row.district_code || '—'}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{row.pwsid}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.open_violations ?? 0}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {(row.suggested_training_topics || []).join(' · ') || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!tableRows.length && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-sm text-slate-500">
                        No utilities match your filter.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </Ww360Section>

      {selected && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Ww360Section tourId="watch-violations" title={`Violations · ${selected.pwsid}`}>
            <div className="overflow-x-auto max-h-96">
              {vLoading ? (
                <p className="text-sm text-slate-500">Loading…</p>
              ) : (
                <ViolationsTable rows={violations || []} />
              )}
            </div>
          </Ww360Section>
          <Ww360Section tourId="watch-enforcement" title={`Enforcement · ${selected.pwsid}`}>
            <div className="overflow-x-auto max-h-96">
              {eLoading ? (
                <p className="text-sm text-slate-500">Loading…</p>
              ) : (
                <EnforcementTable rows={enforcement || []} />
              )}
            </div>
          </Ww360Section>
        </div>
      )}
    </div>
  );
}
