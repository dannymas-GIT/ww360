import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ContaminantMultiSelect } from '@/components/sampling/ContaminantMultiSelect';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { useTenantAuthContext } from '@/hooks/useTenantAuthContext';
import {
  fetchDecisionConfigHistory,
  fetchDecisionRoutingConfig,
  previewDecisionConfigImpact,
  ROLE_OPTIONS,
  saveDecisionRoutingConfig,
  SCHEDULE_TRIGGER_LEVEL_OPTIONS,
  type DecisionRoutingConfig,
  type DecisionRoutingConfigUpdate,
  type ScheduleTriggerMclLevel,
} from '@/services/decisionRoutingConfigService';
import { featureFlags } from '@/config/featureFlags';
import { getAnalytes } from '@/services/readings';
import { ChevronDown, ChevronRight, Save, Zap } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

const Section: React.FC<{
  title: string;
  description: string;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}> = ({ title, description, defaultOpen = true, onOpenChange, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  const toggle = () => {
    setOpen(prev => {
      const next = !prev;
      onOpenChange?.(next);
      return next;
    });
  };
  return (
    <Card>
      <CardHeader className="cursor-pointer select-none" onClick={toggle}>
        <div className="flex items-center gap-2">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      {open && <CardContent className="space-y-4">{children}</CardContent>}
    </Card>
  );
};

const ToggleRow: React.FC<{
  label: string;
  hint?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
}> = ({ label, hint, checked, onCheckedChange, disabled }) => (
  <div className="flex items-start justify-between gap-4 rounded-md border p-3">
    <div>
      <Label className="font-medium">{label}</Label>
      {hint && <p className="text-sm text-muted-foreground mt-1">{hint}</p>}
    </div>
    <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
  </div>
);

const RoleSelect: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  readOnly?: boolean;
}> = ({ label, value, onChange, readOnly }) => (
  <div className="grid gap-2">
    <Label>{label}</Label>
    <Select value={value} onValueChange={onChange} disabled={readOnly}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ROLE_OPTIONS.map(r => (
          <SelectItem key={r.value} value={r.value}>
            {r.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);

const ScheduleTriggerLevelSelect: React.FC<{
  value: ScheduleTriggerMclLevel;
  onChange: (v: ScheduleTriggerMclLevel) => void;
  readOnly?: boolean;
}> = ({ value, onChange, readOnly }) => (
  <div className="grid gap-2">
    <Label>Minimum MCL level that routes to the Decisions Inbox</Label>
    <Select
      value={value}
      onValueChange={v => onChange(v as ScheduleTriggerMclLevel)}
      disabled={readOnly}
    >
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SCHEDULE_TRIGGER_LEVEL_OPTIONS.map(o => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
    <p className="text-sm text-muted-foreground">
      Readings at or above this level create a schedule decision. Lower (routine) readings are
      stored without flooding the calendar.
    </p>
  </div>
);

export interface DistrictDecisionConfigSectionProps {
  /** When set, locks district selector to this code (DA hub). */
  lockedDistrictCode?: string;
  onConfiguredChange?: (configured: boolean) => void;
}

export const DistrictDecisionConfigSection: React.FC<DistrictDecisionConfigSectionProps> = ({
  lockedDistrictCode,
  onConfiguredChange,
}) => {
  const { toast } = useToast();
  const { data: tenantCtx, isLoading: tenantLoading } = useTenantAuthContext();
  const [districtCode, setDistrictCode] = useState(lockedDistrictCode || '');
  const [config, setConfig] = useState<DecisionRoutingConfig | null>(null);
  const [draft, setDraft] = useState<DecisionRoutingConfigUpdate>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [history, setHistory] = useState<Awaited<ReturnType<typeof fetchDecisionConfigHistory>>>(
    []
  );
  const [excludedContaminants, setExcludedContaminants] = useState<string[]>([]);
  const [contaminantFiltersOpen, setContaminantFiltersOpen] = useState(false);

  const { data: contaminantSuggestions = [], isLoading: contaminantSuggestionsLoading } = useQuery({
    queryKey: ['analytes'],
    queryFn: getAnalytes,
    staleTime: 5 * 60 * 1000,
    enabled: contaminantFiltersOpen,
  });

  const readOnly =
    !tenantCtx?.is_district_admin && !tenantCtx?.is_global_admin && !tenantCtx?.is_system_admin;

  const districtOptions = useMemo(() => {
    if (lockedDistrictCode) return [lockedDistrictCode];
    if (!tenantCtx) return [];
    const codes = new Set<string>();
    if (tenantCtx.district_code) codes.add(tenantCtx.district_code);
    (tenantCtx.accessible_districts ?? []).forEach(c => {
      if (c && c !== '*') codes.add(c);
    });
    return Array.from(codes);
  }, [tenantCtx, lockedDistrictCode]);

  useEffect(() => {
    if (lockedDistrictCode) {
      setDistrictCode(lockedDistrictCode);
      return;
    }
    if (tenantLoading) return;
    const preferred = tenantCtx?.district_code || districtOptions[0] || '';
    setDistrictCode(prev => (prev && districtOptions.includes(prev) ? prev : preferred));
  }, [tenantLoading, tenantCtx, districtOptions, lockedDistrictCode]);

  const loadConfig = useCallback(async () => {
    if (!districtCode) return;
    setLoading(true);
    try {
      const data = await fetchDecisionRoutingConfig(districtCode);
      setConfig(data);
      setDraft({});
      setExcludedContaminants(data.excluded_contaminants || []);
      const hist = await fetchDecisionConfigHistory(districtCode);
      setHistory(hist);
      onConfiguredChange?.(true);
    } catch (e: unknown) {
      onConfiguredChange?.(false);
      toast({
        variant: 'destructive',
        title: 'Failed to load config',
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setLoading(false);
    }
  }, [districtCode, toast, onConfiguredChange]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const effective = { ...config, ...draft } as DecisionRoutingConfig;

  const isGlobalOrSystem =
    Boolean(tenantCtx?.is_global_admin) || Boolean(tenantCtx?.is_system_admin);

  const canEditHistoricalAutoApprove =
    isGlobalOrSystem ||
    (Boolean(tenantCtx?.is_district_admin) &&
      Boolean(effective.allow_district_admin_historical_approve));

  const patch = (partial: DecisionRoutingConfigUpdate) => {
    setDraft(prev => ({ ...prev, ...partial }));
  };

  const handlePreview = async () => {
    if (!districtCode) return;
    try {
      const proposed: DecisionRoutingConfigUpdate = {
        ...draft,
        excluded_contaminants: excludedContaminants,
      };
      const result = await previewDecisionConfigImpact(districtCode, proposed);
      setPreview(result);
      toast({ title: 'Preview complete', description: 'See impact summary below.' });
    } catch (e: unknown) {
      toast({
        variant: 'destructive',
        title: 'Preview failed',
        description: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const handleSave = async () => {
    if (!districtCode || readOnly) return;
    setSaving(true);
    try {
      const body: DecisionRoutingConfigUpdate = {
        ...draft,
        excluded_contaminants: excludedContaminants,
      };
      const saved = await saveDecisionRoutingConfig(districtCode, body);
      setConfig(saved);
      setDraft({});
      setExcludedContaminants(saved.excluded_contaminants || []);
      const hist = await fetchDecisionConfigHistory(districtCode);
      setHistory(hist);
      onConfiguredChange?.(true);
      toast({ title: 'Saved', description: `Decision routing v${saved.version} applied.` });
    } catch (e: unknown) {
      toast({
        variant: 'destructive',
        title: 'Save failed',
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 max-w-4xl">
      {!lockedDistrictCode && districtOptions.length > 1 && (
        <Card>
          <CardContent className="pt-6">
            <Label>District</Label>
            <Select value={districtCode} onValueChange={setDistrictCode}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select district" />
              </SelectTrigger>
              <SelectContent>
                {districtOptions.map(c => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {readOnly && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-3">
          Read-only: District Manager and below can view settings; District Admin can edit.
        </p>
      )}

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {config && !loading && (
        <>
          <Section
            title="Alert triggers"
            description="What creates a Decisions Inbox item after promotion"
          >
            <ToggleRow
              label="First detection"
              hint="New contaminant at a well"
              checked={effective.alert_on_first_detect}
              onCheckedChange={v => patch({ alert_on_first_detect: v })}
              disabled={readOnly}
            />
            <ToggleRow
              label="Drastic change"
              checked={effective.alert_on_drastic_change}
              onCheckedChange={v => patch({ alert_on_drastic_change: v })}
              disabled={readOnly}
            />
            <ToggleRow
              label="Schedule change needed"
              checked={effective.alert_on_schedule_change_needed}
              onCheckedChange={v => patch({ alert_on_schedule_change_needed: v })}
              disabled={readOnly}
            />
            <ToggleRow
              label="MCL exceedance — first occurrence only"
              checked={effective.alert_on_mcl_exceedance_first_only}
              onCheckedChange={v => patch({ alert_on_mcl_exceedance_first_only: v })}
              disabled={readOnly}
            />
            <ToggleRow
              label="Every MCL exceedance"
              checked={effective.alert_on_every_mcl_exceedance}
              onCheckedChange={v => patch({ alert_on_every_mcl_exceedance: v })}
              disabled={readOnly}
            />
            <div className="grid gap-2">
              <Label>MCL dedup window (days)</Label>
              <Input
                type="number"
                min={1}
                value={effective.mcl_repeat_dedup_window_days}
                onChange={e =>
                  patch({ mcl_repeat_dedup_window_days: parseInt(e.target.value, 10) || 90 })
                }
                disabled={readOnly}
              />
            </div>
          </Section>

          {featureFlags.scheduleAutomationEnabled && (
            <Section
              title="Schedule triggers"
              description="What auto-creates a sampling schedule decision after promotion"
            >
              <ScheduleTriggerLevelSelect
                value={effective.schedule_trigger_mcl_level}
                onChange={v => patch({ schedule_trigger_mcl_level: v })}
                readOnly={readOnly}
              />
              <ToggleRow
                label="Trigger on first detection"
                hint="New contaminant at a well always routes to a schedule decision"
                checked={effective.schedule_trigger_on_first_detect}
                onCheckedChange={v => patch({ schedule_trigger_on_first_detect: v })}
                disabled={readOnly}
              />
              <ToggleRow
                label="Trigger on drastic change"
                hint="Large change vs. prior reading routes to a schedule decision. Change-% thresholds are set under Drastic change."
                checked={effective.schedule_trigger_on_drastic_change}
                onCheckedChange={v => patch({ schedule_trigger_on_drastic_change: v })}
                disabled={readOnly}
              />
            </Section>
          )}

          <Section
            title="Approval gates"
            description="Roles required per action"
            defaultOpen={false}
          >
            <RoleSelect
              label="Promote to production"
              value={effective.promote_role}
              onChange={v => patch({ promote_role: v })}
              readOnly={readOnly}
            />
            <RoleSelect
              label="Resolve first-detect alerts"
              value={effective.first_detect_alert_resolve_role}
              onChange={v => patch({ first_detect_alert_resolve_role: v })}
              readOnly={readOnly}
            />
            <RoleSelect
              label="Resolve MCL alerts"
              value={effective.mcl_alert_resolve_role}
              onChange={v => patch({ mcl_alert_resolve_role: v })}
              readOnly={readOnly}
            />
          </Section>

          <Section title="Auto-promotion" description="Verified batch handling" defaultOpen={false}>
            <ToggleRow
              label="Auto-ingest clean rows"
              hint="Passed (non-flagged) staging rows promote automatically; flagged rows stay for review unless historical auto-approve is enabled"
              checked={effective.auto_ingest_clean_rows ?? true}
              onCheckedChange={v => patch({ auto_ingest_clean_rows: v })}
              disabled={readOnly}
            />
            <ToggleRow
              label="Auto-promote verified batches"
              checked={effective.auto_promote_verified}
              onCheckedChange={v => patch({ auto_promote_verified: v })}
              disabled={readOnly}
            />
            <ToggleRow
              label="Auto-approve historical flagged rows (onboarding)"
              hint="During ingestion-mode import, flagged rows older than the district ingestion cutoff are approved automatically"
              checked={effective.auto_approve_historical_flagged ?? false}
              onCheckedChange={v => patch({ auto_approve_historical_flagged: v })}
              disabled={readOnly || !canEditHistoricalAutoApprove}
            />
            {isGlobalOrSystem ? (
              <ToggleRow
                label="Allow District Admins to enable historical auto-approve"
                hint="When on, district admins may toggle historical auto-approve for their district"
                checked={effective.allow_district_admin_historical_approve ?? false}
                onCheckedChange={v => patch({ allow_district_admin_historical_approve: v })}
                disabled={readOnly}
              />
            ) : null}
            <ToggleRow
              label="Block on first detect"
              checked={effective.auto_promote_blocks_on_first_detect}
              onCheckedChange={v => patch({ auto_promote_blocks_on_first_detect: v })}
              disabled={readOnly}
            />
            <ToggleRow
              label="Block on MCL"
              checked={effective.auto_promote_blocks_on_mcl}
              onCheckedChange={v => patch({ auto_promote_blocks_on_mcl: v })}
              disabled={readOnly}
            />
            <ToggleRow
              label="Block on drastic change"
              checked={effective.auto_promote_blocks_on_drastic}
              onCheckedChange={v => patch({ auto_promote_blocks_on_drastic: v })}
              disabled={readOnly}
            />
          </Section>

          <Section
            title="Contaminant filters"
            description="Pre-staging exclusions"
            defaultOpen={false}
            onOpenChange={setContaminantFiltersOpen}
          >
            <ToggleRow
              label="Exclude radiological"
              checked={effective.exclude_radiological}
              onCheckedChange={v => patch({ exclude_radiological: v })}
              disabled={readOnly}
            />
            <div>
              <Label>Excluded contaminants</Label>
              <p className="text-sm text-muted-foreground mt-1 mb-2">
                Search and pick contaminants to drop from lab imports before staging.
              </p>
              {contaminantFiltersOpen && (
                <>
                  {contaminantSuggestionsLoading && contaminantSuggestions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Loading contaminants…</p>
                  ) : (
                    <ContaminantMultiSelect
                      value={excludedContaminants}
                      onChange={setExcludedContaminants}
                      suggestions={contaminantSuggestions}
                      placeholder="Search contaminants to exclude…"
                      disabled={readOnly}
                      allowCustom={false}
                    />
                  )}
                </>
              )}
            </div>
          </Section>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Preview &amp; save
              </CardTitle>
              <CardDescription>Config version {config.version}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => void handlePreview()} disabled={readOnly}>
                  Preview impact (30 days)
                </Button>
                <Button onClick={() => void handleSave()} disabled={readOnly || saving}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Saving…' : 'Save'}
                </Button>
              </div>
              {preview && (
                <pre className="text-xs bg-slate-50 border rounded p-3 overflow-auto max-h-48">
                  {JSON.stringify(preview, null, 2)}
                </pre>
              )}
            </CardContent>
          </Card>

          <Section title="Change history" description="Saved versions" defaultOpen={false}>
            <ul className="space-y-2 text-sm">
              {history.map(h => (
                <li key={h.id} className="border rounded p-2 flex justify-between">
                  <span>v{h.version}</span>
                  <span className="text-muted-foreground">
                    {h.created_at ? new Date(h.created_at).toLocaleString() : ''}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        </>
      )}
    </div>
  );
};

export default DistrictDecisionConfigSection;
