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
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/context/AuthContext';
import {
  Calendar,
  Edit,
  Eye,
  Filter,
  Key,
  Lock,
  Mail,
  Phone,
  Search,
  Shield,
  ShieldCheck,
  ShieldX,
  Trash2,
  Truck,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  district_code: string;
  district_name: string;
  roles: Array<{
    id: number;
    role_name: string;
    role_description: string;
    display_name?: string;
    parent_role_name?: string | null;
    is_system_role?: boolean;
  }>;
  created_at: string;
  last_login?: string;
  phone?: string;
  department?: string;
  two_factor_enabled?: boolean;
  two_factor_setup_completed?: boolean;
}

interface NewUserData {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  password: string;
  role_ids: number[];
  phone?: string;
  department?: string;
}

interface EditUserData {
  email: string;
  first_name: string;
  last_name: string;
  role_ids: number[];
  phone?: string;
  department?: string;
  is_active: boolean;
}

interface Role {
  id: number;
  role_name: string;
  role_description: string;
  display_name?: string;
  parent_role_name?: string | null;
  is_system_role?: boolean;
}

function roleLabel(role: {
  role_name: string;
  role_description: string;
  display_name?: string;
}): string {
  return role.display_name || role.role_description || role.role_name.replace(/_/g, ' ');
}

export interface DistrictUserManagementProps {
  /** When true, omit page-level hero (for district admin hub). */
  embedded?: boolean;
}

