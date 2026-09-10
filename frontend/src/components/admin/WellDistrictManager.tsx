import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building,
  MapPin,
  Edit,
  Save,
  X,
  CheckCircle,
  AlertTriangle,
  Search,
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

interface Well {
  id: number;
  well_number: string;
  name?: string;
  address?: string;
  district_code?: string;
  district_id?: string;
}

const WATER_DISTRICTS = [
  { code: 'WWD', name: 'Westbury Water District', color: 'bg-blue-100 text-blue-800' },
  { code: 'NASSAU', name: 'Nassau County Regional', color: 'bg-gray-100 text-gray-800' },
  { code: 'GVWD', name: 'Glen Cove Water District', color: 'bg-green-100 text-green-800' },
  { code: 'HWD', name: 'Hempstead Water District', color: 'bg-purple-100 text-purple-800' },
  { code: 'OTHER', name: 'Other/Unknown', color: 'bg-orange-100 text-orange-800' },
];

const WESTBURY_WELLS = ['6', '9', '10', '11', '12', '12A', '14', '15', '16', '17', '18'];

const WellDistrictManager: React.FC = () => {
  const [editingWell, setEditingWell] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDistrict, setFilterDistrict] = useState<string>('all');
  const [newDistrictCode, setNewDistrictCode] = useState<string>('');

  const queryClient = useQueryClient();

  // Fetch all wells
  const { data: wells, isLoading } = useQuery({
    queryKey: ['all-wells'],
    queryFn: async () => {
      const response = await fetch('/api/v1/wells?limit=1000');
      if (!response.ok) throw new Error('Failed to fetch wells');
      return response.json();
    },
  });

  // Update well district
  const updateWellMutation = useMutation({
    mutationFn: async ({ wellId, districtCode }: { wellId: number; districtCode: string }) => {
      const response = await fetch(`/api/v1/wells/${wellId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ district_code: districtCode }),
      });
      if (!response.ok) throw new Error('Failed to update well');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-wells'] });
      setEditingWell(null);
      setNewDistrictCode('');
    },
  });

  // Bulk assign Westbury wells
  const bulkAssignWestburyMutation = useMutation({
    mutationFn: async () => {
      const responses = await Promise.all(
        WESTBURY_WELLS.map(wellNumber => {
          const well = wells?.find((w: Well) => w.well_number === wellNumber);
          if (well) {
            return fetch(`/api/v1/wells/${well.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ district_code: 'WWD' }),
            });
          }
          return Promise.resolve(null);
        })
      );
      return responses.filter(r => r !== null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-wells'] });
    },
  });

  const filteredWells = wells?.filter((well: Well) => {
    const matchesSearch =
      !searchTerm ||
      well.well_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      well.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      well.address?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter =
      filterDistrict === 'all' ||
      (filterDistrict === 'unassigned' && !well.district_code) ||
      well.district_code === filterDistrict;

    return matchesSearch && matchesFilter;
  });

  const getDistrictInfo = (code?: string) => {
    return (
      WATER_DISTRICTS.find(d => d.code === code) || {
        code: code || 'UNASSIGNED',
        name: 'Unassigned',
        color: 'bg-red-100 text-red-800',
      }
    );
  };

  const isWestburyWell = (wellNumber: string) => {
    return WESTBURY_WELLS.includes(wellNumber);
  };

  const getWellStatus = (well: Well) => {
    if (isWestburyWell(well.well_number) && well.district_code === 'WWD') {
      return { icon: CheckCircle, color: 'text-green-500', label: 'Correctly Assigned' };
    } else if (isWestburyWell(well.well_number) && well.district_code !== 'WWD') {
      return { icon: AlertTriangle, color: 'text-orange-500', label: 'Should be WWD' };
    } else if (!isWestburyWell(well.well_number) && well.district_code === 'WWD') {
      return { icon: AlertTriangle, color: 'text-orange-500', label: 'Check Assignment' };
    }
    return { icon: CheckCircle, color: 'text-gray-400', label: 'OK' };
  };

  if (isLoading) {
    return <div className="flex justify-center p-8">Loading wells...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Well District Management</h1>
          <p className="text-gray-600">Assign and manage water district codes for wells</p>
        </div>
        <Button
          onClick={() => bulkAssignWestburyMutation.mutate()}
          disabled={bulkAssignWestburyMutation.isPending}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Building className="w-4 h-4 mr-2" />
          Auto-Assign Westbury Wells
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {WATER_DISTRICTS.map(district => {
          const count = wells?.filter((w: Well) => w.district_code === district.code).length || 0;
          return (
            <Card key={district.code}>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{count}</div>
                <div className="text-sm text-gray-600">{district.name}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search wells..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filterDistrict} onValueChange={setFilterDistrict}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Districts</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {WATER_DISTRICTS.map(district => (
                  <SelectItem key={district.code} value={district.code}>
                    {district.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        {/* Wells Table */}
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left p-4">Well</th>
                  <th className="text-left p-4">Name/Address</th>
                  <th className="text-left p-4">Current District</th>
                  <th className="text-left p-4">Status</th>
                  <th className="text-left p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredWells?.map((well: Well) => {
                  const districtInfo = getDistrictInfo(well.district_code);
                  const status = getWellStatus(well);
                  const StatusIcon = status.icon;

                  return (
                    <tr key={well.id} className="border-b hover:bg-gray-50">
                      <td className="p-4">
                        <div className="font-semibold">{well.well_number}</div>
                        {isWestburyWell(well.well_number) && (
                          <Badge
                            variant="outline"
                            className="text-xs mt-1 bg-blue-50 text-blue-700"
                          >
                            Westbury Well
                          </Badge>
                        )}
                      </td>
                      <td className="p-4">
                        <div>{well.name}</div>
                        {well.address && (
                          <div className="text-sm text-gray-500 flex items-center">
                            <MapPin className="w-3 h-3 mr-1" />
                            {well.address}
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        {editingWell === well.id ? (
                          <Select value={newDistrictCode} onValueChange={setNewDistrictCode}>
                            <SelectTrigger className="w-48">
                              <SelectValue placeholder="Select district..." />
                            </SelectTrigger>
                            <SelectContent>
                              {WATER_DISTRICTS.map(district => (
                                <SelectItem key={district.code} value={district.code}>
                                  {district.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge className={districtInfo.color}>{districtInfo.name}</Badge>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center">
                          <StatusIcon className={`w-4 h-4 mr-2 ${status.color}`} />
                          <span className="text-sm">{status.label}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        {editingWell === well.id ? (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => {
                                if (newDistrictCode) {
                                  updateWellMutation.mutate({
                                    wellId: well.id,
                                    districtCode: newDistrictCode,
                                  });
                                }
                              }}
                              disabled={!newDistrictCode || updateWellMutation.isPending}
                            >
                              <Save className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingWell(null);
                                setNewDistrictCode('');
                              }}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingWell(well.id);
                              setNewDistrictCode(well.district_code || '');
                            }}
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WellDistrictManager;
