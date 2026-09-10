import React, { useState, useEffect } from 'react';
import { Save, Plus, Trash2, Clock, Mail } from 'lucide-react';
import axios from 'axios';
import { getAuthHeader } from '@/services/authService';

interface AlertConfig {
  id?: number;
  district_code: string;
  schedule_frequency: 'Monthly' | 'Quarterly' | 'Annual' | 'Weekly';
  alert_week?: number; // Week of month (1-4) for monthly
  alert_month?: number; // Month of quarter (1-3) for quarterly
  alert_days_before?: number; // Days before due date
  email_enabled: boolean;
  email_recipients?: string;
  alert_on_overdue: boolean;
  alert_on_due_soon: boolean;
  is_active: boolean;
}

interface AlertConfigurationPanelProps {
  districtCode: string;
}

export const AlertConfigurationPanel: React.FC<AlertConfigurationPanelProps> = ({
  districtCode,
}) => {
  const [configs, setConfigs] = useState<AlertConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadConfigs();
  }, [districtCode]);

  const loadConfigs = async () => {
    setLoading(true);
    try {
      const response = await axios.get(
        `/api/v1/district/alert-configs?district_code=${districtCode}`,
        {
          headers: getAuthHeader(),
        }
      );
      setConfigs(response.data.configs || []);
    } catch (error) {
      console.error('Error loading alert configs:', error);
    } finally {
      setLoading(false);
    }
  };

  const addConfig = (frequency: AlertConfig['schedule_frequency']) => {
    const newConfig: AlertConfig = {
      district_code: districtCode,
      schedule_frequency: frequency,
      email_enabled: true,
      alert_on_overdue: true,
      alert_on_due_soon: true,
      is_active: true,
    };
    setConfigs([...configs, newConfig]);
  };

  const updateConfig = (index: number, updates: Partial<AlertConfig>) => {
    const updated = [...configs];
    updated[index] = { ...updated[index], ...updates };
    setConfigs(updated);
  };

  const removeConfig = (index: number) => {
    setConfigs(configs.filter((_, i) => i !== index));
  };

  const saveConfigs = async () => {
    setSaving(true);
    try {
      await axios.post(
        `/api/v1/district/alert-configs`,
        {
          district_code: districtCode,
          configs: configs,
        },
        {
          headers: getAuthHeader(),
        }
      );
      alert('Alert configurations saved successfully');
    } catch (error) {
      console.error('Error saving alert configs:', error);
      alert('Error saving alert configurations');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6">Loading alert configurations...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Time-Based Alert Configuration
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Configure when alerts are sent for scheduled samples
          </p>
        </div>
        <button
          onClick={saveConfigs}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Configurations'}
        </button>
      </div>

      <div className="space-y-6">
        {['Monthly', 'Quarterly', 'Annual', 'Weekly'].map(frequency => {
          const config = configs.find(c => c.schedule_frequency === frequency);
          const configIndex = config ? configs.indexOf(config) : -1;

          return (
            <div key={frequency} className="border rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">{frequency} Schedules</h3>
                {!config && (
                  <button
                    onClick={() => addConfig(frequency as AlertConfig['schedule_frequency'])}
                    className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Configuration
                  </button>
                )}
              </div>

              {config && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={config.is_active}
                      onChange={e => updateConfig(configIndex, { is_active: e.target.checked })}
                      className="rounded"
                    />
                    <label className="text-sm text-gray-700">Configuration Active</label>
                  </div>

                  {frequency === 'Monthly' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Alert at Week of Month (1-4)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="4"
                        value={config.alert_week || ''}
                        onChange={e =>
                          {
                            const val = parseInt(e.target.value);
                            updateConfig(configIndex, val ? { alert_week: val } : {});
                          }
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="3"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Example: 3 = Alert at week 3 of the month
                      </p>
                    </div>
                  )}

                  {frequency === 'Quarterly' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Alert at Month of Quarter (1-3)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="3"
                        value={config.alert_month || ''}
                        onChange={e =>
                          {
                            const val = parseInt(e.target.value);
                            updateConfig(configIndex, val ? { alert_month: val } : {});
                          }
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="3"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Example: 3 = Alert at beginning of 3rd month of quarter
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Days Before Due Date (alternative)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={config.alert_days_before || ''}
                      onChange={e =>
                        {
                          const val = parseInt(e.target.value);
                          updateConfig(configIndex, val ? { alert_days_before: val } : {});
                        }
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="7"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Alert this many days before due date
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={config.alert_on_overdue}
                        onChange={e =>
                          updateConfig(configIndex, { alert_on_overdue: e.target.checked })
                        }
                        className="rounded"
                      />
                      <label className="text-sm text-gray-700">Alert if already overdue</label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={config.alert_on_due_soon}
                        onChange={e =>
                          updateConfig(configIndex, { alert_on_due_soon: e.target.checked })
                        }
                        className="rounded"
                      />
                      <label className="text-sm text-gray-700">Alert if approaching due date</label>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Mail className="w-4 h-4 text-gray-500" />
                      <label className="text-sm font-medium text-gray-700">
                        Email Notifications
                      </label>
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      <input
                        type="checkbox"
                        checked={config.email_enabled}
                        onChange={e =>
                          updateConfig(configIndex, { email_enabled: e.target.checked })
                        }
                        className="rounded"
                      />
                      <label className="text-sm text-gray-700">Enable email alerts</label>
                    </div>
                    {config.email_enabled && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Email Recipients (comma-separated)
                        </label>
                        <input
                          type="text"
                          value={config.email_recipients || ''}
                          onChange={e =>
                            updateConfig(configIndex, { email_recipients: e.target.value })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          placeholder="ops@district.com, manager@district.com"
                        />
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => removeConfig(configIndex)}
                    className="text-sm text-red-600 hover:text-red-800 flex items-center gap-1"
                  >
                    <Trash2 className="w-4 h-4" />
                    Remove Configuration
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
