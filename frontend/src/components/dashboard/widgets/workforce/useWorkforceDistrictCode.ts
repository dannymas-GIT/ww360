import { useAuth } from '@/context/AuthContext';
import { useDistricts } from '@/hooks/useDistricts';
import { resolveWorkforceDistrictCode } from '@/components/dashboard/widgets/workforce/resolveWorkforceDistrictCode';

export function useWorkforceDistrictCode(configDistrictCode?: string): string {
  const { actingDistrictCode } = useAuth();
  const { data: districts } = useDistricts();
  if (configDistrictCode?.trim()) {
    return configDistrictCode.trim();
  }
  return resolveWorkforceDistrictCode(districts, { actingDistrictCode });
}
