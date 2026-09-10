/**
 * In-app SDWIS preview — violations and enforcement without external EPA links.
 */
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { SDWISPreview } from '@/services/sdwisService';

export function PwsPreviewPanel({ preview }: { preview: SDWISPreview }) {
  return (
    <div className="space-y-4">
      <div className="rounded-md border border-sky-200 bg-sky-50/80 px-3 py-3 text-base leading-relaxed text-slate-800">
        <p className="font-medium text-slate-900">
          <span className="font-mono">{preview.pwsid}</span>
          {preview.pws_name ? ` — ${preview.pws_name}` : ''}
        </p>
        <div className="mt-2 grid gap-1 sm:grid-cols-2 lg:grid-cols-3 text-slate-700">
          <p>State: {preview.state_code || '—'}</p>
          <p>Population: {preview.population_served ?? '—'}</p>
          <p>SNC: {preview.snc ?? '—'}</p>
          <p>Health flag: {preview.health_flag ?? '—'}</p>
          <p>Facility status: {preview.facility_status ?? '—'}</p>
          <p>Open violations: {preview.open_violation_count}</p>
        </div>
        <p className="mt-2 text-sm text-slate-600">
          {preview.preview_only
            ? 'Session preview from EPA data — not linked to your district.'
            : 'Linked system data in WW360.'}
          {preview.is_linked ? ' This PWSID is linked for a utility district.' : ''}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-base font-semibold text-slate-900">Violations</h3>
          <div className="overflow-x-auto rounded-md border">
            {!preview.violations.length ? (
              <p className="p-3 text-base text-slate-600">No violations returned.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[120px]">Contaminant / rule</TableHead>
                    <TableHead className="hidden md:table-cell">Category</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.violations.slice(0, 50).map(v => (
                    <TableRow key={v.violation_epa_id}>
                      <TableCell className="max-w-[220px] align-top text-base">
                        {v.contaminant_name || v.rule_name || '—'}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-base">
                        {v.category_desc || v.category_code || '—'}
                      </TableCell>
                      <TableCell className="text-base">{v.status || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-base font-semibold text-slate-900">Enforcement</h3>
          <div className="overflow-x-auto rounded-md border">
            {!preview.enforcement_actions.length ? (
              <p className="p-3 text-base text-slate-600">No enforcement actions returned.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.enforcement_actions.slice(0, 50).map(e => (
                    <TableRow key={e.enforcement_epa_id}>
                      <TableCell className="whitespace-nowrap text-base">
                        {e.action_date || '—'}
                      </TableCell>
                      <TableCell className="text-base">{e.enforcement_type || '—'}</TableCell>
                      <TableCell className="max-w-[220px] text-base">
                        {e.action_description || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
