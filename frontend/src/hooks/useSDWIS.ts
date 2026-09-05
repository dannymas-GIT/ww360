import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SDWISDistrictRememberedPwsid } from '@/services/sdwisService';
import {
  fetchComplianceSummary,
  fetchDistrictRememberedPwsids,
  fetchEnforcement,
  fetchLinkedSystems,
  fetchSystemDetail,
  fetchViolations,
  linkSystem,
  lookupSystems,
  saveDistrictRememberedPwsid,
  syncSystem,
} from '@/services/sdwisService';

export const sdwisKeys = {
  all: ['sdwis'] as const,
  systems: () => [...sdwisKeys.all, 'systems'] as const,
  rememberedPwsids: () => [...sdwisKeys.all, 'district-remembered-pwsids'] as const,
  system: (pwsid: string) => [...sdwisKeys.all, 'system', pwsid] as const,
  violations: (pwsid: string) => [...sdwisKeys.all, 'violations', pwsid] as const,
  enforcement: (pwsid: string) => [...sdwisKeys.all, 'enforcement', pwsid] as const,
  summary: () => [...sdwisKeys.all, 'summary'] as const,
  lookup: (state: string, q: string) => [...sdwisKeys.all, 'lookup', state, q] as const,
};

export function useSDWISLinkedSystems() {
  return useQuery({
    queryKey: sdwisKeys.systems(),
    queryFn: fetchLinkedSystems,
  });
}

export function useSDWISystemDetail(pwsid: string | null) {
  return useQuery({
    queryKey: sdwisKeys.system(pwsid || ''),
    queryFn: () => fetchSystemDetail(pwsid!),
    enabled: !!pwsid,
  });
}

export function useSDWISViolations(pwsid: string | null) {
  return useQuery({
    queryKey: sdwisKeys.violations(pwsid || ''),
    queryFn: () => fetchViolations(pwsid!, { limit: 500 }),
    enabled: !!pwsid,
  });
}

export function useSDWISEnforcement(pwsid: string | null) {
  return useQuery({
    queryKey: sdwisKeys.enforcement(pwsid || ''),
    queryFn: () => fetchEnforcement(pwsid!, { limit: 500 }),
    enabled: !!pwsid,
  });
}

export function useSDWISComplianceSummary() {
  return useQuery({
    queryKey: sdwisKeys.summary(),
    queryFn: fetchComplianceSummary,
  });
}

export function useSDWISLookup(state: string, q: string, enabled: boolean) {
  const trimmedQ = q.trim();
  const canSearch = enabled && state.length === 2 && trimmedQ.length >= 2;
  return useQuery({
    queryKey: sdwisKeys.lookup(state, trimmedQ),
    queryFn: () => lookupSystems(state, trimmedQ),
    enabled: canSearch,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useSDWISDistrictRememberedPwsids() {
  return useQuery({
    queryKey: sdwisKeys.rememberedPwsids(),
    queryFn: fetchDistrictRememberedPwsids,
    staleTime: 30 * 1000,
  });
}

export function useSaveDistrictRememberedPwsid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ districtCode, pwsid }: { districtCode: string; pwsid: string }) =>
      saveDistrictRememberedPwsid(districtCode, pwsid),
    onSuccess: saved => {
      // Update cache only — invalidating here caused endless GET/PUT loops with debounced save.
      qc.setQueryData<SDWISDistrictRememberedPwsid[]>(sdwisKeys.rememberedPwsids(), old => {
        const list = old ?? [];
        const i = list.findIndex(r => r.district_code === saved.district_code);
        if (i >= 0) {
          const next = [...list];
          next[i] = saved;
          return next;
        }
        return [...list, saved].sort((a, b) => a.district_code.localeCompare(b.district_code));
      });
    },
  });
}

export function useLinkSDWISSystem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pwsid, districtCode }: { pwsid: string; districtCode?: string }) =>
      linkSystem(pwsid, districtCode),
    onSuccess: (_data, { pwsid }) => {
      const pid = pwsid.trim().toUpperCase();
      // Avoid invalidating sdwisKeys.all — that refetches remembered-pwsids and retriggers debounced PUTs.
      qc.invalidateQueries({ queryKey: sdwisKeys.systems() });
      qc.invalidateQueries({ queryKey: sdwisKeys.summary() });
      qc.invalidateQueries({ queryKey: sdwisKeys.system(pid) });
      qc.invalidateQueries({ queryKey: sdwisKeys.violations(pid) });
      qc.invalidateQueries({ queryKey: sdwisKeys.enforcement(pid) });
    },
  });
}

export function useSyncSDWISSystem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pwsid: string) => syncSystem(pwsid),
    onSuccess: (_d, pwsid) => {
      qc.invalidateQueries({ queryKey: sdwisKeys.system(pwsid) });
      qc.invalidateQueries({ queryKey: sdwisKeys.violations(pwsid) });
      qc.invalidateQueries({ queryKey: sdwisKeys.enforcement(pwsid) });
      qc.invalidateQueries({ queryKey: sdwisKeys.summary() });
      qc.invalidateQueries({ queryKey: sdwisKeys.systems() });
    },
  });
}
