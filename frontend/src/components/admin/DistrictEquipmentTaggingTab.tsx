import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
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
import { useToast } from '@/hooks/use-toast';
import { fetchWells } from '@/services/wellApi';
import { fetchAllFacilities } from '@/services/facilityApi';
import { saveEquipmentTag } from '@/utils/equipmentTaggingSave';
import { useManageEquipmentTagging } from '@/hooks/useManageEquipmentTagging';
import {
  EQUIPMENT_CATEGORIES,
  EquipmentCategory,
  getCategoryDisplayName,
  getEquipmentCategory,
  getFacilityTypeDisplayName,
} from '@/utils/equipmentTypes';
import { inferCategoryFromName } from '@/utils/inferEquipmentCategory';
import { useTenantAuthContext } from '@/hooks/useTenantAuthContext';
import { ExternalLink, Loader2, Search, Tag } from 'lucide-react';
import { Link } from 'react-router-dom';

type FilterMode = 'all' | 'untagged' | 'suggested';

interface TagRow {
  key: string;
  wellId?: number;
  facilityDbId?: number;
  identifier: string;
  name: string;
  currentType: string | null;
  currentCategory: EquipmentCategory | null;
  suggestedType: string | null;
  suggestedCategory: EquipmentCategory | null;
  source: 'well' | 'facility';
}

function buildTagRows(
  wells: Awaited<ReturnType<typeof fetchWells>>,
  facilities: Awaited<ReturnType<typeof fetchAllFacilities>>
): TagRow[] {
  const byFacilityId = new Map(
    facilities.filter(f => f.facility_id).map(f => [f.facility_id as string, f])
  );
  const linkedFacilityIds = new Set<string>();

  const wellRows: TagRow[] = wells.map(well => {
    const id = well.well_number?.toString() ?? String(well.id);
    const tagged = byFacilityId.get(id);
    if (tagged) linkedFacilityIds.add(id);
    const inference = inferCategoryFromName(well.name, well.well_number);
    return {
      key: `well-${well.id}`,
      wellId: well.id,
      facilityDbId: tagged?.id,
      identifier: id,
      name: well.name || id,
      currentType: tagged?.facility_type ?? null,
      currentCategory: tagged ? getEquipmentCategory(tagged.facility_type) : null,
      suggestedType: inference.facilityType,
      suggestedCategory: inference.category,
      source: 'well',
    };
  });

  const orphanFacilities: TagRow[] = facilities
    .filter(f => !f.facility_id || !linkedFacilityIds.has(f.facility_id))
    .map(f => ({
      key: `facility-${f.id}`,
      facilityDbId: f.id,
      identifier: f.facility_id || `facility-${f.id}`,
      name: f.name || f.facility_id || `Facility ${f.id}`,
      currentType: f.facility_type,
      currentCategory: getEquipmentCategory(f.facility_type),
      suggestedType: null,
      suggestedCategory: null,
      source: 'facility' as const,
    }));

  return [...wellRows, ...orphanFacilities].sort((a, b) =>
    a.identifier.localeCompare(b.identifier)
  );
}

