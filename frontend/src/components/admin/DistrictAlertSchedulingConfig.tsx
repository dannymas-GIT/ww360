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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/context/AuthContext';
import { AlertTriangle, Calendar, Clock, Database, Palette, Save, Shield } from 'lucide-react';
import React, { useEffect, useState } from 'react';

interface AlertLevelConfig {
  id: string;
  name: string;
  color: string;
  threshold: number;
  unit: string;
  enabled: boolean;
  notification_enabled: boolean;
  escalation_minutes: number;
}

interface SchedulingConfig {
  id: string;
  name: string;
  frequency_days: number;
  enabled: boolean;
  well_types: string[];
  priority_multiplier: number;
  emergency_override: boolean;
}

interface DashboardConfig {
  theme: string;
  layout: string;
  widget_configs: Record<string, any>;
  color_scheme: string;
  show_advanced_metrics: boolean;
}

interface ComplianceConfig {
  reporting_frequency: string;
  custom_mcl_enabled: boolean;
  custom_mcl_values: Record<string, number>;
  audit_retention_days: number;
  auto_compliance_check: boolean;
}

interface IngestionConfig {
  auto_promote_verified_batches: boolean;
}

interface DistrictConfig {
  district_code: string;
  district_name: string;
  alert_levels: AlertLevelConfig[];
  scheduling_rules: SchedulingConfig[];
  dashboard_config: DashboardConfig;
  compliance_config: ComplianceConfig;
  ingestion_config: IngestionConfig;
  notification_contacts: Array<{
    id: string;
    name: string;
    email: string;
    phone?: string;
    role: string;
    alert_types: string[];
  }>;
}

export interface DistrictAlertSchedulingConfigProps {
  /** When true, omit page-level heading (for embedding in district admin hub). */
  embedded?: boolean;
}

