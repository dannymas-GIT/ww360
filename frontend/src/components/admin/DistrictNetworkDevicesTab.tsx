/**
 * District admin — Tailscale setup and registered field device management.
 */
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { getAuthHeader } from '@/services/authService';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Loader2, Network, Shield, Smartphone } from 'lucide-react';
import { useMemo, useState } from 'react';

type DistrictDevice = {
  id: number;
  district_code: string;
  tailscale_ip: string | null;
  tailscale_node_id: string | null;
  tailscale_hostname: string | null;
  device_name: string | null;
  status: string;
  assigned_user_id: number | null;
  assigned_user_name: string | null;
  require_2fa: boolean;
  registered_at: string;
  approved_at: string | null;
  last_seen_at: string | null;
  notes: string | null;
};

type TailscaleInfo = {
  tailnet_hostname: string | null;
  field_entry_url: string | null;
  api_configured: boolean;
  multi_tenant_model: string;
  setup_steps: string[];
};

type CollectorOption = { id: number; label: string };

const statusBadge = (status: string) => {
  if (status === 'approved') return 'bg-green-100 text-green-800';
  if (status === 'revoked') return 'bg-red-100 text-red-800';
  return 'bg-amber-100 text-amber-800';
};

export default function DistrictNetworkDevicesTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [authKey, setAuthKey] = useState<string | null>(null);
  const [newDevice, setNewDevice] = useState({
    device_name: '',
    tailscale_ip: '',
    tailscale_hostname: '',
    tailscale_node_id: '',
    assigned_user_id: '',
    notes: '',
  });

  const { data: networkInfo, isLoading: loadingInfo } = useQuery({
    queryKey: ['district-tailscale-info'],
    queryFn: async () => {
      const res = await fetch('/api/v1/district/network/tailscale-info', {
        headers: { ...getAuthHeader() },
      });
      if (!res.ok) throw new Error('Failed to load Tailscale info');
      return (await res.json()) as TailscaleInfo;
    },
  });

  const { data: devicesData, isLoading: loadingDevices } = useQuery({
    queryKey: ['district-devices'],
    queryFn: async () => {
      const res = await fetch('/api/v1/district/devices', {
        headers: { ...getAuthHeader() },
      });
      if (!res.ok) throw new Error('Failed to load devices');
      return (await res.json()) as { devices: DistrictDevice[]; count: number };
    },
  });

  const { data: collectorsData } = useQuery({
    queryKey: ['district-device-collectors'],
    queryFn: async () => {
      const res = await fetch('/api/v1/sampling-schedules/sample-collectors', {
        headers: { ...getAuthHeader() },
      });
      if (!res.ok) return { collectors: [] as Array<Record<string, unknown>> };
      return (await res.json()) as { collectors: Array<Record<string, unknown>> };
    },
  });

  const collectorOptions: CollectorOption[] = useMemo(
    () =>
      (collectorsData?.collectors || []).map(c => ({
        id: Number(c.id),
        label: `${c.first_name || ''} ${c.last_name || ''}`.trim() || String(c.email || c.id),
      })),
    [collectorsData]
  );

  const authKeyMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/v1/district/devices/auth-key', {
        method: 'POST',
        headers: { ...getAuthHeader() },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Failed' }));
        throw new Error(err.detail || 'Failed to generate auth key');
      }
      return (await res.json()) as { key: string; tags?: string[] };
    },
    onSuccess: data => {
      setAuthKey(data.key);
      toast({
        title: 'Auth key generated',
        description: 'Copy it now — it will not be shown again.',
      });
    },
    onError: (err: Error) => {
      toast({ title: 'Auth key', description: err.message, variant: 'destructive' });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/v1/district/devices', {
        method: 'POST',
        headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_name: newDevice.device_name || null,
          tailscale_ip: newDevice.tailscale_ip || null,
          tailscale_hostname: newDevice.tailscale_hostname || null,
          tailscale_node_id: newDevice.tailscale_node_id || null,
          assigned_user_id: newDevice.assigned_user_id ? Number(newDevice.assigned_user_id) : null,
          require_2fa: true,
          notes: newDevice.notes || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Failed' }));
        throw new Error(err.detail || 'Failed to register device');
      }
      return res.json();
    },
    onSuccess: () => {
      setNewDevice({
        device_name: '',
        tailscale_ip: '',
        tailscale_hostname: '',
        tailscale_node_id: '',
        assigned_user_id: '',
        notes: '',
      });
      queryClient.invalidateQueries({ queryKey: ['district-devices'] });
      toast({
        title: 'Device registered',
        description: 'Approve the device once Tailscale IP is confirmed.',
      });
    },
    onError: (err: Error) => {
      toast({ title: 'Register device', description: err.message, variant: 'destructive' });
    },
  });

  const updateDeviceMutation = useMutation({
    mutationFn: async (payload: { id: number; status?: string; device_name?: string }) => {
      const res = await fetch(`/api/v1/district/devices/${payload.id}`, {
        method: 'PUT',
        headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Failed' }));
        throw new Error(err.detail || 'Failed to update device');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['district-devices'] });
    },
    onError: (err: Error) => {
      toast({ title: 'Update device', description: err.message, variant: 'destructive' });
    },
  });

  const devices = devicesData?.devices || [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Network className="h-5 w-5" />
            Tailscale field access
          </CardTitle>
          <CardDescription>
            Field tablets join the AquaSafe tailnet and use a private entry URL that bypasses the
            public nginx IP whitelist. Registered devices always require 2FA at login.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingInfo ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading network info…
            </p>
          ) : (
            <>
              {networkInfo?.field_entry_url ? (
                <Alert>
                  <AlertDescription>
                    <span className="font-medium">Field entry URL:</span>{' '}
                    <code className="text-sm">{networkInfo.field_entry_url}</code>
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert>
                  <AlertDescription>
                    Set <code>TAILSCALE_APP_HOSTNAME</code> on the server (MagicDNS / tailscale
                    serve hostname) to display the field entry URL here.
                  </AlertDescription>
                </Alert>
              )}
              <ol className="list-decimal list-inside text-sm space-y-1 text-muted-foreground">
                {(networkInfo?.setup_steps || []).map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
              <p className="text-xs text-muted-foreground">
                Multi-tenant model: {networkInfo?.multi_tenant_model || 'single_tailnet_tagged_acl'}
                {' — '}
                districts are isolated with ACL tags (<code>tag:dist-&lt;code&gt;</code>) and
                Postgres RLS, not separate tailnets.
              </p>
            </>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => authKeyMutation.mutate()}
              disabled={authKeyMutation.isPending || networkInfo?.api_configured === false}
            >
              {authKeyMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating…
                </>
              ) : (
                'Generate Tailscale auth key'
              )}
            </Button>
            {authKey && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  void navigator.clipboard.writeText(authKey);
                  toast({ title: 'Copied', description: 'Auth key copied to clipboard.' });
                }}
              >
                <Copy className="h-4 w-4 mr-2" /> Copy key
              </Button>
            )}
          </div>
          {authKey && (
            <Textarea readOnly value={authKey} rows={2} className="font-mono text-xs bg-muted" />
          )}
          {networkInfo?.api_configured === false && (
            <p className="text-xs text-amber-700">
              Tailscale API not configured — a platform administrator must set{' '}
              <code>TAILSCALE_API_KEY</code> in the backend environment and restart the API. Create
              the key in the Tailscale admin console (Settings → Keys → Generate API access token)
              with permission to create devices. Until configured, generate enrollment keys manually
              in Tailscale and share them with district staff.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            If key generation fails with &quot;invalid or not permitted&quot; tags, add{' '}
            <code>tag:dist-&lt;your-district&gt;</code> and <code>tag:aquasafe-field</code> to the
            tailnet ACL <code>tagOwners</code> (see{' '}
            <code>docs/architecture/TAILSCALE_ACL.example.json</code>).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Smartphone className="h-5 w-5" />
            Register field device
          </CardTitle>
          <CardDescription>
            After the device joins Tailscale, record its 100.x IP and approve it.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="device_name">Device name</Label>
            <Input
              id="device_name"
              value={newDevice.device_name}
              onChange={e => setNewDevice(s => ({ ...s, device_name: e.target.value }))}
              placeholder="Field tablet #1"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="tailscale_ip">Tailscale IP (100.x)</Label>
            <Input
              id="tailscale_ip"
              value={newDevice.tailscale_ip}
              onChange={e => setNewDevice(s => ({ ...s, tailscale_ip: e.target.value }))}
              placeholder="100.96.180.58"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="tailscale_hostname">Hostname</Label>
            <Input
              id="tailscale_hostname"
              value={newDevice.tailscale_hostname}
              onChange={e => setNewDevice(s => ({ ...s, tailscale_hostname: e.target.value }))}
              placeholder="tablet-01.tailnet.ts.net"
            />
          </div>
          <div className="space-y-1">
            <Label>Default tester (optional)</Label>
            <Select
              value={newDevice.assigned_user_id || '__none__'}
              onValueChange={v =>
                setNewDevice(s => ({
                  ...s,
                  assigned_user_id: v === '__none__' ? '' : v,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Unassigned</SelectItem>
                {collectorOptions.map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2 space-y-1">
            <Label htmlFor="device_notes">Notes</Label>
            <Textarea
              id="device_notes"
              value={newDevice.notes}
              onChange={e => setNewDevice(s => ({ ...s, notes: e.target.value }))}
              rows={2}
            />
          </div>
          <div className="md:col-span-2">
            <Button
              type="button"
              onClick={() => registerMutation.mutate()}
              disabled={registerMutation.isPending}
            >
              {registerMutation.isPending ? 'Registering…' : 'Register device (pending approval)'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5" />
            Registered devices
          </CardTitle>
          <CardDescription>
            Approved devices force 2FA on login. Revoke lost or decommissioned tablets immediately.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingDevices ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading devices…
            </p>
          ) : devices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No devices registered yet.</p>
          ) : (
            <div className="space-y-3">
              {devices.map(device => (
                <div
                  key={device.id}
                  className="rounded-lg border p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">
                        {device.device_name || device.tailscale_hostname || `Device #${device.id}`}
                      </span>
                      <Badge className={statusBadge(device.status)}>{device.status}</Badge>
                      {device.require_2fa && <Badge variant="outline">2FA required</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      IP: {device.tailscale_ip || '—'} · Tester:{' '}
                      {device.assigned_user_name || 'Unassigned'}
                    </p>
                    {device.last_seen_at && (
                      <p className="text-xs text-muted-foreground">
                        Last seen: {new Date(device.last_seen_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {device.status !== 'approved' && (
                      <Button
                        size="sm"
                        onClick={() =>
                          updateDeviceMutation.mutate({ id: device.id, status: 'approved' })
                        }
                        disabled={updateDeviceMutation.isPending}
                      >
                        Approve
                      </Button>
                    )}
                    {device.status !== 'revoked' && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          updateDeviceMutation.mutate({ id: device.id, status: 'revoked' })
                        }
                        disabled={updateDeviceMutation.isPending}
                      >
                        Revoke
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
