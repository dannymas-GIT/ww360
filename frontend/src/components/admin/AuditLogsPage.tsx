import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import {
  AlertTriangle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  History,
  Search,
  Settings,
  ShieldCheck,
  User,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuthHeader } from '@/services/authService';
import { normalizeUtcIso } from '@/utils/districtTime';

interface AuditEntry {
  id: number;
  change_uuid: string;
  change_type: string;
  change_source: string;
  change_status: string;
  change_title: string;
  change_description: string;
  alert_id?: number;
  contaminant_name?: string;
  well_name?: string;
  well_number?: string;
  created_at: string;
  created_by?: string;
  approved_at?: string;
  approved_by?: string;
  implemented_at?: string;
  implemented_by?: string;
  compliance_status?: string;
  regulatory_notification_sent: boolean;
  workflow_group?: string;
  processor_type?: string;
}

interface AuditResponse {
  audit_entries: AuditEntry[];
  pagination: {
    total: number;
    limit: number;
    skip: number;
    has_more: boolean;
  };
  summary: {
    total_changes: number;
    pending_changes: number;
    approved_changes: number;
    implemented_changes: number;
    district_code: string;
  };
}

export interface AuditLogsPageProps {
  embedded?: boolean;
}

export const AuditLogsPage: React.FC<AuditLogsPageProps> = ({ embedded = false }) => {
  const navigate = useNavigate();
  const [auditData, setAuditData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(25);

  // Draft search vs applied search (pagination must use applied filters)
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');

  const fetchAuditLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: pageSize.toString(),
        skip: ((currentPage - 1) * pageSize).toString(),
      });

      if (searchTerm.trim()) {
        params.append('search', searchTerm.trim());
      }

      if (statusFilter !== 'all') {
        params.append('change_status', statusFilter);
      }

      if (typeFilter !== 'all') {
        params.append('change_type', typeFilter);
      }

      if (dateFilter !== 'all') {
        const today = new Date();
        let startDate = '';

        switch (dateFilter) {
          case 'today':
            startDate = today.toISOString().split('T')[0];
            break;
          case 'week': {
            const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
            startDate = weekAgo.toISOString().split('T')[0];
            break;
          }
          case 'month': {
            const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
            startDate = monthAgo.toISOString().split('T')[0];
            break;
          }
        }

        if (startDate) {
          params.append('start_date', startDate);
        }
      }

      const response = await fetch(`/api/v1/district/audit-logs?${params}`, {
        headers: { ...getAuthHeader() },
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setAuditData(data);
      } else {
        console.error('Failed to fetch audit logs:', response.status);
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, searchTerm, statusFilter, typeFilter, dateFilter]);

  useEffect(() => {
    void fetchAuditLogs();
  }, [fetchAuditLogs]);

  // Reset to first page when filters change (except page itself)
  const applySearch = () => {
    setCurrentPage(1);
    setSearchTerm(searchInput);
  };

  const handleStatusFilter = (value: string) => {
    setCurrentPage(1);
    setStatusFilter(value);
  };

  const handleTypeFilter = (value: string) => {
    setCurrentPage(1);
    setTypeFilter(value);
  };

  const handleDateFilter = (value: string) => {
    setCurrentPage(1);
    setDateFilter(value);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(normalizeUtcIso(dateString));
    return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleString();
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'implemented':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'approved':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getChangeTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'frequency_increase':
      case 'frequency_decrease':
        return <Calendar className="h-4 w-4" />;
      case 'schedule_suspension':
      case 'schedule_resumption':
        return <Settings className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const handleAlertClick = (alertId: number) => {
    // Navigate back to alerts page with this alert selected/filtered
    navigate(`/district-admin/alerts?alert_id=${alertId}`);
  };

  if (loading && !auditData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Loading audit logs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={embedded ? 'space-y-6' : 'container mx-auto px-4 py-8 space-y-6'}>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          {!embedded && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(-1)}
              className="flex items-center gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
          )}
          <div>
            <h2
              className={
                embedded
                  ? 'text-lg font-semibold flex items-center gap-2'
                  : 'text-3xl font-bold flex items-center gap-2'
              }
            >
              <History className={embedded ? 'h-5 w-5 text-green-600' : 'h-8 w-8 text-green-600'} />
              Schedule change audit
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Alert-triggered schedule changes for regulatory compliance
            </p>
          </div>
        </div>

        <Button variant="outline" className="flex items-center gap-2" type="button">
          <Download className="h-4 w-4" />
          Export Audit Report
        </Button>
      </div>

      {/* Summary Cards */}
      {auditData?.summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{auditData.summary.total_changes}</p>
                  <p className="text-sm text-gray-600">Total Changes</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-yellow-500" />
                <div>
                  <p className="text-2xl font-bold">{auditData.summary.pending_changes}</p>
                  <p className="text-sm text-gray-600">Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{auditData.summary.approved_changes}</p>
                  <p className="text-sm text-gray-600">Approved</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{auditData.summary.implemented_changes}</p>
                  <p className="text-sm text-gray-600">Implemented</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filter Audit Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Search</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search titles or descriptions..."
                    value={searchInput}
                    onChange={e => setSearchInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') applySearch();
                    }}
                    className="pl-10"
                  />
                </div>
                <Button type="button" variant="secondary" onClick={applySearch}>
                  Search
                </Button>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select value={statusFilter} onValueChange={handleStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="implemented">Implemented</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Change Type</label>
              <Select value={typeFilter} onValueChange={handleTypeFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="frequency_increase">Frequency Increase</SelectItem>
                  <SelectItem value="frequency_decrease">Frequency Decrease</SelectItem>
                  <SelectItem value="schedule_suspension">Schedule Suspension</SelectItem>
                  <SelectItem value="parameter_addition">Parameter Addition</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Time Period</label>
              <Select value={dateFilter} onValueChange={handleDateFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">Last Week</SelectItem>
                  <SelectItem value="month">Last Month</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit Log Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Audit Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {auditData?.audit_entries && auditData.audit_entries.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Alert/Well</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Created By</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditData.audit_entries.map(entry => (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getChangeTypeIcon(entry.change_type)}
                          <span className="text-sm font-medium">
                            {entry.change_type.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{entry.change_title}</p>
                          <p className="text-sm text-gray-600 max-w-xs truncate">
                            {entry.change_description}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {entry.alert_id && (
                          <div>
                            <Button
                              variant="link"
                              size="sm"
                              className="p-0 h-auto text-blue-600"
                              onClick={() => handleAlertClick(entry.alert_id!)}
                            >
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Alert #{entry.alert_id}
                            </Button>
                            {(entry.well_name || entry.well_number) && (
                              <p className="text-xs text-gray-500">
                                {entry.well_name || entry.well_number}
                              </p>
                            )}
                            {entry.contaminant_name && (
                              <p className="text-xs text-gray-500">{entry.contaminant_name}</p>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getStatusColor(entry.change_status)}>
                          {entry.change_status.toUpperCase()}
                        </Badge>
                        {entry.regulatory_notification_sent && (
                          <Badge variant="outline" className="ml-2 bg-blue-50 text-blue-700">
                            NOTIFIED
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(entry.created_at)}</TableCell>
                      <TableCell className="text-sm">{entry.created_by || 'System'}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="text-gray-600">
                          <FileText className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {auditData.pagination && auditData.pagination.total > 0 && (
                <div className="flex items-center justify-between mt-4 gap-4 flex-wrap pr-16 sm:pr-20">
                  <p className="text-sm text-gray-600">
                    Showing {auditData.pagination.skip + 1} to{' '}
                    {Math.min(
                      auditData.pagination.skip + auditData.pagination.limit,
                      auditData.pagination.total
                    )}{' '}
                    of {auditData.pagination.total} entries
                  </p>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>

                    <span className="text-sm">
                      Page {currentPage} of{' '}
                      {Math.max(1, Math.ceil(auditData.pagination.total / pageSize))}
                    </span>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={!auditData.pagination.has_more}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <History className="mx-auto h-12 w-12 mb-4 text-gray-300" />
              <p className="text-lg font-medium">No audit logs found</p>
              <p className="text-sm">
                Audit entries will appear here when schedule changes are made
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
