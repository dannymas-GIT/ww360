import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { AuditLog, AuditLogFilters, auditService } from '@/services/auditService';
import { normalizeUtcIso } from '@/utils/districtTime';
import {
  Activity,
  AlertCircle,
  Calendar,
  Database,
  Download,
  Eye,
  FileText,
  Filter,
  RefreshCw,
  Search,
  User,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Filter states — draft inputs vs applied filters used for fetch/pagination
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [actionFilter, setActionFilter] = useState('');
  const [tableFilter, setTableFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [appliedFilters, setAppliedFilters] = useState({
    start: '',
    end: '',
    action: '',
    table: '',
    username: '',
  });

  // Sorting states
  const [sortColumn, setSortColumn] = useState<string>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Dropdown options
  const [availableActions, setAvailableActions] = useState<string[]>([]);
  const [availableTables, setAvailableTables] = useState<string[]>([]);

  const { toast } = useToast();

  // Fetch audit logs
  const fetchLogs = async () => {
    try {
      setLoading(true);
      const filterParams: AuditLogFilters = {
        sort_by: sortColumn,
        sort_order: sortOrder,
        limit: pageSize,
        skip: (currentPage - 1) * pageSize,
      };

      if (appliedFilters.start) filterParams.start_date = appliedFilters.start;
      if (appliedFilters.end) filterParams.end_date = appliedFilters.end;
      if (appliedFilters.action) {
        // If filtering by "LOGIN", include all login-related actions
        if (appliedFilters.action === 'LOGIN') {
          filterParams.action_group = 'LOGIN';
        } else {
          filterParams.action = appliedFilters.action;
        }
      }
      if (appliedFilters.table) filterParams.table_name = appliedFilters.table;
      if (appliedFilters.username.trim()) {
        filterParams.username = appliedFilters.username.trim();
      }

      const response = await auditService.getAuditLogs(filterParams);
      setLogs(response.logs);
      setTotalCount(response.total);
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch audit logs. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch filter options
  const fetchFilterOptions = async () => {
    try {
      const [actions, tables] = await Promise.all([
        auditService.getUniqueActions(),
        auditService.getUniqueTableNames(),
      ]);
      setAvailableActions(actions);
      setAvailableTables(tables);
    } catch (error) {
      console.error('Failed to fetch filter options:', error);
    }
  };

  // Handle sorting
  const handleSort = (column: string) => {
    if (column === sortColumn) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  // Initial load and refetch when page/sort/applied filters change
  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: refetch on page/sort/filters
  }, [currentPage, sortColumn, sortOrder, appliedFilters]);

  useEffect(() => {
    fetchFilterOptions();
  }, []);

  // Apply filters
  const applyFilters = () => {
    setCurrentPage(1);
    setAppliedFilters({
      start: dateRange.start,
      end: dateRange.end,
      action: actionFilter,
      table: tableFilter,
      username: userFilter,
    });
  };

  // Clear filters
  const clearFilters = () => {
    setDateRange({ start: '', end: '' });
    setActionFilter('');
    setTableFilter('');
    setUserFilter('');
    setCurrentPage(1);
    setAppliedFilters({
      start: '',
      end: '',
      action: '',
      table: '',
      username: '',
    });
  };

  // Export logs
  const exportLogs = async () => {
    try {
      const response = await auditService.getAuditLogs({ limit: 10000 });
      auditService.exportToCsv(response.logs);
      toast({
        title: 'Success',
        description: 'Audit logs exported successfully.',
      });
    } catch (error) {
      console.error('Failed to export audit logs:', error);
      toast({
        title: 'Error',
        description: 'Failed to export audit logs.',
        variant: 'destructive',
      });
    }
  };

  // Format date for display. Prefer the ISO timestamp (naive UTC) — the
  // created_at display string ("2026-07-08 14:27:42 EDT") is not parseable
  // by all browsers and renders as "Invalid Date" in Firefox/Safari.
  const formatDate = (log: AuditLog) => {
    if (log.created_at_iso) {
      const date = new Date(normalizeUtcIso(log.created_at_iso));
      if (!Number.isNaN(date.getTime())) return date.toLocaleString();
    }
    const fallback = new Date(log.created_at);
    return Number.isNaN(fallback.getTime()) ? log.created_at || 'N/A' : fallback.toLocaleString();
  };

  // Get action badge color
  const getActionBadgeColor = (action: string) => {
    switch (action.toUpperCase()) {
      case 'INSERT':
        return 'bg-green-100 text-green-800';
      case 'UPDATE':
        return 'bg-blue-100 text-blue-800';
      case 'DELETE':
        return 'bg-red-100 text-red-800';
      case 'SELECT':
        return 'bg-gray-100 text-gray-800';
      case 'LOGIN':
        return 'bg-purple-100 text-purple-800';
      case 'LOGOUT':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Get sort icon
  const getSortIcon = (column: string) => {
    if (column !== sortColumn) {
      return '↕️';
    }
    return sortOrder === 'asc' ? '↑' : '↓';
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-lg p-6">
        <h1 className="text-3xl font-bold flex items-center">
          <FileText className="mr-3 h-8 w-8" />
          Audit Logs
        </h1>
        <p className="mt-2 text-red-100">Comprehensive security and compliance audit trail</p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="mr-2 h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Date Range */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Start Date</label>
              <Input
                type="date"
                value={dateRange.start}
                onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">End Date</label>
              <Input
                type="date"
                value={dateRange.end}
                onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              />
            </div>

            {/* Action Filter */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Action</label>
              <select
                value={actionFilter}
                onChange={e => setActionFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Actions</option>
                {availableActions.map(action => (
                  <option key={action} value={action}>
                    {action}
                  </option>
                ))}
              </select>
            </div>

            {/* Table Filter */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Table</label>
              <select
                value={tableFilter}
                onChange={e => setTableFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Tables</option>
                {availableTables.map(table => (
                  <option key={table} value={table}>
                    {table}
                  </option>
                ))}
              </select>
            </div>

            {/* User Filter */}
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-2 block">Username</label>
              <Input
                type="text"
                placeholder="Filter by username… (then Apply Filters)"
                value={userFilter}
                onChange={e => setUserFilter(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') applyFilters();
                }}
                className="w-full"
              />
            </div>

            {/* Filter Actions */}
            <div className="md:col-span-2 flex gap-2">
              <Button onClick={applyFilters} className="flex-1">
                <Search className="mr-2 h-4 w-4" />
                Apply Filters
              </Button>
              <Button variant="outline" onClick={clearFilters} className="flex-1">
                <RefreshCw className="mr-2 h-4 w-4" />
                Clear
              </Button>
              <Button variant="outline" onClick={exportLogs}>
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center">
              <Activity className="mr-2 h-5 w-5" />
              Audit Trail ({totalCount} entries)
            </CardTitle>
            <Button variant="outline" size="sm" onClick={fetchLogs}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              Loading audit logs...
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No audit logs found</h3>
              <p className="mt-1 text-sm text-gray-500">
                Try adjusting your filters or check back later.
              </p>
            </div>
          ) : (
            <>
              {/* Logs Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('created_at')}
                      >
                        Time {getSortIcon('created_at')}
                      </th>
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('username')}
                      >
                        User {getSortIcon('username')}
                      </th>
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('action')}
                      >
                        Action {getSortIcon('action')}
                      </th>
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('table_name')}
                      >
                        Table {getSortIcon('table_name')}
                      </th>
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('district_code')}
                      >
                        District {getSortIcon('district_code')}
                      </th>
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('ip_address')}
                      >
                        IP Address {getSortIcon('ip_address')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Details
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {logs.map(log => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className="flex items-center">
                            <Calendar className="mr-2 h-4 w-4 text-gray-400" />
                            {formatDate(log)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className="flex items-center">
                            <User className="mr-2 h-4 w-4 text-gray-400" />
                            <div>
                              <div className="font-medium">{log.username}</div>
                              <div className="text-gray-500 text-xs">{log.user_role}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getActionBadgeColor(log.action)}`}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className="flex items-center">
                            <Database className="mr-2 h-4 w-4 text-gray-400" />
                            {log.table_name}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {log.district_code}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span
                            className={`${log.ip_address && log.ip_address !== 'N/A' ? 'text-blue-600 font-medium' : 'text-gray-400'}`}
                          >
                            {log.ip_address || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <Button variant="outline" size="sm" onClick={() => setSelectedLog(log)}>
                            <Eye className="mr-1 h-3 w-3" />
                            View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalCount > 0 && (
                <div className="mt-6 flex items-center justify-between gap-4 flex-wrap pr-16 sm:pr-20">
                  <div className="text-sm text-gray-700">
                    Showing {(currentPage - 1) * pageSize + 1} to{' '}
                    {Math.min(currentPage * pageSize, totalCount)} of {totalCount} entries
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <span className="px-3 py-1 text-sm border rounded">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage >= totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-2xl w-full max-h-[80vh] overflow-auto">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Audit Log Details</span>
                <Button variant="outline" size="sm" onClick={() => setSelectedLog(null)}>
                  ×
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Log ID</label>
                    <p className="text-sm text-gray-900">{selectedLog.id}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Timestamp</label>
                    <p className="text-sm text-gray-900">{formatDate(selectedLog)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Username</label>
                    <p className="text-sm text-gray-900">{selectedLog.username}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">User Role</label>
                    <p className="text-sm text-gray-900">{selectedLog.user_role}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">District Code</label>
                    <p className="text-sm text-gray-900">{selectedLog.district_code}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Action</label>
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getActionBadgeColor(selectedLog.action)}`}
                    >
                      {selectedLog.action}
                    </span>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Table Name</label>
                    <p className="text-sm text-gray-900">{selectedLog.table_name}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Record ID</label>
                    <p className="text-sm text-gray-900">{selectedLog.record_id || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">IP Address</label>
                    <p className="text-sm text-gray-900">{selectedLog.ip_address || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Endpoint</label>
                    <p className="text-sm text-gray-900">{selectedLog.endpoint || 'N/A'}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AuditLogs;
