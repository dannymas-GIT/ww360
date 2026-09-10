import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { getSamplingSchedules } from '@/services/samplingScheduleService';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Calendar,
  CheckCircle,
  Edit,
  Eye,
  Plus,
  ThumbsDown,
  ThumbsUp,
  User,
  UserPlus,
} from 'lucide-react';
import React, { useState } from 'react';

interface SampleScheduleManagementProps {
  className?: string;
}

interface AlertScheduleAction {
  id: number;
  alert_id: number;
  sampling_schedule_id: number;
  action_type: string;
  previous_frequency: string;
  new_frequency: string;
  triggered_at: string;
  status: 'pending' | 'approved' | 'rejected' | 'implemented';
  justification: string;
  regulatory_basis: string;
  workflow_group: string;
  alert: {
    id: number;
    contaminant_name: string;
    result_value: number;
    mcl_value: number;
    severity: string;
    well_name: string;
  };
}

interface SamplingSchedule {
  id: number;
  name: string;
  well_id: number;
  frequency: string;
  contaminant_names: string[];
  next_due_date: string;
  assigned_to?: number | null;
  assignee_name?: string | null;
  compliance_status: string;
  days_overdue: number;
  is_active: boolean;
  approval_status?: 'pending_approval' | 'approved' | 'rejected';
  well?: {
    id: number;
    well_number: string;
    name: string;
    address: string;
  };
}

interface User {
  id: number;
  username: string;
  full_name: string;
  email: string;
  roles: string[];
}