export const DistrictEquipmentTaggingTab: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canManageTagging = useManageEquipmentTagging();
  const { data: tenantCtx } = useTenantAuthContext();
  const districtId =
    tenantCtx?.district_code ||
    tenantCtx?.assigned_districts?.[0] ||
    tenantCtx?.accessible_districts?.[0] ||
    '*';

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterMode>('untagged');
  const [pendingTypes, setPendingTypes] = useState<Record<string, string>>({});
  const [pendingNames, setPendingNames] = useState<Record<string, string>>({});

  const { data: wells, isLoading: wellsLoading } = useQuery({
    queryKey: ['wells', 'equipment-tagging'],
    queryFn: () => fetchWells({ limit: 1000 }),
    staleTime: 30000,
  });

  const { data: facilities, isLoading: facilitiesLoading } = useQuery({
    queryKey: ['facilities', 'all'],
    queryFn: () => fetchAllFacilities(),
    staleTime: 30000,
  });

  const allRows = useMemo(() => buildTagRows(wells ?? [], facilities ?? []), [wells, facilities]);

  const filteredRows = useMemo(() => {
    let rows = allRows;
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        r =>
          r.identifier.toLowerCase().includes(q) ||
          r.name.toLowerCase().includes(q) ||
          r.currentType?.toLowerCase().includes(q)
      );
    }
    if (filter === 'untagged') {
      rows = rows.filter(r => !r.currentType || r.currentCategory === null);
    } else if (filter === 'suggested') {
      rows = rows.filter(
        r =>
          r.suggestedCategory &&
          r.suggestedCategory !== 'WELLS' &&
          r.suggestedCategory !== r.currentCategory
      );
    }
    return rows;
  }, [allRows, search, filter]);

  const saveMutation = useMutation({
    mutationFn: async ({
      row,
      displayName,
      facilityType,
    }: {
      row: TagRow;
      displayName: string;
      facilityType: string | null;
    }) => {
      if (row.wellId != null) {
        const well = wells?.find(w => w.id === row.wellId);
        if (!well) throw new Error('Well not found');
        return saveEquipmentTag({
          well,
          facilityDbId: row.facilityDbId,
          displayName,
          facilityType,
          districtId,
        });
      }

      if (row.facilityDbId != null) {
        const facility = facilities?.find(f => f.id === row.facilityDbId);
        if (!facility) throw new Error('Facility not found');
        return saveEquipmentTag({
          facility,
          displayName,
          facilityType,
          districtId,
        });
      }

      throw new Error('Cannot save this row');
    },
    onSuccess: (_data, { row }) => {
      void queryClient.invalidateQueries({ queryKey: ['facilities'] });
      void queryClient.invalidateQueries({ queryKey: ['wells'] });
      setPendingTypes(prev => {
        const next = { ...prev };
        delete next[row.key];
        return next;
      });
      setPendingNames(prev => {
        const next = { ...prev };
        delete next[row.key];
        return next;
      });
      toast({ title: 'Saved', description: `${row.identifier} updated.` });
    },
    onError: (err: Error) => {
      toast({
        title: 'Failed to save tag',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  const isLoading = wellsLoading || facilitiesLoading;

  if (!canManageTagging) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          Your role does not include permission to manage equipment tagging. Ask a district
          administrator to enable <strong>manage_equipment_tagging</strong> in the roles matrix.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Equipment & sample location tagging
          </CardTitle>
          <CardDescription>
            Set a display name and equipment type for each well or sample location. Names update the
            well record; types are stored in <code className="text-xs">water_facilities</code> and
            control which Facility Explorer tab each item appears on.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by ID or name..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filter} onValueChange={v => setFilter(v as FilterMode)}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="untagged">Untagged only</SelectItem>
                <SelectItem value="suggested">Name suggests retag</SelectItem>
                <SelectItem value="all">All items</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" asChild>
              <Link to="/wells-explorer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Facility Explorer
              </Link>
            </Button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead className="min-w-[180px]">Display name</TableHead>
                    <TableHead>Current tag</TableHead>
                    <TableHead>Suggestion</TableHead>
                    <TableHead className="min-w-[220px]">Set type</TableHead>
                    <TableHead className="w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                        No items match your filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRows.map(row => {
                      const displayName = pendingNames[row.key] ?? row.name;
                      const selectedType =
                        pendingTypes[row.key] ?? row.currentType ?? row.suggestedType ?? '';
                      const nameChanged = displayName.trim() !== row.name.trim();
                      const typeSelected = Boolean(selectedType);
                      const typeChanged = Boolean(selectedType) && selectedType !== row.currentType;
                      const canSave =
                        nameChanged || typeChanged || (!row.currentType && typeSelected);

                      return (
                        <TableRow key={row.key}>
                          <TableCell className="font-mono text-xs">{row.identifier}</TableCell>
                          <TableCell>
                            <Input
                              value={displayName}
                              onChange={e =>
                                setPendingNames(prev => ({
                                  ...prev,
                                  [row.key]: e.target.value,
                                }))
                              }
                              className="h-9 text-sm"
                              placeholder="Display name"
                            />
                          </TableCell>
                          <TableCell>
                            {row.currentType ? (
                              <Badge variant="outline" className="text-xs">
                                {getFacilityTypeDisplayName(row.currentType)}
                              </Badge>
                            ) : (
                              <span className="text-xs text-amber-600">Untagged</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {row.suggestedType && row.suggestedCategory ? (
                              <span className="text-xs text-gray-600">
                                {getCategoryDisplayName(row.suggestedCategory)} ·{' '}
                                {getFacilityTypeDisplayName(row.suggestedType)}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={selectedType}
                              onValueChange={v =>
                                setPendingTypes(prev => ({ ...prev, [row.key]: v }))
                              }
                            >
                              <SelectTrigger className="h-9 text-xs">
                                <SelectValue placeholder="Select type..." />
                              </SelectTrigger>
                              <SelectContent className="max-h-72">
                                {(Object.keys(EQUIPMENT_CATEGORIES) as EquipmentCategory[]).map(
                                  cat => (
                                    <SelectGroup key={cat}>
                                      <SelectLabel>{getCategoryDisplayName(cat)}</SelectLabel>
                                      {EQUIPMENT_CATEGORIES[cat].map(ftype => (
                                        <SelectItem key={ftype} value={ftype} className="text-xs">
                                          {getFacilityTypeDisplayName(ftype)}
                                        </SelectItem>
                                      ))}
                                    </SelectGroup>
                                  )
                                )}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              disabled={!canSave || !displayName.trim() || saveMutation.isPending}
                              onClick={() =>
                                saveMutation.mutate({
                                  row,
                                  displayName,
                                  facilityType: selectedType || null,
                                })
                              }
                            >
                              Save
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Showing {filteredRows.length} of {allRows.length} items. Untagged wells remain on the
            Wells tab until tagged as non-well equipment.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default DistrictEquipmentTaggingTab;
