import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { getAuthHeader } from '@/services/authService';
import {
  Beaker,
  CheckCircle,
  Clock,
  Database,
  Info,
  RefreshCw,
  Target,
  TrendingUp,
} from 'lucide-react';
import { useEffect, useState } from 'react';

interface ConstituentTrackingConfig {
  id: number;
  district_id: number;
  contaminant_name: string;
  is_tracked: boolean;
  track_nd_values: boolean;
  auto_added: boolean;
  last_reading_date?: string;
  created_at: string;
  updated_at: string;
  notes?: string;
}

interface FirstDetectEvent {
  id: number;
  district_id: number;
  well_id: number;
  contaminant_name: string;
  first_detect_value: number;
  first_detect_unit: string;
  detection_limit?: number;
  sample_date: string;
  alert_sent: boolean;
  alert_sent_at?: string;
  acknowledged: boolean;
  acknowledged_at?: string;
  promoted_to_tracked: boolean;
  created_at: string;
}

interface TrackingStats {
  total_constituents: number;
  tracked_constituents: number;
  tracking_percentage: number;
  first_detects_found: number;
  auto_promoted_count: number;
  storage_efficiency: number;
}

export default function ConstituentTrackingManagement() {
  const [trackingConfigs, setTrackingConfigs] = useState<ConstituentTrackingConfig[]>([]);
  const [firstDetects, setFirstDetects] = useState<FirstDetectEvent[]>([]);
  const [stats, setStats] = useState<TrackingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTracked, setFilterTracked] = useState<'all' | 'tracked' | 'untracked'>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newConstituentName, setNewConstituentName] = useState('');
  const [newConstituentNotes, setNewConstituentNotes] = useState('');
  const [_availableConstituents, setAvailableConstituents] = useState<string[]>([]);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const { toast } = useToast();

  // Comprehensive list of common water quality constituents
  const commonConstituents = [
    // PFAS compounds
    'Perfluorooctanoic Acid (PFOA)',
    'Perfluorooctanesulfonic Acid (PFOS)',
    'Perfluorononanoic Acid (PFNA)',
    'Perfluorohexanesulfonic Acid (PFHxS)',
    'Perfluorobutanesulfonic Acid (PFBS)',
    'GenX (PFOA replacement)',

    // Volatile Organic Compounds (VOCs)
    '1,4-Dioxane (p-Dioxane)',
    'Benzene',
    'Toluene',
    'Ethylbenzene',
    'Xylenes (total)',
    'Methyl tert-butyl ether (MTBE)',
    'Trichloroethylene (TCE)',
    'Perchloroethylene (PCE)',
    'Carbon Tetrachloride',
    'Chloroform',
    'Vinyl Chloride',
    '1,1-Dichloroethylene',
    '1,2-Dichloroethane',

    // Inorganics
    'Arsenic',
    'Lead',
    'Copper',
    'Chromium',
    'Chromium (hexavalent)',
    'Mercury',
    'Cadmium',
    'Selenium',
    'Barium',
    'Fluoride',
    'Nitrate as N',
    'Nitrite as N',
    'Ammonia as N',
    'Iron',
    'Manganese',
    'Chloride',
    'Sulfate',
    'Total Dissolved Solids (TDS)',

    // Pesticides/Herbicides
    '2,4-D',
    'Atrazine',
    'Simazine',
    'Alachlor',
    'Chlordane',
    'Dieldrin',
    'Heptachlor',
    'Lindane',
    'Methoxychlor',
    'Toxaphene',
    'Glyphosate',
    'Diquat',
    'Endrin',
    'Picloram',

    // Other contaminants
    'Perchlorate',
    'Turbidity',
    'Total Coliform',
    'E. coli',
    'Gross Alpha',
    'Gross Beta',
    'Radium 226',
    'Radium 228',
    'Uranium',
    'Radon',

    // Field parameters
    'Field pH',
    'Temperature',
    'Dissolved Oxygen',
    'Conductivity',
    'Alkalinity',
    'Hardness',

    // Disinfection byproducts
    'Total Trihalomethanes (TTHM)',
    'Haloacetic Acids (HAA5)',
    'Chlorite',
    'Bromate',
  ];

  // Mock district ID - in real implementation, get from auth context
  const districtId = 1;

  useEffect(() => {
    fetchData();
    // Initialize available constituents with common ones
    setAvailableConstituents(commonConstituents);
  }, []);

  // Handle search input changes with autocomplete
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);

    if (value.length > 0) {
      const filtered = commonConstituents.filter(constituent =>
        constituent.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredSuggestions(filtered.slice(0, 10)); // Limit to 10 suggestions
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  // Handle constituent name input for add form
  const handleConstituentNameChange = (value: string) => {
    setNewConstituentName(value);

    if (value.length > 0) {
      const filtered = commonConstituents.filter(
        constituent =>
          constituent.toLowerCase().includes(value.toLowerCase()) &&
          !trackingConfigs.some(
            config => config.contaminant_name.toLowerCase() === constituent.toLowerCase()
          )
      );
      setFilteredSuggestions(filtered.slice(0, 10));
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch tracking configurations
      const configResponse = await fetch(
        `/api/v1/constituent-tracking/districts/${districtId}/constituent-tracking`,
        {
          headers: {
            ...getAuthHeader(),
            'Content-Type': 'application/json',
          },
        }
      );

      if (!configResponse.ok) {
        throw new Error(`Failed to fetch tracking configs: ${configResponse.statusText}`);
      }

      const configs = await configResponse.json();
      setTrackingConfigs(configs);

      // Fetch first detect events
      const firstDetectsResponse = await fetch(
        `/api/v1/constituent-tracking/districts/${districtId}/first-detects?days=30`,
        {
          headers: {
            ...getAuthHeader(),
            'Content-Type': 'application/json',
          },
        }
      );

      if (!firstDetectsResponse.ok) {
        throw new Error(`Failed to fetch first detects: ${firstDetectsResponse.statusText}`);
      }

      const firstDetects = await firstDetectsResponse.json();
      setFirstDetects(firstDetects);

      // Fetch statistics
      const statsResponse = await fetch(
        `/api/v1/constituent-tracking/districts/${districtId}/constituent-tracking/stats`,
        {
          headers: {
            ...getAuthHeader(),
            'Content-Type': 'application/json',
          },
        }
      );

      if (!statsResponse.ok) {
        throw new Error(`Failed to fetch stats: ${statsResponse.statusText}`);
      }

      const stats = await statsResponse.json();
      setStats(stats);
    } catch (error) {
      console.error('Error fetching tracking data:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast({
        title: 'Error',
        description: `Failed to load contaminant tracking data: ${errorMessage}`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTracking = async (
    configId: number,
    field: 'is_tracked' | 'track_nd_values',
    value: boolean
  ) => {
    try {
      const config = trackingConfigs.find(c => c.id === configId);
      if (!config) return;

      // Simplified logic: when toggling ND storage, automatically set is_tracked appropriately
      const updates: Record<string, unknown> = { [field]: value };
      if (field === 'track_nd_values' && value) {
        // If enabling ND storage, ensure is_tracked is also true
        updates.is_tracked = true;
      }

      // Update local state immediately for better UX
      setTrackingConfigs(prev =>
        prev.map(c =>
          c.id === configId ? { ...c, ...updates, updated_at: new Date().toISOString() } : c
        )
      );

      // Make API call to update configuration
      const response = await fetch(
        `/api/v1/constituent-tracking/districts/${districtId}/constituent-tracking`,
        {
          method: 'PUT',
          headers: {
            ...getAuthHeader(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([
            {
              contaminant_name: config.contaminant_name,
              ...updates,
            },
          ]),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to update tracking configuration: ${response.statusText}`);
      }

      toast({
        title: 'Success',
        description: `ND storage configuration updated`,
      });
    } catch (error) {
      console.error('Error updating tracking config:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast({
        title: 'Error',
        description: `Failed to update tracking configuration: ${errorMessage}`,
        variant: 'destructive',
      });
      // Revert local state on error
      fetchData();
    }
  };

  const handleSaveNotes = async (configId: number, notes: string) => {
    try {
      const config = trackingConfigs.find(c => c.id === configId);
      if (!config) return;

      setTrackingConfigs(prev =>
        prev.map(c =>
          c.id === configId ? { ...c, notes, updated_at: new Date().toISOString() } : c
        )
      );

      // Make API call to update notes
      const response = await fetch(
        `/api/v1/constituent-tracking/districts/${districtId}/constituent-tracking`,
        {
          method: 'PUT',
          headers: {
            ...getAuthHeader(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([
            {
              contaminant_name: config.contaminant_name,
              notes: notes,
            },
          ]),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to save notes: ${response.statusText}`);
      }

      toast({
        title: 'Success',
        description: 'Notes saved successfully',
      });
    } catch (error) {
      console.error('Error saving notes:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast({
        title: 'Error',
        description: `Failed to save notes: ${errorMessage}`,
        variant: 'destructive',
      });
      // Revert on error
      fetchData();
    }
  };

  const handleAcknowledgeFirstDetect = async (eventId: number) => {
    try {
      setFirstDetects(prev =>
        prev.map(event =>
          event.id === eventId
            ? { ...event, acknowledged: true, acknowledged_at: new Date().toISOString() }
            : event
        )
      );

      // Make API call to acknowledge
      const response = await fetch(
        `/api/v1/constituent-tracking/districts/${districtId}/first-detects/${eventId}/acknowledge`,
        {
          method: 'POST',
          headers: {
            ...getAuthHeader(),
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to acknowledge first detect: ${response.statusText}`);
      }

      toast({
        title: 'Success',
        description: 'First detect event acknowledged',
      });
    } catch (error) {
      console.error('Error acknowledging first detect:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast({
        title: 'Error',
        description: `Failed to acknowledge first detect event: ${errorMessage}`,
        variant: 'destructive',
      });
      // Revert on error
      fetchData();
    }
  };

  const handlePromoteToTracked = async (eventId: number) => {
    try {
      const event = firstDetects.find(e => e.id === eventId);
      if (!event) return;

      setFirstDetects(prev =>
        prev.map(e => (e.id === eventId ? { ...e, promoted_to_tracked: true } : e))
      );

      // Make API call to promote
      const response = await fetch(
        `/api/v1/constituent-tracking/districts/${districtId}/first-detects/${eventId}/promote`,
        {
          method: 'POST',
          headers: {
            ...getAuthHeader(),
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to promote constituent: ${response.statusText}`);
      }

      // Refresh data to get updated tracking configs
      await fetchData();

      toast({
        title: 'Success',
        description: `${event.contaminant_name} promoted to tracked status`,
      });
    } catch (error) {
      console.error('Error promoting to tracked:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast({
        title: 'Error',
        description: `Failed to promote contaminant to tracked status: ${errorMessage}`,
        variant: 'destructive',
      });
      // Revert on error
      fetchData();
    }
  };

  const handleAddNewConstituent = async () => {
    if (!newConstituentName.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a contaminant name',
        variant: 'destructive',
      });
      return;
    }

    // Check if constituent already exists
    const existingConstituent = trackingConfigs.find(
      config => config.contaminant_name.toLowerCase() === newConstituentName.trim().toLowerCase()
    );

    if (existingConstituent) {
      toast({
        title: 'Error',
        description: 'This contaminant is already in your tracking list',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(
        `/api/v1/constituent-tracking/districts/${districtId}/constituent-tracking`,
        {
          method: 'POST',
          headers: {
            ...getAuthHeader(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([
            {
              contaminant_name: newConstituentName.trim(),
              is_tracked: true,
              track_nd_values: true,
              notes: newConstituentNotes.trim() || null,
            },
          ]),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to add constituent: ${response.statusText}`);
      }

      // Reset form
      setNewConstituentName('');
      setNewConstituentNotes('');
      setShowAddForm(false);

      // Refresh data
      await fetchData();

      toast({
        title: 'Success',
        description: `${newConstituentName.trim()} added to tracking list`,
      });
    } catch (error) {
      console.error('Error adding constituent:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast({
        title: 'Error',
        description: `Failed to add contaminant: ${errorMessage}`,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const filteredConfigs = trackingConfigs.filter(config => {
    const matchesSearch = config.contaminant_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter =
      filterTracked === 'all' ||
      (filterTracked === 'tracked' && config.is_tracked) ||
      (filterTracked === 'untracked' && !config.is_tracked);
    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading contaminant tracking data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Contaminants</CardTitle>
              <Beaker className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_constituents}</div>
              <p className="text-xs text-muted-foreground">
                {stats.tracked_constituents} tracked ({stats.tracking_percentage.toFixed(1)}%)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Storage Efficiency</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.storage_efficiency.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">Space saved by selective ND tracking</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">First Detects</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.first_detects_found}</div>
              <p className="text-xs text-muted-foreground">New contaminants detected</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Auto-Promoted</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.auto_promoted_count}</div>
              <p className="text-xs text-muted-foreground">Automatically added to tracking</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="tracking" className="w-full">
        <TabsList>
          <TabsTrigger value="tracking">Tracking Configuration</TabsTrigger>
          <TabsTrigger value="first-detects">First Detects</TabsTrigger>
        </TabsList>

        <TabsContent value="tracking" className="space-y-4">
          {/* Search and Filter Controls */}
          <Card>
            <CardHeader>
              <CardTitle>Contaminant Tracking Configuration</CardTitle>
              <CardDescription>
                Configure which contaminants should store ND (Non-Detect) values for trend analysis.
                <strong>All contaminants with detectable values are always tracked.</strong> Storing
                ND values uses more storage but provides better insights into detection patterns and
                regulatory compliance.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4 mb-4">
                <div className="flex-1 relative">
                  <Label htmlFor="search">Search Contaminants</Label>
                  <Input
                    id="search"
                    placeholder="Search by contaminant name..."
                    value={searchTerm}
                    onChange={e => handleSearchChange(e.target.value)}
                    onFocus={() => {
                      if (searchTerm.length > 0) setShowSuggestions(true);
                    }}
                    onBlur={() => {
                      // Delay hiding suggestions to allow clicks
                      setTimeout(() => setShowSuggestions(false), 200);
                    }}
                  />
                  {showSuggestions && filteredSuggestions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                      {filteredSuggestions.map((constituent, index) => (
                        <div
                          key={index}
                          className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                          onClick={() => {
                            setSearchTerm(constituent);
                            setShowSuggestions(false);
                          }}
                        >
                          {constituent}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <Label htmlFor="filter">Filter</Label>
                  <select
                    id="filter"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    value={filterTracked}
                    onChange={e =>
                      setFilterTracked(e.target.value as 'all' | 'tracked' | 'untracked')
                    }
                  >
                    <option value="all">All Contaminants</option>
                    <option value="tracked">Storing ND Values</option>
                    <option value="untracked">Not Storing ND Values</option>
                  </select>
                </div>
                <div className="flex flex-col justify-end">
                  <Button
                    onClick={() => setShowAddForm(!showAddForm)}
                    className="whitespace-nowrap"
                  >
                    {showAddForm ? 'Cancel' : 'Add New Contaminant'}
                  </Button>
                </div>
              </div>

              {/* Add New Constituent Form */}
              {showAddForm && (
                <Card className="mb-4 border-green-200 bg-green-50">
                  <CardHeader>
                    <CardTitle className="text-green-800">Add New Contaminant</CardTitle>
                    <CardDescription>
                      Add a new contaminant to store ND (Non-Detect) values for trend analysis. All
                      contaminants with detectable values are always tracked.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="relative">
                        <Label htmlFor="new-constituent-name">Contaminant Name *</Label>
                        <Input
                          id="new-constituent-name"
                          placeholder="e.g., PFOA, 1,4-Dioxane, Nitrate as N..."
                          value={newConstituentName}
                          onChange={e => handleConstituentNameChange(e.target.value)}
                          onFocus={() => {
                            if (newConstituentName.length > 0) setShowSuggestions(true);
                          }}
                          onBlur={() => {
                            // Delay hiding suggestions to allow clicks
                            setTimeout(() => setShowSuggestions(false), 200);
                          }}
                        />
                        {showSuggestions && filteredSuggestions.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                            {filteredSuggestions.map((constituent, index) => (
                              <div
                                key={index}
                                className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                                onClick={() => {
                                  setNewConstituentName(constituent);
                                  setShowSuggestions(false);
                                }}
                              >
                                {constituent}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="new-constituent-notes">Notes (Optional)</Label>
                        <Textarea
                          id="new-constituent-notes"
                          placeholder="Add any notes about this contaminant..."
                          value={newConstituentNotes}
                          onChange={e => setNewConstituentNotes(e.target.value)}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={handleAddNewConstituent}
                          disabled={saving || !newConstituentName.trim()}
                        >
                          {saving ? 'Adding...' : 'Add Contaminant'}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setShowAddForm(false);
                            setNewConstituentName('');
                            setNewConstituentNotes('');
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredConfigs.map(config => (
                  <Card key={config.id} className="border-l-4 border-l-blue-500">
                    <CardContent className="pt-6">
                      <div className="space-y-4">
                        {/* Header with title and badges */}
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-lg">{config.contaminant_name}</h3>
                          {config.auto_added && <Badge variant="secondary">Auto-Added</Badge>}
                          {config.track_nd_values && <Badge variant="default">Storing NDs</Badge>}
                        </div>

                        {/* Toggle switch */}
                        <div className="flex items-center space-x-2">
                          <Switch
                            id={`track-nd-${config.id}`}
                            checked={config.track_nd_values}
                            onCheckedChange={checked =>
                              handleToggleTracking(config.id, 'track_nd_values', checked)
                            }
                          />
                          <Label htmlFor={`track-nd-${config.id}`}>Store Non-Detect Values</Label>
                          <span className="text-sm text-gray-500 ml-2">(for trend analysis)</span>
                        </div>

                        {/* Last reading date */}
                        {config.last_reading_date && (
                          <p className="text-sm text-gray-600">
                            <Clock className="h-4 w-4 inline mr-1" />
                            Last reading: {new Date(config.last_reading_date).toLocaleDateString()}
                          </p>
                        )}

                        {/* Notes section */}
                        <div className="space-y-2">
                          <Label htmlFor={`notes-${config.id}`}>Notes</Label>
                          <Textarea
                            id={`notes-${config.id}`}
                            placeholder="Add notes about this contaminant..."
                            value={config.notes || ''}
                            onChange={e => {
                              const updatedConfigs = trackingConfigs.map(c =>
                                c.id === config.id ? { ...c, notes: e.target.value } : c
                              );
                              setTrackingConfigs(updatedConfigs);
                            }}
                            onBlur={e => handleSaveNotes(config.id, e.target.value)}
                            rows={3}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="first-detects" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>First Detect Events</CardTitle>
              <CardDescription>
                New contaminants detected above detection limits. Review and decide whether to add
                to tracking.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {firstDetects.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <p className="text-gray-600">No recent first detect events</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {firstDetects.map(event => (
                    <Card
                      key={event.id}
                      className={`border-l-4 ${
                        event.acknowledged ? 'border-l-green-500' : 'border-l-orange-500'
                      }`}
                    >
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold text-lg">{event.contaminant_name}</h3>
                              {event.acknowledged ? (
                                <Badge variant="default">Acknowledged</Badge>
                              ) : (
                                <Badge variant="destructive">Needs Review</Badge>
                              )}
                              {event.promoted_to_tracked && (
                                <Badge variant="secondary">Promoted</Badge>
                              )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                              <div>
                                <p className="text-sm text-gray-600">
                                  <strong>First Detect Value:</strong> {event.first_detect_value}{' '}
                                  {event.first_detect_unit}
                                </p>
                                {event.detection_limit && (
                                  <p className="text-sm text-gray-600">
                                    <strong>Detection Limit:</strong> {event.detection_limit}{' '}
                                    {event.first_detect_unit}
                                  </p>
                                )}
                              </div>
                              <div>
                                <p className="text-sm text-gray-600">
                                  <strong>Sample Date:</strong>{' '}
                                  {new Date(event.sample_date).toLocaleDateString()}
                                </p>
                                <p className="text-sm text-gray-600">
                                  <strong>Well ID:</strong> {event.well_id}
                                </p>
                              </div>
                            </div>

                            {event.alert_sent && (
                              <Alert className="mb-4">
                                <Info className="h-4 w-4" />
                                <AlertDescription>
                                  Alert sent on{' '}
                                  {event.alert_sent_at
                                    ? new Date(event.alert_sent_at).toLocaleString()
                                    : 'unknown date'}
                                </AlertDescription>
                              </Alert>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-2 mt-4">
                          {!event.acknowledged && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAcknowledgeFirstDetect(event.id)}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Acknowledge
                            </Button>
                          )}

                          {!event.promoted_to_tracked && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handlePromoteToTracked(event.id)}
                            >
                              <Target className="h-4 w-4 mr-2" />
                              Add to Tracking
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
