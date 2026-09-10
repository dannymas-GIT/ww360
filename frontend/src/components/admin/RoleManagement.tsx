import React, { useState, useEffect } from 'react';
import {
  Shield,
  UserCheck,
  Plus,
  Edit3,
  Building2,
  Users,
  Key,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Search,
  Filter,
  Eye,
  Lock,
  Globe,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Role {
  role_name: string;
  district_code: string | null;
  district_name: string | null;
  user_count: number;
  permissions: string[];
  created_at: string;
  is_system_role: boolean;
  description?: string;
  scope?: string;
  is_active?: boolean;
}

interface RoleAssignment {
  user_id: number;
  username: string;
  email: string;
  full_name: string;
  role_name: string;
  district_code: string | null;
  district_name: string | null;
  is_active: boolean;
  granted_at: string;
  expires_at?: string;
  granted_by_username?: string;
}

interface RoleFilters {
  search: string;
  district: string;
  type: 'all' | 'system' | 'district';
}

const RoleManagement: React.FC = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [roleAssignments, setRoleAssignments] = useState<RoleAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<RoleFilters>({
    search: '',
    district: '',
    type: 'all',
  });
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [activeTab, setActiveTab] = useState<'roles' | 'assignments'>('roles');

  useEffect(() => {
    fetchRoles();
    fetchRoleAssignments();
  }, [filters]);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token');

      const params = new URLSearchParams();
      if (filters.district) params.append('district_code', filters.district);

      const response = await fetch(`/api/v1/tenant/admin/roles/list?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch roles: ${response.status}`);
      }

      const data = await response.json();
      setRoles(data.roles || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch roles');
    } finally {
      setLoading(false);
    }
  };

  const fetchRoleAssignments = async () => {
    try {
      const token = localStorage.getItem('auth_token');

      const response = await fetch('/api/v1/tenant/admin/role-assignments', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.warn('Role assignments endpoint not found, using mock data');
        setRoleAssignments([]);
        return;
      }

      const data = await response.json();
      setRoleAssignments(data.assignments || []);
    } catch (err) {
      console.warn('Failed to fetch role assignments:', err);
      setRoleAssignments([]);
    }
  };

  const filteredRoles = roles.filter(role => {
    if (
      filters.search &&
      !role.role_name.toLowerCase().includes(filters.search.toLowerCase()) &&
      !(role.description || '').toLowerCase().includes(filters.search.toLowerCase())
    ) {
      return false;
    }

    if (filters.type !== 'all') {
      const scope = role.scope || 'district';
      if (filters.type === 'system' && scope !== 'global') return false;
      if (filters.type === 'district' && scope === 'global') return false;
    }

    return true;
  });

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
            <h3 className="text-sm font-medium text-red-800">Error Loading Roles</h3>
            <p className="mt-2 text-sm text-red-700">{error}</p>
            <button
              onClick={fetchRoles}
              className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg p-6">
        <h1 className="text-3xl font-bold flex items-center">
          <Shield className="mr-3 h-8 w-8" />
          Role Management
        </h1>
        <p className="mt-2 text-purple-100">
          Configure roles, permissions, and access control across all districts
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('roles')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'roles'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Shield className="w-4 h-4 inline mr-2" />
            Roles & Permissions
          </button>
          <button
            onClick={() => setActiveTab('assignments')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'assignments'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <UserCheck className="w-4 h-4 inline mr-2" />
            Role Assignments
          </button>
        </nav>
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex flex-1 gap-4 items-center">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search roles..."
              value={filters.search}
              onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-2">
            <select
              value={filters.type}
              onChange={e =>
                setFilters(prev => ({ ...prev, type: e.target.value as RoleFilters['type'] }))
              }
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Scopes</option>
              <option value="system">Global Roles</option>
              <option value="district">District Roles</option>
            </select>
          </div>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Create Role</span>
        </button>
      </div>

      {/* Content */}
      {activeTab === 'roles' ? (
        <RolesTab roles={filteredRoles} onEditRole={setEditingRole} onViewRole={setSelectedRole} />
      ) : (
        <AssignmentsTab assignments={roleAssignments} />
      )}

      {/* Modals */}
      {selectedRole && (
        <RoleDetailsModal role={selectedRole} onClose={() => setSelectedRole(null)} />
      )}

      {showCreateModal && (
        <CreateRoleModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchRoles();
          }}
        />
      )}

      {editingRole && (
        <EditRoleModal
          role={editingRole}
          onClose={() => setEditingRole(null)}
          onSuccess={() => {
            setEditingRole(null);
            fetchRoles();
          }}
        />
      )}
    </div>
  );
};