const SampleScheduleManagement: React.FC<SampleScheduleManagementProps> = ({ className }) => {
  const [selectedAction, setSelectedAction] = useState<AlertScheduleAction | null>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<SamplingSchedule | null>(null);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [showAssignmentDialog, setShowAssignmentDialog] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [activeTab, setActiveTab] = useState('overview');

  const queryClient = useQueryClient();

  // Fetch pending alert-to-schedule actions
  const { data: pendingActions, isLoading: actionsLoading } = useQuery({
    queryKey: ['pending-alert-actions'],
    queryFn: async () => {
      // Mock data for now - replace with actual API call
      return [
        {
          id: 1,
          alert_id: 123,
          sampling_schedule_id: 456,
          action_type: 'frequency_change',
          previous_frequency: 'Quarterly',
          new_frequency: 'Monthly',
          triggered_at: '2024-01-15T10:30:00Z',
          status: 'pending',
          justification: 'Perchlorate detected at 12 μg/L - Secondary Action Level triggered',
          regulatory_basis: 'Nassau County Water Sampling Requirements',
          workflow_group: 'perchlorate',
          alert: {
            id: 123,
            contaminant_name: 'Perchlorate',
            result_value: 0.012,
            mcl_value: 0.006,
            severity: 'warning',
            well_name: 'Well 7',
          },
        },
        {
          id: 2,
          alert_id: 124,
          sampling_schedule_id: 457,
          action_type: 'frequency_change',
          previous_frequency: 'Annual',
          new_frequency: 'Weekly',
          triggered_at: '2024-01-14T14:45:00Z',
          status: 'pending',
          justification: 'Nitrate detected at 9.2 mg/L - Critical Response Level triggered',
          regulatory_basis: 'EPA Safe Drinking Water Act',
          workflow_group: 'critical_response',
          alert: {
            id: 124,
            contaminant_name: 'Nitrate',
            result_value: 9.2,
            mcl_value: 10.0,
            severity: 'critical',
            well_name: 'Well 3',
          },
        },
      ] as AlertScheduleAction[];
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch sample schedules
  const { data: schedules, isLoading: schedulesLoading } = useQuery({
    queryKey: ['sampling-schedules'],
    queryFn: async () => {
      const schedules = await getSamplingSchedules({ limit: 20 });
      return schedules.map(schedule => ({
        ...schedule,
        assignee_name: schedule.assigned_to ? `User ${schedule.assigned_to}` : null,
        well: {
          id: schedule.well_id,
          well_number: `Well ${schedule.well_id}`,
          name: `Well ${schedule.well_id}`,
          address: 'Address not available',
        },
      }));
    },
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch users for assignment
  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      // Mock data for now - replace with actual API call
      return [
        {
          id: 1,
          username: 'john.doe',
          full_name: 'John Doe',
          email: 'john@example.com',
          roles: ['sample_collector'],
        },
        {
          id: 2,
          username: 'jane.smith',
          full_name: 'Jane Smith',
          email: 'jane@example.com',
          roles: ['sample_collector'],
        },
        {
          id: 3,
          username: 'mike.johnson',
          full_name: 'Mike Johnson',
          email: 'mike@example.com',
          roles: ['sample_collector'],
        },
      ] as User[];
    },
  });

  // Mutation for approving/rejecting actions
  const approveActionMutation = useMutation({
    mutationFn: async ({
      actionId: _actionId,
      approved: _approved,
      notes: _notes,
    }: {
      actionId: number;
      approved: boolean;
      notes: string;
    }) => {
      // Mock API call - replace with actual implementation
      await new Promise(resolve => setTimeout(resolve, 1000));
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-alert-actions'] });
      setShowApprovalDialog(false);
      setSelectedAction(null);
      setApprovalNotes('');
    },
  });

  // Mutation for assigning schedules
  const assignScheduleMutation = useMutation({
    mutationFn: async ({
      scheduleId: _scheduleId,
      userId: _userId,
    }: {
      scheduleId: number;
      userId: number;
    }) => {
      // Mock API call - replace with actual implementation
      await new Promise(resolve => setTimeout(resolve, 1000));
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sampling-schedules'] });
      setShowAssignmentDialog(false);
      setSelectedSchedule(null);
      setSelectedUserId('');
    },
  });

  const handleApproveAction = (action: AlertScheduleAction) => {
    setSelectedAction(action);
    setShowApprovalDialog(true);
  };

  const handleAssignSchedule = (schedule: SamplingSchedule) => {
    setSelectedSchedule(schedule);
    setShowAssignmentDialog(true);
  };

  const submitApproval = (approved: boolean) => {
    if (selectedAction) {
      approveActionMutation.mutate({
        actionId: selectedAction.id,
        approved,
        notes: approvalNotes,
      });
    }
  };

  const submitAssignment = () => {
    if (selectedSchedule && selectedUserId) {
      assignScheduleMutation.mutate({
        scheduleId: selectedSchedule.id,
        userId: parseInt(selectedUserId),
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'implemented':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'violation':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getComplianceColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'compliant':
        return 'bg-green-100 text-green-800';
      case 'due soon':
        return 'bg-yellow-100 text-yellow-800';
      case 'overdue':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const upcomingSchedules = schedules?.filter(s => s.days_overdue <= 7 && s.is_active) || [];
  const overdueSchedules = schedules?.filter(s => s.days_overdue > 0) || [];
  const pendingApprovalSchedules =
    schedules?.filter(s => s.approval_status === 'pending_approval') || [];

  return (
    <div className={`space-y-6 ${className}`}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-500" />
            Sample Schedule Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="approvals">
                Alert Approvals
                {pendingActions && pendingActions.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {pendingActions.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="assignments">User Assignments</TabsTrigger>
              <TabsTrigger value="schedules">Schedule Details</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Upcoming Samples</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">
                      {upcomingSchedules.length}
                    </div>
                    <p className="text-sm text-gray-600">Next 7 days</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Overdue Samples</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">{overdueSchedules.length}</div>
                    <p className="text-sm text-gray-600">Requiring attention</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-yellow-600">
                      {(pendingActions?.length || 0) + pendingApprovalSchedules.length}
                    </div>
                    <p className="text-sm text-gray-600">Awaiting review</p>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Recent Schedule Changes</h3>
                {upcomingSchedules.slice(0, 5).map(schedule => (
                  <div
                    key={schedule.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-blue-500" />
                      <div>
                        <div className="font-medium">{schedule.name}</div>
                        <div className="text-sm text-gray-600">
                          {schedule.well.well_number} • {schedule.frequency}
                        </div>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={getComplianceColor(schedule.compliance_status)}
                    >
                      {schedule.compliance_status}
                    </Badge>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="approvals" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Alert-to-Schedule Approvals</h3>
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                  {pendingActions?.length || 0} Pending
                </Badge>
              </div>

              {actionsLoading ? (
                <div className="text-center py-8">Loading pending actions...</div>
              ) : (
                <div className="space-y-4">
                  {pendingActions?.map(action => (
                    <Card key={action.id} className="border-l-4 border-yellow-500">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-yellow-500" />
                            Alert-Triggered Schedule Change
                          </CardTitle>
                          <Badge variant="outline" className={getStatusColor(action.status)}>
                            {action.status}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <h4 className="font-medium text-sm">Alert Details</h4>
                            <div className="text-sm text-gray-600 space-y-1">
                              <div>Contaminant: {action.alert.contaminant_name}</div>
                              <div>Well: {action.alert.well_name}</div>
                              <div>Result: {action.alert.result_value} mg/L</div>
                              <Badge
                                variant="outline"
                                className={getSeverityColor(action.alert.severity)}
                              >
                                {action.alert.severity}
                              </Badge>
                            </div>
                          </div>
                          <div>
                            <h4 className="font-medium text-sm">Proposed Changes</h4>
                            <div className="text-sm text-gray-600 space-y-1">
                              <div>
                                Frequency: {action.previous_frequency} → {action.new_frequency}
                              </div>
                              <div>Workflow: {action.workflow_group}</div>
                              <div>Basis: {action.regulatory_basis}</div>
                            </div>
                          </div>
                        </div>
                        <div>
                          <h4 className="font-medium text-sm">Justification</h4>
                          <p className="text-sm text-gray-600">{action.justification}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleApproveAction(action)}
                            className="flex items-center gap-1"
                          >
                            <Eye className="h-3 w-3" />
                            Review
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {(!pendingActions || pendingActions.length === 0) && (
                    <Card>
                      <CardContent className="text-center py-8">
                        <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                        <p className="text-gray-600">No pending approvals</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="assignments" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Sample collector assignments</h3>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-blue-500" />
                  <span className="text-sm text-gray-600">
                    {users?.length || 0} available sample collectors
                  </span>
                </div>
              </div>

              {schedulesLoading ? (
                <div className="text-center py-8">Loading schedules...</div>
              ) : (
                <div className="space-y-4">
                  {schedules?.slice(0, 10).map(schedule => (
                    <Card key={schedule.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                              <Calendar className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                              <div className="font-medium">{schedule.name}</div>
                              <div className="text-sm text-gray-600">
                                {schedule.well.well_number} • {schedule.frequency}
                              </div>
                              <div className="text-sm text-gray-500">
                                Due: {new Date(schedule.next_due_date).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-right">
                              <div className="text-sm font-medium">
                                {schedule.assignee_name || 'Unassigned'}
                              </div>
                              <Badge
                                variant="outline"
                                className={getComplianceColor(schedule.compliance_status)}
                              >
                                {schedule.compliance_status}
                              </Badge>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAssignSchedule(schedule)}
                            >
                              <UserPlus className="h-3 w-3 mr-1" />
                              Assign
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="schedules" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Schedule Details</h3>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline">
                    <Plus className="h-3 w-3 mr-1" />
                    New Schedule
                  </Button>
                </div>
              </div>

              {schedulesLoading ? (
                <div className="text-center py-8">Loading schedules...</div>
              ) : (
                <div className="space-y-4">
                  {schedules?.map(schedule => (
                    <Card key={schedule.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div>
                              <div className="font-medium">{schedule.name}</div>
                              <div className="text-sm text-gray-600">
                                {schedule.well.well_number} •{' '}
                                {schedule.contaminant_names.join(', ')}
                              </div>
                              <div className="text-sm text-gray-500">
                                Frequency: {schedule.frequency} • Due:{' '}
                                {new Date(schedule.next_due_date).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={getComplianceColor(schedule.compliance_status)}
                            >
                              {schedule.compliance_status}
                              {schedule.days_overdue > 0 && ` (${schedule.days_overdue}d overdue)`}
                            </Badge>
                            <Button size="sm" variant="outline">
                              <Edit className="h-3 w-3 mr-1" />
                              Edit
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Approval Dialog */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review Alert-to-Schedule Action</DialogTitle>
          </DialogHeader>
          {selectedAction && (
            <div className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  This alert has triggered an automatic schedule change. Please review the details
                  and approve or reject the action.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium">Alert Information</h4>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>Contaminant: {selectedAction.alert.contaminant_name}</div>
                    <div>Well: {selectedAction.alert.well_name}</div>
                    <div>Result: {selectedAction.alert.result_value} mg/L</div>
                    <div>MCL: {selectedAction.alert.mcl_value} mg/L</div>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium">Proposed Changes</h4>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>Current: {selectedAction.previous_frequency}</div>
                    <div>New: {selectedAction.new_frequency}</div>
                    <div>Workflow: {selectedAction.workflow_group}</div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium">Justification</h4>
                <p className="text-sm text-gray-600">{selectedAction.justification}</p>
              </div>

              <div>
                <Label htmlFor="approval-notes">Review Notes</Label>
                <Textarea
                  id="approval-notes"
                  placeholder="Enter your review notes..."
                  value={approvalNotes}
                  onChange={e => setApprovalNotes(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApprovalDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => submitApproval(false)}
              disabled={approveActionMutation.isPending}
            >
              <ThumbsDown className="h-3 w-3 mr-1" />
              Reject
            </Button>
            <Button onClick={() => submitApproval(true)} disabled={approveActionMutation.isPending}>
              <ThumbsUp className="h-3 w-3 mr-1" />
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assignment Dialog */}
      <Dialog open={showAssignmentDialog} onOpenChange={setShowAssignmentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign sample collector</DialogTitle>
          </DialogHeader>
          {selectedSchedule && (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium">Schedule Details</h4>
                <div className="text-sm text-gray-600 space-y-1">
                  <div>Schedule: {selectedSchedule.name}</div>
                  <div>Well: {selectedSchedule.well?.well_number}</div>
                  <div>Frequency: {selectedSchedule.frequency}</div>
                  <div>Due: {new Date(selectedSchedule.next_due_date).toLocaleDateString()}</div>
                </div>
              </div>

              <div>
                <Label htmlFor="tester-select">Select sample collector</Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a sample collector…" />
                  </SelectTrigger>
                  <SelectContent>
                    {users
                      ?.filter(user => user.roles.includes('sample_collector'))
                      .map(user => (
                        <SelectItem key={user.id} value={user.id.toString()}>
                          {user.full_name} ({user.username})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignmentDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={submitAssignment}
              disabled={!selectedUserId || assignScheduleMutation.isPending}
            >
              <UserPlus className="h-3 w-3 mr-1" />
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SampleScheduleManagement;
