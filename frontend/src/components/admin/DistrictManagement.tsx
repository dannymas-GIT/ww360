import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  Users,
  Settings,
  Database,
  Shield,
  AlertTriangle,
  Plus,
  Edit2,
  Eye,
  Activity,
  CheckCircle,
  XCircle,
  Mail,
  X,
  GraduationCap,
} from 'lucide-react';
import {
  globalAdminDataService,
  type CreateWaterDistrictInput,
} from '@/services/globalAdminDataService';
import {
  getDistrictEmailDomains,
  patchDistrictEmailDomain,
} from '@/services/emailIngestionService';

interface District {
  id: number;
  district_code: string;
  district_name: string;
  full_name: string;
  district_type: string;
  service_area: string;
  nys_pwsid?: string;
  contact_info?: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface DistrictStats {
  wells_count: number;
  users_count: number;
  active_alerts: number;
  recent_readings: number;
}

interface DistrictUser {
  id: number;
  username: string;
  full_name: string;
  email: string;
  roles: Array<{
    role_name: string;
    district_code?: string;
    granted_at: string;
    expires_at?: string;
  }>;
  is_active: boolean;
  primary_district: string;
  last_login?: string;
}

interface Well {
  id: number;
  well_number: string;
  name: string;
  status: string;
  well_type: string;
  address: string;
  city: string;
  district_code: string;
  latitude?: number;
  longitude?: number;
  active_alerts: number;
  latest_reading_date?: string;
  reading_count: number;
}

interface AuthContext {
  user_id: number;
  username: string;
  district_code: string;
  roles: string[];
  is_system_admin: boolean;
  permissions: {
    can_view_all_districts: boolean;
    can_manage_users: boolean;
    can_manage_districts: boolean;
  };
}

const DistrictManagement: React.FC = () => {
  const [districts, setDistricts] = useState<District[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState<District | null>(null);
  const [districtStats, setDistrictStats] = useState<DistrictStats | null>(null);
  const [districtUsers, setDistrictUsers] = useState<DistrictUser[]>([]);
  const [districtWells, setDistrictWells] = useState<Well[]>([]);
  const [authContext, setAuthContext] = useState<AuthContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'wells' | 'config'>('overview');

  // Create-district modal
  const emptyCreateForm: CreateWaterDistrictInput = {
    district_code: '',
    district_name: '',
    state_code: '',
    jurisdiction_codes: '',
    primacy_agency: '',
  };
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<CreateWaterDistrictInput>(emptyCreateForm);

  // Per-district lab email domains (managed here in the district config tab)
  const [emailDomains, setEmailDomains] = useState<Record<string, string | null>>({});
  const [emailDraft, setEmailDraft] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedDistrict) {
      setEmailDraft(emailDomains[selectedDistrict.district_code] ?? '');
      setEmailError(null);
    }
  }, [selectedDistrict, emailDomains]);

  useEffect(() => {
    if (selectedDistrict) {
      loadDistrictData(selectedDistrict.district_code);
    }
  }, [selectedDistrict]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token');
      const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      // Load auth context and districts in parallel
      const [authResponse, districtsResponse] = await Promise.all([
        fetch('/api/v1/tenant/auth/context', { headers }),
        fetch('/api/v1/tenant/districts', { headers }),
      ]);

      if (!authResponse.ok || !districtsResponse.ok) {
        throw new Error('Failed to load initial data');
      }

      const authData = await authResponse.json();
      const districtsData = await districtsResponse.json();

      setAuthContext(authData);

      // Convert district format from API response
      const formattedDistricts = districtsData.districts.map((d: any) => ({
        id: d.id || Math.random(), // Fallback ID if not provided
        district_code: d.code,
        district_name: d.name,
        full_name: d.full_name || d.name,
        district_type: d.district_type || 'Municipal',
        service_area: d.service_area || 'Not specified',
        nys_pwsid: d.nys_pwsid,
        contact_info: d.contact_info,
        is_active: d.is_active !== false,
        created_at: d.created_at || new Date().toISOString(),
        updated_at: d.updated_at || new Date().toISOString(),
      }));

      setDistricts(formattedDistricts);

      // Select first district if available
      if (formattedDistricts.length > 0) {
        setSelectedDistrict(formattedDistricts[0]);
      }

      // Load per-district lab email domains (best-effort; non-fatal)
      try {
        const domainRows = await getDistrictEmailDomains();
        const domainMap: Record<string, string | null> = {};
        for (const row of domainRows) {
          domainMap[row.district_code] = row.ingestion_email_domain;
        }
        setEmailDomains(domainMap);
      } catch (domainErr) {
        console.warn('Could not load district email domains:', domainErr);
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadDistrictData = async (districtCode: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      // Load district-specific data in parallel
      const [usersResponse, wellsResponse] = await Promise.all([
        fetch(`/api/v1/tenant/users/?district_code=${districtCode}`, { headers }),
        fetch(`/api/v1/tenant/wells?district_code=${districtCode}`, { headers }),
      ]);

      if (!usersResponse.ok || !wellsResponse.ok) {
        throw new Error('Failed to load district data');
      }

      const usersData = await usersResponse.json();
      const wellsData = await wellsResponse.json();

      // Process users data
      const users = Array.isArray(usersData.users)
        ? usersData.users
        : Array.isArray(usersData)
          ? usersData
          : [];
      setDistrictUsers(users);

      // Process wells data
      const wells = Array.isArray(wellsData.wells)
        ? wellsData.wells
        : Array.isArray(wellsData)
          ? wellsData
          : [];
      setDistrictWells(wells);

      // Calculate statistics
      const stats: DistrictStats = {
        wells_count: wells.length,
        users_count: users.length,
        active_alerts: wells.reduce((sum: number, well: any) => sum + (well.active_alerts || 0), 0),
        recent_readings: wells.reduce(
          (sum: number, well: any) => sum + (well.reading_count || 0),
          0
        ),
      };
      setDistrictStats(stats);
    } catch (err) {
      console.error('Error loading district data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load district data');
    }
  };

  const handleCreateDistrict = async () => {
    const code = createForm.district_code.trim();
    const name = createForm.district_name.trim();
    if (!code || !name) {
      setCreateError('District code and district name are required.');
      return;
    }

    setCreating(true);
    setCreateError(null);
    try {
      await globalAdminDataService.createWaterDistrict({
        district_code: code,
        district_name: name,
        state_code: createForm.state_code?.trim() || undefined,
        jurisdiction_codes: createForm.jurisdiction_codes?.trim() || undefined,
        primacy_agency: createForm.primacy_agency?.trim() || undefined,
      });
      setShowCreateModal(false);
      setCreateForm(emptyCreateForm);
      await loadInitialData();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create district.');
    } finally {
      setCreating(false);
    }
  };

  const handleSaveEmailDomain = async () => {
    if (!selectedDistrict) return;
    const value = emailDraft.trim();
    setEmailSaving(true);
    setEmailError(null);
    try {
      const updated = await patchDistrictEmailDomain(selectedDistrict.district_code, {
        ingestion_email_domain: value === '' ? null : value,
      });
      setEmailDomains(prev => ({
        ...prev,
        [selectedDistrict.district_code]: updated.ingestion_email_domain,
      }));
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : 'Failed to save email domain.');
    } finally {
      setEmailSaving(false);
    }
  };

  const getStatusIcon = (isActive: boolean) => {
    return isActive ? (
      <CheckCircle className="w-4 h-4 text-green-500" />
    ) : (
      <XCircle className="w-4 h-4 text-red-500" />
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading districts...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-red-500 bg-red-50 p-4 rounded-lg">
        <AlertTriangle className="w-5 h-5" />
        <span>Error: {error}</span>
        <button
          onClick={loadInitialData}
          className="ml-auto px-3 py-1 bg-red-100 hover:bg-red-200 rounded text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!authContext) {
    return (
      <div className="text-center text-gray-500 p-8">
        <Shield className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        <p>Authentication required</p>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-gray-50">
      {/* Left Sidebar - Districts List */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Districts</h2>
            {authContext.permissions.can_manage_districts && (
              <button
                type="button"
                onClick={() => {
                  setCreateError(null);
                  setCreateForm(emptyCreateForm);
                  setShowCreateModal(true);
                }}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                title="Add water district"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {authContext.permissions.can_view_all_districts ? 'All Districts' : 'Your Districts'}
          </p>
          {authContext.permissions.can_manage_districts && (
            <Link
              to="/dashboard/admin/onboarding"
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:text-blue-900"
            >
              <GraduationCap className="w-3.5 h-3.5" />
              Open onboarding wizard
            </Link>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {districts.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <Building2 className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p>No districts available</p>
            </div>
          ) : (
            districts.map(district => (
              <div
                key={district.district_code}
                onClick={() => setSelectedDistrict(district)}
                className={`p-4 border-b border-gray-100 cursor-pointer transition-colors ${
                  selectedDistrict?.district_code === district.district_code
                    ? 'bg-blue-50 border-l-4 border-l-blue-500'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Building2 className="w-4 h-4 text-gray-500" />
                      <span className="font-medium text-gray-900">{district.district_name}</span>
                      {getStatusIcon(district.is_active)}
                    </div>
                    <p className="text-sm text-gray-600">{district.district_code}</p>
                    <p className="text-xs text-gray-500 mt-1">{district.district_type}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {selectedDistrict ? (
          <>
            {/* District Header */}
            <div className="bg-white border-b border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <Building2 className="w-6 h-6 text-blue-600" />
                    <h1 className="text-2xl font-bold text-gray-900">
                      {selectedDistrict.district_name}
                    </h1>
                    {getStatusIcon(selectedDistrict.is_active)}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span>
                      <strong>Code:</strong> {selectedDistrict.district_code}
                    </span>
                    <span>
                      <strong>Type:</strong> {selectedDistrict.district_type}
                    </span>
                    <span>
                      <strong>Service Area:</strong> {selectedDistrict.service_area}
                    </span>
                  </div>
                </div>
                {authContext.permissions.can_manage_districts && (
                  <div className="flex gap-2">
                    <button className="px-4 py-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50">
                      <Edit2 className="w-4 h-4 mr-2 inline" />
                      Edit District
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Statistics Cards */}
            {districtStats && (
              <div className="bg-white p-6 border-b border-gray-200">
                <div className="grid grid-cols-4 gap-6">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-blue-600">Wells</p>
                        <p className="text-2xl font-bold text-blue-900">
                          {districtStats.wells_count}
                        </p>
                      </div>
                      <Database className="w-8 h-8 text-blue-500" />
                    </div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-green-600">Users</p>
                        <p className="text-2xl font-bold text-green-900">
                          {districtStats.users_count}
                        </p>
                      </div>
                      <Users className="w-8 h-8 text-green-500" />
                    </div>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-red-600">Active Alerts</p>
                        <p className="text-2xl font-bold text-red-900">
                          {districtStats.active_alerts}
                        </p>
                      </div>
                      <AlertTriangle className="w-8 h-8 text-red-500" />
                    </div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-purple-600">Recent Readings</p>
                        <p className="text-2xl font-bold text-purple-900">
                          {districtStats.recent_readings}
                        </p>
                      </div>
                      <Activity className="w-8 h-8 text-purple-500" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab Navigation */}
            <div className="bg-white border-b border-gray-200">
              <div className="flex space-x-8 px-6">
                {[
                  { id: 'overview', label: 'Overview', icon: Eye },
                  { id: 'users', label: 'Users', icon: Users },
                  { id: 'wells', label: 'Wells', icon: Database },
                  { id: 'config', label: 'Configuration', icon: Settings },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-2 py-4 px-2 border-b-2 font-medium text-sm ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-auto bg-gray-50">
              {activeTab === 'overview' && (
                <div className="p-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-lg shadow">
                      <h3 className="text-lg font-semibold mb-4">District Information</h3>
                      <div className="space-y-3">
                        <div>
                          <label className="text-sm font-medium text-gray-500">Full Name</label>
                          <p className="text-gray-900">{selectedDistrict.full_name}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">NYS PWSID</label>
                          <p className="text-gray-900">
                            {selectedDistrict.nys_pwsid || 'Not specified'}
                          </p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">Created</label>
                          <p className="text-gray-900">{formatDate(selectedDistrict.created_at)}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">Status</label>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(selectedDistrict.is_active)}
                            <span
                              className={
                                selectedDistrict.is_active ? 'text-green-600' : 'text-red-600'
                              }
                            >
                              {selectedDistrict.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow">
                      <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
                      <div className="text-gray-500 text-center py-8">
                        <Activity className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                        <p>Activity tracking coming soon</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'users' && (
                <div className="p-6">
                  <div className="bg-white rounded-lg shadow">
                    <div className="p-6 border-b border-gray-200">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">District Users</h3>
                        {authContext.permissions.can_manage_users && (
                          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                            <Plus className="w-4 h-4 mr-2 inline" />
                            Add User
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              User
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Roles
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Status
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Last Login
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {districtUsers.map(user => (
                            <tr key={user.id}>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div>
                                  <div className="text-sm font-medium text-gray-900">
                                    {user.full_name || user.username}
                                  </div>
                                  <div className="text-sm text-gray-500">{user.email}</div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex flex-wrap gap-1">
                                  {user.roles.map((role, idx) => (
                                    <span
                                      key={idx}
                                      className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full"
                                    >
                                      {role.role_name}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  {getStatusIcon(user.is_active)}
                                  <span
                                    className={user.is_active ? 'text-green-600' : 'text-red-600'}
                                  >
                                    {user.is_active ? 'Active' : 'Inactive'}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {user.last_login ? formatDate(user.last_login) : 'Never'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                {authContext.permissions.can_manage_users && (
                                  <div className="flex gap-2">
                                    <button className="text-blue-600 hover:text-blue-900">
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {districtUsers.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                          <Users className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                          <p>No users found for this district</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'wells' && (
                <div className="p-6">
                  <div className="bg-white rounded-lg shadow">
                    <div className="p-6 border-b border-gray-200">
                      <h3 className="text-lg font-semibold">District Wells</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Well
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Type
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Status
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Location
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Alerts
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Last Reading
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {districtWells.map(well => (
                            <tr key={well.id}>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div>
                                  <div className="text-sm font-medium text-gray-900">
                                    {well.name}
                                  </div>
                                  <div className="text-sm text-gray-500">{well.well_number}</div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {well.well_type}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span
                                  className={`px-2 py-1 text-xs rounded-full ${
                                    well.status === 'active'
                                      ? 'bg-green-100 text-green-800'
                                      : well.status === 'inactive'
                                        ? 'bg-red-100 text-red-800'
                                        : 'bg-yellow-100 text-yellow-800'
                                  }`}
                                >
                                  {well.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {well.address}, {well.city}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {well.active_alerts > 0 ? (
                                  <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">
                                    {well.active_alerts} alerts
                                  </span>
                                ) : (
                                  <span className="text-gray-500 text-sm">None</span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {well.latest_reading_date
                                  ? formatDate(well.latest_reading_date)
                                  : 'No readings'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {districtWells.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                          <Database className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                          <p>No wells found for this district</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'config' && (
                <div className="p-6 space-y-6">
                  {/* Lab email ingestion domain */}
                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center gap-2 mb-1">
                      <Mail className="w-5 h-5 text-blue-600" />
                      <h3 className="text-lg font-semibold">Lab email domain</h3>
                    </div>
                    <p className="text-sm text-gray-500 mb-4 max-w-3xl">
                      Set the email domain (e.g.{' '}
                      <code className="bg-gray-100 px-1 rounded">waterdistrict.org</code>) that
                      appears on lab result messages for{' '}
                      <strong>{selectedDistrict.district_name}</strong>. When an incoming message is
                      addressed to an alias at that domain in To or CC, ingestion routes the CSV to
                      this district. Exact address mappings in Email ingestion still take priority.
                    </p>

                    {emailError && (
                      <div className="mb-3 rounded-md bg-red-50 text-red-800 px-4 py-2 text-sm border border-red-200">
                        {emailError}
                      </div>
                    )}

                    <div className="flex items-end gap-3">
                      <div className="flex-1 max-w-md">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Email domain
                        </label>
                        <input
                          type="text"
                          className="w-full border border-gray-300 rounded px-3 py-2 font-mono text-sm"
                          placeholder="e.g. waterdistrict.org"
                          value={emailDraft}
                          onChange={e => setEmailDraft(e.target.value)}
                          disabled={emailSaving || !authContext.permissions.can_manage_districts}
                        />
                      </div>
                      {authContext.permissions.can_manage_districts && (
                        <button
                          type="button"
                          onClick={() => void handleSaveEmailDomain()}
                          disabled={
                            emailSaving ||
                            emailDraft.trim() ===
                              (emailDomains[selectedDistrict.district_code] ?? '')
                          }
                          className="px-4 py-2 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50"
                        >
                          {emailSaving ? 'Saving…' : 'Save'}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-semibold mb-4">Other configuration</h3>
                    <div className="text-gray-500 text-center py-8">
                      <Settings className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                      <p>Additional configuration management coming soon</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <Building2 className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p>Select a district to view details</p>
            </div>
          </div>
        )}
      </div>

      {/* Create District Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !creating && setShowCreateModal(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-lg"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">Add Water District</h3>
              </div>
              <button
                type="button"
                onClick={() => !creating && setShowCreateModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-500">
                Create a new district tenant. District onboarding (contaminant tracking) runs
                automatically.
              </p>

              {createError && (
                <div className="rounded-md bg-red-50 text-red-800 px-4 py-2 text-sm border border-red-200">
                  {createError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    District Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                    placeholder="e.g., WWD"
                    value={createForm.district_code}
                    onChange={e =>
                      setCreateForm(prev => ({
                        ...prev,
                        district_code: e.target.value.toUpperCase(),
                      }))
                    }
                    autoComplete="off"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Letters, numbers, hyphen, underscore. Cannot be changed later.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                  <input
                    type="text"
                    maxLength={10}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                    placeholder="e.g., NY"
                    value={createForm.state_code ?? ''}
                    onChange={e =>
                      setCreateForm(prev => ({
                        ...prev,
                        state_code: e.target.value.toUpperCase(),
                      }))
                    }
                    autoComplete="off"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  District Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  placeholder="e.g., Westbury Water District"
                  value={createForm.district_name}
                  onChange={e =>
                    setCreateForm(prev => ({ ...prev, district_name: e.target.value }))
                  }
                  autoComplete="off"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Jurisdiction Codes
                </label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  placeholder="e.g., EPA,NYS,NASSAU"
                  value={createForm.jurisdiction_codes ?? ''}
                  onChange={e =>
                    setCreateForm(prev => ({ ...prev, jurisdiction_codes: e.target.value }))
                  }
                  autoComplete="off"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Comma-separated codes used to match applicable MCLs/regulations.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Primacy Agency
                </label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  placeholder="e.g., NYS DOH"
                  value={createForm.primacy_agency ?? ''}
                  onChange={e =>
                    setCreateForm(prev => ({ ...prev, primacy_agency: e.target.value }))
                  }
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 p-5 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                disabled={creating}
                className="px-4 py-2 rounded border border-gray-300 text-gray-700 text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleCreateDistrict()}
                disabled={
                  creating || !createForm.district_code.trim() || !createForm.district_name.trim()
                }
                className="px-4 py-2 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? 'Creating…' : 'Create District'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DistrictManagement;
