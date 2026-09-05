/**
 * District roles & permissions — matrix, list, and custom role CRUD.
 */
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
import { useToast } from '@/components/ui/use-toast';
import {
  createDistrictRole,
  deleteDistrictRole,
  duplicateDistrictRole,
  fetchDistrictRoles,
  fetchPermissionCatalog,
  updateDistrictRole,
  type DistrictRole,
  type PermissionCategory,
} from '@/services/districtRolesService';
import { Check, Copy, LayoutGrid, List, Plus, Search, Shield, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

type ViewMode = 'matrix' | 'list';
type FilterMode = 'all' | 'system' | 'custom';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 50);
}

const emptyForm = {
  display_name: '',
  slug: '',
  description: '',
  parent_role_name: 'district_operator',
  permissions: [] as string[],
};

export function DistrictRolesTab() {
  const { toast } = useToast();
  const [roles, setRoles] = useState<DistrictRole[]>([]);
  const [categories, setCategories] = useState<PermissionCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('matrix');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<DistrictRole | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<DistrictRole | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [roleList, catalog] = await Promise.all([
        fetchDistrictRoles(),
        fetchPermissionCatalog(),
      ]);
      setRoles(roleList);
      setCategories(catalog);
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Failed to load roles',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const systemRoles = useMemo(() => roles.filter(r => r.is_system_role), [roles]);

  const allPermissions = useMemo(() => {
    const keys = new Set<string>();
    for (const cat of categories) {
      for (const p of cat.permissions) keys.add(p.key);
    }
    for (const r of roles) {
      for (const p of r.permissions) keys.add(p);
    }
    return Array.from(keys).sort();
  }, [categories, roles]);

  const filteredRoles = useMemo(() => {
    let list = roles;
    if (filterMode === 'system') list = list.filter(r => r.is_system_role);
    if (filterMode === 'custom') list = list.filter(r => !r.is_system_role);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        r =>
          r.display_name.toLowerCase().includes(q) ||
          r.role_name.toLowerCase().includes(q) ||
          (r.description || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [roles, filterMode, search]);

  const openCreate = () => {
    setEditingRole(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (role: DistrictRole) => {
    setEditingRole(role);
    setForm({
      display_name: role.display_name,
      slug: role.role_name.includes('__') ? role.role_name.split('__')[1] : role.role_name,
      description: role.description || '',
      parent_role_name: role.parent_role_name || 'district_operator',
      permissions: [...role.permissions],
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      if (editingRole) {
        await updateDistrictRole(editingRole.id, {
          display_name: form.display_name,
          description: form.description,
          parent_role_name: form.parent_role_name,
          permissions: form.permissions,
        });
        toast({ title: 'Saved', description: 'Role updated.' });
      } else {
        await createDistrictRole({
          display_name: form.display_name,
          slug: form.slug || slugify(form.display_name),
          description: form.description,
          parent_role_name: form.parent_role_name,
          permissions: form.permissions,
        });
        toast({ title: 'Created', description: 'Custom role created.' });
      }
      setDialogOpen(false);
      await load();
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Save failed',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (role: DistrictRole) => {
    if (role.is_system_role) return;
    try {
      await deleteDistrictRole(role.id);
      toast({ title: 'Deleted', description: `${role.display_name} removed.` });
      setSelected(null);
      await load();
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Delete failed',
        variant: 'destructive',
      });
    }
  };

  const handleDuplicate = async (role: DistrictRole) => {
    const base = `${role.display_name} copy`;
    try {
      await duplicateDistrictRole(role.id, {
        display_name: base,
        slug: slugify(base),
      });
      toast({ title: 'Duplicated', description: 'Role copy created.' });
      await load();
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Duplicate failed',
        variant: 'destructive',
      });
    }
  };

  const togglePermission = (key: string) => {
    setForm(prev => ({
      ...prev,
      permissions: prev.permissions.includes(key)
        ? prev.permissions.filter(p => p !== key)
        : [...prev.permissions, key],
    }));
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-800" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="h-5 w-5 text-blue-600" />
                Roles & permissions
              </CardTitle>
              <CardDescription className="mt-1 max-w-2xl">
                View system roles, compare permissions, and create custom roles that inherit access
                from a parent role. Permission selections document capabilities; enforcement uses
                the parent role until fine-grained checks are enabled.
              </CardDescription>
            </div>
            <Button type="button" onClick={openCreate} className="shrink-0">
              <Plus className="h-4 w-4 mr-1" />
              Create role
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search roles…"
                className="pl-9"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              {(['all', 'system', 'custom'] as const).map(f => (
                <Button
                  key={f}
                  type="button"
                  size="sm"
                  variant={filterMode === f ? 'default' : 'outline'}
                  onClick={() => setFilterMode(f)}
                >
                  {f === 'all' ? 'All' : f === 'system' ? 'System' : 'Custom'}
                </Button>
              ))}
              <Button
                type="button"
                size="sm"
                variant={viewMode === 'matrix' ? 'default' : 'outline'}
                onClick={() => setViewMode('matrix')}
              >
                <LayoutGrid className="h-4 w-4 mr-1" />
                Matrix
              </Button>
              <Button
                type="button"
                size="sm"
                variant={viewMode === 'list' ? 'default' : 'outline'}
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4 mr-1" />
                List
              </Button>
            </div>
          </div>

          {viewMode === 'list' ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredRoles.map(role => (
                <button
                  key={role.id}
                  type="button"
                  className="text-left rounded-lg border p-4 hover:bg-muted/50 transition-colors"
                  onClick={() => setSelected(role)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium">{role.display_name}</span>
                    {role.is_system_role ? (
                      <Badge variant="secondary" className="text-[10px]">
                        System
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">
                        Custom
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {role.description || role.role_name}
                  </p>
                  <div className="flex gap-2 mt-2 text-xs text-muted-foreground">
                    <span>{role.user_count} users</span>
                    <span>·</span>
                    <span>{role.permissions.length} permissions</span>
                  </div>
                  {role.parent_role_name && (
                    <p className="text-xs mt-1">
                      Parent: <span className="font-medium">{role.parent_role_name}</span>
                    </p>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="text-left p-2 sticky left-0 bg-muted/50 min-w-[140px]">
                      Permission
                    </th>
                    {filteredRoles.map(role => (
                      <th
                        key={role.id}
                        className="p-2 text-center min-w-[88px] max-w-[120px] font-medium cursor-pointer hover:bg-muted"
                        onClick={() => setSelected(role)}
                        title={role.role_name}
                      >
                        <span className="line-clamp-2">{role.display_name}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allPermissions.map(perm => (
                    <tr key={perm} className="border-b last:border-0">
                      <td className="p-2 sticky left-0 bg-background font-mono text-[11px]">
                        {perm}
                      </td>
                      {filteredRoles.map(role => (
                        <td key={`${role.id}-${perm}`} className="p-2 text-center">
                          {role.permissions.includes(perm) ? (
                            <Check className="h-4 w-4 text-green-600 mx-auto" />
                          ) : (
                            <X className="h-4 w-4 text-muted-foreground/40 mx-auto" />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={open => !open && setSelected(null)}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.display_name}</DialogTitle>
                <DialogDescription>{selected.role_name}</DialogDescription>
              </DialogHeader>
              <div className="mt-4 space-y-4 text-sm">
                <p>{selected.description || 'No description.'}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{selected.scope}</Badge>
                  {selected.is_system_role ? (
                    <Badge>System role</Badge>
                  ) : (
                    <Badge variant="outline">Custom</Badge>
                  )}
                  <Badge variant="outline">{selected.user_count} users</Badge>
                </div>
                {selected.parent_role_name && (
                  <p>
                    Inherits from: <span className="font-medium">{selected.parent_role_name}</span>
                  </p>
                )}
                <div>
                  <p className="font-medium mb-2">Permissions ({selected.permissions.length})</p>
                  <ul className="max-h-48 overflow-y-auto space-y-1 text-xs font-mono">
                    {selected.permissions.length === 0 ? (
                      <li className="text-muted-foreground">None listed</li>
                    ) : (
                      selected.permissions.map(p => <li key={p}>{p}</li>)
                    )}
                  </ul>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  {!selected.is_system_role && (
                    <Button type="button" size="sm" onClick={() => openEdit(selected)}>
                      Edit
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void handleDuplicate(selected)}
                  >
                    <Copy className="h-3.5 w-3.5 mr-1" />
                    Duplicate
                  </Button>
                  {!selected.is_system_role && selected.user_count === 0 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => void handleDelete(selected)}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRole ? 'Edit role' : 'Create custom role'}</DialogTitle>
            <DialogDescription>
              Custom roles inherit API access from their parent system role. Select permissions to
              document what this role should be allowed to do.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="role_display_name">Display name</Label>
              <Input
                id="role_display_name"
                value={form.display_name}
                onChange={e => {
                  const v = e.target.value;
                  setForm(prev => ({
                    ...prev,
                    display_name: v,
                    slug: editingRole ? prev.slug : slugify(v),
                  }));
                }}
              />
            </div>
            {!editingRole && (
              <div className="space-y-2">
                <Label htmlFor="role_slug">Slug (unique in district)</Label>
                <Input
                  id="role_slug"
                  value={form.slug}
                  onChange={e => setForm(prev => ({ ...prev, slug: e.target.value }))}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="role_description">Description</Label>
              <Input
                id="role_description"
                value={form.description}
                onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role_parent">Parent role (enforcement)</Label>
              <select
                id="role_parent"
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={form.parent_role_name}
                onChange={e => setForm(prev => ({ ...prev, parent_role_name: e.target.value }))}
              >
                {systemRoles.map(r => (
                  <option key={r.role_name} value={r.role_name}>
                    {r.display_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Permissions</Label>
              <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-3">
                {categories.map(cat => (
                  <div key={cat.category_key}>
                    <p className="text-xs font-medium text-muted-foreground mb-1">{cat.name}</p>
                    <div className="flex flex-wrap gap-2">
                      {cat.permissions.map(p => (
                        <label
                          key={p.key}
                          className="flex items-center gap-1 text-xs cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={form.permissions.includes(p.key)}
                            onChange={() => togglePermission(p.key)}
                          />
                          {p.key}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={saving}>
              {saving ? 'Saving…' : editingRole ? 'Save changes' : 'Create role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
