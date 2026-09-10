import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { useTenantAuthContext } from '@/hooks/useTenantAuthContext';
import {
  CHANGE_MODE_OPTIONS,
  deleteTriggerRule,
  fetchTriggerRules,
  LEVEL_MODE_OPTIONS,
  previewTriggerRule,
  saveTriggerRule,
  type ChangeMode,
  type DeliveryConfig,
  type LevelMode,
  type TriggerRule,
  type TriggerRuleUpsert,
} from '@/services/triggerRulesService';
import { fetchAlertContacts, type AlertContact } from '@/services/alertNotificationService';
import { ROLE_OPTIONS } from '@/services/decisionRoutingConfigService';
import { Loader2, Plus, Save, Trash2, Zap } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

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

type RuleDraft = TriggerRuleUpsert & { id?: number };

const emptyDistrictDraft = (): RuleDraft => ({
  scope: 'district',
  level_mode: 'mcl_pct',
  change_mode: 'pct',
  delivery: { popup: true, email: false, sms: false, recipients: [], roles: [], recipient_ids: [] },
});

function scopeLabel(rule: TriggerRule): string {
  if (rule.scope === 'district') return 'District default';
  if (rule.scope === 'contaminant')
    return rule.contaminant_name || `Contaminant #${rule.contaminant_id}`;
  return `Well ${rule.well_id} · ${rule.contaminant_name || rule.contaminant_id}`;
}

export interface DistrictTriggerRulesSectionProps {
  lockedDistrictCode?: string;
}

