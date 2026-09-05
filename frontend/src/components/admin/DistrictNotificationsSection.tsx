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
  createAlertContact,
  createEscalationPolicy,
  deleteAlertContact,
  deleteEscalationPolicy,
  DELIVERY_DEFAULT_ALERT_TYPES,
  fetchAlertContacts,
  fetchEscalationPolicies,
  type AlertContact,
  type DeliveryDefaultPreview,
  type DeliveryDefaultsMap,
  type EscalationPolicy,
  type EscalationTier,
  previewDeliveryDefaultNotification,
  sendDeliveryDefaultTestNotification,
  updateAlertContact,
  updateEscalationPolicy,
} from '@/services/alertNotificationService';
import {
  fetchDecisionRoutingConfig,
  saveDecisionRoutingConfig,
  ROLE_OPTIONS,
} from '@/services/decisionRoutingConfigService';
import type { DeliveryConfig } from '@/services/triggerRulesService';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AlertNotificationPreview } from '@/components/admin/AlertNotificationPreview';
import { Bell, Loader2, Plus, Save, TestTube, Trash2 } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

const emptyContact = () => ({
  name: '',
  email: '',
  phone: '',
  preferred_method: 'email',
});

const emptyTier = (): EscalationTier => ({
  delay_minutes: 60,
  roles: ['district_admin'],
  recipient_ids: [],
  channels: [],
});

export interface DistrictNotificationsSectionProps {
  lockedDistrictCode?: string;
}

