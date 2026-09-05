import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/context/AuthContext';
import { AlertCircle, Calendar, Download, Plus, Share2, Trash2, Upload } from 'lucide-react';
import React, { useEffect, useState } from 'react';

interface DataSharingAgreement {
  id: number;
  partner_district_code: string;
  partner_district_name: string;
  agreement_type: 'outbound' | 'inbound';
  data_types: string[];
  status: 'active' | 'pending' | 'expired' | 'revoked';
  created_at: string;
  expires_at?: string;
  description: string;
  access_level: 'read' | 'read_write';
  contact_email: string;
}

interface ShareRequest {
  id: number;
  requesting_district_code: string;
  requesting_district_name: string;
  requested_data_types: string[];
  justification: string;
  status: 'pending' | 'approved' | 'denied';
  created_at: string;
  contact_email: string;
}

interface NewAgreementData {
  partner_district_code: string;
  data_types: string[];
  description: string;
  access_level: 'read' | 'read_write';
  expires_at?: string;
  contact_email: string;
}

const DistrictDataSharing: React.FC = () => {
  const [agreements, setAgreements] = useState<DataSharingAgreement[]>([]);
  const [shareRequests, setShareRequests] = useState<ShareRequest[]>([]);
  const [availableDistricts, setAvailableDistricts] = useState<
    Array<{ code: string; name: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'agreements' | 'requests'>('agreements');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newAgreement, setNewAgreement] = useState<NewAgreementData>({
    partner_district_code: '',
    data_types: [],
    description: '',
    access_level: 'read',
    expires_at: '',
    contact_email: '',
  });

  useAuth();
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token');
      const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      // Load data sharing agreements, requests, and available districts
      const [agreementsResponse, requestsResponse, districtsResponse] = await Promise.all([
        fetch('/api/v1/district/data-sharing/agreements', { headers }),
        fetch('/api/v1/district/data-sharing/requests', { headers }),
        fetch('/api/v1/district/available-districts', { headers }),
      ]);

      if (!agreementsResponse.ok || !requestsResponse.ok || !districtsResponse.ok) {
        throw new Error('Failed to load data');
      }

      const agreementsData = await agreementsResponse.json();
      const requestsData = await requestsResponse.json();
      const districtsData = await districtsResponse.json();

      setAgreements(agreementsData.agreements || []);
      setShareRequests(requestsData.requests || []);
      setAvailableDistricts(districtsData.districts || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load data sharing information',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAgreement = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/v1/district/data-sharing/agreements', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newAgreement),
      });

      if (!response.ok) {
        throw new Error('Failed to create agreement');
      }

      toast({
        title: 'Success',
        description: 'Data sharing agreement created successfully',
      });

      setIsCreateDialogOpen(false);
      setNewAgreement({
        partner_district_code: '',
        data_types: [],
        description: '',
        access_level: 'read',
        expires_at: '',
        contact_email: '',
      });
      loadData();
    } catch (error) {
      console.error('Error creating agreement:', error);
      toast({
        title: 'Error',
        description: 'Failed to create data sharing agreement',
        variant: 'destructive',
      });
    }
  };

  const handleRequestResponse = async (requestId: number, action: 'approve' | 'deny') => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        `/api/v1/district/data-sharing/requests/${requestId}/${action}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to ${action} request`);
      }

      toast({
        title: 'Success',
        description: `Request ${action}d successfully`,
      });

      loadData();
    } catch (error) {
      console.error(`Error ${action}ing request:`, error);
      toast({
        title: 'Error',
        description: `Failed to ${action} request`,
        variant: 'destructive',
      });
    }
  };

  const handleRevokeAgreement = async (agreementId: number) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        `/api/v1/district/data-sharing/agreements/${agreementId}/revoke`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to revoke agreement');
      }

      toast({
        title: 'Success',
        description: 'Agreement revoked successfully',
      });

      loadData();
    } catch (error) {
      console.error('Error revoking agreement:', error);
      toast({
        title: 'Error',
        description: 'Failed to revoke agreement',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'default';
      case 'pending':
        return 'secondary';
      case 'expired':
        return 'destructive';
      case 'revoked':
        return 'outline';
      case 'approved':
        return 'default';
      case 'denied':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">District Data Sharing</h1>
          <p className="text-gray-600">Manage data sharing agreements for your district</p>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={value => setActiveTab(value as 'agreements' | 'requests')}
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="agreements">Data Sharing Agreements</TabsTrigger>
          <TabsTrigger value="requests">Incoming Requests</TabsTrigger>
        </TabsList>

        <TabsContent value="agreements" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Active Agreements</h2>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  New Agreement
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Create Data Sharing Agreement</DialogTitle>
                  <DialogDescription>
                    Set up a new data sharing agreement with another district
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="partner_district">Partner District</Label>
                    <Select
                      value={newAgreement.partner_district_code}
                      onValueChange={value =>
                        setNewAgreement({ ...newAgreement, partner_district_code: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select district" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableDistricts.map(district => (
                          <SelectItem key={district.code} value={district.code}>
                            {district.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="contact_email">Contact Email</Label>
                    <Input
                      id="contact_email"
                      type="email"
                      value={newAgreement.contact_email}
                      onChange={e =>
                        setNewAgreement({ ...newAgreement, contact_email: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      value={newAgreement.description}
                      onChange={e =>
                        setNewAgreement({ ...newAgreement, description: e.target.value })
                      }
                      placeholder="Purpose of data sharing"
                    />
                  </div>
                  <div>
                    <Label htmlFor="access_level">Access Level</Label>
                    <Select
                      value={newAgreement.access_level}
                      onValueChange={value =>
                        setNewAgreement({
                          ...newAgreement,
                          access_level: value as 'read' | 'read_write',
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="read">Read Only</SelectItem>
                        <SelectItem value="read_write">Read & Write</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="expires_at">Expiration Date (Optional)</Label>
                    <Input
                      id="expires_at"
                      type="date"
                      value={newAgreement.expires_at}
                      onChange={e =>
                        setNewAgreement({ ...newAgreement, expires_at: e.target.value })
                      }
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateAgreement}>Create Agreement</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Share2 className="w-5 h-5" />
                Data Sharing Agreements ({agreements.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Partner District</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Data Types</TableHead>
                    <TableHead>Access Level</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agreements.map(agreement => (
                    <TableRow key={agreement.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{agreement.partner_district_name}</div>
                          <div className="text-sm text-gray-500">
                            {agreement.partner_district_code}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {agreement.agreement_type === 'outbound' ? (
                            <>
                              <Upload className="w-3 h-3 mr-1" />
                              Outbound
                            </>
                          ) : (
                            <>
                              <Download className="w-3 h-3 mr-1" />
                              Inbound
                            </>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {agreement.data_types.slice(0, 2).map((type, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {type}
                            </Badge>
                          ))}
                          {agreement.data_types.length > 2 && (
                            <Badge variant="secondary" className="text-xs">
                              +{agreement.data_types.length - 2} more
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {agreement.access_level === 'read' ? 'Read Only' : 'Read & Write'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(agreement.status)}>
                          {agreement.status.charAt(0).toUpperCase() + agreement.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center text-sm">
                          <Calendar className="w-3 h-3 mr-1" />
                          {agreement.expires_at
                            ? new Date(agreement.expires_at).toLocaleDateString()
                            : 'No expiration'}
                        </div>
                      </TableCell>
                      <TableCell>
                        {agreement.status === 'active' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRevokeAgreement(agreement.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Incoming Share Requests ({shareRequests.length})
              </CardTitle>
              <CardDescription>Requests from other districts to access your data</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Requesting District</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Requested Data</TableHead>
                    <TableHead>Justification</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shareRequests.map(request => (
                    <TableRow key={request.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{request.requesting_district_name}</div>
                          <div className="text-sm text-gray-500">
                            {request.requesting_district_code}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{request.contact_email}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {request.requested_data_types.slice(0, 2).map((type, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {type}
                            </Badge>
                          ))}
                          {request.requested_data_types.length > 2 && (
                            <Badge variant="secondary" className="text-xs">
                              +{request.requested_data_types.length - 2} more
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm max-w-xs truncate" title={request.justification}>
                          {request.justification}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(request.status)}>
                          {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center text-sm">
                          <Calendar className="w-3 h-3 mr-1" />
                          {new Date(request.created_at).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        {request.status === 'pending' && (
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRequestResponse(request.id, 'approve')}
                            >
                              Approve
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRequestResponse(request.id, 'deny')}
                            >
                              Deny
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DistrictDataSharing;
