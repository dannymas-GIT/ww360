import React from 'react';
import { DistrictPwsLinkConfigSection } from '@/components/admin/DistrictPwsLinkConfigSection';
import { PageHeader } from '@/components/PageHeader';

export default function AdminPwsidLinksPage() {
  return (
    <div className="max-w-5xl mx-auto p-6 md:p-8">
      <PageHeader
        title="Utilities & PWSID links"
        description="Link member utilities to EPA SDWIS public water system IDs for compliance watchlists."
      />
      <DistrictPwsLinkConfigSection />
    </div>
  );
}