export const DistrictNotificationsSection: React.FC<DistrictNotificationsSectionProps> = ({
  lockedDistrictCode,
}) => {
  const { toast } = useToast();
  const { data: tenantCtx, isLoading: tenantLoading } = useTenantAuthContext();
  const districtCode = lockedDistrictCode || tenantCtx?.district_code || '';
  const readOnly =
    !tenantCtx?.is_district_admin && !tenantCtx?.is_global_admin && !tenantCtx?.is_system_admin;

  const [contacts, setContacts] = useState<AlertContact[]>([]);
  const [policies, setPolicies] = useState<EscalationPolicy[]>([]);
  const [deliveryDefaults, setDeliveryDefaults] = useState<DeliveryDefaultsMap>({});
  const [loading, setLoading] = useState(false);
  const [savingDefaults, setSavingDefaults] = useState(false);
  const [contactDraft, setContactDraft] = useState(emptyContact());
  const [policyDraft, setPolicyDraft] = useState({
    name: '',
    alert_types: [] as string[],
    min_severity: '',
    tiers: [emptyTier()] as EscalationTier[],
    haunt_enabled: false,
    haunt_interval_minutes: 30,
    haunt_max_reminders: 3,
  });
  const [testPreview, setTestPreview] = useState<DeliveryDefaultPreview | null>(null);
  const [testAlertType, setTestAlertType] = useState<{ key: string; label: string } | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testSending, setTestSending] = useState(false);

  const loadAll = useCallback(async () => {
    if (!districtCode) return;
    setLoading(true);
    try {
      const [contactRows, policyRows, config] = await Promise.all([
        fetchAlertContacts(false),
        fetchEscalationPolicies(districtCode),
        fetchDecisionRoutingConfig(districtCode),
      ]);
      setContacts(contactRows);
      setPolicies(policyRows);
      setDeliveryDefaults((config.delivery_defaults as DeliveryDefaultsMap) || {});
    } catch (e) {
      toast({
        title: 'Failed to load notification settings',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [districtCode, toast]);

  useEffect(() => {
    if (!tenantLoading && districtCode) void loadAll();
  }, [tenantLoading, districtCode, loadAll]);

  const saveContact = async () => {
    if (!contactDraft.name.trim() || !contactDraft.email.trim()) return;
    try {
      await createAlertContact({
        name: contactDraft.name.trim(),
        email: contactDraft.email.trim(),
        phone: contactDraft.phone.trim() || undefined,
        preferred_method: contactDraft.preferred_method,
      });
      setContactDraft(emptyContact());
      toast({ title: 'Contact added' });
      await loadAll();
    } catch (e) {
      toast({
        title: 'Failed to add contact',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const toggleContactActive = async (contact: AlertContact) => {
    try {
      await updateAlertContact(contact.id, { is_active: !contact.is_active });
      await loadAll();
    } catch (e) {
      toast({
        title: 'Update failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const removeContact = async (contact: AlertContact) => {
    try {
      await deleteAlertContact(contact.id);
      toast({ title: 'Contact removed' });
      await loadAll();
    } catch (e) {
      toast({
        title: 'Delete failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const patchDefault = (alertType: string, patch: Partial<DeliveryConfig>) => {
    setDeliveryDefaults(prev => ({
      ...prev,
      [alertType]: { ...(prev[alertType] ?? {}), ...patch },
    }));
  };

  const toggleDefaultRole = (alertType: string, role: string, checked: boolean) => {
    const current = deliveryDefaults[alertType]?.roles ?? [];
    const next = checked ? [...new Set([...current, role])] : current.filter(r => r !== role);
    patchDefault(alertType, { roles: next });
  };

  const toggleDefaultContact = (alertType: string, contactId: number, checked: boolean) => {
    const current = deliveryDefaults[alertType]?.recipient_ids ?? [];
    const next = checked
      ? [...new Set([...current, contactId])]
      : current.filter(id => id !== contactId);
    patchDefault(alertType, { recipient_ids: next });
  };

  const saveDefaults = async () => {
    if (!districtCode) return;
    setSavingDefaults(true);
    try {
      await saveDecisionRoutingConfig(districtCode, { delivery_defaults: deliveryDefaults });
      toast({ title: 'Delivery defaults saved' });
    } catch (e) {
      toast({
        title: 'Save failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSavingDefaults(false);
    }
  };

  const openTestPreview = async (alertType: { key: string; label: string }) => {
    if (!districtCode) return;
    setTestAlertType(alertType);
    setTestPreview(null);
    setTestLoading(true);
    try {
      const preview = await previewDeliveryDefaultNotification(
        districtCode,
        alertType.key,
        deliveryDefaults[alertType.key]
      );
      setTestPreview(preview);
    } catch (e) {
      setTestAlertType(null);
      toast({
        title: 'Preview failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setTestLoading(false);
    }
  };

  const sendTestNotification = async () => {
    if (!districtCode || !testAlertType) return;
    setTestSending(true);
    try {
      const result = await sendDeliveryDefaultTestNotification(
        districtCode,
        testAlertType.key,
        deliveryDefaults[testAlertType.key]
      );
      setTestPreview(result);
      toast({
        title: 'Test notification sent',
        description: result.alert_id
          ? `Created test alert #${result.alert_id}. Check inbox and delivery log below.`
          : 'Notification dispatched.',
      });
    } catch (e) {
      toast({
        title: 'Send failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setTestSending(false);
    }
  };

  const savePolicy = async () => {
    if (!districtCode || !policyDraft.name.trim()) return;
    const hasTiers = policyDraft.tiers.length > 0;
    const hasHaunt = policyDraft.haunt_enabled && policyDraft.haunt_interval_minutes >= 5;
    if (!hasTiers && !hasHaunt) {
      toast({
        title: 'Policy incomplete',
        description: 'Add at least one escalation tier or enable reminders.',
        variant: 'destructive',
      });
      return;
    }
    try {
      await createEscalationPolicy(districtCode, {
        name: policyDraft.name.trim(),
        alert_types: policyDraft.alert_types,
        min_severity: policyDraft.min_severity || null,
        tiers: policyDraft.tiers,
        haunt_interval_minutes: hasHaunt ? policyDraft.haunt_interval_minutes : null,
        haunt_max_reminders: policyDraft.haunt_max_reminders,
        is_active: true,
      });
      setPolicyDraft({
        name: '',
        alert_types: [],
        min_severity: '',
        tiers: [emptyTier()],
        haunt_enabled: false,
        haunt_interval_minutes: 30,
        haunt_max_reminders: 3,
      });
      toast({ title: 'Escalation policy created' });
      await loadAll();
    } catch (e) {
      toast({
        title: 'Create failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const togglePolicyActive = async (policy: EscalationPolicy) => {
    try {
      await updateEscalationPolicy(districtCode, policy.id, { is_active: !policy.is_active });
      await loadAll();
    } catch (e) {
      toast({
        title: 'Update failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const removePolicy = async (policy: EscalationPolicy) => {
    try {
      await deleteEscalationPolicy(districtCode, policy.id);
      toast({ title: 'Policy removed' });
      await loadAll();
    } catch (e) {
      toast({
        title: 'Delete failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  if (loading && contacts.length === 0) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground p-6">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading notification settings…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" /> Contact directory
          </CardTitle>
          <CardDescription>
            Named contacts for alert delivery (email and SMS). Used alongside role-based routing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!readOnly ? (
            <div className="grid gap-3 md:grid-cols-4">
              <Input
                placeholder="Name"
                value={contactDraft.name}
                onChange={e => setContactDraft(d => ({ ...d, name: e.target.value }))}
              />
              <Input
                placeholder="Email"
                value={contactDraft.email}
                onChange={e => setContactDraft(d => ({ ...d, email: e.target.value }))}
              />
              <Input
                placeholder="Phone (SMS)"
                value={contactDraft.phone}
                onChange={e => setContactDraft(d => ({ ...d, phone: e.target.value }))}
              />
              <Button onClick={() => void saveContact()}>
                <Plus className="h-4 w-4 mr-2" /> Add contact
              </Button>
            </div>
          ) : null}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                {!readOnly ? <TableHead>Actions</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    No contacts configured
                  </TableCell>
                </TableRow>
              ) : (
                contacts.map(c => (
                  <TableRow key={c.id}>
                    <TableCell>{c.name}</TableCell>
                    <TableCell>{c.email}</TableCell>
                    <TableCell>{c.phone || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={c.is_active ? 'default' : 'secondary'}>
                        {c.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    {!readOnly ? (
                      <TableCell className="text-right space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void toggleContactActive(c)}
                        >
                          {c.is_active ? 'Deactivate' : 'Activate'}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => void removeContact(c)}>
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
          <CardTitle>Delivery defaults by alert type</CardTitle>
          <CardDescription>
            Default channels, roles, and contacts for scheduled and system alert types.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {DELIVERY_DEFAULT_ALERT_TYPES.map(({ key, label }) => {
            const cfg = deliveryDefaults[key] ?? {};
            return (
              <div key={key} className="rounded-md border p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium">{label}</div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void openTestPreview({ key, label })}
                    disabled={!districtCode || testLoading}
                  >
                    {testLoading && testAlertType?.key === key ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <TestTube className="h-4 w-4 mr-2" />
                    )}
                    Test
                  </Button>
                </div>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={cfg.popup ?? true}
                      onCheckedChange={v => patchDefault(key, { popup: v })}
                      disabled={readOnly}
                    />
                    Popup
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={cfg.email ?? false}
                      onCheckedChange={v => patchDefault(key, { email: v })}
                      disabled={readOnly}
                    />
                    Email
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={cfg.sms ?? false}
                      onCheckedChange={v => patchDefault(key, { sms: v })}
                      disabled={readOnly}
                    />
                    SMS
                  </label>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Roles</Label>
                  <div className="flex flex-wrap gap-2">
                    {ROLE_OPTIONS.map(role => (
                      <label
                        key={role.value}
                        className="flex items-center gap-1 text-xs border rounded px-2 py-1"
                      >
                        <input
                          type="checkbox"
                          checked={(cfg.roles ?? []).includes(role.value)}
                          onChange={e => toggleDefaultRole(key, role.value, e.target.checked)}
                          disabled={readOnly}
                        />
                        {role.label}
                      </label>
                    ))}
                  </div>
                </div>
                {contacts.length > 0 ? (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Named contacts</Label>
                    <div className="flex flex-wrap gap-2">
                      {contacts
                        .filter(c => c.is_active)
                        .map(c => (
                          <label
                            key={c.id}
                            className="flex items-center gap-1 text-xs border rounded px-2 py-1"
                          >
                            <input
                              type="checkbox"
                              checked={(cfg.recipient_ids ?? []).includes(c.id)}
                              onChange={e => toggleDefaultContact(key, c.id, e.target.checked)}
                              disabled={readOnly}
                            />
                            {c.name}
                          </label>
                        ))}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
          {!readOnly ? (
            <Button onClick={() => void saveDefaults()} disabled={savingDefaults}>
              {savingDefaults ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save delivery defaults
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(testAlertType)}
        onOpenChange={open => {
          if (!open) {
            setTestAlertType(null);
            setTestPreview(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TestTube className="h-5 w-5" />
              {testAlertType?.label ?? 'Notification preview'}
            </DialogTitle>
          </DialogHeader>
          {testLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-8">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading preview…
            </div>
          ) : testPreview ? (
            <div className="space-y-4">
              <AlertNotificationPreview preview={testPreview} showPlainBody />
              {testPreview.dispatch_results?.length ? (
                <div>
                  <Label className="text-xs text-muted-foreground">DISPATCH RESULTS</Label>
                  <div className="mt-1 space-y-2">
                    {testPreview.dispatch_results.map((row, idx) => (
                      <div key={idx} className="text-sm border rounded p-2 flex flex-wrap gap-2">
                        <Badge variant="outline">{row.channel}</Badge>
                        <span>{row.recipient_label || row.recipient_address || '—'}</span>
                        <Badge
                          variant={
                            row.status === 'sent'
                              ? 'default'
                              : row.status === 'skipped'
                                ? 'secondary'
                                : 'destructive'
                          }
                        >
                          {row.status}
                        </Badge>
                        {row.error_message ? (
                          <span className="text-muted-foreground">{row.error_message}</span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setTestAlertType(null)}>
              Close
            </Button>
            {!readOnly ? (
              <Button
                onClick={() => void sendTestNotification()}
                disabled={testLoading || testSending || !testPreview}
              >
                {testSending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <TestTube className="h-4 w-4 mr-2" />
                )}
                Send test notification
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Escalation policies</CardTitle>
          <CardDescription>
            If an alert stays unacknowledged, notify the next tier after the configured delay.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!readOnly ? (
            <div className="rounded-md border p-4 space-y-3">
              <Input
                placeholder="Policy name"
                value={policyDraft.name}
                onChange={e => setPolicyDraft(p => ({ ...p, name: e.target.value }))}
              />
              <Input
                placeholder="Alert types (comma-separated, empty = all)"
                value={policyDraft.alert_types.join(', ')}
                onChange={e =>
                  setPolicyDraft(p => ({
                    ...p,
                    alert_types: e.target.value
                      .split(',')
                      .map(s => s.trim())
                      .filter(Boolean),
                  }))
                }
              />
              <Select
                value={policyDraft.min_severity || 'none'}
                onValueChange={v =>
                  setPolicyDraft(p => ({ ...p, min_severity: v === 'none' ? '' : v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Minimum severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Any severity</SelectItem>
                  <SelectItem value="warning">Warning+</SelectItem>
                  <SelectItem value="critical">Critical+</SelectItem>
                  <SelectItem value="violation">Violation only</SelectItem>
                </SelectContent>
              </Select>
              <div className="rounded-md border p-3 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label className="font-medium">Reminders (haunt)</Label>
                    <p className="text-xs text-muted-foreground">
                      Re-notify original recipients on an interval until acknowledged.
                    </p>
                  </div>
                  <Switch
                    checked={policyDraft.haunt_enabled}
                    onCheckedChange={v => setPolicyDraft(p => ({ ...p, haunt_enabled: v }))}
                  />
                </div>
                {policyDraft.haunt_enabled ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <Label>Interval (minutes)</Label>
                      <Input
                        type="number"
                        min={5}
                        value={policyDraft.haunt_interval_minutes}
                        onChange={e =>
                          setPolicyDraft(p => ({
                            ...p,
                            haunt_interval_minutes: Number(e.target.value) || 30,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <Label>Max reminders</Label>
                      <Input
                        type="number"
                        min={1}
                        max={50}
                        value={policyDraft.haunt_max_reminders}
                        onChange={e =>
                          setPolicyDraft(p => ({
                            ...p,
                            haunt_max_reminders: Number(e.target.value) || 3,
                          }))
                        }
                      />
                    </div>
                  </div>
                ) : null}
              </div>
              {policyDraft.tiers.map((tier, idx) => (
                <div key={idx} className="grid gap-2 md:grid-cols-3 border rounded p-3">
                  <div>
                    <Label>Tier {idx + 1} delay (minutes)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={tier.delay_minutes}
                      onChange={e =>
                        setPolicyDraft(p => {
                          const tiers = [...p.tiers];
                          tiers[idx] = {
                            ...tiers[idx],
                            delay_minutes: Number(e.target.value) || 60,
                          };
                          return { ...p, tiers };
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>Roles (comma-separated)</Label>
                    <Input
                      value={(tier.roles ?? []).join(', ')}
                      onChange={e =>
                        setPolicyDraft(p => {
                          const tiers = [...p.tiers];
                          tiers[idx] = {
                            ...tiers[idx],
                            roles: e.target.value
                              .split(',')
                              .map(s => s.trim())
                              .filter(Boolean),
                          };
                          return { ...p, tiers };
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>Channels</Label>
                    <Input
                      value={(tier.channels ?? ['email']).join(', ')}
                      onChange={e =>
                        setPolicyDraft(p => {
                          const tiers = [...p.tiers];
                          tiers[idx] = {
                            ...tiers[idx],
                            channels: e.target.value
                              .split(',')
                              .map(s => s.trim())
                              .filter(Boolean),
                          };
                          return { ...p, tiers };
                        })
                      }
                    />
                  </div>
                </div>
              ))}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setPolicyDraft(p => ({ ...p, tiers: [...p.tiers, emptyTier()] }))}
                >
                  <Plus className="h-4 w-4 mr-2" /> Add tier
                </Button>
                <Button onClick={() => void savePolicy()}>Create policy</Button>
              </div>
            </div>
          ) : null}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Types</TableHead>
                <TableHead>Tiers</TableHead>
                <TableHead>Reminders</TableHead>
                <TableHead>Status</TableHead>
                {!readOnly ? <TableHead>Actions</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {policies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    No escalation policies
                  </TableCell>
                </TableRow>
              ) : (
                policies.map(p => (
                  <TableRow key={p.id}>
                    <TableCell>{p.name}</TableCell>
                    <TableCell className="text-xs">
                      {(p.alert_types ?? []).length ? p.alert_types.join(', ') : 'All types'}
                    </TableCell>
                    <TableCell>{(p.tiers ?? []).length}</TableCell>
                    <TableCell className="text-xs">
                      {p.haunt_interval_minutes
                        ? `every ${p.haunt_interval_minutes} min × ${p.haunt_max_reminders}`
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.is_active ? 'default' : 'secondary'}>
                        {p.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    {!readOnly ? (
                      <TableCell className="text-right space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void togglePolicyActive(p)}
                        >
                          {p.is_active ? 'Deactivate' : 'Activate'}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => void removePolicy(p)}>
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

export default DistrictNotificationsSection;
