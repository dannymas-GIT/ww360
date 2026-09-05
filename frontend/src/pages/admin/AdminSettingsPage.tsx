import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Ww360PageHero } from '@/components/ww360/Ww360PageHero';
import { Ww360Section } from '@/components/ww360/Ww360Section';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/AuthContext';
import { refreshSdwisState } from '@/services/sdwisService';

export default function AdminSettingsPage() {
  const { isPlatformAdmin } = useAuth();
  const [state, setState] = useState('NY');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const onRefresh = async () => {
    if (!isPlatformAdmin) {
      setMessage('Platform admin required to refresh SDWIS landscape.');
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const result = await refreshSdwisState(state.trim().toUpperCase().slice(0, 2) || 'NY');
      setMessage(
        `Refreshed ${result.state}: ${result.systems_refreshed.toLocaleString()} systems cached.`
      );
    } catch {
      setMessage('Refresh failed. Check API logs and EPA connectivity.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ww360-app-shell mx-auto w-full max-w-[1440px] space-y-6 p-4 md:p-6">
      <Ww360PageHero
        eyebrow="Administration"
        title="Settings"
        description="Operational controls for WW360 staging — SDWIS landscape cache and admin shortcuts."
        dataMode="live"
      />

      <Ww360Section tourId="sdwis-refresh" title="SDWIS state landscape">
        <p className="text-sm text-slate-600 mb-4">
          Pulls EPA ECHO / SDWIS Fed inventory for a state into the WW360 cache used by Landscape,
          Watchlist, and the executive dashboard strip. Nightly jobs also refresh this.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="sdwis-state">State</Label>
            <Input
              id="sdwis-state"
              value={state}
              onChange={e => setState(e.target.value.toUpperCase())}
              maxLength={2}
              className="w-20 font-mono uppercase min-h-[44px]"
            />
          </div>
          <Button
            onClick={() => void onRefresh()}
            disabled={busy || !isPlatformAdmin}
            className="min-h-[44px] bg-[#2563eb] hover:bg-[#1d4ed8]"
          >
            {busy ? 'Refreshing…' : 'Refresh landscape now'}
          </Button>
        </div>
        {message && (
          <p className="text-sm text-emerald-800 mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
            {message}
          </p>
        )}
        {!isPlatformAdmin && (
          <p className="text-xs text-amber-700 mt-2">
            Signed-in user needs platform_admin to run refresh.
          </p>
        )}
      </Ww360Section>

      <Ww360Section tourId="admin-shortcuts" title="Shortcuts">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="min-h-[44px] md:min-h-9" asChild>
            <Link to="/admin/pwsid-links">PWSID links</Link>
          </Button>
          <Button variant="outline" size="sm" className="min-h-[44px] md:min-h-9" asChild>
            <Link to="/admin/users">Users & access</Link>
          </Button>
          <Button variant="outline" size="sm" className="min-h-[44px] md:min-h-9" asChild>
            <Link to="/water-systems">Water system landscape</Link>
          </Button>
          <Button variant="outline" size="sm" className="min-h-[44px] md:min-h-9" asChild>
            <Link to="/continuity">Continuity workspace</Link>
          </Button>
        </div>
      </Ww360Section>
    </div>
  );
}
