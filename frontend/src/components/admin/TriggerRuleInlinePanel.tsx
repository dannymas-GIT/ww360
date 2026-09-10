import { Button } from '@/components/ui/button';
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
  CHANGE_MODE_OPTIONS,
  LEVEL_MODE_OPTIONS,
  previewTriggerRule,
  saveTriggerRule,
  type ChangeMode,
  type LevelMode,
} from '@/services/triggerRulesService';
import { Loader2, Settings2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';

export interface TriggerRuleInlinePanelProps {
  wellId: number;
  contaminantName: string;
  districtCode?: string;
  mclPct?: number;
  resultValue?: number;
}

export const TriggerRuleInlinePanel: React.FC<TriggerRuleInlinePanelProps> = ({
  wellId,
  contaminantName,
  districtCode: districtCodeProp,
  mclPct,
  resultValue,
}) => {
  const { toast } = useToast();
  const { data: tenantCtx } = useTenantAuthContext();
  const districtCode = districtCodeProp || tenantCtx?.district_code || '';
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [levelMode, setLevelMode] = useState<LevelMode>('mcl_pct');
  const [levelValue, setLevelValue] = useState('');
  const [changeMode, setChangeMode] = useState<ChangeMode>('pct');
  const [changeValue, setChangeValue] = useState('');
  const [popup, setPopup] = useState(true);
  const [effectiveScope, setEffectiveScope] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !districtCode) return;
    void (async () => {
      try {
        const preview = await previewTriggerRule(districtCode, {
          well_id: wellId,
          contaminant_name: contaminantName,
          sample: {
            mcl_pct: mclPct,
            value: resultValue,
            is_first_detect: false,
            is_mcl_exceedance: false,
          },
        });
        const eff = preview.effective as { resolved_scope?: string };
        setEffectiveScope(eff.resolved_scope ?? null);
      } catch {
        setEffectiveScope(null);
      }
    })();
  }, [open, districtCode, wellId, contaminantName, mclPct, resultValue]);

  const handleSave = async () => {
    if (!districtCode) return;
    setSaving(true);
    try {
      await saveTriggerRule(districtCode, {
        scope: 'well_contaminant',
        well_id: wellId,
        contaminant_name: contaminantName,
        level_mode: levelMode,
        level_value: levelValue === '' ? undefined : Number(levelValue),
        change_mode: changeMode,
        change_value: changeValue === '' ? undefined : Number(changeValue),
        delivery: { popup, email: false, sms: false },
      });
      toast({
        title: 'Custom trigger rule saved',
        description: `Well ${wellId} · ${contaminantName}`,
      });
      setOpen(false);
    } catch (e) {
      toast({
        title: 'Could not save trigger rule',
        description: e instanceof Error ? e.message : 'Save failed',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (!districtCode) return null;

  return (
    <div className="rounded-md border p-3 space-y-3 bg-slate-50">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-medium flex items-center gap-2">
          <Settings2 className="h-4 w-4" />
          Custom trigger rule for this well + contaminant
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(v => !v)}>
          {open ? 'Hide' : 'Configure'}
        </Button>
      </div>
      {open ? (
        <div className="space-y-3">
          {effectiveScope ? (
            <p className="text-xs text-muted-foreground">
              Current effective scope: <strong>{effectiveScope}</strong>
            </p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1">
              <Label className="text-xs">Level mode</Label>
              <Select value={levelMode} onValueChange={v => setLevelMode(v as LevelMode)}>
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
            <div className="grid gap-1">
              <Label className="text-xs">Level value</Label>
              <Input
                type="number"
                min={0}
                value={levelValue}
                onChange={e => setLevelValue(e.target.value)}
                placeholder="e.g. 50"
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Change mode</Label>
              <Select value={changeMode} onValueChange={v => setChangeMode(v as ChangeMode)}>
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
            <div className="grid gap-1">
              <Label className="text-xs">Change threshold</Label>
              <Input
                type="number"
                min={0}
                value={changeValue}
                onChange={e => setChangeValue(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center justify-between rounded border p-2 bg-white">
            <Label className="text-xs">In-app popup for alerts</Label>
            <Switch checked={popup} onCheckedChange={setPopup} />
          </div>
          <Button type="button" size="sm" onClick={() => void handleSave()} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save well+contaminant rule
          </Button>
        </div>
      ) : null}
    </div>
  );
};

export default TriggerRuleInlinePanel;
