import { useEffect, useMemo, useState } from 'react';
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
import { useAuth } from '@/context/AuthContext';
import {
  useSDWISEnforcement,
  useSDWISLinkedSystems,
  useSDWISystemDetail,
  useSDWISViolations,
  useSyncSDWISSystem,
} from '@/hooks/useSDWIS';
import { RefreshCw } from 'lucide-react';

export default function SdwisCompliancePage() {
  const { isDistrictManager, actingDistrictCode, user } = useAuth();
  const utilityDistrict = actingDistrictCode || user?.districts?.[0] || undefined;

  const [selectedPwsid, setSelectedPwsid] = useState<string | null>(null);
  const { data: systems, isLoading: sysLoading } = useSDWISLinkedSystems();
  const { data: detail, isLoading: detailLoading } = useSDWISystemDetail(selectedPwsid);
  const { data: violations, isLoading: vLoading } = useSDWISViolations(selectedPwsid);
  const { data: enforcement, isLoading: eLoading } = useSDWISEnforcement(selectedPwsid);

  const syncMut = useSyncSDWISSystem();

  const utilitySystems = useMemo(() => {
    if (!utilityDistrict) return systems || [];
    return (systems || []).filter(s => s.district_code === utilityDistrict);
  }, [systems, utilityDistrict]);

  useEffect(() => {
    if (utilitySystems.length && !selectedPwsid) {
      setSelectedPwsid(utilitySystems[0].pwsid);
    }
  }, [utilitySystems, selectedPwsid]);

  const handleSync = async () => {
    if (!selectedPwsid) return;
    await syncMut.mutateAsync(selectedPwsid);
  };

  return (
    <div className="ww360-app-shell mx-auto w-full max-w-[1440px] space-y-6 p-4 md:p-6">
      <Ww360PageHero
        eyebrow="EPA SDWIS · ECHO"
        title={isDistrictManager ? 'Our water system' : 'SDWIS compliance'}
        description={
          isDistrictManager
            ? 'Link your district’s EPA PWSID once — violations and enforcement stay in WW360 for your team.'
            : 'Review linked utility systems or preview any PWSID from lookup without persisting a district link.'
        }
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
            {!isDistrictManager && (
              <Button
                variant="outline"
                size="sm"
                className="border-white/20 bg-white/5 text-white hover:bg-white/15 min-h-[44px] md:min-h-9"
                asChild
              >
                <Link to="/water-systems/analysis">Analysis</Link>
              </Button>
            )}
          </div>
        }
      />

      <Ww360Section
        tourId="pwsid-links-inline"
        title={isDistrictManager ? 'Link your PWS' : 'Preview a system'}
      >
        <DistrictPwsLinkConfigSection
          mode={isDistrictManager ? 'link' : 'select'}
          lockedDistrictCode={isDistrictManager ? utilityDistrict : undefined}
          stateCode={user?.active_state_code}
        />
      </Ww360Section>

      {isDistrictManager && (
        <Ww360Section
          tourId="linked-systems"
          title="Linked system"
          action={
            selectedPwsid ? (
              <Button
                variant="outline"
                size="sm"
                className="min-h-[44px] text-base md:min-h-9"
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
            <p className="text-base text-slate-600">Loading…</p>
          ) : !utilitySystems.length ? (
            <p className="text-base text-slate-600">
              No PWS linked yet. Search above and use Link & sync to connect your district.
            </p>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap gap-2">
                {utilitySystems.map(s => (
                  <Button
                    key={s.pwsid}
                    variant={selectedPwsid === s.pwsid ? 'default' : 'outline'}
                    size="sm"
                    className="min-h-[44px] font-mono text-base md:min-h-9"
                    onClick={() => setSelectedPwsid(s.pwsid)}
                  >
                    {s.pwsid}
                  </Button>
                ))}
              </div>

              {detailLoading ? (
                <p className="text-base text-slate-600">Loading detail…</p>
              ) : detail ? (
                <Card className="border-slate-200 shadow-sm">
                  <CardContent className="grid gap-2 rounded-lg border bg-slate-50/50 p-4 pt-4 text-base">
                    <div className="text-base font-semibold">{detail.system.pws_name}</div>
                    <div className="grid gap-2 text-slate-600 sm:grid-cols-2">
                      <div>
                        State: {detail.system.state_code} · Region: {detail.system.epa_region}
                      </div>
                      <div>Population: {detail.system.population_served ?? '—'}</div>
                      <div>Facility status: {detail.system.facility_status ?? '—'}</div>
                      <div>Last synced: {detail.system.last_synced_at ?? '—'}</div>
                      <div>Open violations: {detail.open_violation_count}</div>
                      <div>Enforcement actions: {detail.enforcement_count}</div>
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </>
          )}
        </Ww360Section>
      )}

      {isDistrictManager && selectedPwsid && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Ww360Section tourId="violations" title="Violations">
            <div className="overflow-x-auto">
              {vLoading ? (
                <p className="text-base text-slate-600">Loading…</p>
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
                        <TableCell className="max-w-[220px] align-top text-base">
                          <div className="font-medium">
                            {v.contaminant_name || v.rule_name || '—'}
                          </div>
                        </TableCell>
                        <TableCell className="hidden text-base md:table-cell">
                          {v.category_desc || v.category_code || '—'}
                        </TableCell>
                        <TableCell className="text-base">{v.status || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </Ww360Section>

          <Ww360Section tourId="enforcement" title="Enforcement actions">
            <div className="overflow-x-auto">
              {eLoading ? (
                <p className="text-base text-slate-600">Loading…</p>
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
                        <TableCell className="whitespace-nowrap text-base">
                          {e.action_date || '—'}
                        </TableCell>
                        <TableCell className="text-base">{e.enforcement_type || '—'}</TableCell>
                        <TableCell className="max-w-[220px] text-base">
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
      )}
    </div>
  );
}
