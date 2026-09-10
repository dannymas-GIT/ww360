import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import {
  Share2,
  Plus,
  Users,
  Eye,
  Clock,
  Trash2,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Database,
} from 'lucide-react';

interface SharingPermission {
  id: number;
  from_district: string;
  to_district: string;
  from_district_name?: string;
  to_district_name?: string;
  data_type: string;
  permission_level: string;
  approved_at: string;
  expires_at?: string;
  conditions?: string;
  justification?: string;
  approved_by_username?: string;
}

interface District {
  district_code: string;
  district_name: string;
  data_sharing_level: string;
}

interface DataSharingOverview {
  current_district: {
    code: string;
    name: string;
  };
  outbound_sharing: {
    description: string;
    permissions: SharingPermission[];
    count: number;
  };
  inbound_sharing: {
    description: string;
    permissions: SharingPermission[];
    count: number;
  };
  available_districts: District[];
  sharing_capabilities: {
    data_types: string[];
    permission_levels: string[];
    can_configure: boolean;
  };
}

interface Engineer {
  id: number;
  username: string;
  full_name: string;
  role_name: string;
}

interface DataSharingCreateRequest {
  to_district: string;
  data_type: string;
  permission_level: string;
  expires_at?: string;
  conditions?: string;
  justification?: string;
}

interface EngineerDataRequest {
  requesting_engineer_id: number;
  district_codes: string[];
  data_types: string[];
  duration_days: number;
  justification: string;
  project_name?: string;
}

