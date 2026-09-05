import React, { useState, useEffect } from 'react';
import {
  Users,
  Building2,
  Shield,
  Activity,
  TrendingUp,
  Database,
  Eye,
  AlertTriangle,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface SystemOverview {
  districts: {
    total_districts: number;
    new_districts_30d: number;
  };
  users_by_role: Array<{
    role_name: string;
    user_count: number;
    districts_count: number;
  }>;
  performance: {
    total_wells: number;
    total_readings: number;
    readings_30d: number;
    active_alerts: number;
  };
  total_sharing_permissions: number;
}

interface SharingPermission {
  from_district: string;
  to_district: string;
  data_type: string;
  permission_level: string;
  from_district_name: string;
  to_district_name: string;
  approved_at: string;
  expires_at?: string;
}

interface AuditActivity {
  action: string;
  table_name: string;
  user_id: number;
  username: string;
  district_code: string;
  district_name: string;
  created_at: string;
}

interface AdminOverviewData {
  system_overview: SystemOverview;
  active_sharing_permissions: SharingPermission[];
  recent_activity: AuditActivity[];
  system_health: {
    data_collection_rate: number;
    districts_active: number;
    security_level: string;
  };
}

const MultiTenantOverview: React.FC = () => {
  const [data, setData] = useState<AdminOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOverviewData();
  }, []);

  const fetchOverviewData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token');

      const response = await fetch('/api/v1/tenant/admin/overview', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch overview data: ${response.status}`);
      }

      const overviewData = await response.json();
      setData(overviewData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="flex">
          <AlertTriangle className="h-5 w-5 text-red-400" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error Loading Overview</h3>
            <p className="mt-2 text-sm text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return <div>No data available</div>;
  }

  const { system_overview, active_sharing_permissions, recent_activity, system_health } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg p-6">
        <h1 className="text-3xl font-bold flex items-center">
          <Shield className="mr-3 h-8 w-8" />
          Multi-Tenant Administration
        </h1>
        <p className="mt-2 text-purple-100">
          Enterprise-grade water quality monitoring system with granular permissions and
          district-level data isolation
        </p>
      </div>

      {/* System Health Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Districts</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{system_overview.districts.total_districts}</div>
            <p className="text-xs text-muted-foreground">
              +{system_overview.districts.new_districts_30d} this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data Collection</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{system_health.data_collection_rate}</div>
            <p className="text-xs text-muted-foreground">readings last 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Security Level</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">{system_health.security_level}</div>
            <p className="text-xs text-green-600 flex items-center">
              <CheckCircle className="h-3 w-3 mr-1" />
              RLS Active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sharing Permissions</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{system_overview.total_sharing_permissions}</div>
            <p className="text-xs text-muted-foreground">cross-district permissions</p>
          </CardContent>
        </Card>
      </div>

      {/* Users by Role */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="mr-2 h-5 w-5" />
            User Role Distribution
          </CardTitle>
          <CardDescription>Active users organized by role across all districts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {system_overview.users_by_role.map(role => (
              <div
                key={role.role_name}
                className="bg-slate-50 rounded-lg p-4 border border-slate-200"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900 capitalize">
                      {role.role_name.replace('_', ' ')}
                    </h3>
                    <p className="text-sm text-slate-600">
                      {role.user_count} users in {role.districts_count} districts
                    </p>
                  </div>
                  <div className="text-2xl font-bold text-blue-600">{role.user_count}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* System Performance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Database className="mr-2 h-5 w-5" />
              System Performance
            </CardTitle>
            <CardDescription>Data collection and monitoring statistics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Total Wells</span>
                <span className="font-semibold">{system_overview.performance.total_wells}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Total Readings</span>
                <span className="font-semibold">{system_overview.performance.total_readings}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Recent Readings (30d)</span>
                <span className="font-semibold text-green-600">
                  {system_overview.performance.readings_30d}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Active Alerts</span>
                <span className="font-semibold text-red-600">
                  {system_overview.performance.active_alerts}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Activity className="mr-2 h-5 w-5" />
              Recent Activity
            </CardTitle>
            <CardDescription>Latest system activities and changes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {recent_activity.slice(0, 10).map((activity, index) => (
                <div key={index} className="flex items-center space-x-3 text-sm">
                  <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-900 truncate">
                      <span className="font-medium">{activity.username}</span> performed{' '}
                      <span className="font-medium">{activity.action}</span> on{' '}
                      <span className="font-medium">{activity.table_name}</span>
                    </p>
                    <p className="text-slate-500 text-xs">
                      {activity.district_name} • {new Date(activity.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Sharing Permissions */}
      {active_sharing_permissions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Eye className="mr-2 h-5 w-5" />
              Active Data Sharing
            </CardTitle>
            <CardDescription>
              Cross-district data sharing permissions currently in effect
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {active_sharing_permissions.map((permission, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200"
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      {permission.from_district_name} → {permission.to_district_name}
                    </p>
                    <p className="text-sm text-slate-600">
                      {permission.data_type} ({permission.permission_level} access)
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">
                      Approved {new Date(permission.approved_at).toLocaleDateString()}
                    </p>
                    {permission.expires_at && (
                      <p className="text-xs text-amber-600 flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        Expires {new Date(permission.expires_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Security Features */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="mr-2 h-5 w-5" />
            Security & Compliance Features
          </CardTitle>
          <CardDescription>
            Enterprise security features currently active in the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center space-x-3">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-medium">Row-Level Security (RLS)</p>
                <p className="text-sm text-slate-600">Automatic data isolation at database level</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-medium">Role-Based Access Control</p>
                <p className="text-sm text-slate-600">9 granular permission levels</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-medium">Comprehensive Audit Logging</p>
                <p className="text-sm text-slate-600">All actions tracked for compliance</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-medium">Multi-District Support</p>
                <p className="text-sm text-slate-600">Scalable tenant architecture</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MultiTenantOverview;
