import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DistrictPwsLinkConfigSection } from '@/components/admin/DistrictPwsLinkConfigSection';
import { Ww360PageHero } from '@/components/ww360/Ww360PageHero';
import { Ww360Section } from '@/components/ww360/Ww360Section';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  useSDWISEnforcement,
  useSDWISLinkedSystems,
  useSDWISystemDetail,
  useSDWISViolations,
  useSyncSDWISSystem,
} from '@/hooks/useSDWIS';
import { RefreshCw } from 'lucide-react';

function formatDateRange(begin?: string | null, end?: string | null): string {
  if (!begin?.trim() && !end?.trim()) return '—';
  if (begin?.trim() && end?.trim()) return `${begin} → ${end}`;
  return (begin || end || '—').trim();
}

export default function SdwisCompliancePage() {
  const [selectedPwsid, setSelectedPwsid] = useState<string | null>(null);
  const { data: systems, isLoading: sysLoading } = useSDWISLinkedSystems();
  const { data: detail, isLoading: detailLoading } = useSDWISystemDetail(selectedPwsid);
  const { data: violations, isLoading: vLoading } = useSDWISViolations(selectedPwsid);
  const { data: enforcement, isLoading: eLoading } = useSDWISEnforcement(selectedPwsid);

  const syncMut = useSyncSDWISSystem();

  useEffect(() => {
    if (systems?.length && !selectedPwsid) {
      setSelectedPwsid(systems[0].pwsid);
    }
  }, [systems, selectedPwsid]);

  const handleSync = async () => {
    if (!selectedPwsid) return;
    await syncMut.mutateAsync(selectedPwsid);
  };

  return (
    <div className="ww360-app-shell mx-auto w-full max-w-[1440px] space-y-6 p-4 md:p-6">
      <Ww360PageHero
        eyebrow="EPA SDWIS · ECHO"
        title="SDWIS compliance"
        description="Linked EPA ECHO / SDWIS Fed data for your public water systems — violations and enforcement from Detailed Facility Reports."
        dataMode="live"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-white/20 bg-white/5 text-white hover:bg-white/15 min-h-[44px] md:min-h-9"
              asChild
            >
              <Link to="/water-systems/lookup">System lookup</Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-white/20 bg-white/5 text-white hover:bg-white/15 min-h-[44px] md:min-h-9"
              asChild
            >
              <Link to="/water-systems/watchlist">Watchlist</Link>
            </Button>
          </div>
        }
      />

      <Ww360Section tourId="pwsid-links-inline" title="Link systems" sources={['ww360']}>
        <DistrictPwsLinkConfigSection />
      </Ww360Section>

      <Ww360Section
        tourId="linked-systems"
        title="Linked systems"
        action={
          selectedPwsid ? (
            <Button
              variant="outline"
              size="sm"
              className="min-h-[44px] md:min-h-9"
              onClick={() => void handleSync()}
              disabled={syncMut.isPending}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${syncMut.isPending ? 'animate-spin' : ''}`} />
              Re-sync from EPA
            </Button>
          ) : undefined
        }
      >
        {sysLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : !systems?.length ? (
          <p className="text-sm text-slate-500">No systems linked yet.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 mb-4">
              {systems.map(s => (
                <Button
                  key={s.pwsid}
                  variant={selectedPwsid === s.pwsid ? 'default' : 'outline'}
                  size="sm"
                  className="font-mono min-h-[44px] md:min-h-9"
                  onClick={() => setSelectedPwsid(s.pwsid)}
                >
                  {s.pwsid}
                </Button>
              ))}
            </div>

            {detailLoading ? (
              <p className="text-sm text-slate-500">Loading detail…</p>
            ) : detail ? (
              <Card className="border-slate-200 shadow-sm">
                <CardContent className="grid gap-2 text-sm border rounded-lg p-4 bg-slate-50/50 pt-4">
                  <div className="font-semibold text-base">{detail.system.pws_name}</div>
                  <div className="grid sm:grid-cols-2 gap-2 text-slate-600">
                    <div>
                      State: {detail.system.state_code} · Region: {detail.system.epa_region}
                    </div>
                    <div>Population: {detail.system.population_served ?? '—'}</div>
                    <div>Facility status: {detail.system.facility_status ?? '—'}</div>
                    <div>Last synced: {detail.system.last_synced_at ?? '—'}</div>
                    <div>Open violations: {detail.open_violation_count}</div>
                    <div>Enforcement actions: {detail.enforcement_count}</div>
                  </div>
                  {detail.system.dfr_url && (
                    <a
                      href={detail.system.dfr_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#2563eb] text-sm hover:underline"
                    >
                      Open EPA Detailed Facility Report
                    </a>
                  )}
                </CardContent>
              </Card>
            ) : null}
          </>
        )}
      </Ww360Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Ww360Section tourId="violations" title="Violations">
          <div className="overflow-x-auto">
            {!selectedPwsid ? (
              <p className="text-sm text-slate-500">Select a system.</p>
            ) : vLoading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[120px]">Contaminant / rule</TableHead>
                    <TableHead className="hidden md:table-cell">Category</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(violations || []).slice(0, 100).map(v => (
                    <TableRow key={v.id}>
                      <TableCell className="max-w-[220px] align-top">
                        <div className="font-medium">
                          {v.contaminant_name || v.rule_name || '—'}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs">
                        {v.category_desc || v.category_code || '—'}
                      </TableCell>
                      <TableCell className="text-xs">{v.status || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </Ww360Section>

        <Ww360Section tourId="enforcement" title="Enforcement actions">
          <div className="overflow-x-auto">
            {!selectedPwsid ? (
              <p className="text-sm text-slate-500">Select a system.</p>
            ) : eLoading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(enforcement || []).slice(0, 100).map(e => (
                    <TableRow key={e.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {e.action_date || '—'}
                      </TableCell>
                      <TableCell className="text-xs">{e.enforcement_type || '—'}</TableCell>
                      <TableCell className="text-xs max-w-[220px]">
                        {e.action_description || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </Ww360Section>
      </div>
    </div>
  );
}
