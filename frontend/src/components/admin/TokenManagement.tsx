import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Activity,
  AlertCircle,
  Building2,
  CheckCircle,
  Clock,
  CreditCard,
  DollarSign,
  Edit,
  FileText,
  Plus,
  RefreshCw,
  Trash2,
  TrendingDown,
  TrendingUp,
  Users,
  XCircle,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

import {
  DistrictSubscription,
  DistrictSubscriptionCreate,
  DistrictSubscriptionUpdate,
  RevenueReport,
  RevenueSummary,
  tokenManagementService,
  TokenTransaction,
} from '@/services/tokenManagementService';

interface TokenManagementProps {
  className?: string;
}

const TokenManagement: React.FC<TokenManagementProps> = ({ className = '' }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Data states
  const [subscriptions, setSubscriptions] = useState<DistrictSubscription[]>([]);
  const [revenueSummary, setRevenueSummary] = useState<RevenueSummary | null>(null);
  const [transactions, setTransactions] = useState<TokenTransaction[]>([]);
  const [revenueReports, setRevenueReports] = useState<RevenueReport[]>([]);

  // Form states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState<DistrictSubscription | null>(
    null
  );
  const [createForm, setCreateForm] = useState<DistrictSubscriptionCreate>({
    district_code: '',
    district_name: '',
    subscription_type: 'standard',
    monthly_revenue: 1000,
  });
  const [updateForm, setUpdateForm] = useState<DistrictSubscriptionUpdate>({});

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [subscriptionTypeFilter, setSubscriptionTypeFilter] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load all data in parallel
      const [subscriptionsData, summaryData, transactionsData, reportsData] = await Promise.all([
        tokenManagementService.getDistrictSubscriptions(
          0,
          100,
          statusFilter,
          subscriptionTypeFilter
        ),
        tokenManagementService.getRevenueSummary(),
        tokenManagementService.getTokenTransactions(0, 50),
        tokenManagementService.getRevenueReports(new Date().getFullYear()),
      ]);

      setSubscriptions(subscriptionsData);
      setRevenueSummary(summaryData);
      setTransactions(transactionsData);
      setRevenueReports(reportsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load token management data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubscription = async () => {
    try {
      await tokenManagementService.createDistrictSubscription(createForm);
      setIsCreateDialogOpen(false);
      setCreateForm({
        district_code: '',
        district_name: '',
        subscription_type: 'standard',
        monthly_revenue: 1000,
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create subscription');
    }
  };

  const handleUpdateSubscription = async () => {
    if (!selectedSubscription) return;

    try {
      await tokenManagementService.updateDistrictSubscription(selectedSubscription.id, updateForm);
      setIsEditDialogOpen(false);
      setSelectedSubscription(null);
      setUpdateForm({});
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update subscription');
    }
  };

  const handleDeleteSubscription = async (subscriptionId: number) => {
    if (!confirm('Are you sure you want to delete this subscription?')) return;

    try {
      await tokenManagementService.deleteDistrictSubscription(subscriptionId);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete subscription');
    }
  };

  const handleProcessMonthlyBilling = async () => {
    try {
      const result = await tokenManagementService.processMonthlyBilling();
      alert(
        `Monthly billing processed: ${result.processed_subscriptions} subscriptions, ${result.total_revenue} revenue`
      );
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process monthly billing');
    }
  };

  const openEditDialog = (subscription: DistrictSubscription) => {
    setSelectedSubscription(subscription);
    const form: DistrictSubscriptionUpdate = {
      district_name: subscription.district_name,
      subscription_type: subscription.subscription_type,
      status: subscription.status,
      monthly_revenue: subscription.monthly_revenue,
      auto_renewal: subscription.auto_renewal,
    };
    if (subscription.billing_contact_name != null) form.billing_contact_name = subscription.billing_contact_name;
    if (subscription.billing_contact_email != null) form.billing_contact_email = subscription.billing_contact_email;
    if (subscription.billing_contact_phone != null) form.billing_contact_phone = subscription.billing_contact_phone;
    if (subscription.notes != null) form.notes = subscription.notes;
    setUpdateForm(form);
    setIsEditDialogOpen(true);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'trial':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'suspended':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-64 ${className}`}>
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className={className}>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Token Management</h2>
          <p className="text-gray-600">SaaS monetization and district subscription management</p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={loadData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={handleProcessMonthlyBilling} variant="outline" size="sm">
            <CreditCard className="h-4 w-4 mr-2" />
            Process Billing
          </Button>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add District
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Create District Subscription</DialogTitle>
                <DialogDescription>
                  Add a new district subscription to the SaaS platform.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="district_code" className="text-right">
                    District Code
                  </Label>
                  <Input
                    id="district_code"
                    value={createForm.district_code}
                    onChange={e => setCreateForm({ ...createForm, district_code: e.target.value })}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="district_name" className="text-right">
                    District Name
                  </Label>
                  <Input
                    id="district_name"
                    value={createForm.district_name}
                    onChange={e => setCreateForm({ ...createForm, district_name: e.target.value })}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="subscription_type" className="text-right">
                    Type
                  </Label>
                  <Select
                    value={createForm.subscription_type || 'standard'}
                    onValueChange={value =>
                      setCreateForm({ ...createForm, subscription_type: value })
                    }
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="premium">Premium</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="monthly_revenue" className="text-right">
                    Monthly Revenue
                  </Label>
                  <Input
                    id="monthly_revenue"
                    type="number"
                    step="1000"
                    value={createForm.monthly_revenue}
                    onChange={e =>
                      setCreateForm({
                        ...createForm,
                        monthly_revenue: parseInt(e.target.value) || 1000,
                      })
                    }
                    className="col-span-3"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateSubscription}>Create Subscription</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Revenue Summary Cards */}
      {revenueSummary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {tokenManagementService.formatCurrency(revenueSummary.total_monthly_revenue)}
              </div>
              <p className="text-xs text-muted-foreground">
                <span
                  className={`inline-flex items-center ${revenueSummary.revenue_growth_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}
                >
                  {revenueSummary.revenue_growth_percent >= 0 ? (
                    <TrendingUp className="h-3 w-3 mr-1" />
                  ) : (
                    <TrendingDown className="h-3 w-3 mr-1" />
                  )}
                  {Math.abs(revenueSummary.revenue_growth_percent).toFixed(1)}%
                </span>{' '}
                from last month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{revenueSummary.total_tokens}</div>
              <p className="text-xs text-muted-foreground">
                {tokenManagementService.formatCurrency(revenueSummary.average_revenue_per_district)}{' '}
                avg per district
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Districts</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{revenueSummary.active_districts}</div>
              <p className="text-xs text-muted-foreground">
                <span
                  className={`inline-flex items-center ${revenueSummary.district_growth_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}
                >
                  {revenueSummary.district_growth_percent >= 0 ? (
                    <TrendingUp className="h-3 w-3 mr-1" />
                  ) : (
                    <TrendingDown className="h-3 w-3 mr-1" />
                  )}
                  {Math.abs(revenueSummary.district_growth_percent).toFixed(1)}%
                </span>{' '}
                growth
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Annual Revenue</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {tokenManagementService.formatCurrency(revenueSummary.total_annual_revenue)}
              </div>
              <p className="text-xs text-muted-foreground">Projected annual revenue</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Subscription Status Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span>Active</span>
                    </div>
                    <span className="font-medium">{revenueSummary?.active_districts || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      <span>Trial</span>
                    </div>
                    <span className="font-medium">{revenueSummary?.trial_districts || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                      <span>Suspended</span>
                    </div>
                    <span className="font-medium">{revenueSummary?.suspended_districts || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                      <span>Cancelled</span>
                    </div>
                    <span className="font-medium">{revenueSummary?.cancelled_districts || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Recent Revenue Reports
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {revenueReports.slice(0, 6).map(report => (
                    <div
                      key={`${report.year}-${report.month}`}
                      className="flex justify-between items-center p-2 rounded-lg hover:bg-gray-50"
                    >
                      <div>
                        <div className="font-medium">
                          {new Date(report.year, report.month - 1).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                          })}
                        </div>
                        <div className="text-sm text-gray-600">
                          {report.active_districts} districts
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">
                          {tokenManagementService.formatCurrency(report.total_revenue)}
                        </div>
                        <div className="text-sm text-gray-600">{report.total_tokens} tokens</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="subscriptions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>District Subscriptions</CardTitle>
              <CardDescription>Manage district subscriptions and token allocations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Filters */}
                <div className="flex space-x-4">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Statuses</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="trial">Trial</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={subscriptionTypeFilter} onValueChange={setSubscriptionTypeFilter}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Filter by type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Types</SelectItem>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="premium">Premium</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={loadData} variant="outline" size="sm">
                    Apply Filters
                  </Button>
                </div>

                {/* Subscriptions Table */}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-200">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border border-gray-200 px-4 py-2 text-left">District</th>
                        <th className="border border-gray-200 px-4 py-2 text-left">Type</th>
                        <th className="border border-gray-200 px-4 py-2 text-left">Status</th>
                        <th className="border border-gray-200 px-4 py-2 text-right">
                          Monthly Revenue
                        </th>
                        <th className="border border-gray-200 px-4 py-2 text-right">Tokens</th>
                        <th className="border border-gray-200 px-4 py-2 text-left">Next Billing</th>
                        <th className="border border-gray-200 px-4 py-2 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subscriptions.map(subscription => (
                        <tr key={subscription.id} className="hover:bg-gray-50">
                          <td className="border border-gray-200 px-4 py-2">
                            <div>
                              <div className="font-medium">{subscription.district_name}</div>
                              <div className="text-sm text-gray-600">
                                {subscription.district_code}
                              </div>
                            </div>
                          </td>
                          <td className="border border-gray-200 px-4 py-2">
                            <Badge
                              className={tokenManagementService.getSubscriptionTypeColor(
                                subscription.subscription_type
                              )}
                            >
                              {subscription.subscription_type}
                            </Badge>
                          </td>
                          <td className="border border-gray-200 px-4 py-2">
                            <div className="flex items-center gap-2">
                              {getStatusIcon(subscription.status)}
                              <Badge
                                className={tokenManagementService.getStatusBadgeColor(
                                  subscription.status
                                )}
                              >
                                {subscription.status}
                              </Badge>
                            </div>
                          </td>
                          <td className="border border-gray-200 px-4 py-2 text-right">
                            <div className="font-medium">
                              {tokenManagementService.formatCurrency(subscription.monthly_revenue)}
                            </div>
                            <div className="text-sm text-gray-600">
                              {tokenManagementService.formatCurrency(subscription.annual_revenue)}
                              /year
                            </div>
                          </td>
                          <td className="border border-gray-200 px-4 py-2 text-right">
                            <div className="font-medium text-blue-600">
                              {subscription.tokens_generated}
                            </div>
                          </td>
                          <td className="border border-gray-200 px-4 py-2">
                            {subscription.next_billing_date
                              ? tokenManagementService.formatDate(subscription.next_billing_date)
                              : 'N/A'}
                          </td>
                          <td className="border border-gray-200 px-4 py-2">
                            <div className="flex justify-center space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEditDialog(subscription)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteSubscription(subscription.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Token Transactions</CardTitle>
              <CardDescription>
                View token transaction history and billing activities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-200">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border border-gray-200 px-4 py-2 text-left">Date</th>
                      <th className="border border-gray-200 px-4 py-2 text-left">District</th>
                      <th className="border border-gray-200 px-4 py-2 text-left">Type</th>
                      <th className="border border-gray-200 px-4 py-2 text-right">Tokens</th>
                      <th className="border border-gray-200 px-4 py-2 text-right">Amount</th>
                      <th className="border border-gray-200 px-4 py-2 text-left">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map(transaction => (
                      <tr key={transaction.id} className="hover:bg-gray-50">
                        <td className="border border-gray-200 px-4 py-2">
                          {tokenManagementService.formatDateTime(transaction.created_at)}
                        </td>
                        <td className="border border-gray-200 px-4 py-2">
                          <div className="font-medium">{transaction.district_code}</div>
                        </td>
                        <td className="border border-gray-200 px-4 py-2">
                          <Badge
                            className={tokenManagementService.getTransactionTypeColor(
                              transaction.transaction_type
                            )}
                          >
                            {tokenManagementService.getTransactionTypeLabel(
                              transaction.transaction_type
                            )}
                          </Badge>
                        </td>
                        <td className="border border-gray-200 px-4 py-2 text-right">
                          <span
                            className={`font-medium ${transaction.tokens_amount >= 0 ? 'text-green-600' : 'text-red-600'}`}
                          >
                            {transaction.tokens_amount >= 0 ? '+' : ''}
                            {transaction.tokens_amount}
                          </span>
                        </td>
                        <td className="border border-gray-200 px-4 py-2 text-right">
                          <span
                            className={`font-medium ${transaction.dollar_amount >= 0 ? 'text-green-600' : 'text-red-600'}`}
                          >
                            {tokenManagementService.formatCurrency(transaction.dollar_amount)}
                          </span>
                        </td>
                        <td className="border border-gray-200 px-4 py-2">
                          <div className="text-sm">{transaction.description}</div>
                          {transaction.created_by && (
                            <div className="text-xs text-gray-500">by {transaction.created_by}</div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>Edit District Subscription</DialogTitle>
            <DialogDescription>
              Update subscription details for {selectedSubscription?.district_name}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_status" className="text-right">
                Status
              </Label>
              <Select
                value={updateForm.status || 'active'}
                onValueChange={value => setUpdateForm({ ...updateForm, status: value })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_monthly_revenue" className="text-right">
                Monthly Revenue
              </Label>
              <Input
                id="edit_monthly_revenue"
                type="number"
                step="1000"
                value={updateForm.monthly_revenue}
                onChange={e =>
                  setUpdateForm({ ...updateForm, monthly_revenue: parseInt(e.target.value) })
                }
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_contact_name" className="text-right">
                Contact Name
              </Label>
              <Input
                id="edit_contact_name"
                value={updateForm.billing_contact_name || ''}
                onChange={e =>
                  setUpdateForm({ ...updateForm, billing_contact_name: e.target.value })
                }
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_contact_email" className="text-right">
                Contact Email
              </Label>
              <Input
                id="edit_contact_email"
                type="email"
                value={updateForm.billing_contact_email || ''}
                onChange={e =>
                  setUpdateForm({ ...updateForm, billing_contact_email: e.target.value })
                }
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_notes" className="text-right">
                Notes
              </Label>
              <Textarea
                id="edit_notes"
                value={updateForm.notes || ''}
                onChange={e => setUpdateForm({ ...updateForm, notes: e.target.value })}
                className="col-span-3"
              />
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateSubscription}>Update Subscription</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TokenManagement;
