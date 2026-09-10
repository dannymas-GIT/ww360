import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle,
  Edit3,
  Eye,
  EyeOff,
  Filter,
  Key,
  Lock,
  Mail,
  MapPin,
  Plus,
  Search,
  Shield,
  ShieldCheck,
  ShieldX,
  Trash2,
  Unlock,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { fetchUserModules, updateUserModules } from '@/services/lmsService';

interface User {
  id: number;
  username: string;
  email: string;
  full_name?: string;
  is_active: boolean;
  is_superuser: boolean;
  primary_district?: string;
  default_role?: string;
  created_at: string;
  updated_at?: string;
  last_login?: string;
  // These will be fetched separately from /users/{id}/roles endpoint
  roles: Array<{
    role_name: string;
    district_code: string;
    district_name?: string;
    is_active: boolean;
    granted_at: string;
    expires_at?: string;
  }>;
  // Multi-district assignments
  district_assignments?: Array<{
    id: number;
    district_code: string;
    district_name: string;
    assignment_type: string;
    access_level: string;
    assigned_at: string;
    expires_at?: string;
  }>;
  // Additional fields for UI state
  login_attempts?: number;
  locked_until?: string;
  // 2FA fields
  two_factor_enabled?: boolean;
  two_factor_setup_completed?: boolean;
}

interface UserFilters {
  search: string;
  district: string;
  role: string;
  status: 'all' | 'active' | 'inactive' | 'locked';
}

