import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useJurisdiction } from '@/context/JurisdictionContext';
import { DistrictPwsLinkConfigSection } from '@/components/admin/DistrictPwsLinkConfigSection';
import { Ww360PageHero } from '@/components/ww360/Ww360PageHero';
import { Ww360Section } from '@/components/ww360/Ww360Section';
import { Button } from '@/components/ui/button';

export default function SdwisLookupPage() {
  const { activeState } = useJurisdiction();
  const { isDistrictManager, actingDistrictCode, user } = useAuth();
  const utilityDistrict = actingDistrictCode || user?.districts?.[0] || undefined;
  return (
    <div className="ww360-app-shell mx-auto w-full max-w-[1440px] space-y-6 p-4 md:p-6">
      <Ww360PageHero
        eyebrow="EPA lookup"
        title="System lookup"
        description="Search EPA SDWIS by name or PWSID and choose a system to view landscape compliance fields."
        dataMode="live"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-white/20 bg-white/5 text-white hover:bg-white/15 min-h-[44px] md:min-h-9"
              asChild
            >
              <Link to="/water-systems">Landscape</Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-white/20 bg-white/5 text-white hover:bg-white/15 min-h-[44px] md:min-h-9"
              asChild
            >
              <Link to="/water-systems/compliance">Compliance viewer</Link>
            </Button>
          </div>
        }
      />
      <Ww360Section tourId="pwsid-lookup" title="Search & select" sources={['ww360']}>
        <DistrictPwsLinkConfigSection
          showComplianceLink
          stateCode={activeState}
          autoSuggestPws={false}
          mode={isDistrictManager ? 'link' : 'select'}
          lockedDistrictCode={isDistrictManager ? utilityDistrict : undefined}
        />
      </Ww360Section>
    </div>
  );
}