const DataSharingManagement: React.FC = () => {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEngineerRequestDialogOpen, setIsEngineerRequestDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'outbound' | 'inbound' | 'engineers'>('outbound');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch data sharing overview
  const { data: sharingData, isLoading } = useQuery<DataSharingOverview>({
    queryKey: ['dataSharing', 'overview'],
    queryFn: async () => {
      const response = await fetch('/api/v1/tenant/admin/districts/sharing', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch sharing data');
      return response.json();
    },
  });

  // Fetch engineers for data access requests
  const { data: engineers } = useQuery<Engineer[]>({
    queryKey: ['engineers'],
    queryFn: async () => {
      const response = await fetch(
        '/api/v1/tenant/admin/users?role_filter=lead_engineer,field_engineer,regulatory_viewer',
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
          },
        }
      );
      if (!response.ok) throw new Error('Failed to fetch engineers');
      return response.json();
    },
  });

  // Create sharing permission mutation
  const createSharingMutation = useMutation({
    mutationFn: async (data: DataSharingCreateRequest) => {
      const response = await fetch('/api/v1/tenant/admin/districts/sharing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create sharing permission');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dataSharing'] });
      setIsCreateDialogOpen(false);
      toast({
        title: 'Success',
        description: 'Data sharing permission created successfully',
        variant: 'default',
      });
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast({
        title: 'Error',
        description: errorMessage || 'Failed to create sharing permission',
        variant: 'destructive',
      });
    },
  });

  // Engineer data access request mutation
  const engineerAccessMutation = useMutation({
    mutationFn: async (data: EngineerDataRequest) => {
      const response = await fetch('/api/v1/tenant/admin/engineers/data-access-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create engineer access request');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dataSharing'] });
      setIsEngineerRequestDialogOpen(false);
      toast({
        title: 'Success',
        description: 'Engineer data access configured successfully',
        variant: 'default',
      });
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast({
        title: 'Error',
        description: errorMessage || 'Failed to configure engineer access',
        variant: 'destructive',
      });
    },
  });

  // Revoke sharing permission mutation
  const revokeSharingMutation = useMutation({
    mutationFn: async (sharingId: number) => {
      const response = await fetch(`/api/v1/tenant/admin/districts/sharing/${sharingId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });
      if (!response.ok) throw new Error('Failed to revoke sharing permission');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dataSharing'] });
      toast({
        title: 'Success',
        description: 'Data sharing permission revoked',
        variant: 'default',
      });
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast({
        title: 'Error',
        description: errorMessage || 'Failed to revoke permission',
        variant: 'destructive',
      });
    },
  });

  const handleCreateSharing = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    const expiresAt = formData.get('expires_at') as string;
    const conditions = formData.get('conditions') as string;
    const justification = formData.get('justification') as string;

    const data: DataSharingCreateRequest = {
      to_district: formData.get('to_district') as string,
      data_type: formData.get('data_type') as string,
      permission_level: formData.get('permission_level') as string,
      ...(expiresAt && { expires_at: expiresAt }),
      ...(conditions && { conditions }),
      ...(justification && { justification }),
    };
    createSharingMutation.mutate(data);
  };

  const handleEngineerRequest = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    const districtCodes = JSON.parse((formData.get('district_codes') as string) || '[]');
    const dataTypes = JSON.parse((formData.get('data_types') as string) || '[]');
    const projectName = formData.get('project_name') as string;

    const data: EngineerDataRequest = {
      requesting_engineer_id: parseInt(formData.get('engineer_id') as string),
      district_codes: districtCodes,
      data_types: dataTypes,
      duration_days: parseInt(formData.get('duration_days') as string) || 30,
      justification: formData.get('justification') as string,
      ...(projectName && { project_name: projectName }),
    };
    engineerAccessMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!sharingData) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-gray-500">Failed to load data sharing information</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center">
            <Share2 className="mr-3 h-6 w-6 text-blue-600" />
            Data Sharing Management
          </h2>
          <p className="text-gray-600 mt-1">
            Manage opt-in data sharing with other districts and engineer access
          </p>
        </div>

        <div className="flex space-x-3">
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="mr-2 h-4 w-4" />
                Share Data
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <form onSubmit={handleCreateSharing}>
                <DialogHeader>
                  <DialogTitle>Create Data Sharing Permission</DialogTitle>
                  <DialogDescription>
                    Grant another district access to your data (opt-in sharing)
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div>
                    <Label htmlFor="to_district">Target District</Label>
                    <Select name="to_district" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select district to share with" />
                      </SelectTrigger>
                      <SelectContent>
                        {sharingData.available_districts.map(district => (
                          <SelectItem key={district.district_code} value={district.district_code}>
                            {district.district_name} ({district.district_code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="data_type">Data Type</Label>
                    <Select name="data_type" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select data type" />
                      </SelectTrigger>
                      <SelectContent>
                        {sharingData.sharing_capabilities.data_types.map(type => (
                          <SelectItem key={type} value={type}>
                            {type.charAt(0).toUpperCase() + type.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="permission_level">Permission Level</Label>
                    <Select name="permission_level" defaultValue="read">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {sharingData.sharing_capabilities.permission_levels.map(level => (
                          <SelectItem key={level} value={level}>
                            {level.charAt(0).toUpperCase() + level.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="expires_at">Expiration Date (Optional)</Label>
                    <Input type="datetime-local" name="expires_at" />
                  </div>

                  <div>
                    <Label htmlFor="justification">Justification</Label>
                    <Textarea
                      name="justification"
                      placeholder="Explain why this data sharing is needed..."
                      rows={3}
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button type="submit" disabled={createSharingMutation.isPending}>
                    {createSharingMutation.isPending ? 'Creating...' : 'Create Permission'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isEngineerRequestDialogOpen} onOpenChange={setIsEngineerRequestDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Users className="mr-2 h-4 w-4" />
                Engineer Access
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <form onSubmit={handleEngineerRequest}>
                <DialogHeader>
                  <DialogTitle>Configure Engineer Data Access</DialogTitle>
                  <DialogDescription>
                    Grant engineers temporary access to shared district data
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div>
                    <Label htmlFor="engineer_id">Engineer</Label>
                    <Select name="engineer_id" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select engineer" />
                      </SelectTrigger>
                      <SelectContent>
                        {engineers?.map(engineer => (
                          <SelectItem key={engineer.id} value={engineer.id.toString()}>
                            {engineer.full_name} ({engineer.role_name})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="project_name">Project Name (Optional)</Label>
                    <Input name="project_name" placeholder="e.g., Q4 Compliance Review" />
                  </div>

                  <div>
                    <Label htmlFor="duration_days">Access Duration (Days)</Label>
                    <Input type="number" name="duration_days" defaultValue={30} min={1} max={365} />
                  </div>

                  <div>
                    <Label>Districts (Select multiple)</Label>
                    <input type="hidden" name="district_codes" value="[]" />
                    <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto border rounded p-2">
                      {sharingData.available_districts.map(district => (
                        <label
                          key={district.district_code}
                          className="flex items-center space-x-2 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            className="rounded"
                            onChange={e => {
                              const hiddenInput = document.querySelector(
                                'input[name="district_codes"]'
                              ) as HTMLInputElement;
                              const current = JSON.parse(hiddenInput.value);
                              if (e.target.checked) {
                                current.push(district.district_code);
                              } else {
                                const index = current.indexOf(district.district_code);
                                if (index > -1) current.splice(index, 1);
                              }
                              hiddenInput.value = JSON.stringify(current);
                            }}
                          />
                          <span className="text-sm">{district.district_name}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label>Data Types (Select multiple)</Label>
                    <input type="hidden" name="data_types" value="[]" />
                    <div className="grid grid-cols-2 gap-2">
                      {sharingData.sharing_capabilities.data_types.map(type => (
                        <label key={type} className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            className="rounded"
                            onChange={e => {
                              const hiddenInput = document.querySelector(
                                'input[name="data_types"]'
                              ) as HTMLInputElement;
                              const current = JSON.parse(hiddenInput.value);
                              if (e.target.checked) {
                                current.push(type);
                              } else {
                                const index = current.indexOf(type);
                                if (index > -1) current.splice(index, 1);
                              }
                              hiddenInput.value = JSON.stringify(current);
                            }}
                          />
                          <span className="text-sm capitalize">{type}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="justification">Justification</Label>
                    <Textarea
                      name="justification"
                      placeholder="Explain the purpose of this data access..."
                      rows={3}
                      required
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button type="submit" disabled={engineerAccessMutation.isPending}>
                    {engineerAccessMutation.isPending ? 'Configuring...' : 'Configure Access'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Current District Info */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-center">
            <Database className="h-5 w-5 text-blue-600 mr-3" />
            <div>
              <p className="font-medium text-blue-900">
                Current District: {sharingData.current_district.name}
              </p>
              <p className="text-sm text-blue-700">Code: {sharingData.current_district.code}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('outbound')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'outbound'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <ArrowRight className="inline h-4 w-4 mr-1" />
            Outbound Sharing ({sharingData.outbound_sharing.count})
          </button>
          <button
            onClick={() => setActiveTab('inbound')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'inbound'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <ArrowLeft className="inline h-4 w-4 mr-1" />
            Inbound Sharing ({sharingData.inbound_sharing.count})
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'outbound' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <ArrowRight className="mr-2 h-5 w-5 text-blue-600" />
              Data You Share With Others
            </CardTitle>
            <CardDescription>{sharingData.outbound_sharing.description}</CardDescription>
          </CardHeader>
          <CardContent>
            {sharingData.outbound_sharing.permissions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Share2 className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                <p>No outbound data sharing permissions configured</p>
                <p className="text-sm">
                  Click "Share Data" to enable data sharing with other districts
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {sharingData.outbound_sharing.permissions.map(permission => (
                  <div
                    key={`${permission.to_district}-${permission.data_type}`}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border"
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <Database className="h-4 w-4 text-blue-600" />
                          </div>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {permission.to_district_name || permission.to_district}
                          </p>
                          <p className="text-sm text-gray-600">
                            {permission.data_type} data • {permission.permission_level} access
                          </p>
                          {permission.expires_at && (
                            <p className="text-xs text-amber-600 flex items-center mt-1">
                              <Clock className="h-3 w-3 mr-1" />
                              Expires {new Date(permission.expires_at).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <div className="text-right text-xs text-gray-500">
                        <p>Approved {new Date(permission.approved_at).toLocaleDateString()}</p>
                        {permission.approved_by_username && (
                          <p>by {permission.approved_by_username}</p>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (
                            confirm('Are you sure you want to revoke this data sharing permission?')
                          ) {
                            revokeSharingMutation.mutate(permission.id);
                          }
                        }}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'inbound' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <ArrowLeft className="mr-2 h-5 w-5 text-green-600" />
              Data Shared With You
            </CardTitle>
            <CardDescription>{sharingData.inbound_sharing.description}</CardDescription>
          </CardHeader>
          <CardContent>
            {sharingData.inbound_sharing.permissions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Eye className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                <p>No data is currently being shared with your district</p>
                <p className="text-sm">Other districts haven't opted to share data with you yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {sharingData.inbound_sharing.permissions.map(permission => (
                  <div
                    key={`${permission.from_district}-${permission.data_type}`}
                    className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        </div>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {permission.from_district_name || permission.from_district}
                        </p>
                        <p className="text-sm text-gray-600">
                          {permission.data_type} data • {permission.permission_level} access
                        </p>
                        {permission.expires_at && (
                          <p className="text-xs text-amber-600 flex items-center mt-1">
                            <Clock className="h-3 w-3 mr-1" />
                            Expires {new Date(permission.expires_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="text-right text-xs text-gray-500">
                      <p>Approved {new Date(permission.approved_at).toLocaleDateString()}</p>
                      {permission.approved_by_username && (
                        <p>by {permission.approved_by_username}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DataSharingManagement;
