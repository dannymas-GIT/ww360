import { useSDWISLinkedSystems } from '@/hooks/useSDWIS';
import { Ww360PageHero } from '@/components/ww360/Ww360PageHero';
import { Ww360Section } from '@/components/ww360/Ww360Section';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

/** Platform read-only overview of utility-linked PWSIDs (utilities link their own systems). */
export default function AdminPwsidLinksPage() {
  const { data: systems, isLoading } = useSDWISLinkedSystems();

  return (
    <div className="ww360-app-shell mx-auto w-full max-w-[1440px] space-y-6 p-4 md:p-6">
      <Ww360PageHero
        eyebrow="Administration"
        title="Linked utilities overview"
        description="Utilities link their own EPA PWSIDs. Platform and state reviewers use lookup preview and analysis sets — not this link workflow."
        dataMode="live"
      />
      <Ww360Section tourId="pwsid-admin" title="District-linked systems" sources={['ww360']}>
        {isLoading ? (
          <p className="text-base text-slate-600">Loading linked systems…</p>
        ) : !systems?.length ? (
          <p className="text-base text-slate-600">
            No utilities have linked a PWSID yet. District admins link from Water Systems → Our
            water system.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PWSID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>District</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Population</TableHead>
                  <TableHead>Last synced</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {systems.map(s => (
                  <TableRow key={s.pwsid}>
                    <TableCell className="font-mono text-base">{s.pwsid}</TableCell>
                    <TableCell className="text-base">{s.pws_name || '—'}</TableCell>
                    <TableCell className="font-mono text-base">{s.district_code || '—'}</TableCell>
                    <TableCell className="text-base">{s.state_code || '—'}</TableCell>
                    <TableCell className="text-base">{s.population_served ?? '—'}</TableCell>
                    <TableCell className="text-base whitespace-nowrap">
                      {s.last_synced_at || '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Ww360Section>
    </div>
  );
}
