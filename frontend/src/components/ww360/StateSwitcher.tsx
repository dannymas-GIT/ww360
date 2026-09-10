import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { useJurisdiction } from '@/context/JurisdictionContext';
import { fetchJurisdictionList } from '@/services/jurisdictionService';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export const StateSwitcher: React.FC = () => {
  const { user, isPlatformAdmin, userRoles } = useAuth();
  const { activeState, switchState } = useJurisdiction();
  const [states, setStates] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);

  const canSwitch =
    isPlatformAdmin ||
    userRoles.includes('national_observer') ||
    (user?.orgs?.length ?? 0) > 1 ||
    Boolean(user?.is_national_admin);

  React.useEffect(() => {
    if (!canSwitch) return;
    void fetchJurisdictionList()
      .then(data => setStates(data.states))
      .catch(() => setStates(['NY', 'NJ']));
  }, [canSwitch]);

  if (!canSwitch) return null;

  const options = [...states];
  if (isPlatformAdmin || userRoles.includes('national_observer')) {
    if (!options.includes('US')) options.unshift('US');
  }

  if (options.length < 2) return null;

  return (
    <div className="px-3 pb-2">
      <label className="text-[10px] uppercase tracking-wider text-slate-400 block mb-1">
        Primacy state
      </label>
      <Select
        value={activeState}
        disabled={busy}
        onValueChange={val => {
          if (val === activeState) return;
          if (val === 'US') {
            window.location.href = '/national';
            return;
          }
          setBusy(true);
          void switchState(val)
            .catch(() => {})
            .finally(() => setBusy(false));
        }}
      >
        <SelectTrigger className="h-9 bg-white/5 border-white/10 text-white text-xs">
          <SelectValue placeholder="State" />
        </SelectTrigger>
        <SelectContent>
          {options.map(s => (
            <SelectItem key={s} value={s}>
              {s === 'US' ? 'United States' : s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
