import { DistrictPwsLinkConfigSection } from '@/components/admin/DistrictPwsLinkConfigSection';
import { Ww360PageHero } from '@/components/ww360/Ww360PageHero';
import { Ww360Section } from '@/components/ww360/Ww360Section';

export default function AdminPwsidLinksPage() {
  return (
    <div className="ww360-app-shell mx-auto w-full max-w-[1440px] space-y-6 p-4 md:p-6">
      <Ww360PageHero
        eyebrow="Administration"
        title="Utilities & PWSID links"
        description="Link member utilities to EPA SDWIS public water system IDs for compliance watchlists."
        dataMode="live"
      />
      <Ww360Section tourId="pwsid-admin" title="Link utilities" sources={['ww360']}>
        <DistrictPwsLinkConfigSection />
      </Ww360Section>
    </div>
  );
}
