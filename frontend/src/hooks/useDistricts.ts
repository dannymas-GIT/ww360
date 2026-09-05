import { useQuery } from '@tanstack/react-query';
import { fetchAccessibleDistricts } from '@/services/districtService';

export const districtKeys = {
  all: ['districts', 'accessible'] as const,
};

export function useDistricts() {
  return useQuery({
    queryKey: districtKeys.all,
    queryFn: fetchAccessibleDistricts,
    staleTime: 5 * 60 * 1000,
  });
}
