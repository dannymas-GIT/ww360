import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useTenantAuthContext } from '@/hooks/useTenantAuthContext';
import { getAuthHeader } from '@/services/authService';
import { isOfflineReadAllowedByDeployment } from '@/lib/offline/offlineConfig';
import { WifiOff } from 'lucide-react';
import React, { useEffect, useState } from 'react';

interface OfflineReadConfig {
  pwa_shell_enabled: boolean;
  offline_read_enabled: boolean;
}

const DEFAULT_CONFIG: OfflineReadConfig = {
  pwa_shell_enabled: false,
  offline_read_enabled: false,
};

const DistrictOfflineReadConfigSection: React.FC = () => {
  const { toast } = useToast();
  const { data: tenantCtx } = useTenantAuthContext();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [config, setConfig] = useState<OfflineReadConfig>(DEFAULT_CONFIG);

  const deploymentAllowed = isOfflineReadAllowedByDeployment();
  const districtLabel = tenantCtx?.district_name || tenantCtx?.district_code || 'this district';

  useEffect(() => {
    let cancelled = false;

    const loadConfig = async () => {
      try {
        setLoading(true);
        setLoadError(null);
        const response = await fetch('/api/v1/district/offline-read-config', {
          headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
        });
        if (!response.ok) {
          throw new Error(`Failed to load offline settings (${response.status})`);
        }
        const data = (await response.json()) as OfflineReadConfig;
        if (!cancelled) {
          setConfig(data ?? DEFAULT_CONFIG);
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'Could not load offline settings');
          setConfig(DEFAULT_CONFIG);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadConfig();
    return () => {
      cancelled = true;
    };
  }, []);

  const saveConfig = async () => {
    try {
      setSaving(true);
      const putRes = await fetch('/api/v1/district/offline-read-config', {
        method: 'PUT',
        headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!putRes.ok) throw new Error('Failed to save offline settings');
      toast({
        title: 'Offline settings saved',
        description: 'Field users must refresh or re-login to pick up changes.',
      });
    } catch (error) {
      toast({
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground">
          Loading offline settings…
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <WifiOff className="h-5 w-5" />
          Field offline read mode
        </CardTitle>
        <CardDescription>
          Per-district settings for sample collectors and operators on phones/tablets in the field.
          Applies to <strong>{districtLabel}</strong> only.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {loadError && (
          <Alert variant="destructive">
            <AlertDescription>
              {loadError}. Showing defaults — you can still save new settings for this district.
            </AlertDescription>
          </Alert>
        )}

        {!deploymentAllowed && (
          <Alert variant="destructive">
            <AlertDescription>
              Offline read is disabled for this deployment (platform setting). District toggles have
              no effect until the host enables offline features.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
          <div className="space-y-1">
            <Label htmlFor="pwa-shell">PWA shell (installable app + offline UI assets)</Label>
            <p className="text-sm text-muted-foreground">
              Caches the app shell locally. Required before offline data caching.
            </p>
          </div>
          <Switch
            id="pwa-shell"
            checked={config.pwa_shell_enabled}
            disabled={!deploymentAllowed}
            onCheckedChange={checked =>
              setConfig(prev => ({
                ...prev,
                pwa_shell_enabled: checked,
                offline_read_enabled: checked ? prev.offline_read_enabled : false,
              }))
            }
          />
        </div>

        <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
          <div className="space-y-1">
            <Label htmlFor="offline-read">Read-only offline data cache</Label>
            <p className="text-sm text-muted-foreground">
              Persist pages you visit to this device for the district while offline. Data refreshes
              when connected and is kept across logout (shared district store; cleared on district
              switch). Writes stay disabled until reconnected.
            </p>
          </div>
          <Switch
            id="offline-read"
            checked={config.offline_read_enabled}
            disabled={!deploymentAllowed || !config.pwa_shell_enabled}
            onCheckedChange={checked =>
              setConfig(prev => ({ ...prev, offline_read_enabled: checked }))
            }
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={config.pwa_shell_enabled ? 'default' : 'secondary'}>
            PWA shell: {config.pwa_shell_enabled ? 'On' : 'Off'}
          </Badge>
          <Badge variant={config.offline_read_enabled ? 'default' : 'secondary'}>
            Offline read: {config.offline_read_enabled ? 'On' : 'Off'}
          </Badge>
        </div>

        <Button onClick={() => void saveConfig()} disabled={saving || !deploymentAllowed}>
          {saving ? 'Saving…' : 'Save offline settings'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default DistrictOfflineReadConfigSection;
