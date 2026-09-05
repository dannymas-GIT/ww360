import React, { useState, useEffect } from 'react';
import { Save, Plus, Trash2, Bell, Mail, MessageSquare } from 'lucide-react';
import axios from 'axios';
import { getAuthHeader } from '@/services/authService';

interface WorkflowAction {
  type: 'popup' | 'email' | 'dashboard_notification';
  target?: string; // For popup: "district_operators", "district_managers", "district_admins"
  recipients?: string[]; // For email: list of email addresses
}

interface WorkflowConfig {
  id?: number;
  district_code: string;
  trigger_type: 'new_detect' | 'import_completion' | 'schedule_due';
  actions: WorkflowAction[];
  is_active: boolean;
}

interface WorkflowConfigurationPanelProps {
  districtCode: string;
}

export const WorkflowConfigurationPanel: React.FC<WorkflowConfigurationPanelProps> = ({
  districtCode,
}) => {
  const [workflows, setWorkflows] = useState<WorkflowConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadWorkflows();
  }, [districtCode]);

  const loadWorkflows = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/v1/district/workflows?district_code=${districtCode}`, {
        headers: getAuthHeader(),
      });
      setWorkflows(response.data.workflows || []);
    } catch (error) {
      console.error('Error loading workflows:', error);
    } finally {
      setLoading(false);
    }
  };

  const addWorkflow = (triggerType: WorkflowConfig['trigger_type']) => {
    const newWorkflow: WorkflowConfig = {
      district_code: districtCode,
      trigger_type: triggerType,
      actions: [],
      is_active: true,
    };
    setWorkflows([...workflows, newWorkflow]);
  };

  const updateWorkflow = (index: number, updates: Partial<WorkflowConfig>) => {
    const updated = [...workflows];
    updated[index] = { ...updated[index], ...updates };
    setWorkflows(updated);
  };

  const addAction = (workflowIndex: number, actionType: WorkflowAction['type']) => {
    const updated = [...workflows];
    const newAction: WorkflowAction = {
      type: actionType,
      ...(actionType === 'popup' ? { target: 'district_operators' } : {}),
      ...(actionType === 'email' ? { recipients: [] } : {}),
    };
    updated[workflowIndex].actions.push(newAction);
    setWorkflows(updated);
  };

  const removeAction = (workflowIndex: number, actionIndex: number) => {
    const updated = [...workflows];
    updated[workflowIndex].actions.splice(actionIndex, 1);
    setWorkflows(updated);
  };

  const updateAction = (
    workflowIndex: number,
    actionIndex: number,
    updates: Partial<WorkflowAction>
  ) => {
    const updated = [...workflows];
    updated[workflowIndex].actions[actionIndex] = {
      ...updated[workflowIndex].actions[actionIndex],
      ...updates,
    };
    setWorkflows(updated);
  };

  const saveWorkflows = async () => {
    setSaving(true);
    try {
      await axios.post(
        `/api/v1/district/workflows`,
        {
          district_code: districtCode,
          workflows: workflows,
        },
        {
          headers: getAuthHeader(),
        }
      );
      alert('Workflows saved successfully');
    } catch (error) {
      console.error('Error saving workflows:', error);
      alert('Error saving workflows');
    } finally {
      setSaving(false);
    }
  };

  const getTriggerLabel = (trigger: string) => {
    switch (trigger) {
      case 'new_detect':
        return 'New Detect';
      case 'import_completion':
        return 'Import Completion';
      case 'schedule_due':
        return 'Schedule Due';
      default:
        return trigger;
    }
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'popup':
        return <Bell className="w-4 h-4" />;
      case 'email':
        return <Mail className="w-4 h-4" />;
      case 'dashboard_notification':
        return <MessageSquare className="w-4 h-4" />;
      default:
        return null;
    }
  };

  if (loading) {
    return <div className="p-6">Loading workflows...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Workflow Configuration</h2>
          <p className="text-sm text-gray-600 mt-1">
            Configure district-specific workflows for events
          </p>
        </div>
        <button
          onClick={saveWorkflows}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Workflows'}
        </button>
      </div>

      <div className="space-y-6">
        {['new_detect', 'import_completion', 'schedule_due'].map(triggerType => {
          const workflow = workflows.find(w => w.trigger_type === triggerType);
          const workflowIndex = workflow ? workflows.indexOf(workflow) : -1;

          return (
            <div key={triggerType} className="border rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  {getTriggerLabel(triggerType)}
                </h3>
                {!workflow && (
                  <button
                    onClick={() => addWorkflow(triggerType as WorkflowConfig['trigger_type'])}
                    className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Workflow
                  </button>
                )}
              </div>

              {workflow && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={workflow.is_active}
                      onChange={e => updateWorkflow(workflowIndex, { is_active: e.target.checked })}
                      className="rounded"
                    />
                    <label className="text-sm text-gray-700">Workflow Active</label>
                  </div>

                  <div className="space-y-3">
                    {workflow.actions.map((action, actionIndex) => (
                      <div key={actionIndex} className="border rounded-lg p-4 bg-gray-50">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            {getActionIcon(action.type)}
                            <span className="font-medium capitalize">
                              {action.type.replace('_', ' ')}
                            </span>
                          </div>
                          <button
                            onClick={() => removeAction(workflowIndex, actionIndex)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {action.type === 'popup' && (
                          <select
                            value={action.target || 'district_operators'}
                            onChange={e =>
                              updateAction(workflowIndex, actionIndex, { target: e.target.value })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          >
                            <option value="district_operators">District Operators</option>
                            <option value="district_managers">District Managers</option>
                            <option value="district_admins">District Admins</option>
                          </select>
                        )}

                        {action.type === 'email' && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Email Recipients (comma-separated)
                            </label>
                            <input
                              type="text"
                              value={action.recipients?.join(', ') || ''}
                              onChange={e =>
                                updateAction(workflowIndex, actionIndex, {
                                  recipients: e.target.value
                                    .split(',')
                                    .map(email => email.trim())
                                    .filter(Boolean),
                                })
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-md"
                              placeholder="email1@example.com, email2@example.com"
                            />
                          </div>
                        )}
                      </div>
                    ))}

                    <button
                      onClick={() => {
                        const actionTypes: WorkflowAction['type'][] = [
                          'popup',
                          'email',
                          'dashboard_notification',
                        ];
                        const actionType = actionTypes[0]; // Default to popup
                        addAction(workflowIndex, actionType);
                      }}
                      className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" />
                      Add Action
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
