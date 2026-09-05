import React, { useState, useEffect } from 'react';
import {
  Network,
  Shield,
  Users,
  Database,
  Eye,
  Lock,
  Check,
  X,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
} from 'lucide-react';

interface Role {
  role_name: string;
  description: string;
  district_scope: string;
  permissions: string[];
  user_count?: number;
}

interface PermissionCategory {
  name: string;
  permissions: string[];
  description: string;
}

interface PermissionMatrix {
  data_access: Record<string, string[]>;
  user_management: Record<string, string[]>;
  cross_district: Record<string, string[]>;
}

interface RolesData {
  role_definitions: Record<string, Role>;
  current_assignments: any[];
  multi_district_users: any[];
  permission_matrix: PermissionMatrix;
  summary: {
    total_roles: number;
    active_assignments: number;
    multi_district_users_count: number;
  };
}

const PermissionMatrix: React.FC = () => {
  const [rolesData, setRolesData] = useState<RolesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'matrix' | 'categories' | 'assignments'>('matrix');

  // Define all possible permissions with categories
  const permissionCategories: PermissionCategory[] = [
    {
      name: 'Data Access',
      description: 'Permissions related to viewing and modifying data',
      permissions: [
        'view_wells',
        'edit_wells',
        'delete_wells',
        'create_wells',
        'view_readings',
        'edit_readings',
        'delete_readings',
        'create_readings',
        'view_alerts',
        'edit_alerts',
        'delete_alerts',
        'create_alerts',
        'view_reports',
        'generate_reports',
        'export_data',
      ],
    },
    {
      name: 'User Management',
      description: 'Permissions for managing users and roles',
      permissions: [
        'view_users',
        'create_users',
        'edit_users',
        'delete_users',
        'assign_roles',
        'revoke_roles',
        'manage_permissions',
        'view_audit_logs',
        'system_admin',
      ],
    },
    {
      name: 'District Management',
      description: 'Permissions for managing districts and cross-district access',
      permissions: [
        'view_all_districts',
        'manage_districts',
        'cross_district_access',
        'share_data',
        'view_shared_data',
        'configure_sharing',
      ],
    },
    {
      name: 'System Operations',
      description: 'System-level permissions and operations',
      permissions: [
        'system_configuration',
        'backup_restore',
        'maintenance_mode',
        'view_system_logs',
        'manage_integrations',
        'api_access',
      ],
    },
  ];

  useEffect(() => {
    loadRolesData();
  }, []);

  const loadRolesData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/v1/tenant/admin/roles', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to load roles data: ${response.status}`);
      }

      const data = await response.json();
      setRolesData(data);
      setError(null);

      // Select first role by default
      const roles = Object.keys(data.role_definitions);
      if (roles.length > 0) {
        setSelectedRole(roles[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load roles data');
    } finally {
      setLoading(false);
    }
  };

  const getAllPermissions = (): string[] => {
    if (!rolesData) return [];

    const allPerms = new Set<string>();
    Object.values(rolesData.role_definitions).forEach(role => {
      role.permissions.forEach(perm => allPerms.add(perm));
    });

    // Add permissions from categories that might not be assigned yet
    permissionCategories.forEach(category => {
      category.permissions.forEach(perm => allPerms.add(perm));
    });

    return Array.from(allPerms).sort();
  };

  const getPermissionCategory = (permission: string): string => {
    for (const category of permissionCategories) {
      if (category.permissions.includes(permission)) {
        return category.name;
      }
    }
    return 'Other';
  };

  const hasPermission = (roleName: string, permission: string): boolean => {
    return rolesData?.role_definitions[roleName]?.permissions.includes(permission) || false;
  };

  const getRoleColor = (roleName: string): string => {
    const colorMap: Record<string, string> = {
      system_admin: 'bg-red-100 text-red-800 border-red-200',
      district_admin: 'bg-blue-100 text-blue-800 border-blue-200',
      district_manager: 'bg-green-100 text-green-800 border-green-200',
      district_operator: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      lead_engineer: 'bg-purple-100 text-purple-800 border-purple-200',
      field_engineer: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      district_viewer: 'bg-gray-100 text-gray-800 border-gray-200',
      regulatory_viewer: 'bg-orange-100 text-orange-800 border-orange-200',
      contractor: 'bg-pink-100 text-pink-800 border-pink-200',
      ceu_admin: 'bg-teal-100 text-teal-800 border-teal-200',
      ceu_manager: 'bg-teal-100 text-teal-800 border-teal-200',
      ceu_user: 'bg-teal-50 text-teal-700 border-teal-200',
    };
    return colorMap[roleName] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getScopeIcon = (scope: string) => {
    switch (scope) {
      case 'global':
        return <Network className="w-4 h-4" />;
      case 'district':
        return <Shield className="w-4 h-4" />;
      case 'multi_district':
        return <Database className="w-4 h-4" />;
      default:
        return <Lock className="w-4 h-4" />;
    }
  };

  const filteredPermissions = getAllPermissions().filter(permission => {
    const matchesSearch = permission.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      filterCategory === 'all' || getPermissionCategory(permission) === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const filteredRoles = rolesData
    ? Object.keys(rolesData.role_definitions).filter(roleName =>
        roleName.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <span className="ml-2">Loading permission matrix...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-red-500 bg-red-50 p-4 rounded-lg">
        <AlertTriangle className="w-5 h-5" />
        <span>Error: {error}</span>
        <button
          onClick={loadRolesData}
          className="ml-auto px-3 py-1 bg-red-100 hover:bg-red-200 rounded text-sm flex items-center gap-1"
        >
          <RefreshCw className="w-3 h-3" />
          Retry
        </button>
      </div>
    );
  }

  if (!rolesData) {
    return (
      <div className="text-center text-gray-500 p-8">
        <Network className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        <p>No permission data available</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg p-6">
        <h1 className="text-3xl font-bold flex items-center">
          <Network className="mr-3 h-8 w-8" />
          Permission Matrix
        </h1>
        <p className="mt-2 text-indigo-100">
          Visualize and configure granular permissions across roles
        </p>
        <div className="flex items-center gap-4 mt-4">
          <div className="bg-white/20 rounded-lg px-3 py-1">
            <span className="text-sm font-medium">{rolesData.summary.total_roles} Roles</span>
          </div>
          <div className="bg-white/20 rounded-lg px-3 py-1">
            <span className="text-sm font-medium">
              {rolesData.summary.active_assignments} Active Assignments
            </span>
          </div>
          <div className="bg-white/20 rounded-lg px-3 py-1">
            <span className="text-sm font-medium">
              {rolesData.summary.multi_district_users_count} Multi-District Users
            </span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* View Mode Toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            {[
              { id: 'matrix', label: 'Matrix View', icon: Network },
              { id: 'categories', label: 'Categories', icon: Filter },
              { id: 'assignments', label: 'Assignments', icon: Users },
            ].map(mode => (
              <button
                key={mode.id}
                onClick={() => setViewMode(mode.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  viewMode === mode.id
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <mode.icon className="w-4 h-4" />
                {mode.label}
              </button>
            ))}
          </div>

          {/* Search and Filter */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 rounded-lg border border-amber-200">
              <Eye className="w-4 h-4" />
              <span className="text-sm font-medium">Read-Only View</span>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search roles or permissions..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Categories</option>
              {permissionCategories.map(category => (
                <option key={category.name} value={category.name}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Content Based on View Mode */}
      {viewMode === 'matrix' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Role-Permission Matrix</h3>
            <p className="text-sm text-gray-500 mt-1">
              Visual representation of which roles have which permissions
            </p>
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-700">
                <strong>Note:</strong> System roles and their permissions are pre-defined and cannot
                be modified. To customize permissions, create new roles in the{' '}
                <strong>Role Management</strong> section.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto" style={{ maxHeight: '70vh' }}>
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0 z-20">
                <tr className="h-32">
                  <th className="sticky left-0 bg-gray-50 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 min-w-[250px] z-30 h-32">
                    <div className="flex items-center h-full">Role</div>
                  </th>
                  {filteredPermissions.map((permission, index) => (
                    <th
                      key={permission}
                      className={`text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-20 relative h-32 overflow-visible border-r border-gray-200 ${
                        index % 2 === 0 ? 'bg-gray-50' : 'bg-white'
                      }`}
                    >
                      <div className="absolute inset-0 flex justify-center items-center">
                        <div
                          className="text-xs text-center"
                          style={{
                            transform: 'rotate(-90deg)',
                            transformOrigin: 'center',
                            fontSize: '11px',
                            lineHeight: '1.3',
                            width: '60px',
                            height: 'auto',
                          }}
                        >
                          {(() => {
                            const words = permission.replace(/_/g, ' ').toLowerCase().split(' ');

                            // Single word or two words - keep on one line
                            if (words.length <= 2) {
                              return <div>{words.join(' ')}</div>;
                            }

                            // 3+ words - smart split into exactly 2 lines
                            let line1, line2;

                            if (words.length === 3) {
                              // For 3 words, try 2-1 split first, then 1-2 if first line too long
                              const option1 = words.slice(0, 2).join(' ');
                              const option2 = words.slice(2).join(' ');

                              if (option1.length <= 12) {
                                line1 = option1;
                                line2 = option2;
                              } else {
                                line1 = words[0];
                                line2 = words.slice(1).join(' ');
                              }
                            } else {
                              // 4+ words - split at midpoint
                              const midPoint = Math.ceil(words.length / 2);
                              line1 = words.slice(0, midPoint).join(' ');
                              line2 = words.slice(midPoint).join(' ');
                            }

                            return (
                              <>
                                <div>{line1}</div>
                                <div>{line2}</div>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredRoles.map(roleName => {
                  const role = rolesData.role_definitions[roleName];
                  return (
                    <tr
                      key={roleName}
                      className={`hover:bg-gray-50 ${selectedRole === roleName ? 'bg-blue-50' : ''}`}
                      onClick={() => setSelectedRole(roleName)}
                    >
                      <td className="sticky left-0 bg-white px-6 py-4 whitespace-nowrap border-r border-gray-200 z-10">
                        <div className="flex items-center gap-3">
                          {getScopeIcon(role.district_scope)}
                          <div>
                            <div
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getRoleColor(roleName)}`}
                            >
                              {roleName.replace(/_/g, ' ').toUpperCase()}
                            </div>
                            <div className="text-xs text-gray-500 mt-1 max-w-[180px] truncate">
                              {role.description}
                            </div>
                          </div>
                        </div>
                      </td>
                      {filteredPermissions.map((permission, index) => {
                        const hasPermissionValue = hasPermission(roleName, permission);

                        return (
                          <td
                            key={permission}
                            className={`px-3 py-4 text-center border-r border-gray-200 ${
                              index % 2 === 0 ? 'bg-gray-50' : 'bg-white'
                            }`}
                          >
                            {hasPermissionValue ? (
                              <Check className="w-5 h-5 text-green-500 mx-auto" />
                            ) : (
                              <X className="w-5 h-5 text-gray-300 mx-auto" />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {viewMode === 'categories' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {permissionCategories.map(category => (
            <div key={category.name} className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">{category.name}</h3>
                <p className="text-sm text-gray-500 mt-1">{category.description}</p>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {category.permissions
                    .filter(perm => filteredPermissions.includes(perm))
                    .map(permission => (
                      <div key={permission} className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900">
                          {permission
                            .replace(/_/g, ' ')
                            .toLowerCase()
                            .replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                        <div className="flex gap-1">
                          {Object.keys(rolesData.role_definitions).map(roleName => {
                            if (hasPermission(roleName, permission)) {
                              return (
                                <span
                                  key={roleName}
                                  className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getRoleColor(roleName)}`}
                                >
                                  {roleName
                                    .replace(/_/g, ' ')
                                    .split(' ')
                                    .map(word => word[0])
                                    .join('')
                                    .toUpperCase()}
                                </span>
                              );
                            }
                            return null;
                          })}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {viewMode === 'assignments' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Current Role Assignments</h3>
            <p className="text-sm text-gray-500 mt-1">Active role assignments across the system</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    District
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Granted
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Expires
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rolesData.current_assignments.map((assignment, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {assignment.username}
                        </div>
                        <div className="text-sm text-gray-500">{assignment.full_name}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(assignment.role_name)}`}
                      >
                        {assignment.role_name.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {assignment.district_code || 'Global'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(assignment.granted_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {assignment.expires_at
                        ? new Date(assignment.expires_at).toLocaleDateString()
                        : 'Never'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          assignment.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {assignment.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Permission Matrix Legend</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-2">Access Levels</h4>
            <div className="space-y-2">
              {Object.entries(rolesData.permission_matrix.data_access).map(([level, roles]) => (
                <div key={level} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span className="text-sm text-gray-600">
                    <strong>{level.replace(/_/g, ' ').toUpperCase()}:</strong> {roles.join(', ')}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-2">User Management</h4>
            <div className="space-y-2">
              {Object.entries(rolesData.permission_matrix.user_management).map(([level, roles]) => (
                <div key={level} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="text-sm text-gray-600">
                    <strong>{level.toUpperCase()}:</strong> {roles.join(', ')}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-2">Cross-District Access</h4>
            <div className="space-y-2">
              {Object.entries(rolesData.permission_matrix.cross_district).map(([level, roles]) => (
                <div key={level} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                  <span className="text-sm text-gray-600">
                    <strong>{level.toUpperCase()}:</strong> {roles.join(', ')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PermissionMatrix;
