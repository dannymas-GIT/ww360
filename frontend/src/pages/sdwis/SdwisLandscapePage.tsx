import React, { useEffect, useState } from 'react';
import { DistrictPwsLinkConfigSection } from '@/components/admin/DistrictPwsLinkConfigSection';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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

const SDWISCompliancePage: React.FC = () => {
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
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">SDWIS compliance</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Linked EPA ECHO / SDWIS Fed data for your public water systems (violations and enforcement
          from Detailed Facility Reports).
        </p>
      </div>

      <DistrictPwsLinkConfigSection />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Linked systems</CardTitle>
          {selectedPwsid && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleSync()}
              disabled={syncMut.isPending}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${syncMut.isPending ? 'animate-spin' : ''}`} />
              Re-sync from EPA
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {sysLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !systems?.length ? (
            <p className="text-sm text-muted-foreground">No systems linked yet.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {systems.map(s => (
                  <Button
                    key={s.pwsid}
                    variant={selectedPwsid === s.pwsid ? 'default' : 'outline'}
                    size="sm"
                    className="font-mono"
                    onClick={() => setSelectedPwsid(s.pwsid)}
                  >
                    {s.pwsid}
                  </Button>
                ))}
              </div>

              {detailLoading ? (
                <p className="text-sm text-muted-foreground">Loading detail…</p>
              ) : detail ? (
                <div className="grid gap-2 text-sm border rounded-lg p-4 bg-muted/30">
                  <div className="font-semibold text-base">{detail.system.pws_name}</div>
                  <div className="grid sm:grid-cols-2 gap-2 text-muted-foreground">
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
                      className="text-primary text-sm hover:underline"
                    >
                      Open EPA Detailed Facility Report
                    </a>
                  )}
                  {detail.raw_compliance_status && (
                    <div className="mt-2">
                      <div className="text-xs font-medium text-muted-foreground mb-1">
                        Quarterly status (recent)
                      </div>
                      <div className="flex flex-wrap gap-1 text-xs">
                        {Object.entries(detail.raw_compliance_status)
                          .filter(([k]) => k.startsWith('Qtr') && k.endsWith('Status'))
                          .slice(-8)
                          .map(([k, v]) => (
                            <span key={k} className="px-1.5 py-0.5 rounded bg-background border">
                              {k.replace('Status', '')}: {v}
                            </span>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Violations</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {!selectedPwsid ? (
              <p className="text-sm text-muted-foreground">Select a system.</p>
            ) : vLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[120px] sm:min-w-[140px]">
                      Contaminant / rule
                    </TableHead>
                    <TableHead className="hidden md:table-cell min-w-[100px]">Category</TableHead>
                    <TableHead className="hidden lg:table-cell min-w-[90px]">Measure</TableHead>
                    <TableHead className="min-w-[72px]">Fed MCL</TableHead>
                    <TableHead className="hidden sm:table-cell min-w-[72px]">State MCL</TableHead>
                    <TableHead className="hidden lg:table-cell min-w-[160px]">
                      Compliance period
                    </TableHead>
                    <TableHead className="hidden xl:table-cell min-w-[160px]">
                      Non-compliance
                    </TableHead>
                    <TableHead className="min-w-[80px]">Status</TableHead>
                    <TableHead className="hidden md:table-cell min-w-[96px]">Resolved</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(violations || []).slice(0, 100).map(v => (
                    <TableRow key={v.id}>
                      <TableCell className="max-w-[220px] align-top">
                        <div className="font-medium">
                          {v.contaminant_name || v.rule_name || '—'}
                        </div>
                        {v.contaminant_name && v.rule_name ? (
                          <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {v.rule_name}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs align-top max-w-[140px]">
                        {v.category_desc || v.category_code || '—'}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs align-top whitespace-pre-wrap max-w-[120px]">
                        {v.violation_measure?.trim() || '—'}
                      </TableCell>
                      <TableCell className="text-xs align-top font-mono">
                        {v.federal_mcl?.trim() || '—'}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-xs align-top font-mono">
                        {v.state_mcl?.trim() || '—'}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs align-top whitespace-nowrap">
                        {formatDateRange(v.compliance_period_begin, v.compliance_period_end)}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell text-xs align-top whitespace-nowrap">
                        {formatDateRange(v.non_compliance_begin, v.non_compliance_end)}
                      </TableCell>
                      <TableCell className="text-xs align-top">{v.status || '—'}</TableCell>
                      <TableCell className="hidden md:table-cell text-xs align-top whitespace-nowrap">
                        {v.resolved_date || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Enforcement actions</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {!selectedPwsid ? (
              <p className="text-sm text-muted-foreground">Select a system.</p>
            ) : eLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Agency</TableHead>
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
                      <TableCell className="text-xs">{e.agency || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SDWISCompliancePage;
