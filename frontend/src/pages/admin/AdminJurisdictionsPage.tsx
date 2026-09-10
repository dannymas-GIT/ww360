import { useEffect, useMemo, useState } from 'react';
import { Ww360PageHero } from '@/components/ww360/Ww360PageHero';
import { Ww360Section } from '@/components/ww360/Ww360Section';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/context/AuthContext';
import {
  fetchAdminJurisdictions,
  fetchOrgMembers,
  patchAdminJurisdiction,
  type AdminJurisdiction,
  type OrgMember,
} from '@/services/jurisdictionService';
import { fetchAdminUsers, type AdminUser } from '@/services/adminUsersService';

export default function AdminJurisdictionsPage() {
  const { isPlatformAdmin } = useAuth();
  const [rows, setRows] = useState<AdminJurisdiction[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([fetchAdminJurisdictions(), fetchAdminUsers()])
      .then(([j, u]) => {
        setRows(j);
        setUsers(u);
        if (!selectedOrg && j.length) setSelectedOrg(j[0].org_code);
      })
      .catch(() => setError('Platform admin required to manage jurisdictions.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isPlatformAdmin) load();
    else {
      setLoading(false);
      setError('Platform admin role required.');
    }
  }, [isPlatformAdmin]);

  useEffect(() => {
    if (!selectedOrg || !isPlatformAdmin) return;
    void fetchOrgMembers(selectedOrg).then(setMembers).catch(() => setMembers([]));
  }, [selectedOrg, isPlatformAdmin]);

  const selected = useMemo(
    () => rows.find(r => r.org_code === selectedOrg) ?? null,
    [rows, selectedOrg]
  );

  const toggleActive = async (org: AdminJurisdiction) => {
    setBusy(true);
    try {
      const updated = await patchAdminJurisdiction(org.org_code, { is_active: !org.is_active });
      setRows(prev => prev.map(r => (r.org_code === updated.org_code ? updated : r)));
    } catch {
      setError('Failed to update jurisdiction.');
    } finally {
      setBusy(false);
    }
  };

  const assignStateAdmin = async (userId: number) => {
    if (!selectedOrg) return;
    setBusy(true);
    try {
      const { addOrgMember } = await import('@/services/jurisdictionService');
      const mem = await addOrgMember(selectedOrg, userId, 'state_admin');
      setMembers(prev => [...prev.filter(m => m.user_id !== userId), mem]);
    } catch {
      setError('Failed to assign state admin.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ww360-app-shell mx-auto w-full max-w-[1440px] space-y-6 p-4 md:p-6">
      <Ww360PageHero
        eyebrow="Administration"
        title="State primacy jurisdictions"
        description="National platform admins create and activate state program orgs. State admins see exec and landscape for their primacy state only."
        dataMode="live"
        actions={
          isPlatformAdmin ? (
            <Button
              variant="outline"
              size="sm"
              className="border-white/20 bg-white/5 text-white hover:bg-white/15 min-h-[44px] md:min-h-9"
              onClick={load}
              disabled={loading}
            >
              Reload
            </Button>
          ) : null
        }
      />

      {error && (
        <p className="text-sm text-amber-800 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Ww360Section tourId="jurisdictions-list" title="Program organizations">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>State</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(org => (
                  <TableRow
                    key={org.org_code}
                    className={selectedOrg === org.org_code ? 'bg-slate-50' : undefined}
                  >
                    <TableCell className="font-mono">{org.state_code}</TableCell>
                    <TableCell>
                      <button
                        type="button"
                        className="text-left font-medium hover:underline"
                        onClick={() => setSelectedOrg(org.org_code)}
                      >
                        {org.name}
                      </button>
                      <div className="text-xs text-slate-500">{org.org_code}</div>
                    </TableCell>
                    <TableCell>{org.is_active ? 'Active' : 'Inactive'}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => void toggleActive(org)}
                      >
                        {org.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Ww360Section>

          <Ww360Section tourId="jurisdiction-members" title="State admin assignments">
            {selected ? (
              <>
                <p className="text-sm text-slate-600 mb-4">
                  {selected.name} ({selected.state_code}) · pack {selected.content_pack_key} ·{' '}
                  {selected.district_count} districts · {selected.member_count} admins
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Role</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map(m => (
                      <TableRow key={m.id}>
                        <TableCell>{m.username}</TableCell>
                        <TableCell>{m.role}</TableCell>
                      </TableRow>
                    ))}
                    {!members.length && (
                      <TableRow>
                        <TableCell colSpan={2} className="text-slate-500 text-sm">
                          No org memberships yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                <div className="mt-4 space-y-2">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Assign state admin</p>
                  <div className="flex flex-wrap gap-2">
                    {users
                      .filter(u => u.is_active && !members.some(m => m.user_id === u.id))
                      .slice(0, 8)
                      .map(u => (
                        <Button
                          key={u.id}
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() => void assignStateAdmin(u.id)}
                        >
                          {u.username}
                        </Button>
                      ))}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-500">Select an organization.</p>
            )}
          </Ww360Section>
        </div>
      )}
    </div>
  );
}
