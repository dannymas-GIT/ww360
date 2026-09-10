import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import {
  fetchDistrictConfig,
  updateDistrictConfig,
  type DistrictConfig,
  type WorkforceTrainingSettings,
} from '@/services/districtAdminService';

export function WorkforceTrainingSettingsPanel() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullConfig, setFullConfig] = useState<DistrictConfig | null>(null);
  const [settings, setSettings] = useState<WorkforceTrainingSettings>({
    operator_self_enroll_enabled: false,
  });

  useEffect(() => {
    void (async () => {
      try {
        const cfg = await fetchDistrictConfig();
        setFullConfig(cfg);
        if (cfg.workforce_training) setSettings(cfg.workforce_training);
      } catch (err) {
        toast({
          title: 'Could not load training settings',
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
      await updateDistrictConfig({ ...fullConfig, workforce_training: settings });
      toast({ title: 'Training settings saved' });
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

  if (loading) return <p className="text-sm text-gray-500">Loading training settings…</p>;

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <h3 className="font-semibold">Workforce training</h3>
      <p className="text-sm text-gray-600">
        Control whether operators can sign up for district training sessions from the Training tab.
        Learning Stream catalog courses remain visible to everyone.
      </p>
      <div className="flex items-center justify-between gap-4">
        <div>
          <span className="text-sm font-medium">Allow operator self-enrollment</span>
          <p className="text-xs text-gray-500">
            When on, linked operators see a Sign up button on open district sessions.
          </p>
        </div>
        <Switch
          checked={settings.operator_self_enroll_enabled}
          onCheckedChange={v =>
            setSettings(s => ({ ...s, operator_self_enroll_enabled: v }))
          }
        />
      </div>
      <Button disabled={saving} onClick={() => void save()}>
        Save training settings
      </Button>
    </div>
  );
}