interface PasswordChangeData {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

interface AdminPasswordResetData {
  user_id: number;
  new_password: string;
  confirm_password: string;
}

const TenantUserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [filters, setFilters] = useState<UserFilters>({
    search: '',
    district: '',
    role: '',
    status: 'all',
  });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showPasswordChangeDialog, setShowPasswordChangeDialog] = useState(false);
  const [showAdminResetDialog, setShowAdminResetDialog] = useState(false);
  const [selectedUserForReset, setSelectedUserForReset] = useState<User | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    show: boolean;
    user: User | null;
  }>({
    show: false,
    user: null,
  });
  const [roleAssignmentDialog, setRoleAssignmentDialog] = useState<{
    show: boolean;
    user: User | null;
  }>({
    show: false,
    user: null,
  });
  const [multiDistrictDialog, setMultiDistrictDialog] = useState<{
    show: boolean;
    user: User | null;
  }>({
    show: false,
    user: null,
  });

  useEffect(() => {
    fetchCurrentUser();
    fetchUsers();
  }, [filters]);

  const fetchCurrentUser = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/v1/tenant/users/me', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const userData = await response.json();
        setCurrentUser(userData);
      }
    } catch (err) {
      console.error('Failed to fetch current user:', err);
    }
  };

  const fetchUserRoles = async (userId: number) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/v1/tenant/admin/users/${userId}/roles`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const roles = await response.json();
        return Array.isArray(roles) ? roles : [];
      }
      return [];
    } catch (err) {
      console.error(`💥 Failed to fetch roles for user ${userId}:`, err);
      return [];
    }
  };

  const fetchUser2FAStatus = async (userId: number) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/v1/tenant/admin/users/${userId}/2fa/status`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const statusData = await response.json();
        return {
          two_factor_enabled: statusData.two_factor?.enabled || false,
          two_factor_setup_completed: statusData.two_factor?.setup_completed || false,
        };
      }
      return {
        two_factor_enabled: false,
        two_factor_setup_completed: false,
      };
    } catch (err) {
      console.error(`💥 Failed to fetch 2FA status for user ${userId}:`, err);
      return {
        two_factor_enabled: false,
        two_factor_setup_completed: false,
      };
    }
  };

  const fetchUserDistrictAssignments = async (
    userId: number
  ): Promise<User['district_assignments']> => {
    try {
      console.log(`🏗️ Fetching district assignments for user ${userId}...`);
      const token = localStorage.getItem('auth_token');

      const response = await fetch(`/api/v1/tenant/admin/users/${userId}/district-assignments`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log(`📡 District assignments API response for user ${userId}:`, {
        status: response.status,
        ok: response.ok,
        url: response.url,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log(
          `❌ District assignments API failed for user ${userId}:`,
          response.status,
          errorText
        );
        return [];
      }

      const data = await response.json();
      console.log(`📊 Full district assignments response for user ${userId}:`, data);

      const assignments = data.district_assignments || data.assignments || [];
      console.log(`📋 Parsed assignments array for user ${userId}:`, assignments);
      console.log(`📋 Assignment count for user ${userId}:`, assignments.length);

      return assignments;
    } catch (err) {
      console.error(`💥 Failed to fetch district assignments for user ${userId}:`, err);
      return [];
    }
  };

  const fetchUsers = async () => {
    console.log('🚀 fetchUsers called - starting to fetch users...');
    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token');

      const params = new URLSearchParams();
      if (filters.search) params.append('search', filters.search);
      if (filters.district) params.append('district', filters.district);
      if (filters.role) params.append('role', filters.role);
      if (filters.status !== 'all') params.append('status', filters.status);

      // No trailing slash: FastAPI 307 redirects to absolute backend URL and breaks Vite proxy.
      const queryString = params.toString();
      const url = queryString
        ? `/api/v1/tenant/admin/users?${queryString}`
        : `/api/v1/tenant/admin/users`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch users: ${response.status}`);
      }

      const data = await response.json();
      // The backend returns {users: [...], total: N} format
      const users = data.users || (Array.isArray(data) ? data : []);
      console.log(`📊 Fetched ${users.length} users from backend`);

      // Fetch roles and 2FA status for each user
      const usersWithRoles = await Promise.all(
        users.map(async (user: User) => {
          const [roles, districtAssignments, twoFAStatus] = await Promise.all([
            fetchUserRoles(user.id),
            fetchUserDistrictAssignments(user.id),
            fetchUser2FAStatus(user.id),
          ]);

          return {
            ...user,
            roles: roles || [],
            district_assignments: districtAssignments || [],
            ...twoFAStatus,
          };
        })
      );

      setUsers(usersWithRoles);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleUserStatus = async (userId: number, currentStatus: boolean) => {
    try {
      const token = localStorage.getItem('auth_token');

      const response = await fetch(`/api/v1/tenant/admin/users/${userId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          is_active: !currentStatus,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update user status: ${response.status}`);
      }

      await fetchUsers();
      console.log(`User ${userId} status toggled successfully`);
    } catch (err) {
      console.error('Failed to toggle user status:', err);
    }
  };

  const handle2FAToggle = async (userId: number, currentStatus: boolean) => {
    try {
      const token = localStorage.getItem('auth_token');

      const response = await fetch(`/api/v1/tenant/admin/users/${userId}/2fa/toggle`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          enabled: !currentStatus,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Failed to toggle 2FA' }));
        throw new Error(errorData.detail || `Failed to toggle 2FA: ${response.status}`);
      }

      // Refresh users to get updated 2FA status
      await fetchUsers();
      console.log(`User ${userId} 2FA toggled successfully`);
    } catch (err) {
      console.error('Failed to toggle 2FA:', err);
      alert(`Failed to toggle 2FA: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleUnlockUser = async (userId: number) => {
    try {
      const token = localStorage.getItem('auth_token');

      const response = await fetch(`/api/v1/tenant/admin/users/${userId}/unlock`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to unlock user');
      }

      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unlock user');
    }
  };

  const changePassword = async (passwordData: PasswordChangeData) => {
    const token = localStorage.getItem('auth_token');
    const response = await fetch('/api/v1/password/change-password', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(passwordData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to change password');
    }

    return await response.json();
  };

  const adminResetPassword = async (resetData: AdminPasswordResetData) => {
    const token = localStorage.getItem('auth_token');

    const response = await fetch(`/api/v1/tenant/admin/users/${resetData.user_id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        password: resetData.new_password,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to reset password');
    }

    await fetchUsers(); // Refresh the user list
  };

  const isGlobalAdmin = () => {
    return (
      currentUser?.is_superuser ||
      currentUser?.roles?.some(role => ['global_admin', 'system_admin'].includes(role.role_name))
    );
  };

  const handleReset2FA = async (user: User) => {
    try {
      const confirmReset = window.confirm(
        `Are you sure you want to reset Two-Factor Authentication for ${user.username}?\n\n` +
          `This will:\n` +
          `• Disable their 2FA settings\n` +
          `• Clear their authenticator app setup\n` +
          `• Remove their backup codes\n` +
          `• Require them to set up 2FA again on next login\n\n` +
          `This action is useful for testing or when users lose access to their authenticator.`
      );

      if (!confirmReset) return;

      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/v1/tenant/admin/users/${user.id}/2fa/reset`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to reset 2FA');
      }

      await response.json();
      alert(
        `✅ 2FA reset successfully for ${user.username}!\n\nThey will need to set up 2FA again on their next login.`
      );

      // Refresh the users list to show updated status
      fetchUsers();
    } catch (error) {
      console.error('Error resetting 2FA:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert(`❌ Failed to reset 2FA: ${errorMessage}`);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    try {
      const token = localStorage.getItem('auth_token');

      // Global admins always use hard delete from the trash button
      const endpoint = `/api/v1/tenant/admin/users/${userId}/hard-delete?confirm=true`;

      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to delete user: ${errorText}`);
      }

      await fetchUsers(); // Refresh the user list
      setDeleteConfirmation({ show: false, user: null });
    } catch (error) {
      alert('Error: ' + (error instanceof Error ? error.message : 'Failed to delete user'));
    }
  };

  const getStatusBadge = (user: User) => {
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <Lock className="w-3 h-3 mr-1" />
          Locked
        </span>
      );
    }

    if (user.login_attempts && user.login_attempts >= 5) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Too Many Failed Attempts
        </span>
      );
    }

    return (
      <span
        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
          user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}
      >
        {user.is_active ? 'Active' : 'Inactive'}
      </span>
    );
  };

  const getRoleBadges = (user: User) => {
    const uniqueRoleNames = [...new Set(user.roles.map(role => role.role_name))];

    return (
      <div className="flex flex-wrap gap-1">
        {uniqueRoleNames.slice(0, 2).map(roleName => (
          <span
            key={roleName}
            className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
              roleName === 'global_admin' || roleName === 'system_admin'
                ? 'bg-purple-100 text-purple-800'
                : roleName === 'district_admin'
                  ? 'bg-red-100 text-red-800'
                  : roleName === 'district_manager'
                    ? 'bg-orange-100 text-orange-800'
                    : roleName === 'lead_engineer'
                      ? 'bg-blue-100 text-blue-800'
                      : roleName === 'field_engineer'
                        ? 'bg-green-100 text-green-800'
                        : roleName === 'contractor'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
            }`}
          >
            {roleName.replace('_', ' ')}
          </span>
        ))}
        {uniqueRoleNames.length > 2 && (
          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700">
            +{uniqueRoleNames.length - 2} more
          </span>
        )}
      </div>
    );
  };

  const DistrictDisplay = ({ user }: { user: User }) => {
    console.log(`🔍 DistrictDisplay rendering for user: ${user.username} (ID: ${user.id})`);

    const allDistricts: string[] = [];

    console.log(`🔍 User ${user.username} data:`, {
      primary_district: user.primary_district,
      district_assignments: user.district_assignments,
      district_assignments_count: user.district_assignments?.length || 0,
      roles: user.roles?.map(r => r.role_name),
    });

    // Add primary district if exists
    if (user.primary_district) {
      allDistricts.push(user.primary_district);
    }

    // Add additional district assignments if they exist
    if (user.district_assignments && Array.isArray(user.district_assignments)) {
      console.log(
        `🔍 Processing ${user.district_assignments.length} district assignments for ${user.username}`
      );
      user.district_assignments.forEach((assignment, index) => {
        console.log(`  Assignment ${index + 1}:`, assignment);
        if (assignment.district_code && !allDistricts.includes(assignment.district_code)) {
          console.log(`  ✅ Adding district: ${assignment.district_code}`);
          allDistricts.push(assignment.district_code);
        } else {
          console.log(
            `  ❌ Skipping district: ${assignment.district_code} (already included or invalid)`
          );
        }
      });
    } else {
      console.log(
        `❌ No district assignments array for ${user.username}:`,
        user.district_assignments
      );
    }

    console.log(`📍 Final districts list for ${user.username}:`, allDistricts);

    // If user has multiple districts, show "Multi District" badge with hover tooltip
    if (allDistricts.length > 1) {
      console.log(
        `✨ Showing Multi District badge for ${user.username} with ${allDistricts.length} districts`
      );
      return (
        <div className="flex items-center text-sm group relative">
          <Building2 className="w-4 h-4 mr-1 text-gray-400" />
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 cursor-help">
            Multi District ({allDistricts.length})
          </span>

          {/* Hover tooltip showing all districts */}
          <div className="absolute left-0 top-8 bg-gray-900 text-white text-xs rounded-md px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap z-50 shadow-lg">
            Districts: {allDistricts.join(', ')}
            <div className="absolute -top-1 left-4 w-2 h-2 bg-gray-900 transform rotate-45"></div>
          </div>
        </div>
      );
    }

    // Single district or no district
    const districtDisplay = allDistricts.length === 1 ? allDistricts[0] : 'No District';
    console.log(`📍 Showing single district for ${user.username}: ${districtDisplay}`);

    return (
      <div className="flex items-center text-sm">
        <Building2 className="w-4 h-4 mr-1 text-gray-400" />
        <span className="text-gray-900">{districtDisplay}</span>
      </div>
    );
  };

  const filteredUsers = users.filter(user => {
    if (
      filters.search &&
      !user.username.toLowerCase().includes(filters.search.toLowerCase()) &&
      !user.email.toLowerCase().includes(filters.search.toLowerCase()) &&
      !(user.full_name || '').toLowerCase().includes(filters.search.toLowerCase())
    ) {
      return false;
    }

    if (filters.district && user.primary_district !== filters.district) {
      return false;
    }

    if (filters.role && !user.roles.some(role => role.role_name === filters.role)) {
      return false;
    }

    if (filters.status !== 'all') {
      const isLocked =
        (user.locked_until && new Date(user.locked_until) > new Date()) ||
        (user.login_attempts && user.login_attempts >= 5);
      if (filters.status === 'locked' && !isLocked) return false;
      if (filters.status === 'active' && (!user.is_active || isLocked)) return false;
      if (filters.status === 'inactive' && user.is_active && !isLocked) return false;
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
            <h3 className="text-sm font-medium text-red-800">Error Loading Users</h3>
            <p className="mt-2 text-sm text-red-700">{error}</p>
            <button
              onClick={fetchUsers}
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
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg p-6">
        <h1 className="text-3xl font-bold flex items-center">
          <Users className="mr-3 h-8 w-8" />
          User Management
        </h1>
        <p className="mt-2 text-indigo-100">
          Manage user accounts, roles, and permissions across all districts
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex flex-1 gap-4 items-center">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search users..."
              value={filters.search}
              onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-2">
            <select
              value={filters.district}
              onChange={e => setFilters(prev => ({ ...prev, district: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Districts</option>
              <option value="WWD">Westbury Water District</option>
              {/* Add more districts as needed */}
            </select>

            <select
              value={filters.status}
              onChange={e =>
                setFilters(prev => ({ ...prev, status: e.target.value as UserFilters['status'] }))
              }
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="locked">Locked</option>
            </select>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowPasswordChangeDialog(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
          >
            <Key className="w-4 h-4" />
            <span>Change My Password</span>
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add User</span>
          </button>
        </div>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Users ({filteredUsers.length})</span>
            <div className="flex items-center text-sm text-gray-500">
              <Filter className="w-4 h-4 mr-1" />
              {filters.search || filters.district || filters.status !== 'all'
                ? 'Filtered'
                : 'All Users'}
            </div>
          </CardTitle>
          <CardDescription>Manage user accounts and their access permissions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-700">User</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Contact</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">District</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Roles</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">2FA</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Last Login</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(user => (
                  <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-blue-600 font-medium text-sm">
                            {user.full_name?.[0] || user.username[0].toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">
                            {user.full_name || user.username}
                          </div>
                          <div className="text-sm text-gray-500">@{user.username}</div>
                          {/* Display highest-level role instead of legacy super admin */}
                          {(user.roles.some(role => role.role_name === 'system_admin') ||
                            user.roles.some(role => role.role_name === 'global_admin')) && (
                            <div className="inline-flex items-center mt-1">
                              <Shield className="w-3 h-3 text-purple-600 mr-1" />
                              <span className="text-xs text-purple-600 font-medium">
                                {user.roles.some(role => role.role_name === 'system_admin')
                                  ? 'System Admin'
                                  : 'Global Admin'}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <div className="space-y-1">
                        <div className="flex items-center text-sm text-gray-600">
                          <Mail className="w-3 h-3 mr-1" />
                          {user.email}
                        </div>
                        {/* Phone number not available in current backend response */}
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <DistrictDisplay user={user} />
                    </td>

                    <td className="py-4 px-4">
                      {user.roles.length > 0 ? (
                        getRoleBadges(user)
                      ) : user.default_role ? (
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">
                          {user.default_role.replace('_', ' ')}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">No roles assigned</span>
                      )}
                    </td>

                    <td className="py-4 px-4">{getStatusBadge(user)}</td>

                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-2">
                        <div className="flex items-center space-x-1">
                          {user.two_factor_enabled ? (
                            <ShieldCheck className="w-4 h-4 text-green-600" />
                          ) : (
                            <ShieldX className="w-4 h-4 text-gray-400" />
                          )}
                          <span className="text-sm text-gray-600">
                            {user.two_factor_enabled ? 'On' : 'Off'}
                          </span>
                        </div>
                        <Switch
                          checked={user.two_factor_enabled || false}
                          onCheckedChange={() =>
                            handle2FAToggle(user.id, user.two_factor_enabled || false)
                          }
                          className="data-[state=checked]:bg-green-600"
                        />
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <div className="flex items-center text-sm text-gray-600">
                        <Calendar className="w-3 h-3 mr-1" />
                        {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}
                      </div>
                    </td>

                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => setSelectedUser(user)}
                          className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => setEditingUser(user)}
                          className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                          title="Edit User"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => {
                            setSelectedUserForReset(user);
                            setShowAdminResetDialog(true);
                          }}
                          className="p-1 text-gray-400 hover:text-orange-600 transition-colors"
                          title="Reset Password"
                        >
                          <Key className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => setRoleAssignmentDialog({ show: true, user })}
                          className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                          title="Assign Roles"
                        >
                          <Shield className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleReset2FA(user)}
                          className="p-1 text-gray-400 hover:text-orange-600 transition-colors"
                          title="Reset Two-Factor Authentication"
                        >
                          <ShieldX className="w-4 h-4" />
                        </button>

                        {/* Show multi-district button for users with multi-district roles */}
                        {user.roles.some(role =>
                          ['lead_engineer', 'regulatory_viewer'].includes(role.role_name)
                        ) && (
                          <button
                            onClick={() => setMultiDistrictDialog({ show: true, user })}
                            className="p-1 text-gray-400 hover:text-purple-600 transition-colors"
                            title="Manage Multi-District Access"
                          >
                            <MapPin className="w-4 h-4" />
                          </button>
                        )}

                        {/* Show unlock button for locked users */}
                        {((user.locked_until && new Date(user.locked_until) > new Date()) ||
                          (user.login_attempts && user.login_attempts >= 5)) && (
                          <button
                            onClick={() => handleUnlockUser(user.id)}
                            className="p-1 text-gray-400 hover:text-yellow-600 transition-colors"
                            title="Unlock User"
                          >
                            <Unlock className="w-4 h-4" />
                          </button>
                        )}

                        {/* Show activate/deactivate button for all admins when user is not locked */}
                        {!(
                          (user.locked_until && new Date(user.locked_until) > new Date()) ||
                          (user.login_attempts && user.login_attempts >= 5)
                        ) && (
                          <button
                            onClick={() => handleToggleUserStatus(user.id, user.is_active)}
                            className={`p-1 transition-colors ${
                              user.is_active
                                ? 'text-gray-400 hover:text-orange-600'
                                : 'text-gray-400 hover:text-green-600'
                            }`}
                            title={
                              user.is_active ? 'Deactivate User (Soft Delete)' : 'Activate User'
                            }
                          >
                            {user.is_active ? (
                              <Lock className="w-4 h-4" />
                            ) : (
                              <UserCheck className="w-4 h-4" />
                            )}
                          </button>
                        )}

                        {/* Hard Delete button - only show for global admins */}
                        {isGlobalAdmin() && (
                          <button
                            onClick={() => setDeleteConfirmation({ show: true, user })}
                            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                            title="Permanently Delete User (Cannot be undone)"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredUsers.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Users className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <p>No users found matching the current filters.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* User Details Modal */}
      {selectedUser && (
        <UserDetailsModal user={selectedUser} onClose={() => setSelectedUser(null)} />
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <CreateUserModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchUsers();
          }}
        />
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSuccess={() => {
            setEditingUser(null);
            fetchUsers();
          }}
        />
      )}

      {/* Password Change Dialog */}
      <PasswordChangeDialog
        isOpen={showPasswordChangeDialog}
        onClose={() => setShowPasswordChangeDialog(false)}
        onChangePassword={changePassword}
      />

      {/* Admin Password Reset Dialog */}
      <AdminPasswordResetDialog
        isOpen={showAdminResetDialog}
        onClose={() => {
          setShowAdminResetDialog(false);
          setSelectedUserForReset(null);
        }}
        onResetPassword={adminResetPassword}
        selectedUser={selectedUserForReset}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmation.show}
        onOpenChange={open => !open && setDeleteConfirmation({ show: false, user: null })}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Permanently Delete User
            </DialogTitle>
            <DialogDescription>
              ⚠️ <strong>WARNING:</strong> You are about to permanently delete{' '}
              <strong>
                {deleteConfirmation.user?.full_name || deleteConfirmation.user?.username}
              </strong>{' '}
              from the database. This action <strong>CANNOT BE UNDONE</strong> and will remove all
              user data permanently.
              <br />
              <br />
              <strong>Note:</strong> To temporarily disable a user account while preserving data,
              use the deactivate button (lock icon) instead.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmation({ show: false, user: null })}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                deleteConfirmation.user && handleDeleteUser(deleteConfirmation.user.id)
              }
              className="bg-red-600 hover:bg-red-700"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Permanently Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Assignment Dialog */}
      {roleAssignmentDialog.show && roleAssignmentDialog.user && (
        <RoleAssignmentDialog
          user={roleAssignmentDialog.user}
          onClose={() => setRoleAssignmentDialog({ show: false, user: null })}
          onSuccess={() => {
            setRoleAssignmentDialog({ show: false, user: null });
            fetchUsers();
          }}
        />
      )}

      {/* Multi-District Assignment Dialog */}
      {multiDistrictDialog.show && multiDistrictDialog.user && (
        <MultiDistrictAssignmentDialog
          user={multiDistrictDialog.user}
          onClose={() => setMultiDistrictDialog({ show: false, user: null })}
          onSuccess={() => {
            setMultiDistrictDialog({ show: false, user: null });
            fetchUsers();
          }}
        />
      )}
    </div>
  );
};

