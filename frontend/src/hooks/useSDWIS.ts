import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SDWISDistrictRememberedPwsid } from '@/services/sdwisService';
import {
  addAnalysisSetItem,
  createAnalysisSet,
  updateAnalysisSet,
  deleteAnalysisSet,
  fetchAnalysisSet,
  fetchAnalysisSets,
  fetchComplianceSummary,
  fetchDistrictRememberedPwsids,
  fetchEnforcement,
  fetchLinkedSystems,
  fetchPwsPreview,
  fetchSystemDetail,
  fetchViolations,
  linkSystem,
  lookupSystems,
  removeAnalysisSetItem,
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
  preview: (pwsid: string, state?: string) =>
    [...sdwisKeys.all, 'preview', pwsid, state || ''] as const,
  analysisSets: () => [...sdwisKeys.all, 'analysis-sets'] as const,
  analysisSet: (id: number) => [...sdwisKeys.all, 'analysis-set', id] as const,
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

export function useSDWISPreview(pwsid: string | null, state?: string) {
  const pid = (pwsid || '').trim().toUpperCase();
  return useQuery({
    queryKey: sdwisKeys.preview(pid, state),
    queryFn: () => fetchPwsPreview(pid, state),
    enabled: pid.length >= 7,
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });
}

export function useSDWISAnalysisSets(enabled = true) {
  return useQuery({
    queryKey: sdwisKeys.analysisSets(),
    queryFn: fetchAnalysisSets,
    enabled,
  });
}

export function useSDWISAnalysisSet(id: number | null) {
  return useQuery({
    queryKey: sdwisKeys.analysisSet(id || 0),
    queryFn: () => fetchAnalysisSet(id!),
    enabled: !!id,
    staleTime: 60 * 1000,
  });
}

export function useCreateAnalysisSet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => createAnalysisSet(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: sdwisKeys.analysisSets() });
    },
  });
}

export function useUpdateAnalysisSet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => updateAnalysisSet(id, name),
    onSuccess: data => {
      qc.invalidateQueries({ queryKey: sdwisKeys.analysisSets() });
      qc.invalidateQueries({ queryKey: sdwisKeys.analysisSet(data.id) });
    },
  });
}

export function useAddAnalysisSetItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      setId,
      item,
    }: {
      setId: number;
      item: {
        pwsid: string;
        pws_name?: string | null;
        state_code?: string | null;
        population_served?: number | null;
        snc?: string | null;
      };
    }) => addAnalysisSetItem(setId, item),
    onSuccess: (_data, { setId }) => {
      qc.invalidateQueries({ queryKey: sdwisKeys.analysisSets() });
      qc.invalidateQueries({ queryKey: sdwisKeys.analysisSet(setId) });
    },
  });
}

export function useRemoveAnalysisSetItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ setId, pwsid }: { setId: number; pwsid: string }) =>
      removeAnalysisSetItem(setId, pwsid),
    onSuccess: (_data, { setId }) => {
      qc.invalidateQueries({ queryKey: sdwisKeys.analysisSets() });
      qc.invalidateQueries({ queryKey: sdwisKeys.analysisSet(setId) });
    },
  });
}

export function useDeleteAnalysisSet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteAnalysisSet(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: sdwisKeys.analysisSets() });
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