// Roles Tab Component
const RolesTab: React.FC<{
  roles: Role[];
  onEditRole: (role: Role) => void;
  onViewRole: (role: Role) => void;
}> = ({ roles, onEditRole, onViewRole }) => {
  const getRoleTypeIcon = (role: Role) => {
    const scope = role.scope || 'district';
    switch (scope) {
      case 'global':
        return <Globe className="w-4 h-4 text-purple-600" />;
      case 'multi_district':
        return <Globe className="w-4 h-4 text-purple-600" />;
      case 'project':
        return <Building2 className="w-4 h-4 text-orange-600" />;
      default:
        return <Building2 className="w-4 h-4 text-blue-600" />;
    }
  };

  const getRoleTypeBadge = (role: Role) => {
    const scope = role.scope || 'district';
    switch (scope) {
      case 'global':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
            <Globe className="w-3 h-3 mr-1" />
            Global
          </span>
        );
      case 'multi_district':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
            <Globe className="w-3 h-3 mr-1" />
            Multi-District
          </span>
        );
      case 'project':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
            <Building2 className="w-3 h-3 mr-1" />
            Project
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <Building2 className="w-3 h-3 mr-1" />
            District
          </span>
        );
    }
  };

  const getPermissionBadges = (permissions: string[]) => {
    return (
      <div className="flex flex-wrap gap-1">
        {permissions.slice(0, 3).map((permission, index) => (
          <span
            key={index}
            className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800"
          >
            {permission.replace('_', ' ')}
          </span>
        ))}
        {permissions.length > 3 && (
          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700">
            +{permissions.length - 3} more
          </span>
        )}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Roles ({roles.length})</span>
          <div className="flex items-center text-sm text-gray-500">
            <Filter className="w-4 h-4 mr-1" />
            All Roles
          </div>
        </CardTitle>
        <CardDescription>Manage role definitions and their associated permissions</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-700">Role</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Scope</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Users</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Permissions</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Created</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role, index) => (
                <tr
                  key={`${role.role_name}-${role.scope || 'global'}-${index}`}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="py-4 px-4">
                    <div className="flex items-center space-x-3">
                      {getRoleTypeIcon(role)}
                      <div>
                        <div className="font-medium text-gray-900">
                          {role.role_name.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </div>
                        {role.description && (
                          <div className="text-sm text-gray-500">{role.description}</div>
                        )}
                        {role.is_system_role && (
                          <div className="inline-flex items-center mt-1">
                            <Lock className="w-3 h-3 text-orange-600 mr-1" />
                            <span className="text-xs text-orange-600 font-medium">System Role</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>

                  <td className="py-4 px-4">
                    <div className="space-y-1">
                      {getRoleTypeBadge(role)}
                      {role.district_name && (
                        <div className="text-sm text-gray-600">{role.district_name}</div>
                      )}
                    </div>
                  </td>

                  <td className="py-4 px-4">
                    <div className="flex items-center text-sm">
                      <Users className="w-4 h-4 mr-1 text-gray-400" />
                      <span className="font-medium">{role.user_count}</span>
                      <span className="ml-1 text-gray-500">users</span>
                    </div>
                  </td>

                  <td className="py-4 px-4">{getPermissionBadges(role.permissions)}</td>

                  <td className="py-4 px-4">
                    <div className="flex items-center text-sm text-gray-600">
                      <Calendar className="w-3 h-3 mr-1" />
                      {new Date(role.created_at).toLocaleDateString()}
                    </div>
                  </td>

                  <td className="py-4 px-4 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => onViewRole(role)}
                        className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {!role.is_system_role && (
                        <button
                          onClick={() => onEditRole(role)}
                          className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                          title="Edit Role"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {roles.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Shield className="w-12 h-12 mx-auto text-gray-300 mb-4" />
              <p>No roles found matching the current filters.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Assignments Tab Component
const AssignmentsTab: React.FC<{
  assignments: RoleAssignment[];
}> = ({ assignments }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Role Assignments ({assignments.length})</CardTitle>
        <CardDescription>
          View and manage user role assignments across all districts
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-center py-8 text-gray-500">
          <UserCheck className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <p>Role assignments feature coming soon.</p>
          <p className="text-sm">This will show detailed role assignment history and management.</p>
        </div>
      </CardContent>
    </Card>
  );
};

// Role Details Modal - Comprehensive View
const RoleDetailsModal: React.FC<{ role: Role; onClose: () => void }> = ({ role, onClose }) => {
  const [users, setUsers] = useState<
    Array<{ username: string; email: string; granted_at: string }>
  >([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    fetchRoleUsers();
  }, [role.role_name, role.scope]);

  const fetchRoleUsers = async () => {
    try {
      setLoadingUsers(true);
      const token = localStorage.getItem('auth_token');

      const params = new URLSearchParams();
      params.append('role', role.role_name);
      if (role.scope) params.append('scope', role.scope);

      const response = await fetch(`/api/v1/tenant/admin/role-users?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      }
    } catch (err) {
      console.warn('Failed to fetch role users:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const allPermissions = [
    { key: 'read_wells', name: 'View Wells', description: 'View well information and data' },
    { key: 'write_wells', name: 'Manage Wells', description: 'Create and modify well records' },
    { key: 'read_readings', name: 'View Readings', description: 'Access water quality readings' },
    { key: 'write_readings', name: 'Enter Readings', description: 'Submit new water quality data' },
    { key: 'read_alerts', name: 'View Alerts', description: 'See system alerts and notifications' },
    { key: 'manage_alerts', name: 'Manage Alerts', description: 'Create and configure alerts' },
    {
      key: 'read_reports',
      name: 'View Reports',
      description: 'Access compliance and system reports',
    },
    { key: 'create_reports', name: 'Create Reports', description: 'Generate custom reports' },
    { key: 'manage_users', name: 'User Management', description: 'Manage user accounts and roles' },
    {
      key: 'system_admin',
      name: 'System Administration',
      description: 'Full system administration access',
    },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            {role.scope === 'global' ? (
              <Globe className="w-8 h-8 text-purple-600" />
            ) : role.scope === 'multi_district' ? (
              <Globe className="w-8 h-8 text-purple-600" />
            ) : role.scope === 'project' ? (
              <Building2 className="w-8 h-8 text-orange-600" />
            ) : (
              <Building2 className="w-8 h-8 text-blue-600" />
            )}
            <div>
              <h3 className="text-xl font-bold text-gray-900">
                {role.role_name.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </h3>
              <p className="text-sm text-gray-500">
                {role.scope === 'global'
                  ? 'Global Role'
                  : role.scope === 'multi_district'
                    ? 'Multi-District Role'
                    : role.scope === 'project'
                      ? 'Project Role'
                      : role.district_name}{' '}
                • {role.user_count} users
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <span className="sr-only">Close</span>
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Role Information */}
          <div className="space-y-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-lg font-medium text-gray-900 mb-4">Role Information</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Role Name</label>
                  <p className="mt-1 text-sm text-gray-900">{role.role_name}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Scope</label>
                  <div className="mt-1">
                    {role.scope === 'global' ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        <Globe className="w-3 h-3 mr-1" />
                        Global Role
                      </span>
                    ) : role.scope === 'multi_district' ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        <Globe className="w-3 h-3 mr-1" />
                        Multi-District
                      </span>
                    ) : role.scope === 'project' ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                        <Building2 className="w-3 h-3 mr-1" />
                        Project
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        <Building2 className="w-3 h-3 mr-1" />
                        {role.district_name}
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Created</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {new Date(role.created_at).toLocaleString()}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Type</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {role.is_system_role ? (
                      <span className="inline-flex items-center text-orange-600">
                        <Lock className="w-3 h-3 mr-1" />
                        System Role (Protected)
                      </span>
                    ) : (
                      'Custom Role'
                    )}
                  </p>
                </div>
                {role.description && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Description</label>
                    <p className="mt-1 text-sm text-gray-900">{role.description}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-lg font-medium text-gray-900 mb-4">
                Permissions ({role.permissions.length})
              </h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {role.permissions.map((permission, index) => {
                  const permissionInfo = allPermissions.find(p => p.key === permission);
                  return (
                    <div
                      key={index}
                      className="flex items-start space-x-3 p-2 bg-white rounded border"
                    >
                      <Key className="w-4 h-4 text-green-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {permissionInfo?.name || permission.replace('_', ' ')}
                        </p>
                        {permissionInfo?.description && (
                          <p className="text-xs text-gray-500">{permissionInfo.description}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Users with this Role */}
          <div className="space-y-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-lg font-medium text-gray-900 mb-4">
                Users with this Role ({role.user_count})
              </h4>
              {loadingUsers ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : users.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {users.map((user, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 bg-white rounded border"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <Users className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{user.username}</p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">
                          {new Date(user.granted_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">
                  No users currently have this role
                </p>
              )}
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h4>
              <div className="space-y-2">
                <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors">
                  Assign to Users
                </button>
                <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors">
                  View Assignment History
                </button>
                {!role.is_system_role && (
                  <>
                    <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors">
                      Edit Permissions
                    </button>
                    <button className="w-full text-left px-3 py-2 text-sm text-red-700 hover:bg-red-50 rounded transition-colors">
                      Delete Role
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

const CreateRoleModal: React.FC<{ onClose: () => void; onSuccess: () => void }> = ({
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState({
    role_name: '',
    description: '',
    district_code: '',
    permissions: [] as string[],
    is_active: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableDistricts] = useState([{ code: 'WWD', name: 'Westbury Water District' }]);

  const allPermissions = [
    {
      key: 'read_wells',
      name: 'View Wells',
      description: 'View well information and data',
      category: 'Wells',
    },
    {
      key: 'write_wells',
      name: 'Manage Wells',
      description: 'Create and modify well records',
      category: 'Wells',
    },
    {
      key: 'read_readings',
      name: 'View Readings',
      description: 'Access water quality readings',
      category: 'Readings',
    },
    {
      key: 'write_readings',
      name: 'Enter Readings',
      description: 'Submit new water quality data',
      category: 'Readings',
    },
    {
      key: 'read_alerts',
      name: 'View Alerts',
      description: 'See system alerts and notifications',
      category: 'Alerts',
    },
    {
      key: 'manage_alerts',
      name: 'Manage Alerts',
      description: 'Create and configure alerts',
      category: 'Alerts',
    },
    {
      key: 'read_reports',
      name: 'View Reports',
      description: 'Access compliance and system reports',
      category: 'Reports',
    },
    {
      key: 'create_reports',
      name: 'Create Reports',
      description: 'Generate custom reports',
      category: 'Reports',
    },
    {
      key: 'manage_users',
      name: 'User Management',
      description: 'Manage user accounts and roles',
      category: 'Administration',
    },
    {
      key: 'system_admin',
      name: 'System Administration',
      description: 'Full system administration access',
      category: 'Administration',
    },
  ];

  const permissionCategories = [...new Set(allPermissions.map(p => p.category))];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.role_name.trim()) {
      setError('Role name is required');
      return;
    }

    if (formData.permissions.length === 0) {
      setError('At least one permission is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('auth_token');

      // Create the role payload
      const createRolePayload = {
        role_name: formData.role_name.toLowerCase().replace(/\s+/g, '_'),
        description: formData.description || null,
        district_code: formData.district_code || null,
        permissions: formData.permissions,
        is_active: formData.is_active,
      };

      const response = await fetch('/api/v1/tenant/admin/roles', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(createRolePayload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Failed to create role' }));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create role');
    } finally {
      setLoading(false);
    }
  };

  const handlePermissionToggle = (permission: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter(p => p !== permission)
        : [...prev.permissions, permission],
    }));
  };

  const handleCategoryToggle = (category: string) => {
    const categoryPermissions = allPermissions.filter(p => p.category === category).map(p => p.key);
    const allSelected = categoryPermissions.every(p => formData.permissions.includes(p));

    if (allSelected) {
      // Remove all category permissions
      setFormData(prev => ({
        ...prev,
        permissions: prev.permissions.filter(p => !categoryPermissions.includes(p)),
      }));
    } else {
      // Add all category permissions
      setFormData(prev => ({
        ...prev,
        permissions: [...new Set([...prev.permissions, ...categoryPermissions])],
      }));
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">Create New Role</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <span className="sr-only">Close</span>
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <div className="flex">
              <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5" />
              <div className="ml-2">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.role_name}
                onChange={e => setFormData(prev => ({ ...prev, role_name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="e.g., Senior Operator"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Will be converted to:{' '}
                {formData.role_name.toLowerCase().replace(/\s+/g, '_') || 'role_name'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Scope</label>
              <select
                value={formData.district_code}
                onChange={e => setFormData(prev => ({ ...prev, district_code: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">Global Role (All Districts)</option>
                {availableDistricts.map(district => (
                  <option key={district.code} value={district.code}>
                    {district.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              rows={3}
              placeholder="Describe what this role is for and its responsibilities..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Permissions <span className="text-red-500">*</span>
            </label>
            <div className="space-y-4">
              {permissionCategories.map(category => {
                const categoryPermissions = allPermissions.filter(p => p.category === category);
                const selectedCount = categoryPermissions.filter(p =>
                  formData.permissions.includes(p.key)
                ).length;
                const allSelected = selectedCount === categoryPermissions.length;

                return (
                  <div key={category} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-gray-900">{category}</h4>
                      <button
                        type="button"
                        onClick={() => handleCategoryToggle(category)}
                        className={`text-xs px-2 py-1 rounded ${
                          allSelected
                            ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {allSelected ? 'Deselect All' : 'Select All'} ({selectedCount}/
                        {categoryPermissions.length})
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      {categoryPermissions.map(permission => (
                        <label
                          key={permission.key}
                          className="flex items-start space-x-3 p-2 border rounded hover:bg-gray-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={formData.permissions.includes(permission.key)}
                            onChange={() => handlePermissionToggle(permission.key)}
                            className="mt-1 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                          />
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <Key className="w-3 h-3 text-green-600" />
                              <span className="text-sm font-medium text-gray-900">
                                {permission.name}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{permission.description}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={e => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <span className="text-sm text-gray-700">Role is active and can be assigned</span>
            </label>
          </div>

          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating...
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4 mr-2" />
                  Create Role
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const EditRoleModal: React.FC<{ role: Role; onClose: () => void; onSuccess: () => void }> = ({
  role,
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState({
    description: role.description || '',
    permissions: [...role.permissions],
    is_active: role.is_active,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allPermissions = [
    {
      key: 'read_wells',
      name: 'View Wells',
      description: 'View well information and data',
      category: 'Wells',
    },
    {
      key: 'write_wells',
      name: 'Manage Wells',
      description: 'Create and modify well records',
      category: 'Wells',
    },
    {
      key: 'read_readings',
      name: 'View Readings',
      description: 'Access water quality readings',
      category: 'Readings',
    },
    {
      key: 'write_readings',
      name: 'Enter Readings',
      description: 'Submit new water quality data',
      category: 'Readings',
    },
    {
      key: 'read_alerts',
      name: 'View Alerts',
      description: 'See system alerts and notifications',
      category: 'Alerts',
    },
    {
      key: 'manage_alerts',
      name: 'Manage Alerts',
      description: 'Create and configure alerts',
      category: 'Alerts',
    },
    {
      key: 'read_reports',
      name: 'View Reports',
      description: 'Access compliance and system reports',
      category: 'Reports',
    },
    {
      key: 'create_reports',
      name: 'Create Reports',
      description: 'Generate custom reports',
      category: 'Reports',
    },
    {
      key: 'manage_users',
      name: 'User Management',
      description: 'Manage user accounts and roles',
      category: 'Administration',
    },
    {
      key: 'system_admin',
      name: 'System Administration',
      description: 'Full system administration access',
      category: 'Administration',
    },
  ];

  const permissionCategories = [...new Set(allPermissions.map(p => p.category))];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.permissions.length === 0) {
      setError('At least one permission is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('auth_token');

      const updateRolePayload = {
        description: formData.description || null,
        permissions: formData.permissions,
        is_active: formData.is_active,
      };

      const response = await fetch(`/api/v1/tenant/admin/roles/${role.role_name}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateRolePayload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Failed to update role' }));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role');
    } finally {
      setLoading(false);
    }
  };

  const handlePermissionToggle = (permission: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter(p => p !== permission)
        : [...prev.permissions, permission],
    }));
  };

  const handleCategoryToggle = (category: string) => {
    const categoryPermissions = allPermissions.filter(p => p.category === category).map(p => p.key);
    const allSelected = categoryPermissions.every(p => formData.permissions.includes(p));

    if (allSelected) {
      setFormData(prev => ({
        ...prev,
        permissions: prev.permissions.filter(p => !categoryPermissions.includes(p)),
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        permissions: [...new Set([...prev.permissions, ...categoryPermissions])],
      }));
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            {role.scope === 'global' ? (
              <Globe className="w-8 h-8 text-purple-600" />
            ) : role.scope === 'multi_district' ? (
              <Globe className="w-8 h-8 text-purple-600" />
            ) : role.scope === 'project' ? (
              <Building2 className="w-8 h-8 text-orange-600" />
            ) : (
              <Building2 className="w-8 h-8 text-blue-600" />
            )}
            <div>
              <h3 className="text-xl font-bold text-gray-900">
                Edit: {role.role_name.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </h3>
              <p className="text-sm text-gray-500">
                {role.scope === 'global'
                  ? 'Global Role'
                  : role.scope === 'multi_district'
                    ? 'Multi-District Role'
                    : role.scope === 'project'
                      ? 'Project Role'
                      : role.district_name}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <span className="sr-only">Close</span>
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {role.is_system_role && (
          <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-md">
            <div className="flex">
              <Lock className="h-4 w-4 text-orange-400 mt-0.5" />
              <div className="ml-2">
                <p className="text-sm text-orange-700">
                  This is a system role. Some properties cannot be modified to maintain system
                  integrity.
                </p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <div className="flex">
              <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5" />
              <div className="ml-2">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Role Information</h4>
            <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
              <div>
                <strong>Role Name:</strong> {role.role_name} (cannot be changed)
              </div>
              <div>
                <strong>Scope:</strong>{' '}
                {role.scope === 'global'
                  ? 'Global Role'
                  : role.scope === 'multi_district'
                    ? 'Multi-District Role'
                    : role.scope === 'project'
                      ? 'Project Role'
                      : role.district_name}{' '}
                (cannot be changed)
              </div>
              <div>
                <strong>Created:</strong> {new Date(role.created_at).toLocaleDateString()}
              </div>
              <div>
                <strong>Users:</strong> {role.user_count} assigned
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
              rows={3}
              placeholder="Describe what this role is for and its responsibilities..."
              disabled={role.is_system_role}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Permissions <span className="text-red-500">*</span>
            </label>
            <div className="space-y-4">
              {permissionCategories.map(category => {
                const categoryPermissions = allPermissions.filter(p => p.category === category);
                const selectedCount = categoryPermissions.filter(p =>
                  formData.permissions.includes(p.key)
                ).length;
                const allSelected = selectedCount === categoryPermissions.length;

                return (
                  <div key={category} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-gray-900">{category}</h4>
                      {!role.is_system_role && (
                        <button
                          type="button"
                          onClick={() => handleCategoryToggle(category)}
                          className={`text-xs px-2 py-1 rounded ${
                            allSelected
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {allSelected ? 'Deselect All' : 'Select All'} ({selectedCount}/
                          {categoryPermissions.length})
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      {categoryPermissions.map(permission => (
                        <label
                          key={permission.key}
                          className={`flex items-start space-x-3 p-2 border rounded ${
                            role.is_system_role ? 'bg-gray-50' : 'hover:bg-gray-50 cursor-pointer'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={formData.permissions.includes(permission.key)}
                            onChange={() => handlePermissionToggle(permission.key)}
                            className="mt-1 rounded border-gray-300 text-green-600 focus:ring-green-500"
                            disabled={role.is_system_role}
                          />
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <Key className="w-3 h-3 text-green-600" />
                              <span className="text-sm font-medium text-gray-900">
                                {permission.name}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{permission.description}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={e => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                disabled={role.is_system_role}
              />
              <span className="text-sm text-gray-700">Role is active and can be assigned</span>
            </label>
          </div>

          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RoleManagement;