const DistrictUserManagement: React.FC<DistrictUserManagementProps> = ({ embedded = false }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isPasswordResetOpen, setIsPasswordResetOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editUser, setEditUser] = useState<EditUserData>({
    email: '',
    first_name: '',
    last_name: '',
    role_ids: [],
    phone: '',
    department: '',
    is_active: true,
  });
  const [newUser, setNewUser] = useState<NewUserData>({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    password: '',
    role_ids: [],
    phone: '',
    department: '',
  });

  const [fieldTesterDefaultUserId, setFieldTesterDefaultUserId] = useState<string>('');
  const [fieldTesterAutoClaim, setFieldTesterAutoClaim] = useState(true);
  const [fieldTesterSaving, setFieldTesterSaving] = useState(false);

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

      // Load users for current district and available roles
      const [usersResponse, fieldTesterResponse] = await Promise.all([
        fetch('/api/v1/district/users', { headers }),
        fetch('/api/v1/district/settings/field-tester', { headers }),
      ]);

      if (!usersResponse.ok) {
        throw new Error('Failed to load users');
      }

      let rolesResponse = await fetch('/api/v1/district/roles/assignable', { headers });
      if (!rolesResponse.ok) {
        rolesResponse = await fetch('/api/v1/district/roles', { headers });
      }
      if (!rolesResponse.ok) {
        throw new Error('Failed to load roles');
      }

      const usersData = await usersResponse.json();
      const rolesData = await rolesResponse.json();
      const rawRoles = rolesData.roles || [];
      const normalizedRoles = rawRoles.map(
        (r: {
          id: number;
          role_name: string;
          role_description?: string;
          display_name?: string;
        }) => ({
          id: r.id,
          role_name: r.role_name,
          role_description: r.role_description ?? r.display_name ?? r.role_name,
          display_name: r.display_name ?? r.role_description,
        })
      );

      if (fieldTesterResponse.ok) {
        const ft = await fieldTesterResponse.json();
        setFieldTesterDefaultUserId(
          ft.default_tester_user_id != null ? String(ft.default_tester_user_id) : ''
        );
        setFieldTesterAutoClaim(ft.tester_auto_claim_unassigned !== false);
      }

      // Backend now provides real 2FA data
      setUsers(usersData.users || []);
      setRoles(normalizedRoles);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load user data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/v1/district/users', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newUser),
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ detail: `Failed to create user (HTTP ${response.status})` }));
        throw new Error(errorData.detail || `Failed to create user (HTTP ${response.status})`);
      }

      toast({
        title: 'Success',
        description: 'User created successfully',
      });

      setIsCreateDialogOpen(false);
      setNewUser({
        username: '',
        email: '',
        first_name: '',
        last_name: '',
        password: '',
        role_ids: [],
        phone: '',
        department: '',
      });
      loadData();
    } catch (error) {
      console.error('Error creating user:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create user',
        variant: 'destructive',
      });
    }
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/v1/district/users/${editingUser.id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editUser),
      });

      if (!response.ok) {
        throw new Error('Failed to update user');
      }

      toast({
        title: 'Success',
        description: 'User updated successfully',
      });

      setIsEditDialogOpen(false);
      setEditingUser(null);
      loadData();
    } catch (error) {
      console.error('Error updating user:', error);
      toast({
        title: 'Error',
        description: 'Failed to update user',
        variant: 'destructive',
      });
    }
  };

  const handleToggleUserStatus = async (userId: number, currentStatus: boolean) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/v1/district/users/${userId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_active: !currentStatus }),
      });

      if (!response.ok) {
        throw new Error('Failed to update user status');
      }

      toast({
        title: 'Success',
        description: `User ${!currentStatus ? 'activated' : 'deactivated'} successfully`,
      });

      loadData();
    } catch (error) {
      console.error('Error updating user status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update user status',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteUser = async (user: User) => {
    const ok = window.confirm(
      `Permanently delete ${user.username}?\n\n` +
        'This removes the user and their role assignments. This cannot be undone. ' +
        'If you only want to revoke access, deactivate the account instead.'
    );
    if (!ok) return;

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/v1/district/users/${user.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ detail: `Failed to delete user (HTTP ${response.status})` }));
        throw new Error(errorData.detail || `Failed to delete user (HTTP ${response.status})`);
      }

      toast({
        title: 'User deleted',
        description: `${user.username} was permanently removed.`,
      });

      loadData();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete user',
        variant: 'destructive',
      });
    }
  };

  const handleResetPassword = async (userId: number, newPassword: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/v1/district/users/${userId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password: newPassword }),
      });

      if (!response.ok) {
        throw new Error('Failed to reset password');
      }

      toast({
        title: 'Success',
        description: 'Password reset successfully',
      });

      setIsPasswordResetOpen(false);
      setSelectedUser(null);
    } catch (error) {
      console.error('Error resetting password:', error);
      toast({
        title: 'Error',
        description: 'Failed to reset password',
        variant: 'destructive',
      });
    }
  };

  const openEditDialog = (user: User) => {
    setEditingUser(user);
    setEditUser({
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role_ids: user.roles.map(r => r.id),
      phone: user.phone || '',
      department: user.department || '',
      is_active: user.is_active,
    });
    setIsEditDialogOpen(true);
  };

  const handle2FAToggle = async (userId: number, currentStatus: boolean) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/v1/district/users/${userId}/2fa/toggle`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled: !currentStatus }),
      });

      if (!response.ok) {
        throw new Error('Failed to toggle 2FA');
      }

      toast({
        title: 'Success',
        description: `2FA ${!currentStatus ? 'enabled' : 'disabled'} successfully`,
      });

      loadData();
    } catch (error) {
      console.error('Error toggling 2FA:', error);
      toast({
        title: 'Error',
        description: 'Failed to toggle 2FA',
        variant: 'destructive',
      });
    }
  };

  const handleReset2FA = async (user: User) => {
    const ok = window.confirm(
      `Reset two-factor authentication for ${user.username}?\n\n` +
        'This will disable 2FA, remove their authenticator enrollment and backup codes, ' +
        'and clear setup completion. Turn 2FA back on here if this account must use 2FA again.'
    );
    if (!ok) return;

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/v1/district/users/${user.id}/2fa/reset`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        const detail =
          typeof errBody.detail === 'string'
            ? errBody.detail
            : Array.isArray(errBody.detail)
              ? errBody.detail
                  .map((d: { msg?: string }) => d.msg)
                  .filter(Boolean)
                  .join(', ')
              : 'Failed to reset 2FA';
        throw new Error(detail || 'Failed to reset 2FA');
      }

      toast({
        title: '2FA reset',
        description: `${user.username}: authenticator data cleared. Re-enable 2FA if required.`,
      });
      loadData();
    } catch (error) {
      console.error('Error resetting 2FA:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to reset 2FA',
        variant: 'destructive',
      });
    }
  };

  const saveFieldTesterSettings = async () => {
    try {
      setFieldTesterSaving(true);
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/v1/district/settings/field-tester', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          default_tester_user_id: fieldTesterDefaultUserId
            ? Number(fieldTesterDefaultUserId)
            : null,
          tester_auto_claim_unassigned: fieldTesterAutoClaim,
        }),
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || 'Save failed');
      }
      const ft = await res.json();
      setFieldTesterDefaultUserId(
        ft.default_tester_user_id != null ? String(ft.default_tester_user_id) : ''
      );
      setFieldTesterAutoClaim(ft.tester_auto_claim_unassigned !== false);
      toast({ title: 'Saved', description: 'Sample collector settings updated.' });
    } catch (e) {
      console.error(e);
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Could not save field settings',
        variant: 'destructive',
      });
    } finally {
      setFieldTesterSaving(false);
    }
  };

  /** Users who can reasonably be the district default assignee for new sampling events (no separate "group" — derived from roles on district users). */
  const FIELD_DEFAULT_ASSIGNEE_ROLES = ['sample_collector', 'field_engineer'] as const;
  const fieldDefaultRoleLabels: Record<string, string> = {
    sample_collector: 'Sample collector',
    field_engineer: 'Field engineer',
  };
  const fieldStaffForDefaultAssignee = users.filter(u =>
    u.roles?.some(r => (FIELD_DEFAULT_ASSIGNEE_ROLES as readonly string[]).includes(r.role_name))
  );
  const fieldStaffRoleSummary = (u: User) =>
    (u.roles || [])
      .map(r => r.role_name)
      .filter(rn => (FIELD_DEFAULT_ASSIGNEE_ROLES as readonly string[]).includes(rn))
      .map(rn => fieldDefaultRoleLabels[rn] || rn)
      .join(', ');

  const filteredUsers = users.filter(
    user =>
      user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.last_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {embedded && (
        <p className="text-sm text-muted-foreground">
          Assign roles on each user below, or manage the permission matrix in{' '}
          <Link
            to="/dashboard/district-admin/utilities?tab=roles"
            className="text-blue-600 underline font-medium"
          >
            Roles & permissions
          </Link>
          .
        </p>
      )}
      {!embedded && (
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg p-6">
          <h1 className="text-3xl font-bold flex items-center">
            <Users className="mr-3 h-8 w-8" />
            District User Management
          </h1>
          <p className="mt-2 text-blue-100">
            Manage user accounts within your district.{' '}
            <Link
              to="/dashboard/district-admin/utilities?tab=roles"
              className="underline font-medium text-white hover:text-blue-50"
            >
              Roles & permissions
            </Link>
          </p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Truck className="h-5 w-5 text-blue-600" />
            Sample collectors
          </CardTitle>
          <CardDescription>
            Default assignee for newly generated sampling events, and visibility of unassigned work
            in the field collection app. Choose users with the{' '}
            <span className="font-medium">sample collector</span> or{' '}
            <span className="font-medium">field engineer</span> role below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 max-w-xl">
          <div className="space-y-2">
            <Label htmlFor="default_field_tester">Default sample collector</Label>
            <select
              id="default_field_tester"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
              value={fieldTesterDefaultUserId}
              onChange={e => setFieldTesterDefaultUserId(e.target.value)}
            >
              <option value="">None (leave unassigned unless schedule specifies)</option>
              {fieldStaffForDefaultAssignee.map(u => (
                <option key={u.id} value={String(u.id)}>
                  {u.first_name} {u.last_name} ({u.username}) — {fieldStaffRoleSummary(u)}
                </option>
              ))}
            </select>
            {fieldStaffForDefaultAssignee.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No district users yet with sample collector or field engineer role. Add one of those
                roles on a user below, then pick them here.
              </p>
            )}
          </div>
          <div className="flex items-center justify-between gap-4 rounded-md border border-gray-200 p-3">
            <div>
              <p className="text-sm font-medium">District unassigned pool</p>
              <p className="text-xs text-muted-foreground">
                When on, users with the sample collector role see today's district events that have
                no assignee yet.
              </p>
            </div>
            <Switch checked={fieldTesterAutoClaim} onCheckedChange={setFieldTesterAutoClaim} />
          </div>
          <Button type="button" onClick={saveFieldTesterSettings} disabled={fieldTesterSaving}>
            {fieldTesterSaving ? 'Saving…' : 'Save sample collector settings'}
          </Button>
        </CardContent>
      </Card>

      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex flex-1 gap-4 items-center">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setIsCreateDialogOpen(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add User</span>
          </button>
        </div>
      </div>

      {/* Create User Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>Add a new user to your district</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="first_name">First Name</Label>
                <Input
                  id="first_name"
                  value={newUser.first_name}
                  onChange={e => setNewUser({ ...newUser, first_name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="last_name">Last Name</Label>
                <Input
                  id="last_name"
                  value={newUser.last_name}
                  onChange={e => setNewUser({ ...newUser, last_name: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={newUser.username}
                onChange={e => setNewUser({ ...newUser, username: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={newUser.email}
                onChange={e => setNewUser({ ...newUser, email: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={newUser.password}
                onChange={e => setNewUser({ ...newUser, password: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone (Optional)</Label>
              <Input
                id="phone"
                value={newUser.phone}
                onChange={e => setNewUser({ ...newUser, phone: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="department">Department (Optional)</Label>
              <Input
                id="department"
                value={newUser.department}
                onChange={e => setNewUser({ ...newUser, department: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="roles">Roles</Label>
              <div className="space-y-2 mt-2">
                {roles.map(role => (
                  <div key={role.id} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={`role_${role.id}`}
                      checked={newUser.role_ids.includes(role.id)}
                      onChange={e => {
                        if (e.target.checked) {
                          setNewUser({ ...newUser, role_ids: [...newUser.role_ids, role.id] });
                        } else {
                          setNewUser({
                            ...newUser,
                            role_ids: newUser.role_ids.filter(id => id !== role.id),
                          });
                        }
                      }}
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor={`role_${role.id}`} className="text-sm">
                      {roleLabel(role)}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateUser}>Create User</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>District Users ({filteredUsers.length})</span>
            <div className="flex items-center text-sm text-gray-500">
              <Filter className="w-4 h-4 mr-1" />
              {searchTerm ? 'Filtered' : 'All Users'}
            </div>
          </CardTitle>
          <CardDescription>
            Manage user accounts and permissions within your district
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-700">User</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Contact</th>
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
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            user.id % 6 === 0
                              ? 'bg-blue-100'
                              : user.id % 6 === 1
                                ? 'bg-green-100'
                                : user.id % 6 === 2
                                  ? 'bg-purple-100'
                                  : user.id % 6 === 3
                                    ? 'bg-yellow-100'
                                    : user.id % 6 === 4
                                      ? 'bg-red-100'
                                      : 'bg-indigo-100'
                          }`}
                        >
                          <span
                            className={`font-medium text-sm ${
                              user.id % 6 === 0
                                ? 'text-blue-600'
                                : user.id % 6 === 1
                                  ? 'text-green-600'
                                  : user.id % 6 === 2
                                    ? 'text-purple-600'
                                    : user.id % 6 === 3
                                      ? 'text-yellow-600'
                                      : user.id % 6 === 4
                                        ? 'text-red-600'
                                        : 'text-indigo-600'
                            }`}
                          >
                            {user.first_name?.[0] || user.username[0].toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">
                            {user.first_name} {user.last_name}
                          </div>
                          <div className="text-sm text-gray-500">@{user.username}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <div className="space-y-1">
                        <div className="flex items-center text-sm text-gray-600">
                          <Mail className="w-3 h-3 mr-1" />
                          {user.email}
                        </div>
                        {user.phone && (
                          <div className="flex items-center text-sm text-gray-500">
                            <Phone className="w-3 h-3 mr-1" />
                            {user.phone}
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <div className="flex flex-wrap gap-1">
                        {user.roles.map(role => (
                          <span
                            key={role.id}
                            className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                              role.role_name === 'global_admin' || role.role_name === 'system_admin'
                                ? 'bg-purple-100 text-purple-800'
                                : role.role_name === 'district_admin'
                                  ? 'bg-red-100 text-red-800'
                                  : role.role_name === 'district_manager'
                                    ? 'bg-orange-100 text-orange-800'
                                    : role.role_name === 'field_engineer'
                                      ? 'bg-blue-100 text-blue-800'
                                      : role.role_name === 'sample_collector'
                                        ? 'bg-green-100 text-green-800'
                                        : role.role_name.startsWith('ceu_')
                                          ? 'bg-teal-100 text-teal-800'
                                          : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {roleLabel(role)}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>

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
                          onClick={() => {
                            setSelectedUser(user);
                            setIsDetailsDialogOpen(true);
                          }}
                          className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => openEditDialog(user)}
                          className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                          title="Edit User"
                        >
                          <Edit className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => {
                            setSelectedUser(user);
                            setIsPasswordResetOpen(true);
                          }}
                          className="p-1 text-gray-400 hover:text-orange-600 transition-colors"
                          title="Reset Password"
                        >
                          <Key className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleReset2FA(user)}
                          className="p-1 text-gray-400 hover:text-amber-600 transition-colors"
                          title="Reset authenticator / 2FA enrollment"
                        >
                          <ShieldX className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => openEditDialog(user)}
                          className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                          title="Assign Roles"
                        >
                          <Shield className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleToggleUserStatus(user.id, user.is_active)}
                          className={`p-1 transition-colors ${
                            user.is_active
                              ? 'text-gray-400 hover:text-orange-600'
                              : 'text-gray-400 hover:text-green-600'
                          }`}
                          title={user.is_active ? 'Deactivate User (Soft Delete)' : 'Activate User'}
                        >
                          {user.is_active ? (
                            <Lock className="w-4 h-4" />
                          ) : (
                            <UserCheck className="w-4 h-4" />
                          )}
                        </button>

                        <button
                          onClick={() => handleDeleteUser(user)}
                          className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                          title="Delete User (Permanent)"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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

      {/* Edit User Dialog */}
      {isEditDialogOpen && editingUser && (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit User: {editingUser.username}</DialogTitle>
              <DialogDescription>Update user information and roles</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit_first_name">First Name</Label>
                  <Input
                    id="edit_first_name"
                    value={editUser.first_name}
                    onChange={e => setEditUser({ ...editUser, first_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit_last_name">Last Name</Label>
                  <Input
                    id="edit_last_name"
                    value={editUser.last_name}
                    onChange={e => setEditUser({ ...editUser, last_name: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="edit_email">Email</Label>
                <Input
                  id="edit_email"
                  type="email"
                  value={editUser.email}
                  onChange={e => setEditUser({ ...editUser, email: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit_phone">Phone (Optional)</Label>
                <Input
                  id="edit_phone"
                  value={editUser.phone}
                  onChange={e => setEditUser({ ...editUser, phone: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit_department">Department (Optional)</Label>
                <Input
                  id="edit_department"
                  value={editUser.department}
                  onChange={e => setEditUser({ ...editUser, department: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit_roles">Roles</Label>
                <div className="space-y-2 mt-2">
                  {roles.map(role => (
                    <div key={role.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`edit_role_${role.id}`}
                        checked={editUser.role_ids.includes(role.id)}
                        onChange={e => {
                          if (e.target.checked) {
                            setEditUser({ ...editUser, role_ids: [...editUser.role_ids, role.id] });
                          } else {
                            setEditUser({
                              ...editUser,
                              role_ids: editUser.role_ids.filter(id => id !== role.id),
                            });
                          }
                        }}
                        className="rounded border-gray-300"
                      />
                      <Label htmlFor={`edit_role_${role.id}`} className="text-sm">
                        {roleLabel(role)}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={editUser.is_active}
                  onCheckedChange={checked => setEditUser({ ...editUser, is_active: checked })}
                />
                <Label>Account Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateUser}>Update User</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* User Details Dialog */}
      {isDetailsDialogOpen && selectedUser && (
        <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                User Details: {selectedUser.first_name} {selectedUser.last_name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="font-semibold">Username</Label>
                  <p className="text-sm text-gray-600">{selectedUser.username}</p>
                </div>
                <div>
                  <Label className="font-semibold">Email</Label>
                  <p className="text-sm text-gray-600">{selectedUser.email}</p>
                </div>
                <div>
                  <Label className="font-semibold">District</Label>
                  <p className="text-sm text-gray-600">
                    {selectedUser.district_name || selectedUser.district_code}
                  </p>
                </div>
                <div>
                  <Label className="font-semibold">Status</Label>
                  <Badge variant={selectedUser.is_active ? 'default' : 'secondary'}>
                    {selectedUser.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                {selectedUser.phone && (
                  <div>
                    <Label className="font-semibold">Phone</Label>
                    <p className="text-sm text-gray-600">{selectedUser.phone}</p>
                  </div>
                )}
                {selectedUser.department && (
                  <div>
                    <Label className="font-semibold">Department</Label>
                    <p className="text-sm text-gray-600">{selectedUser.department}</p>
                  </div>
                )}
                <div>
                  <Label className="font-semibold">Created</Label>
                  <p className="text-sm text-gray-600">
                    {new Date(selectedUser.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <Label className="font-semibold">Last Login</Label>
                  <p className="text-sm text-gray-600">
                    {selectedUser.last_login
                      ? new Date(selectedUser.last_login).toLocaleDateString()
                      : 'Never'}
                  </p>
                </div>
              </div>
              <div>
                <Label className="font-semibold">Assigned Roles</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedUser.roles.map(role => (
                    <Badge key={role.id} variant="outline">
                      {roleLabel(role)}
                      {role.parent_role_name && (
                        <span className="text-muted-foreground ml-1 text-xs">
                          (inherits {role.parent_role_name.replace(/_/g, ' ')})
                        </span>
                      )}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setIsDetailsDialogOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Password Reset Dialog */}
      {isPasswordResetOpen && selectedUser && (
        <PasswordResetDialog
          user={selectedUser}
          onClose={() => {
            setIsPasswordResetOpen(false);
            setSelectedUser(null);
          }}
          onReset={handleResetPassword}
        />
      )}
    </div>
  );
};

// Password Reset Dialog Component
const PasswordResetDialog: React.FC<{
  user: User;
  onClose: () => void;
  onReset: (userId: number, newPassword: string) => void;
}> = ({ user, onClose, onReset }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    onReset(user.id, newPassword);
    onClose();
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
          <DialogDescription>
            Reset password for {user.first_name} {user.last_name} ({user.username})
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="text-red-600 text-sm">{error}</div>}
          <div>
            <Label htmlFor="new_password">New Password</Label>
            <Input
              id="new_password"
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <div>
            <Label htmlFor="confirm_password">Confirm Password</Label>
            <Input
              id="confirm_password"
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Reset Password</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default DistrictUserManagement;