export const DistrictTriggerRulesSection: React.FC<DistrictTriggerRulesSectionProps> = ({
  lockedDistrictCode,
}) => {
  const { toast } = useToast();
  const { data: tenantCtx, isLoading: tenantLoading } = useTenantAuthContext();
  const districtCode = lockedDistrictCode || tenantCtx?.district_code || '';
  const readOnly =
    !tenantCtx?.is_district_admin && !tenantCtx?.is_global_admin && !tenantCtx?.is_system_admin;

  const [rules, setRules] = useState<TriggerRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [districtDraft, setDistrictDraft] = useState<RuleDraft>(emptyDistrictDraft());
  const [newContaminant, setNewContaminant] = useState('');
  const [newWellId, setNewWellId] = useState('');
  const [newWellContaminant, setNewWellContaminant] = useState('');
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [contacts, setContacts] = useState<AlertContact[]>([]);

  const districtRule = useMemo(() => rules.find(r => r.scope === 'district') ?? null, [rules]);
  const contaminantRules = useMemo(() => rules.filter(r => r.scope === 'contaminant'), [rules]);
  const wellContaminantRules = useMemo(
    () => rules.filter(r => r.scope === 'well_contaminant'),
    [rules]
  );

  const loadRules = useCallback(async () => {
    if (!districtCode) return;
    setLoading(true);
    try {
      const rows = await fetchTriggerRules(districtCode);
      setRules(rows);
      try {
        const contactRows = await fetchAlertContacts(true);
        setContacts(contactRows);
      } catch {
        setContacts([]);
      }
      const d = rows.find(r => r.scope === 'district');
      if (d) {
        setDistrictDraft({
          scope: 'district',
          level_mode: (d.level_mode as LevelMode) ?? 'mcl_pct',
          level_value: d.level_value ?? undefined,
          level_unit: d.level_unit ?? undefined,
          change_mode: (d.change_mode as ChangeMode) ?? 'pct',
          change_value: d.change_value ?? undefined,
          change_unit: d.change_unit ?? undefined,
          trigger_on_first_detect: d.trigger_on_first_detect ?? undefined,
          trigger_on_drastic: d.trigger_on_drastic ?? undefined,
          trigger_on_mcl: d.trigger_on_mcl ?? undefined,
          create_schedule: d.create_schedule ?? undefined,
          create_alert: d.create_alert ?? undefined,
          delivery: d.delivery ?? undefined,
          id: d.id,
        });
      } else {
        setDistrictDraft(emptyDistrictDraft());
      }
    } catch (e) {
      toast({
        title: 'Failed to load trigger rules',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [districtCode, toast]);

  useEffect(() => {
    if (!tenantLoading && districtCode) void loadRules();
  }, [tenantLoading, districtCode, loadRules]);

  const patchDelivery = (patch: Partial<DeliveryConfig>) => {
    setDistrictDraft(d => ({
      ...d,
      delivery: { ...(d.delivery ?? {}), ...patch },
    }));
  };

  const toggleDeliveryRole = (role: string, checked: boolean) => {
    const current = districtDraft.delivery?.roles ?? [];
    const next = checked ? [...new Set([...current, role])] : current.filter(r => r !== role);
    patchDelivery({ roles: next });
  };

  const toggleDeliveryContact = (contactId: number, checked: boolean) => {
    const current = districtDraft.delivery?.recipient_ids ?? [];
    const next = checked
      ? [...new Set([...current, contactId])]
      : current.filter(id => id !== contactId);
    patchDelivery({ recipient_ids: next });
  };

  const saveDistrictDefault = async () => {
    if (!districtCode) return;
    setSaving(true);
    try {
      await saveTriggerRule(districtCode, { ...districtDraft, scope: 'district' });
      toast({ title: 'District trigger rule saved' });
      await loadRules();
    } catch (e) {
      toast({
        title: 'Save failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const addContaminantRule = async () => {
    const name = newContaminant.trim();
    if (!name || !districtCode) return;
    setSaving(true);
    try {
      await saveTriggerRule(districtCode, {
        scope: 'contaminant',
        contaminant_name: name,
        level_mode: 'mcl_pct',
        change_mode: 'pct',
        delivery: { popup: true, email: false, sms: false },
      });
      setNewContaminant('');
      toast({ title: 'Contaminant override added' });
      await loadRules();
    } catch (e) {
      toast({
        title: 'Add failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const addWellContaminantRule = async () => {
    const wellId = Number(newWellId);
    const name = newWellContaminant.trim();
    if (!wellId || !name || !districtCode) return;
    setSaving(true);
    try {
      await saveTriggerRule(districtCode, {
        scope: 'well_contaminant',
        well_id: wellId,
        contaminant_name: name,
        level_mode: 'mcl_pct',
        change_mode: 'pct',
        delivery: { popup: true, email: false, sms: false },
      });
      setNewWellId('');
      setNewWellContaminant('');
      toast({ title: 'Well+contaminant override added' });
      await loadRules();
    } catch (e) {
      toast({
        title: 'Add failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const removeRule = async (rule: TriggerRule) => {
    if (!districtCode) return;
    try {
      await deleteTriggerRule(districtCode, rule.id);
      toast({ title: 'Rule removed' });
      await loadRules();
    } catch (e) {
      toast({
        title: 'Delete failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const runPreview = async () => {
    if (!districtCode) return;
    try {
      const result = await previewTriggerRule(districtCode, {
        sample: { mcl_pct: 55, is_first_detect: false, is_mcl_exceedance: false },
      });
      setPreview(result as unknown as Record<string, unknown>);
    } catch (e) {
      toast({
        title: 'Preview failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  if (!districtCode) {
    return (
      <Card>
        <CardContent className="p-6 text-muted-foreground">
          Select a district to configure trigger rules.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Trigger rules</CardTitle>
          <CardDescription>
            Granular thresholds and delivery for schedule and alert triggers. Most specific wins:
            well+contaminant → contaminant → district default.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">
                  District: {districtRule ? 'custom' : 'routing defaults'}
                </Badge>
                <Badge variant="secondary">{contaminantRules.length} contaminant overrides</Badge>
                <Badge variant="secondary">
                  {wellContaminantRules.length} well+contaminant overrides
                </Badge>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => void runPreview()}>
                <Zap className="h-4 w-4 mr-2" />
                Preview district default (55% MCL sample)
              </Button>
              {preview ? (
                <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-40">
                  {JSON.stringify(preview, null, 2)}
                </pre>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">District default</CardTitle>
          <CardDescription>
            Base rule layered on decision routing defaults. Leave toggles unset to inherit.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>Level mode</Label>
              <Select
                value={districtDraft.level_mode ?? 'mcl_pct'}
                onValueChange={v => setDistrictDraft(d => ({ ...d, level_mode: v as LevelMode }))}
                disabled={readOnly}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEVEL_MODE_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Level value</Label>
              <Input
                type="number"
                min={0}
                value={districtDraft.level_value ?? ''}
                onChange={e =>
                  setDistrictDraft(d => ({
                    ...d,
                    level_value: e.target.value === '' ? undefined : Number(e.target.value),
                  }))
                }
                disabled={readOnly}
                placeholder="e.g. 50 for 50% MCL"
              />
            </div>
            <div className="grid gap-2">
              <Label>Change mode</Label>
              <Select
                value={districtDraft.change_mode ?? 'pct'}
                onValueChange={v => setDistrictDraft(d => ({ ...d, change_mode: v as ChangeMode }))}
                disabled={readOnly}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHANGE_MODE_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Change threshold</Label>
              <Input
                type="number"
                min={0}
                value={districtDraft.change_value ?? ''}
                onChange={e =>
                  setDistrictDraft(d => ({
                    ...d,
                    change_value: e.target.value === '' ? undefined : Number(e.target.value),
                  }))
                }
                disabled={readOnly}
                placeholder="% or absolute delta"
              />
            </div>
          </div>

          <ToggleRow
            label="Trigger on first detect"
            checked={districtDraft.trigger_on_first_detect ?? true}
            onCheckedChange={v => setDistrictDraft(d => ({ ...d, trigger_on_first_detect: v }))}
            disabled={readOnly}
          />
          <ToggleRow
            label="Trigger on drastic change"
            checked={districtDraft.trigger_on_drastic ?? true}
            onCheckedChange={v => setDistrictDraft(d => ({ ...d, trigger_on_drastic: v }))}
            disabled={readOnly}
          />
          <ToggleRow
            label="Trigger on MCL exceedance"
            checked={districtDraft.trigger_on_mcl ?? true}
            onCheckedChange={v => setDistrictDraft(d => ({ ...d, trigger_on_mcl: v }))}
            disabled={readOnly}
          />
          <ToggleRow
            label="Create schedule decisions"
            checked={districtDraft.create_schedule ?? true}
            onCheckedChange={v => setDistrictDraft(d => ({ ...d, create_schedule: v }))}
            disabled={readOnly}
          />
          <ToggleRow
            label="Create alerts"
            checked={districtDraft.create_alert ?? true}
            onCheckedChange={v => setDistrictDraft(d => ({ ...d, create_alert: v }))}
            disabled={readOnly}
          />

          <div className="rounded-md border p-4 space-y-3">
            <Label className="font-medium">Delivery channels</Label>
            <ToggleRow
              label="In-app popup"
              checked={districtDraft.delivery?.popup ?? true}
              onCheckedChange={v => patchDelivery({ popup: v })}
              disabled={readOnly}
            />
            <ToggleRow
              label="Email (when enabled server-side)"
              checked={districtDraft.delivery?.email ?? false}
              onCheckedChange={v => patchDelivery({ email: v })}
              disabled={readOnly}
            />
            <ToggleRow
              label="SMS (when enabled server-side)"
              checked={districtDraft.delivery?.sms ?? false}
              onCheckedChange={v => patchDelivery({ sms: v })}
              disabled={readOnly}
            />
            <div className="grid gap-2">
              <Label>Extra email recipients (comma-separated)</Label>
              <Input
                value={(districtDraft.delivery?.recipients ?? []).join(', ')}
                onChange={e =>
                  patchDelivery({
                    recipients: e.target.value
                      .split(',')
                      .map(s => s.trim())
                      .filter(Boolean),
                  })
                }
                disabled={readOnly}
                placeholder="ops@district.gov"
              />
            </div>
            <div className="space-y-2">
              <Label>Notify roles</Label>
              <div className="flex flex-wrap gap-2">
                {ROLE_OPTIONS.map(role => (
                  <label
                    key={role.value}
                    className="flex items-center gap-1 text-xs border rounded px-2 py-1"
                  >
                    <input
                      type="checkbox"
                      checked={(districtDraft.delivery?.roles ?? []).includes(role.value)}
                      onChange={e => toggleDeliveryRole(role.value, e.target.checked)}
                      disabled={readOnly}
                    />
                    {role.label}
                  </label>
                ))}
              </div>
            </div>
            {contacts.length > 0 ? (
              <div className="space-y-2">
                <Label>Named contacts</Label>
                <div className="flex flex-wrap gap-2">
                  {contacts.map(c => (
                    <label
                      key={c.id}
                      className="flex items-center gap-1 text-xs border rounded px-2 py-1"
                    >
                      <input
                        type="checkbox"
                        checked={(districtDraft.delivery?.recipient_ids ?? []).includes(c.id)}
                        onChange={e => toggleDeliveryContact(c.id, e.target.checked)}
                        disabled={readOnly}
                      />
                      {c.name}
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {!readOnly ? (
            <Button onClick={() => void saveDistrictDefault()} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save district default
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Per-contaminant overrides</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!readOnly ? (
            <div className="flex flex-wrap gap-2">
              <Input
                className="max-w-xs"
                placeholder="Contaminant name"
                value={newContaminant}
                onChange={e => setNewContaminant(e.target.value)}
              />
              <Button onClick={() => void addContaminantRule()} disabled={saving}>
                <Plus className="h-4 w-4 mr-2" /> Add
              </Button>
            </div>
          ) : null}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Scope</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Change</TableHead>
                <TableHead>Delivery</TableHead>
                {!readOnly ? <TableHead>Actions</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {contaminantRules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    No contaminant overrides
                  </TableCell>
                </TableRow>
              ) : (
                contaminantRules.map(r => (
                  <TableRow key={r.id}>
                    <TableCell>{scopeLabel(r)}</TableCell>
                    <TableCell>
                      {r.level_mode ?? 'inherit'}{' '}
                      {r.level_value != null ? `@ ${r.level_value}` : ''}
                    </TableCell>
                    <TableCell>
                      {r.change_mode ?? 'inherit'}{' '}
                      {r.change_value != null ? `@ ${r.change_value}` : ''}
                    </TableCell>
                    <TableCell>
                      popup={String(r.delivery?.popup ?? 'inherit')} email=
                      {String(r.delivery?.email ?? false)}
                    </TableCell>
                    {!readOnly ? (
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => void removeRule(r)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Per well + contaminant</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!readOnly ? (
            <div className="flex flex-wrap gap-2">
              <Input
                className="w-28"
                placeholder="Well ID"
                value={newWellId}
                onChange={e => setNewWellId(e.target.value)}
              />
              <Input
                className="max-w-xs"
                placeholder="Contaminant name"
                value={newWellContaminant}
                onChange={e => setNewWellContaminant(e.target.value)}
              />
              <Button onClick={() => void addWellContaminantRule()} disabled={saving}>
                <Plus className="h-4 w-4 mr-2" /> Add
              </Button>
            </div>
          ) : null}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Scope</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Change</TableHead>
                {!readOnly ? <TableHead>Actions</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {wellContaminantRules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    No well+contaminant overrides
                  </TableCell>
                </TableRow>
              ) : (
                wellContaminantRules.map(r => (
                  <TableRow key={r.id}>
                    <TableCell>{scopeLabel(r)}</TableCell>
                    <TableCell>
                      {r.level_mode ?? 'inherit'}{' '}
                      {r.level_value != null ? `@ ${r.level_value}` : ''}
                    </TableCell>
                    <TableCell>
                      {r.change_mode ?? 'inherit'}{' '}
                      {r.change_value != null ? `@ ${r.change_value}` : ''}
                    </TableCell>
                    {!readOnly ? (
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => void removeRule(r)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default DistrictTriggerRulesSection;
