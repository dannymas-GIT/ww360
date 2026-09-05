import { useAuth } from '@/context/AuthContext';
import { useDistricts } from '@/hooks/useDistricts';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Building2, Loader2 } from 'lucide-react';
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';

/**
 * Persistent banner for global admins showing the current acting district
 * with a dropdown to switch JWT context.
 */
export const ActingDistrictBanner: React.FC = () => {
  const {
    isGlobalAdmin,
    isSystemAdmin,
    actingDistrictCode,
    actingDistrictName,
    switchDistrict,
    isSwitchingDistrict,
    isOwwPartner,
  } = useAuth();
  const { data: districts, isLoading: districtsLoading } = useDistricts();

  // Program partners (OWW) hold platform_admin for privileges but work at the
  // program level, not inside one district — the acting-district strip is noise.
  const show = (isGlobalAdmin || isSystemAdmin) && !isOwwPartner;
  const districtList = useMemo(() => {
    if (!districts?.length) return [];
    return [...districts].sort((a, b) =>
      (a.district_name || a.district_code).localeCompare(b.district_name || b.district_code)
    );
  }, [districts]);

  if (!show) {
    return null;
  }

  const label = actingDistrictCode
    ? actingDistrictName
      ? `${actingDistrictCode} — ${actingDistrictName}`
      : actingDistrictCode
    : 'No district selected';

  return (
    <div
      className={`no-print border-b shadow-sm ${
        actingDistrictCode
          ? 'bg-amber-500 text-amber-950 border-amber-600'
          : 'bg-red-500 text-red-50 border-red-700'
      }`}
    >
      <div className="container mx-auto px-4 py-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Building2 className="w-4 h-4 shrink-0" />
          <span>Working in:</span>
          <span className="font-bold">{label}</span>
          {!actingDistrictCode && (
            <span className="font-normal text-xs opacity-95">
              — select a district to scope Lab workflow and admin tools
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {actingDistrictCode ? (
            <Link
              to="/dashboard/district-admin/utilities"
              className="text-xs font-semibold underline underline-offset-2 hover:opacity-90"
            >
              District admin hub
            </Link>
          ) : null}
          <span className="text-xs font-medium opacity-90">
            {actingDistrictCode ? 'Switch district' : 'Select district'}
          </span>
          {districtsLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Select
              value={actingDistrictCode || undefined}
              onValueChange={code => {
                if (code && code !== actingDistrictCode) {
                  void switchDistrict(code);
                }
              }}
              disabled={isSwitchingDistrict}
            >
              <SelectTrigger
                className={`h-8 w-[220px] text-xs ${
                  actingDistrictCode
                    ? 'bg-amber-50 text-amber-950 border-amber-700'
                    : 'bg-white text-red-950 border-red-200'
                }`}
              >
                <SelectValue placeholder="Select district" />
              </SelectTrigger>
              <SelectContent>
                {districtList.map(d => (
                  <SelectItem key={d.district_code} value={d.district_code}>
                    {d.district_code} — {d.district_name || d.district_code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>
    </div>
  );
};

export default ActingDistrictBanner;
