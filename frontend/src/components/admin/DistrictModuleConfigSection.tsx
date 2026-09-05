import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useTenantAuthContext } from '@/hooks/useTenantAuthContext';
import { fetchDistrictModules, updateDistrictModules } from '@/services/lmsService';
import { MODULE_CORE, MODULE_LMS, MODULE_WORKFORCE } from '@/services/authService';
import { Droplets, GraduationCap, Users } from 'lucide-react';
import React, { useEffect, useState } from 'react';

const MODULE_OPTIONS = [
  {
    key: MODULE_CORE,
    label: 'AquaSafe',
    description: 'Water quality monitoring and compliance platform',
    icon: Droplets,
  },
  {
    key: MODULE_LMS,
    label: 'The Reservoir',
    description: 'Learning management — training courses',
    icon: GraduationCap,
  },
  {
    key: MODULE_WORKFORCE,
    label: 'Workforce Continuity (CEU)',
    description: 'Workforce succession, CEU tracking, and training continuity',
    icon: Users,
  },
];

const DistrictModuleConfigSection: React.FC = () => {
  const { toast } = useToast();
  const { data: tenantCtx } = useTenantAuthContext();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [enabled, setEnabled] = useState<Set<string>>(new Set([MODULE_CORE]));

  const districtLabel = tenantCtx?.district_name || tenantCtx?.district_code || 'this district';

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setLoadError(null);
        const modules = await fetchDistrictModules();
        if (!cancelled) {
          setEnabled(new Set(modules.length ? modules : [MODULE_CORE]));
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'Could not load module settings');
          setEnabled(new Set([MODULE_CORE]));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleModule = (key: string, checked: boolean) => {
    setEnabled(prev => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      // At least one module required; workforce-only (CEU) districts are allowed.
      if (next.size === 0) next.add(MODULE_CORE);
      return next;
    });
  };

  const save = async () => {
    try {
      setSaving(true);
      await updateDistrictModules([...enabled]);
      toast({
        title: 'Module settings saved',
        description: 'Users must refresh or re-login to pick up changes.',
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
          Loading module settings…
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5" />
          Product modules
        </CardTitle>
        <CardDescription>
          Choose which product areas are available to users in <strong>{districtLabel}</strong>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {loadError && (
          <Alert variant="destructive">
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        )}

        {MODULE_OPTIONS.map(opt => {
          const Icon = opt.icon;
          const isOn = enabled.has(opt.key);
          const isCoreOnly = opt.key === MODULE_CORE && enabled.size === 1 && isOn;
          return (
            <div key={opt.key} className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-base font-medium">{opt.label}</Label>
                  {isOn && <Badge variant="secondary">Enabled</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">{opt.description}</p>
              </div>
              <Switch
                checked={isOn}
                disabled={isCoreOnly}
                onCheckedChange={checked => toggleModule(opt.key, checked)}
              />
            </div>
          );
        })}

        <Button onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save module settings'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default DistrictModuleConfigSection;