const DistrictAlertSchedulingConfig: React.FC<DistrictAlertSchedulingConfigProps> = ({
  embedded = false,
}) => {
  const [config, setConfig] = useState<DistrictConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('alerts');

  const { userRole: _userRole } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    loadDistrictConfig();
  }, []);

  const loadDistrictConfig = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/v1/district/config', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load district configuration');
      }

      const data = await response.json();
      setConfig(data);
    } catch (error) {
      console.error('Error loading district config:', error);
      // Initialize with default config if loading fails
      setConfig(getDefaultConfig());
      toast({
        title: 'Info',
        description: 'Loaded default configuration. Changes will be saved to your district.',
      });
    } finally {
      setLoading(false);
    }
  };

  const getDefaultConfig = (): DistrictConfig => ({
    district_code: 'UNKNOWN',
    district_name: 'Unknown District',
    alert_levels: [
      {
        id: 'warning',
        name: 'Warning Level',
        color: '#F59E0B',
        threshold: 0.75,
        unit: 'MCL',
        enabled: true,
        notification_enabled: true,
        escalation_minutes: 60,
      },
      {
        id: 'critical',
        name: 'Critical Level',
        color: '#DC2626',
        threshold: 0.9,
        unit: 'MCL',
        enabled: true,
        notification_enabled: true,
        escalation_minutes: 30,
      },
      {
        id: 'emergency',
        name: 'Emergency Level',
        color: '#7C2D12',
        threshold: 1.0,
        unit: 'MCL',
        enabled: true,
        notification_enabled: true,
        escalation_minutes: 15,
      },
    ],
    scheduling_rules: [
      {
        id: 'routine',
        name: 'Routine Sampling',
        frequency_days: 30,
        enabled: true,
        well_types: ['production', 'monitoring'],
        priority_multiplier: 1.0,
        emergency_override: false,
      },
      {
        id: 'high_priority',
        name: 'High Priority Wells',
        frequency_days: 14,
        enabled: true,
        well_types: ['production'],
        priority_multiplier: 1.5,
        emergency_override: true,
      },
      {
        id: 'quarterly',
        name: 'Quarterly Assessment',
        frequency_days: 90,
        enabled: true,
        well_types: ['all'],
        priority_multiplier: 0.8,
        emergency_override: false,
      },
    ],
    dashboard_config: {
      theme: 'light',
      layout: 'grid',
      widget_configs: {},
      color_scheme: 'blue',
      show_advanced_metrics: false,
    },
    compliance_config: {
      reporting_frequency: 'monthly',
      custom_mcl_enabled: false,
      custom_mcl_values: {},
      audit_retention_days: 365,
      auto_compliance_check: true,
    },
    ingestion_config: {
      auto_promote_verified_batches: false,
    },
    notification_contacts: [
      {
        id: 'primary',
        name: 'District Manager',
        email: 'manager@waterworks.local',
        phone: '+1-555-0101',
        role: 'manager',
        alert_types: ['critical', 'emergency'],
      },
    ],
  });

  const saveConfig = async () => {
    if (!config) return;

    try {
      setSaving(true);
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/v1/district/config', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        throw new Error('Failed to save configuration');
      }

      toast({
        title: 'Success',
        description: 'District configuration saved successfully',
      });
    } catch (error) {
      console.error('Error saving config:', error);
      toast({
        title: 'Error',
        description: 'Failed to save configuration',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const updateAlertLevel = (id: string, updates: Partial<AlertLevelConfig>) => {
    if (!config) return;

    setConfig({
      ...config,
      alert_levels: config.alert_levels.map(level =>
        level.id === id ? { ...level, ...updates } : level
      ),
    });
  };

  const updateSchedulingRule = (id: string, updates: Partial<SchedulingConfig>) => {
    if (!config) return;

    setConfig({
      ...config,
      scheduling_rules: config.scheduling_rules.map(rule =>
        rule.id === id ? { ...rule, ...updates } : rule
      ),
    });
  };

  const updateDashboardConfig = (updates: Partial<DashboardConfig>) => {
    if (!config) return;

    setConfig({
      ...config,
      dashboard_config: { ...config.dashboard_config, ...updates },
    });
  };

  const updateComplianceConfig = (updates: Partial<ComplianceConfig>) => {
    if (!config) return;

    setConfig({
      ...config,
      compliance_config: { ...config.compliance_config, ...updates },
    });
  };

  const updateIngestionConfig = (updates: Partial<IngestionConfig>) => {
    if (!config) return;

    setConfig({
      ...config,
      ingestion_config: {
        ...(config.ingestion_config || { auto_promote_verified_batches: false }),
        ...updates,
      },
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Failed to load configuration</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
        <div>
          {embedded ? (
            <>
              <h2 className="text-lg font-semibold">Alert &amp; scheduling settings</h2>
              <p className="text-sm text-muted-foreground">
                Thresholds, schedule rules, and alert behavior for {config.district_name}
              </p>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-bold">Alert & Scheduling Configuration</h1>
              <p className="text-gray-600">
                Configure alerts, scheduling, and district-specific settings for{' '}
                {config.district_name}
              </p>
            </>
          )}
        </div>
        <Button onClick={saveConfig} disabled={saving} className="min-h-9 shrink-0">
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Saving...' : 'Save Configuration'}
        </Button>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="flex flex-wrap h-auto w-full gap-1">
          <TabsTrigger value="alerts" className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Alert Levels
          </TabsTrigger>
          <TabsTrigger value="scheduling" className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Scheduling Rules
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <Palette className="w-4 h-4" />
            Dashboard Theme
          </TabsTrigger>
          <TabsTrigger value="compliance" className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Compliance
          </TabsTrigger>
          <TabsTrigger value="ingestion" className="flex items-center gap-2">
            <Database className="w-4 h-4" />
            Ingestion
          </TabsTrigger>
        </TabsList>

        <TabsContent value="alerts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Alert Level Configuration
              </CardTitle>
              <CardDescription>
                Configure thresholds, colors, and notification rules for different alert levels
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {config.alert_levels.map(level => (
                <Card key={level.id} className="p-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-6 h-6 rounded-full border-2"
                          style={{ backgroundColor: level.color }}
                        />
                        <h3 className="text-lg font-semibold">{level.name}</h3>
                        <Badge variant={level.enabled ? 'default' : 'secondary'}>
                          {level.enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </div>
                      <Switch
                        checked={level.enabled}
                        onCheckedChange={enabled => updateAlertLevel(level.id, { enabled })}
                      />
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <Label>Color</Label>
                        <Input
                          type="color"
                          value={level.color}
                          onChange={e => updateAlertLevel(level.id, { color: e.target.value })}
                          className="h-10"
                        />
                      </div>
                      <div>
                        <Label>Threshold</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={level.threshold}
                          onChange={e =>
                            updateAlertLevel(level.id, { threshold: parseFloat(e.target.value) })
                          }
                        />
                      </div>
                      <div>
                        <Label>Escalation (minutes)</Label>
                        <Input
                          type="number"
                          value={level.escalation_minutes}
                          onChange={e =>
                            updateAlertLevel(level.id, {
                              escalation_minutes: parseInt(e.target.value),
                            })
                          }
                        />
                      </div>
                      <div className="flex items-center space-x-2 mt-6">
                        <Switch
                          checked={level.notification_enabled}
                          onCheckedChange={notification_enabled =>
                            updateAlertLevel(level.id, { notification_enabled })
                          }
                        />
                        <Label>Send Notifications</Label>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scheduling" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Sampling Schedule Rules
              </CardTitle>
              <CardDescription>
                Configure automated sampling schedules and frequency rules for different well types
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {config.scheduling_rules.map(rule => (
                <Card key={rule.id} className="p-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Clock className="w-5 h-5" />
                        <h3 className="text-lg font-semibold">{rule.name}</h3>
                        <Badge variant={rule.enabled ? 'default' : 'secondary'}>
                          {rule.enabled ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <Switch
                        checked={rule.enabled}
                        onCheckedChange={enabled => updateSchedulingRule(rule.id, { enabled })}
                      />
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <Label>Frequency (days)</Label>
                        <Input
                          type="number"
                          value={rule.frequency_days}
                          onChange={e =>
                            updateSchedulingRule(rule.id, {
                              frequency_days: parseInt(e.target.value),
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label>Priority Multiplier</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={rule.priority_multiplier}
                          onChange={e =>
                            updateSchedulingRule(rule.id, {
                              priority_multiplier: parseFloat(e.target.value),
                            })
                          }
                        />
                      </div>
                      <div className="flex items-center space-x-2 mt-6">
                        <Switch
                          checked={rule.emergency_override}
                          onCheckedChange={emergency_override =>
                            updateSchedulingRule(rule.id, { emergency_override })
                          }
                        />
                        <Label>Emergency Override</Label>
                      </div>
                    </div>

                    <div>
                      <Label>Well Types</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {rule.well_types.map(type => (
                          <Badge key={type} variant="outline">
                            {type}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dashboard" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="w-5 h-5" />
                Dashboard Customization
              </CardTitle>
              <CardDescription>
                Customize the look and feel of your district dashboard
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <div>
                  <Label>Theme</Label>
                  <Select
                    value={config.dashboard_config.theme}
                    onValueChange={theme => updateDashboardConfig({ theme })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="auto">Auto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Layout Style</Label>
                  <Select
                    value={config.dashboard_config.layout}
                    onValueChange={layout => updateDashboardConfig({ layout })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="grid">Grid Layout</SelectItem>
                      <SelectItem value="list">List Layout</SelectItem>
                      <SelectItem value="compact">Compact View</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Color Scheme</Label>
                  <Select
                    value={config.dashboard_config.color_scheme}
                    onValueChange={color_scheme => updateDashboardConfig({ color_scheme })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="blue">Blue</SelectItem>
                      <SelectItem value="green">Green</SelectItem>
                      <SelectItem value="purple">Purple</SelectItem>
                      <SelectItem value="orange">Orange</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  checked={config.dashboard_config.show_advanced_metrics}
                  onCheckedChange={show_advanced_metrics =>
                    updateDashboardConfig({ show_advanced_metrics })
                  }
                />
                <Label>Show Advanced Metrics</Label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compliance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Compliance Settings
              </CardTitle>
              <CardDescription>
                Configure district-specific compliance requirements and reporting
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <Label>Reporting Frequency</Label>
                  <Select
                    value={config.compliance_config.reporting_frequency}
                    onValueChange={reporting_frequency =>
                      updateComplianceConfig({ reporting_frequency })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="annual">Annual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Audit Retention (days)</Label>
                  <Input
                    type="number"
                    value={config.compliance_config.audit_retention_days}
                    onChange={e =>
                      updateComplianceConfig({ audit_retention_days: parseInt(e.target.value) })
                    }
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={config.compliance_config.custom_mcl_enabled}
                    onCheckedChange={custom_mcl_enabled =>
                      updateComplianceConfig({ custom_mcl_enabled })
                    }
                  />
                  <Label>Enable Custom MCL Values</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    checked={config.compliance_config.auto_compliance_check}
                    onCheckedChange={auto_compliance_check =>
                      updateComplianceConfig({ auto_compliance_check })
                    }
                  />
                  <Label>Automatic Compliance Checking</Label>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ingestion" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                Lab Ingestion Approval
              </CardTitle>
              <CardDescription>
                Configure how clean, auto-verified lab batches enter production for this district.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start justify-between gap-6 rounded-lg border p-4">
                <div className="space-y-2">
                  <Label className="text-base font-semibold">
                    Auto-promote fully verified batches
                  </Label>
                  <p className="text-sm text-gray-600">
                    When enabled, email ingestion and CSV uploads will promote a batch automatically
                    only if every promotable row passes verification with no flags. Any flagged,
                    duplicate, unresolved, QC, or surrogate rows still require review or are skipped
                    by the normal staging rules.
                  </p>
                  <p className="text-sm text-amber-700">
                    Recommended while onboarding a new lab/feed: leave this off and promote from
                    Staging Review after inspection.
                  </p>
                </div>
                <Switch
                  checked={config.ingestion_config?.auto_promote_verified_batches ?? false}
                  onCheckedChange={auto_promote_verified_batches =>
                    updateIngestionConfig({ auto_promote_verified_batches })
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DistrictAlertSchedulingConfig;
