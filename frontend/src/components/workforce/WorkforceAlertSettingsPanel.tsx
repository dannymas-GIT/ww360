import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import {
  fetchDistrictConfig,
  updateDistrictConfig,
  type DistrictConfig,
  type WorkforceAlertSettings,
} from '@/services/districtAdminService';

export function WorkforceAlertSettingsPanel() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullConfig, setFullConfig] = useState<DistrictConfig | null>(null);
  const [settings, setSettings] = useState<WorkforceAlertSettings>({
    enabled: true,
    cert_expiry_horizon_days: [30, 90, 180],
    retirement_horizon_months: [12, 24],
    ceu_shortfall_lead_days: 90,
    ceu_requirements_by_grade: {},
    notification_channels: ['in_app'],
    recipient_emails: [],
    scan_daily: true,
  });

  useEffect(() => {
    void (async () => {
      try {
        const cfg = await fetchDistrictConfig();
        setFullConfig(cfg);
        if (cfg.workforce_alerts) setSettings(cfg.workforce_alerts);
      } catch (err) {
        toast({
          title: 'Could not load workforce alert settings',
          description: err instanceof Error ? err.message : String(err),
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  const save = async () => {
    if (!fullConfig) return;
    setSaving(true);
    try {
      await updateDistrictConfig({ ...fullConfig, workforce_alerts: settings });
      toast({ title: 'Workforce alert settings saved' });
    } catch (err) {
      toast({
        title: 'Save failed',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-sm text-gray-500">Loading workforce alert settings…</p>;

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <h3 className="font-semibold">Workforce succession alerts</h3>
      <div className="flex items-center justify-between">
        <span className="text-sm">Enable workforce alerts</span>
        <Switch
          checked={settings.enabled}
          onCheckedChange={v => setSettings(s => ({ ...s, enabled: v }))}
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm">Daily automatic scan</span>
        <Switch
          checked={settings.scan_daily}
          onCheckedChange={v => setSettings(s => ({ ...s, scan_daily: v }))}
        />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600">
          CEU shortfall lead time (days before cycle end)
        </label>
        <Input
          type="number"
          value={settings.ceu_shortfall_lead_days}
          onChange={e =>
            setSettings(s => ({ ...s, ceu_shortfall_lead_days: Number(e.target.value) || 90 }))
          }
        />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600">
          Cert expiry horizons (comma-separated days)
        </label>
        <Input
          value={settings.cert_expiry_horizon_days.join(', ')}
          onChange={e =>
            setSettings(s => ({
              ...s,
              cert_expiry_horizon_days: e.target.value
                .split(',')
                .map(x => Number(x.trim()))
                .filter(n => !Number.isNaN(n)),
            }))
          }
        />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600">
          Notification emails (comma-separated)
        </label>
        <Input
          value={settings.recipient_emails.join(', ')}
          onChange={e =>
            setSettings(s => ({
              ...s,
              recipient_emails: e.target.value
                .split(',')
                .map(x => x.trim())
                .filter(Boolean),
              notification_channels: e.target.value.trim() ? ['in_app', 'email'] : ['in_app'],
            }))
          }
        />
      </div>
      <Button onClick={() => void save()} disabled={saving}>
        {saving ? 'Saving…' : 'Save workforce alert settings'}
      </Button>
    </div>
  );
}
