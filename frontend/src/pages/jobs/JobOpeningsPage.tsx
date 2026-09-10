import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, ExternalLink, Link2 } from 'lucide-react';
import { Ww360PageHero } from '@/components/ww360/Ww360PageHero';
import { Ww360Section } from '@/components/ww360/Ww360Section';
import { Ww360SourceChip } from '@/components/ww360/Ww360SourceChip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { UsajobsJobListingsPanel } from '@/pages/workspaces/UsajobsJobListingsPanel';

type SourceTab = 'all' | 'usajobs' | 'oww' | 'utility';

const SOURCES: Array<{
  id: SourceTab;
  label: string;
  status: 'live' | 'coming';
  blurb: string;
}> = [
  {
    id: 'all',
    label: 'All sources',
    status: 'live',
    blurb: 'Combined view of federal, section, and utility openings as each feed comes online.',
  },
  {
    id: 'usajobs',
    label: 'USAJOBS (federal)',
    status: 'live',
    blurb: 'Federal water and wastewater operator announcements from USAJOBS.gov.',
  },
  {
    id: 'oww',
    label: 'One Water Workforce',
    status: 'coming',
    blurb: 'Section and program job board from onewaterworkforce.org — connection pending.',
  },
  {
    id: 'utility',
    label: 'Utility vacancies',
    status: 'coming',
    blurb: 'Open roles from Continuity / WW360 member utilities — will surface when districts publish vacancies.',
  },
];

export default function JobOpeningsPage() {
  const [tab, setTab] = useState<SourceTab>('all');

  const showUsajobs = tab === 'all' || tab === 'usajobs';
  const showOww = tab === 'all' || tab === 'oww';
  const showUtility = tab === 'all' || tab === 'utility';

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 p-4 md:p-6" data-tour="jobs-page">
      <Ww360PageHero
        eyebrow="Careers"
        title="Job openings"
        description="Operator and plant roles from federal, section, and utility sources — each listing tagged with its source so you always know where it came from."
        dataMode="mixed"
      />

      <Ww360Section
        title="Sources"
        description="More feeds will appear here as we connect OWW and utility Continuity vacancies."
        dataMode="mixed"
      >
        <div className="flex flex-wrap gap-2 px-5 pb-5">
          {SOURCES.map(s => (
            <Button
              key={s.id}
              type="button"
              variant={tab === s.id ? 'default' : 'outline'}
              className="min-h-[44px] text-base"
              onClick={() => setTab(s.id)}
            >
              {s.label}
              {s.status === 'coming' && (
                <Badge variant="secondary" className="ml-2 text-sm">
                  Coming soon
                </Badge>
              )}
            </Button>
          ))}
        </div>
        <p className="px-5 pb-5 text-[1.125rem] leading-relaxed text-slate-600">
          {SOURCES.find(s => s.id === tab)?.blurb}
        </p>
      </Ww360Section>

      {showUsajobs && <UsajobsJobListingsPanel tourId="jobs-page-usajobs" />}

      {showOww && (
        <Ww360Section
          title="One Water Workforce job board"
          description="Member and pathway openings from onewaterworkforce.org."
          dataMode="sample"
        >
          <div className="space-y-4 px-5 pb-5">
            <div className="flex flex-wrap items-center gap-2">
              <Ww360SourceChip id="oww-web" />
              <Badge variant="outline" className="text-sm">
                Not connected yet
              </Badge>
            </div>
            <p className="text-[1.125rem] leading-relaxed text-slate-600">
              When the OWW job board API (or approved partner feed) is available, listings will
              appear here alongside federal roles — same page, clear source badges.
            </p>
            <Button asChild variant="outline" className="min-h-[44px] text-base">
              <a
                href="https://onewaterworkforce.org"
                target="_blank"
                rel="noreferrer"
              >
                Visit onewaterworkforce.org
                <ExternalLink className="ml-2 h-4 w-4" aria-hidden />
              </a>
            </Button>
          </div>
        </Ww360Section>
      )}

      {showUtility && (
        <Ww360Section
          title="Utility vacancies"
          description="Open positions published by member utilities in Continuity."
          dataMode="sample"
        >
          <div className="space-y-4 px-5 pb-5">
            <div className="flex flex-wrap items-center gap-2">
              <Ww360SourceChip id="ww360" />
              <Badge variant="outline" className="text-sm">
                Coming soon
              </Badge>
            </div>
            <p className="text-[1.125rem] leading-relaxed text-slate-600">
              Continuity already tracks vacancies and succession. A feed from those records will
              list member-utility openings here so partners and operators see demand in one place.
            </p>
            <Button asChild variant="outline" className="min-h-[44px] text-base">
              <Link to="/continuity">
                <Link2 className="mr-2 h-4 w-4" aria-hidden />
                Open Continuity workspace
              </Link>
            </Button>
          </div>
        </Ww360Section>
      )}

      <p className="flex items-start gap-2 text-[1rem] text-slate-500">
        <Briefcase className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        Tip: add the Federal job openings panel to your home via Customize home, or bookmark this
        Careers page from the sidebar.
      </p>
    </div>
  );
}