// Password Change Dialog Component
const PasswordChangeDialog: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onChangePassword: (data: PasswordChangeData) => Promise<any>;
}> = ({ isOpen, onClose, onChangePassword }) => {
  const [passwordData, setPasswordData] = useState<PasswordChangeData>({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [isLoading, setIsLoading] = useState(false);

  const handlePasswordChange = (field: keyof PasswordChangeData, value: string) => {
    setPasswordData(prev => ({ ...prev, [field]: value }));
  };

  const togglePasswordVisibility = (field: 'current' | 'new' | 'confirm') => {
    setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (passwordData.new_password !== passwordData.confirm_password) {
      alert('New password and confirmation do not match');
      return;
    }

    if (passwordData.new_password.length < 6) {
      alert('Password must be at least 6 characters long');
      return;
    }

    setIsLoading(true);
    try {
      await onChangePassword(passwordData);
      alert('Password changed successfully!');
      setPasswordData({
        current_password: '',
        new_password: '',
        confirm_password: '',
      });
      onClose();
    } catch (error) {
      alert('Error: ' + (error instanceof Error ? error.message : 'Failed to change password'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-blue-600" />
            Change Password
          </DialogTitle>
          <DialogDescription>
            Change your account password to keep your account secure.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="current_password">Current Password</Label>
              <div className="relative">
                <Input
                  id="current_password"
                  type={showPasswords.current ? 'text' : 'password'}
                  value={passwordData.current_password}
                  onChange={e => handlePasswordChange('current_password', e.target.value)}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility('current')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPasswords.current ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new_password">New Password</Label>
              <div className="relative">
                <Input
                  id="new_password"
                  type={showPasswords.new ? 'text' : 'password'}
                  value={passwordData.new_password}
                  onChange={e => handlePasswordChange('new_password', e.target.value)}
                  required
                  minLength={6}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility('new')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPasswords.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-gray-600">Password must be at least 6 characters long</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm_password">Confirm New Password</Label>
              <div className="relative">
                <Input
                  id="confirm_password"
                  type={showPasswords.confirm ? 'text' : 'password'}
                  value={passwordData.confirm_password}
                  onChange={e => handlePasswordChange('confirm_password', e.target.value)}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility('confirm')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPasswords.confirm ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Changing...' : 'Change Password'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// Admin Password Reset Dialog Component
const AdminPasswordResetDialog: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onResetPassword: (data: AdminPasswordResetData) => Promise<any>;
  selectedUser: User | null;
}> = ({ isOpen, onClose, onResetPassword, selectedUser }) => {
  const [resetData, setResetData] = useState<AdminPasswordResetData>({
    user_id: selectedUser?.id || 0,
    new_password: '',
    confirm_password: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    new: false,
    confirm: false,
  });
  const [isLoading, setIsLoading] = useState(false);

  const handlePasswordChange = (
    field: keyof Omit<AdminPasswordResetData, 'user_id'>,
    value: string
  ) => {
    setResetData(prev => ({ ...prev, [field]: value }));
  };

  const togglePasswordVisibility = (field: 'new' | 'confirm') => {
    setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (resetData.new_password !== resetData.confirm_password) {
      alert('New password and confirmation do not match');
      return;
    }

    if (resetData.new_password.length < 6) {
      alert('Password must be at least 6 characters long');
      return;
    }

    setIsLoading(true);
    try {
      await onResetPassword({
        ...resetData,
        user_id: selectedUser?.id || 0,
      });
      alert(`Password has been reset for ${selectedUser?.username}`);
      setResetData({
        user_id: 0,
        new_password: '',
        confirm_password: '',
      });
      onClose();
    } catch (error) {
      alert('Error: ' + (error instanceof Error ? error.message : 'Failed to reset password'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-orange-600" />
            Reset User Password
          </DialogTitle>
          <DialogDescription>
            Reset password for user: <strong>{selectedUser?.username}</strong>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new_password">New Password</Label>
              <div className="relative">
                <Input
                  id="new_password"
                  type={showPasswords.new ? 'text' : 'password'}
                  value={resetData.new_password}
                  onChange={e => handlePasswordChange('new_password', e.target.value)}
                  required
                  minLength={6}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility('new')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPasswords.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-gray-600">Password must be at least 6 characters long</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm_password">Confirm New Password</Label>
              <div className="relative">
                <Input
                  id="confirm_password"
                  type={showPasswords.confirm ? 'text' : 'password'}
                  value={resetData.confirm_password}
                  onChange={e => handlePasswordChange('confirm_password', e.target.value)}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility('confirm')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPasswords.confirm ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Resetting...' : 'Reset Password'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// User Details Modal - Comprehensive View
const UserDetailsModal: React.FC<{ user: User; onClose: () => void }> = ({ user, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">User Profile</h3>
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* User Info */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-lg font-medium text-gray-900 mb-4">Personal Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Full Name</label>
                  <p className="mt-1 text-sm text-gray-900">{user.full_name || 'Not specified'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Username</label>
                  <p className="mt-1 text-sm text-gray-900">{user.username}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <p className="mt-1 text-sm text-gray-900">{user.email}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">District Access</label>
                  <div className="mt-1">
                    {(() => {
                      const allDistricts: string[] = [];

                      // Add primary district if exists
                      if (user.primary_district) {
                        allDistricts.push(user.primary_district);
                      }

                      // Add additional district assignments if they exist
                      if (user.district_assignments && Array.isArray(user.district_assignments)) {
                        user.district_assignments.forEach(assignment => {
                          if (
                            assignment.district_code &&
                            !allDistricts.includes(assignment.district_code)
                          ) {
                            allDistricts.push(assignment.district_code);
                          }
                        });
                      }

                      // If user has multiple districts, show "Multi District" badge with tooltip
                      if (allDistricts.length > 1) {
                        return (
                          <div className="flex items-center text-sm group relative">
                            <Building2 className="w-4 h-4 mr-1 text-gray-400" />
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 cursor-help">
                              Multi District ({allDistricts.length})
                            </span>

                            {/* Hover tooltip showing all districts */}
                            <div className="absolute left-0 top-8 bg-gray-900 text-white text-xs rounded-md px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap z-50 shadow-lg">
                              Districts: {allDistricts.join(', ')}
                              <div className="absolute -top-1 left-4 w-2 h-2 bg-gray-900 transform rotate-45"></div>
                            </div>
                          </div>
                        );
                      }

                      // Single district or no district
                      const districtDisplay =
                        allDistricts.length === 1 ? allDistricts[0] : 'No District';

                      return (
                        <div className="flex items-center text-sm">
                          <Building2 className="w-4 h-4 mr-1 text-gray-400" />
                          <span className="text-gray-900">{districtDisplay}</span>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-lg font-medium text-gray-900 mb-4">Account Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Account Status</label>
                  <div className="mt-1">
                    {user.is_active ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        Inactive
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Account Type</label>
                  <div className="mt-1">
                    {user.is_superuser ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        <Shield className="w-3 h-3 mr-1" />
                        Global Admin
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        Regular User
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Default Role</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {user.default_role?.replace('_', ' ') || 'No default role'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Member Since</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {new Date(user.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-lg font-medium text-gray-900 mb-4">Role Assignments</h4>
              {user.roles.length > 0 ? (
                <div className="space-y-3">
                  {user.roles.map((role, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-white rounded border"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <Shield className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {role.role_name
                              .replace('_', ' ')
                              .replace(/\b\w/g, l => l.toUpperCase())}
                          </p>
                          <p className="text-xs text-gray-500">
                            {role.district_name || role.district_code || 'Global'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">
                          Granted: {new Date(role.granted_at).toLocaleDateString()}
                        </p>
                        {role.expires_at && (
                          <p className="text-xs text-red-500">
                            Expires: {new Date(role.expires_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No roles assigned</p>
              )}
            </div>
          </div>

          {/* Activity Summary */}
          <div className="space-y-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-lg font-medium text-gray-900 mb-4">Activity Summary</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Last Login</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Last Updated</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {user.updated_at ? new Date(user.updated_at).toLocaleDateString() : 'Unknown'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Login Attempts</label>
                  <p className="mt-1 text-sm text-gray-900">{user.login_attempts || 0}</p>
                </div>
                {user.locked_until && new Date(user.locked_until) > new Date() && (
                  <div>
                    <label className="block text-sm font-medium text-red-700">
                      Account Locked Until
                    </label>
                    <p className="mt-1 text-sm text-red-900">
                      {new Date(user.locked_until).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h4>
              <div className="space-y-2">
                <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors">
                  View Activity Log
                </button>
                <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors">
                  Reset Password
                </button>
                <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors">
                  Export User Data
                </button>
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

const CreateUserModal: React.FC<{ onClose: () => void; onSuccess: () => void }> = ({
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    first_name: '',
    last_name: '',
    primary_district: '',
    roles: [] as string[],
    modules: ['core'] as string[],
    is_active: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableRoles] = useState([
    'district_viewer',
    'district_operator',
    'field_engineer',
    'district_admin',
    'lead_engineer',
    'regulatory_viewer',
    'district_manager',
    'contractor',
    'global_admin',
    'sample_collector',
    'system_admin',
    'platform_admin',
    'lms_learner',
    'lms_instructor',
    'ceu_admin',
    'ceu_manager',
    'ceu_user',
  ]);
  const [availableDistricts, setAvailableDistricts] = useState<
    Array<{
      district_code: string;
      district_name: string;
    }>
  >([]);
  const [_districtsLoading, setDistrictsLoading] = useState(true);

  useEffect(() => {
    fetchAvailableDistricts();
  }, []);

  const fetchAvailableDistricts = async () => {
    try {
      console.log('🏗️ Fetching districts from API...');
      const token = localStorage.getItem('auth_token');
      console.log('🔑 Token exists:', !!token);

      // Try admin endpoint first, then fall back to tenant endpoint
      let response = await fetch('/api/v1/tenant/admin/districts/list', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('📡 Admin API Response status:', response.status);

      if (!response.ok) {
        console.log('⚠️ Admin endpoint failed, trying tenant endpoint...');
        response = await fetch('/api/v1/tenant/districts', {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        console.log('📡 Tenant API Response status:', response.status);
      }

      if (response.ok) {
        const data = await response.json();
        console.log('📊 Districts data received:', data);

        // Handle both data formats
        let districts = [];
        if (data.districts) {
          districts = data.districts.map((district: any) => ({
            district_code: district.district_code || district.code,
            district_name: district.district_name || district.name,
          }));
        }

        console.log('📋 Processed districts array:', districts);
        setAvailableDistricts(districts);
      } else {
        console.error('❌ API Error:', response.status, await response.text());
      }
    } catch (error) {
      console.error('💥 Failed to fetch districts:', error);
    } finally {
      setDistrictsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.username || !formData.email || !formData.password) {
      setError('Username, email, and password are required');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('auth_token');

      // Create the user payload
      const createUserPayload = {
        username: formData.username,
        email: formData.email,
        password: formData.password,
        first_name: formData.first_name || null,
        last_name: formData.last_name || null,
        district_code: formData.primary_district || null, // Fixed: use district_code to match backend schema
        is_active: formData.is_active,
        roles: formData.roles,
        modules: formData.modules,
      };

      const response = await fetch('/api/v1/tenant/admin/users', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(createUserPayload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Failed to create user' }));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleToggle = (role: string) => {
    setFormData(prev => ({
      ...prev,
      roles: prev.roles.includes(role) ? prev.roles.filter(r => r !== role) : [...prev.roles, role],
    }));
  };

  const handleModuleToggle = (moduleKey: string) => {
    setFormData(prev => {
      const has = prev.modules.includes(moduleKey);
      const modules = has
        ? prev.modules.filter(m => m !== moduleKey)
        : [...prev.modules, moduleKey];
      const nextModules = modules.length ? modules : ['core'];
      const lmsOnly =
        nextModules.includes('lms') &&
        !nextModules.includes('core') &&
        !nextModules.includes('workforce');
      return {
        ...prev,
        modules: nextModules,
        // LMS-only accounts may omit a district
        primary_district: lmsOnly ? '' : prev.primary_district,
      };
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">Create New User</h3>
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
                Username <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.username}
                onChange={e => setFormData(prev => ({ ...prev, username: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter username"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter email"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
              <input
                type="text"
                value={formData.first_name}
                onChange={e => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter first name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
              <input
                type="text"
                value={formData.last_name}
                onChange={e => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter last name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={e => setFormData(prev => ({ ...prev, password: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter password (min 8 characters)"
                required
                minLength={8}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={e => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Confirm password"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Primary District</label>
            <select
              value={formData.primary_district}
              onChange={e => setFormData(prev => ({ ...prev, primary_district: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select a district</option>
              {availableDistricts.map(district => (
                <option key={district.district_code} value={district.district_code}>
                  {district.district_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">User Roles</label>
            <div className="grid grid-cols-2 gap-2">
              {availableRoles.map(role => (
                <label
                  key={role}
                  className="flex items-center space-x-2 p-2 border rounded hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={formData.roles.includes(role)}
                    onChange={() => handleRoleToggle(role)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">
                    {role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Product modules</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'core', label: 'AquaSafe (core)' },
                { key: 'lms', label: 'The Reservoir (LMS)' },
                { key: 'workforce', label: 'Workforce Continuity (CEU)' },
              ].map(mod => {
                const coreLocked =
                  mod.key === 'core' &&
                  formData.modules.includes('core') &&
                  formData.modules.length === 1;
                return (
                  <label
                    key={mod.key}
                    className={`flex items-center space-x-2 ${coreLocked ? 'opacity-70' : ''}`}
                    title={
                      coreLocked
                        ? 'Enable another module first (LMS or Workforce/CEU), then you can turn off AquaSafe (core).'
                        : undefined
                    }
                  >
                    <input
                      type="checkbox"
                      checked={formData.modules.includes(mod.key)}
                      onChange={() => handleModuleToggle(mod.key)}
                      disabled={coreLocked}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
                    />
                    <span className="text-sm text-gray-700">{mod.label}</span>
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              At least one module is required. CEU tracking is under Workforce Continuity. For
              LMS-only: check The Reservoir, then uncheck AquaSafe (core). LMS-only users can omit a
              district and use lms_learner role.
            </p>
          </div>

          <div className="space-y-3">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={e => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Account is active</span>
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
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Create User
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const EditUserModal: React.FC<{ user: User; onClose: () => void; onSuccess: () => void }> = ({
  user,
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState({
    email: user.email,
    first_name: user.full_name?.split(' ')[0] || '',
    last_name: user.full_name?.split(' ').slice(1).join(' ') || '',
    primary_district: user.primary_district || '',
    roles: user.roles.map(r => r.role_name),
    modules: ['core'] as string[],
    is_active: user.is_active,
  });
  const [modulesLoading, setModulesLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableRoles, setAvailableRoles] = useState<
    Array<{
      role_name: string;
      description: string;
      scope: string;
    }>
  >([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [availableDistricts, setAvailableDistricts] = useState<
    Array<{
      district_code: string;
      district_name: string;
    }>
  >([]);
  const [_districtsLoading, setDistrictsLoading] = useState(true);

  useEffect(() => {
    fetchAvailableRoles();
    fetchAvailableDistricts();
    fetchUserModules(user.id)
      .then(grants => {
        setFormData(prev => ({
          ...prev,
          modules: grants.length ? grants : ['core'],
        }));
      })
      .catch(() => {
        setFormData(prev => ({ ...prev, modules: ['core'] }));
      })
      .finally(() => setModulesLoading(false));
  }, [user.id]);

  const fetchAvailableDistricts = async () => {
    try {
      console.log('🏗️ [EditUser] Fetching districts from API...');
      const token = localStorage.getItem('auth_token');
      console.log('🔑 [EditUser] Token exists:', !!token);

      // Try admin endpoint first, then fall back to tenant endpoint
      let response = await fetch('/api/v1/tenant/admin/districts/list', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('📡 [EditUser] Admin API Response status:', response.status);

      if (!response.ok) {
        console.log('⚠️ [EditUser] Admin endpoint failed, trying tenant endpoint...');
        response = await fetch('/api/v1/tenant/districts', {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        console.log('📡 [EditUser] Tenant API Response status:', response.status);
      }

      if (response.ok) {
        const data = await response.json();
        console.log('📊 [EditUser] Districts data received:', data);

        // Handle both data formats
        let districts = [];
        if (data.districts) {
          districts = data.districts.map((district: any) => ({
            district_code: district.district_code || district.code,
            district_name: district.district_name || district.name,
          }));
        }

        console.log('📋 [EditUser] Processed districts array:', districts);
        setAvailableDistricts(districts);
      } else {
        console.error('❌ [EditUser] API Error:', response.status, await response.text());
      }
    } catch (error) {
      console.error('💥 [EditUser] Failed to fetch districts:', error);
    } finally {
      setDistrictsLoading(false);
    }
  };

  const fetchAvailableRoles = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/v1/tenant/admin/roles/list', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setAvailableRoles(data.roles || []);
      }
    } catch (error) {
      console.error('Failed to fetch roles:', error);
    } finally {
      setRolesLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('auth_token');

      // Update basic user information first
      const updateUserPayload = {
        email: formData.email,
        first_name: formData.first_name || null,
        last_name: formData.last_name || null,
        district_code: formData.primary_district || null,
        is_active: formData.is_active,
      };

      const response = await fetch(`/api/v1/tenant/admin/users/${user.id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateUserPayload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Failed to update user' }));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      // Handle role assignments using the proper API
      const currentRoles = new Set(user.roles.map(role => role.role_name));
      const selectedRoles = new Set(formData.roles);

      // Determine roles to add and remove
      const rolesToAdd = Array.from(selectedRoles).filter(role => !currentRoles.has(role));
      const rolesToRemove = Array.from(currentRoles).filter(role => !selectedRoles.has(role));

      // Add new roles
      for (const roleName of rolesToAdd) {
        // Determine the correct district_code based on role type
        let districtCode;
        const roleInfo = availableRoles.find(r => r.role_name === roleName);

        if (roleInfo?.scope === 'global') {
          // Global roles should have NULL district_code for system-wide access
          districtCode = null;
        } else {
          // District and other roles use the user's primary district
          districtCode = formData.primary_district || 'WWD';
        }

        const roleResponse = await fetch('/api/v1/tenant/admin/roles/assign', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: user.id,
            role_name: roleName,
            district_code: districtCode,
          }),
        });

        if (!roleResponse.ok) {
          const errorData = await roleResponse.json().catch(() => ({ detail: 'Unknown error' }));
          throw new Error(`Failed to add role ${roleName}: ${errorData.detail}`);
        }
      }

      // Remove roles
      for (const roleName of rolesToRemove) {
        const roleResponse = await fetch(
          `/api/v1/tenant/admin/users/${user.id}/roles/${roleName}`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!roleResponse.ok) {
          const errorData = await roleResponse.json().catch(() => ({ detail: 'Unknown error' }));
          throw new Error(`Failed to remove role ${roleName}: ${errorData.detail}`);
        }
      }

      await updateUserModules(user.id, formData.modules);

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleToggle = (role: string) => {
    setFormData(prev => ({
      ...prev,
      roles: prev.roles.includes(role) ? prev.roles.filter(r => r !== role) : [...prev.roles, role],
    }));
  };

  const handleModuleToggle = (moduleKey: string) => {
    setFormData(prev => {
      const has = prev.modules.includes(moduleKey);
      const modules = has
        ? prev.modules.filter(m => m !== moduleKey)
        : [...prev.modules, moduleKey];
      const nextModules = modules.length ? modules : ['core'];
      const lmsOnly =
        nextModules.includes('lms') &&
        !nextModules.includes('core') &&
        !nextModules.includes('workforce');
      return {
        ...prev,
        modules: nextModules,
        // LMS-only accounts may omit a district
        primary_district: lmsOnly ? '' : prev.primary_district,
      };
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">Edit User: {user.username}</h3>
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
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Account Information</h4>
            <div className="text-sm text-gray-600">
              <p>
                <strong>Username:</strong> {user.username} (cannot be changed)
              </p>
              <p>
                <strong>Created:</strong> {new Date(user.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter email"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Primary District
              </label>
              <select
                value={formData.primary_district}
                onChange={e => setFormData(prev => ({ ...prev, primary_district: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">No district</option>
                {availableDistricts.map(district => (
                  <option key={district.district_code} value={district.district_code}>
                    {district.district_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
              <input
                type="text"
                value={formData.first_name}
                onChange={e => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter first name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
              <input
                type="text"
                value={formData.last_name}
                onChange={e => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter last name"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">User Roles</label>
            {rolesLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-sm text-gray-500">Loading roles...</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {availableRoles.map(role => (
                  <label
                    key={role.role_name}
                    className="flex items-center space-x-2 p-2 border rounded hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={formData.roles.includes(role.role_name)}
                      onChange={() => handleRoleToggle(role.role_name)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">
                      {role.role_name.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Product modules</label>
            {modulesLoading ? (
              <p className="text-sm text-gray-500">Loading modules…</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'core', label: 'AquaSafe (core)' },
                    { key: 'lms', label: 'The Reservoir (LMS)' },
                    { key: 'workforce', label: 'Workforce Continuity (CEU)' },
                  ].map(mod => {
                    const coreLocked =
                      mod.key === 'core' &&
                      formData.modules.includes('core') &&
                      formData.modules.length === 1;
                    return (
                      <label
                        key={mod.key}
                        className={`flex items-center space-x-2 ${coreLocked ? 'opacity-70' : ''}`}
                        title={
                          coreLocked
                            ? 'Enable another module first (LMS or Workforce/CEU), then you can turn off AquaSafe (core).'
                            : undefined
                        }
                      >
                        <input
                          type="checkbox"
                          checked={formData.modules.includes(mod.key)}
                          onChange={() => handleModuleToggle(mod.key)}
                          disabled={coreLocked}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
                        />
                        <span className="text-sm text-gray-700">{mod.label}</span>
                      </label>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  At least one module is required. CEU tracking is under Workforce Continuity. For
                  LMS-only: check The Reservoir, then uncheck AquaSafe (core). LMS-only users can
                  omit a district and use lms_learner role.
                </p>
              </>
            )}
          </div>

          <div className="space-y-3">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={e => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Account is active</span>
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

// Role Assignment Dialog Component
const RoleAssignmentDialog: React.FC<{
  user: User;
  onClose: () => void;
  onSuccess: () => void;
}> = ({ user, onClose, onSuccess }) => {
  console.log('🚀 RoleAssignmentDialog loaded with NEW CODE - version 2.0');
  console.log('🔍 User passed to dialog:', user);

  const [availableRoles, setAvailableRoles] = useState<
    Array<{
      role_name: string;
      description: string;
      scope: string;
    }>
  >([]);
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAvailableRoles();
    // Initialize selected roles from user's current role records only
    const currentRoles = new Set(user.roles.map(role => role.role_name));
    setSelectedRoles(currentRoles);
  }, [user]);

  const fetchAvailableRoles = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/v1/tenant/admin/roles/list', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setAvailableRoles(data.roles || []);
      }
    } catch (error) {
      console.error('Failed to fetch roles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleToggle = (roleName: string) => {
    setSelectedRoles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(roleName)) {
        newSet.delete(roleName);
      } else {
        newSet.add(roleName);
      }
      return newSet;
    });
  };

  const handleSave = async () => {
    try {
      const token = localStorage.getItem('auth_token');

      // Get current roles from the user_roles table
      const currentRoles = new Set(user.roles.map(role => role.role_name));

      // Determine roles to add and remove (simple role-based logic)
      const rolesToAdd = Array.from(selectedRoles).filter(role => !currentRoles.has(role));
      const rolesToRemove = Array.from(currentRoles).filter(role => !selectedRoles.has(role));

      // Add new roles
      for (const roleName of rolesToAdd) {
        // Determine the correct district_code based on role type
        let districtCode;
        const roleInfo = availableRoles.find(r => r.role_name === roleName);

        if (roleInfo?.scope === 'global') {
          // Global roles should have NULL district_code for system-wide access
          districtCode = null;
        } else {
          // District and other roles use the user's primary district
          districtCode = user.primary_district || 'WWD';
        }

        const response = await fetch('/api/v1/tenant/admin/roles/assign', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: user.id,
            role_name: roleName,
            district_code: districtCode,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
          throw new Error(`Failed to add role ${roleName}: ${errorData.detail}`);
        }
      }

      // Remove roles (simple DELETE for all roles)
      for (const roleName of rolesToRemove) {
        const response = await fetch(`/api/v1/tenant/admin/users/${user.id}/roles/${roleName}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
          throw new Error(`Failed to remove role ${roleName}: ${errorData.detail}`);
        }
      }

      onSuccess();
    } catch (error) {
      console.error('Failed to update roles:', error);
      alert(
        `Failed to update user roles: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  };

  const getScopeBadge = (scope: string) => {
    switch (scope) {
      case 'global':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
            Global
          </span>
        );
      case 'multi_district':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
            Multi-District
          </span>
        );
      case 'project':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
            Project
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
            District
          </span>
        );
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            Assign Roles to {user.full_name || user.username}
          </DialogTitle>
          <DialogDescription>
            Select the roles you want to assign to this user. Changes will be applied immediately.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="py-4">
            <div className="space-y-3">
              {availableRoles.map(role => (
                <div
                  key={role.role_name}
                  className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    id={role.role_name}
                    checked={selectedRoles.has(role.role_name)}
                    onChange={() => handleRoleToggle(role.role_name)}
                    className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <label
                        htmlFor={role.role_name}
                        className="font-medium text-gray-900 cursor-pointer"
                      >
                        {role.role_name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </label>
                      {getScopeBadge(role.scope)}
                    </div>
                    <p className="text-sm text-gray-600">{role.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            <Shield className="w-4 h-4 mr-2" />
            Update Roles
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Multi-District Assignment Dialog Component
const MultiDistrictAssignmentDialog: React.FC<{
  user: User;
  onClose: () => void;
  onSuccess: () => void;
}> = ({ user, onClose, onSuccess }) => {
  const [districtAssignments, setDistrictAssignments] = useState<
    Array<{
      id: number;
      district_code: string;
      district_name: string;
      assignment_type: string;
      access_level: string;
      assigned_at: string;
      expires_at?: string;
      notes?: string;
    }>
  >([]);
  const [availableDistricts, setAvailableDistricts] = useState<
    Array<{
      district_code: string;
      district_name: string;
      city: string;
      state: string;
    }>
  >([]);
  const [newAssignment, setNewAssignment] = useState({
    district_code: '',
    assignment_type: 'assigned',
    access_level: 'read',
    notes: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchDistrictAssignments();
    fetchAvailableDistricts();
  }, [user.id]);

  const fetchDistrictAssignments = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/v1/tenant/admin/users/${user.id}/district-assignments`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setDistrictAssignments(data.district_assignments || []);
      }
    } catch (error) {
      console.error('Failed to fetch district assignments:', error);
    }
  };

  const fetchAvailableDistricts = async () => {
    try {
      console.log('🏗️ [MultiDistrict] Fetching districts from API...');
      const token = localStorage.getItem('auth_token');

      // Try admin endpoint first, then fall back to tenant endpoint
      let response = await fetch('/api/v1/tenant/admin/districts/list', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('📡 [MultiDistrict] Admin API Response status:', response.status);

      if (!response.ok) {
        console.log('⚠️ [MultiDistrict] Admin endpoint failed, trying tenant endpoint...');
        response = await fetch('/api/v1/tenant/districts', {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        console.log('📡 [MultiDistrict] Tenant API Response status:', response.status);
      }

      if (response.ok) {
        const data = await response.json();
        console.log('📊 [MultiDistrict] Districts data received:', data);

        // Handle both data formats
        let districts = [];
        if (data.districts) {
          districts = data.districts.map((district: any) => ({
            district_code: district.district_code || district.code,
            district_name: district.district_name || district.name,
            city: district.city || '',
            state: district.state || '',
          }));
        }

        console.log('📋 [MultiDistrict] Processed districts array:', districts);
        setAvailableDistricts(districts);
      } else {
        console.error('❌ [MultiDistrict] API Error:', response.status, await response.text());
      }
    } catch (error) {
      console.error('💥 [MultiDistrict] Failed to fetch districts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAssignment = async () => {
    if (!newAssignment.district_code) {
      alert('Please select a district');
      return;
    }

    // Check if assignment already exists
    const existingAssignment = districtAssignments.find(
      a =>
        a.district_code === newAssignment.district_code &&
        a.assignment_type === newAssignment.assignment_type
    );

    if (existingAssignment) {
      alert('Assignment already exists for this district and type');
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/v1/tenant/admin/users/${user.id}/district-assignments`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: user.id,
          district_code: newAssignment.district_code,
          assignment_type: newAssignment.assignment_type,
          access_level: newAssignment.access_level,
          notes: newAssignment.notes,
        }),
      });

      if (response.ok) {
        await fetchDistrictAssignments();
        setNewAssignment({
          district_code: '',
          assignment_type: 'assigned',
          access_level: 'read',
          notes: '',
        });
        onSuccess();
      } else {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        alert(`Failed to add district assignment: ${errorData.detail}`);
      }
    } catch (error) {
      console.error('Failed to add district assignment:', error);
      alert('Failed to add district assignment');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAssignment = async (assignmentId: number, districtName: string) => {
    if (!confirm(`Remove district assignment for ${districtName}?`)) return;

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        `/api/v1/tenant/admin/users/${user.id}/district-assignments/${assignmentId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        await fetchDistrictAssignments();
        onSuccess();
      } else {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        alert(`Failed to remove district assignment: ${errorData.detail}`);
      }
    } catch (error) {
      console.error('Failed to remove district assignment:', error);
      alert('Failed to remove district assignment');
    }
  };

  const getAccessLevelBadge = (level: string) => {
    const styles: { [key: string]: string } = {
      read: 'bg-blue-100 text-blue-800',
      write: 'bg-green-100 text-green-800',
      admin: 'bg-purple-100 text-purple-800',
    };

    return (
      <span
        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${styles[level] || styles.read}`}
      >
        {level.charAt(0).toUpperCase() + level.slice(1)}
      </span>
    );
  };

  const getAssignmentTypeBadge = (type: string) => {
    const styles: { [key: string]: string } = {
      assigned: 'bg-gray-100 text-gray-800',
      shared_access: 'bg-orange-100 text-orange-800',
      contractor: 'bg-cyan-100 text-cyan-800',
    };

    return (
      <span
        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${styles[type] || styles.assigned}`}
      >
        {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
      </span>
    );
  };

  // Filter out districts that are already assigned
  const assignedDistrictCodes = new Set(districtAssignments.map(a => a.district_code));
  const unassignedDistricts = availableDistricts.filter(
    d => !assignedDistrictCodes.has(d.district_code)
  );

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-blue-600" />
            Multi-District Access for {user.full_name || user.username}
          </DialogTitle>
          <DialogDescription>
            Manage additional district assignments for users with multi-district roles (Lead
            Engineers, Regulatory Viewers). This allows them to access data from multiple districts.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="py-4 space-y-6">
            {/* Current Assignments */}
            <div>
              <h4 className="text-lg font-medium text-gray-900 mb-3">
                Current District Assignments
              </h4>
              {districtAssignments.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <MapPin className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p>No additional district assignments found.</p>
                  <p className="text-sm">
                    User has access to their primary district: {user.primary_district}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {districtAssignments.map(assignment => (
                    <div
                      key={assignment.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <h5 className="font-medium text-gray-900">{assignment.district_name}</h5>
                          <span className="text-sm text-gray-500">
                            ({assignment.district_code})
                          </span>
                          {getAssignmentTypeBadge(assignment.assignment_type)}
                          {getAccessLevelBadge(assignment.access_level)}
                        </div>
                        <div className="text-sm text-gray-600">
                          <p>Assigned: {new Date(assignment.assigned_at).toLocaleDateString()}</p>
                          {assignment.expires_at && (
                            <p>Expires: {new Date(assignment.expires_at).toLocaleDateString()}</p>
                          )}
                          {assignment.notes && <p>Notes: {assignment.notes}</p>}
                        </div>
                      </div>
                      <button
                        onClick={() =>
                          handleRemoveAssignment(assignment.id, assignment.district_name)
                        }
                        className="ml-4 p-2 text-red-600 hover:bg-red-50 rounded"
                        title="Remove district assignment"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add New Assignment */}
            <div className="border-t pt-6">
              <h4 className="text-lg font-medium text-gray-900 mb-3">
                Add New District Assignment
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">District</label>
                  <select
                    value={newAssignment.district_code}
                    onChange={e =>
                      setNewAssignment(prev => ({ ...prev, district_code: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select a district...</option>
                    {unassignedDistricts.map(district => (
                      <option key={district.district_code} value={district.district_code}>
                        {district.district_name} ({district.district_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Assignment Type
                  </label>
                  <select
                    value={newAssignment.assignment_type}
                    onChange={e =>
                      setNewAssignment(prev => ({ ...prev, assignment_type: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="assigned">Assigned</option>
                    <option value="shared_access">Shared Access</option>
                    <option value="contractor">Contractor</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Access Level
                  </label>
                  <select
                    value={newAssignment.access_level}
                    onChange={e =>
                      setNewAssignment(prev => ({ ...prev, access_level: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="read">Read</option>
                    <option value="write">Write</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes (Optional)
                  </label>
                  <input
                    type="text"
                    value={newAssignment.notes}
                    onChange={e => setNewAssignment(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Assignment notes..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleAddAssignment}
                  disabled={saving || !newAssignment.district_code}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Add Assignment
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            Close
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TenantUserManagement;
