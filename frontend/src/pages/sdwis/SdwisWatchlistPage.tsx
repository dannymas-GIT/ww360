import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Ww360EmptyState } from '@/components/ww360/Ww360EmptyState';
import { Ww360PageHero } from '@/components/ww360/Ww360PageHero';
import { Ww360Section } from '@/components/ww360/Ww360Section';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useSDWISEnforcement, useSDWISViolations } from '@/hooks/useSDWIS';
import { fetchWorkforceInsights } from '@/services/sdwisService';

type WatchRow = {
  pwsid: string;
  pws_name?: string;
  district_code?: string;
  open_violations?: number;
  suggested_training_topics?: string[];
};

export default function SdwisWatchlistPage() {
  const [rows, setRows] = useState<WatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPwsid, setSelectedPwsid] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    void fetchWorkforceInsights('NY')
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
  }, []);

  const selected = useMemo(
    () => rows.find(r => r.pwsid === selectedPwsid) || null,
    [rows, selectedPwsid]
  );
  const { data: violations, isLoading: vLoading } = useSDWISViolations(selectedPwsid);
  const { data: enforcement, isLoading: eLoading } = useSDWISEnforcement(selectedPwsid);

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
            description="Link PWSIDs under Administration, then refresh the NY landscape."
            actionLabel="Link a PWSID"
            actionHref="/admin/pwsid-links"
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Utility</TableHead>
                  <TableHead>PWSID</TableHead>
                  <TableHead className="text-right">Open violations</TableHead>
                  <TableHead>Suggested training</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(row => (
                  <TableRow
                    key={row.pwsid}
                    className={selectedPwsid === row.pwsid ? 'bg-sky-50/50' : 'cursor-pointer'}
                    onClick={() => setSelectedPwsid(row.pwsid)}
                  >
                    <TableCell className="font-medium">
                      {row.pws_name || row.district_code || '—'}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{row.pwsid}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.open_violations ?? 0}</TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {(row.suggested_training_topics || []).join(' · ') || '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contaminant / rule</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(violations || []).slice(0, 50).map(v => (
                      <TableRow key={v.id}>
                        <TableCell className="text-sm">
                          {v.contaminant_name || v.rule_name || '—'}
                        </TableCell>
                        <TableCell className="text-xs">{v.status || '—'}</TableCell>
                      </TableRow>
                    ))}
                    {!violations?.length && (
                      <TableRow>
                        <TableCell colSpan={2} className="text-sm text-slate-500">
                          No violation rows (system may not be linked yet).
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
          </Ww360Section>
          <Ww360Section tourId="watch-enforcement" title={`Enforcement · ${selected.pwsid}`}>
            <div className="overflow-x-auto max-h-96">
              {eLoading ? (
                <p className="text-sm text-slate-500">Loading…</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(enforcement || []).slice(0, 50).map(e => (
                      <TableRow key={e.id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {e.action_date || '—'}
                        </TableCell>
                        <TableCell className="text-xs">{e.enforcement_type || '—'}</TableCell>
                      </TableRow>
                    ))}
                    {!enforcement?.length && (
                      <TableRow>
                        <TableCell colSpan={2} className="text-sm text-slate-500">
                          No enforcement rows.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
          </Ww360Section>
        </div>
      )}
    </div>
  );
}
