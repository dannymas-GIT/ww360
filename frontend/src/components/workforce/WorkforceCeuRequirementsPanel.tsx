import { useCeuRequirements } from '@/hooks/useWorkforceSuccession';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GradeBadge, RoleIcon } from '@/components/workforce/workforceBadges';

export function WorkforceCeuRequirementsPanel() {
  const requirementsQuery = useCeuRequirements();

  if (requirementsQuery.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">NYS operator CEU requirements</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-500">Loading requirements…</CardContent>
      </Card>
    );
  }

  if (requirementsQuery.isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">NYS operator CEU requirements</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-red-600">
          Could not load CEU requirements reference. Try refreshing the page.
        </CardContent>
      </Card>
    );
  }

  const data = requirementsQuery.data;
  if (!data) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">NYS operator CEU requirements</CardTitle>
        <CardDescription className="text-xs leading-relaxed space-y-2">
          <p>
            Fixed {data.renewal_cycle_years}-year renewal cycle per {data.state_citation}. Federal
            baseline: {data.federal_citation}
          </p>
          {data.regulation_sources?.section_5_4_8 ? (
            <p>
              Official source:{' '}
              <a
                href={data.regulation_sources.section_5_4_8}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                10 NYCRR §5-4.8 (Table 5-4.8)
              </a>
              {' · '}
              <a
                href={data.regulation_sources.subpart_5_4}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Subpart 5-4
              </a>
            </p>
          ) : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.scope_notes?.length ? (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 space-y-2">
            <p className="font-medium text-slate-900">Scope and limits</p>
            <ul className="list-disc pl-4 space-y-1">
              {data.scope_notes.map(note => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {data.roles.map(role => (
          <div key={role.role_key} className="rounded-md border p-3">
            <div className="mb-2 flex items-center gap-2">
              <RoleIcon roleKey={role.role_key} />
              <div>
                <p className="font-medium">{role.role_title}</p>
                <p className="text-xs text-gray-500">{role.issuing_authority}</p>
              </div>
            </div>
            <p className="mb-2 text-xs text-gray-600">{role.description}</p>
            <div className="space-y-2">
              {role.grades.map(grade => (
                <div
                  key={`${role.role_key}-${grade.grade}`}
                  className="flex flex-wrap items-start gap-2 border-t pt-2 first:border-t-0 first:pt-0"
                >
                  <GradeBadge grade={grade.grade} />
                  <span className="text-sm font-medium">{grade.required_ceu} CEU</span>
                  <span className="text-xs text-gray-500 capitalize">
                    ({grade.cert_type.replace(/_/g, ' ')})
                  </span>
                  {grade.mandatory_categories.length > 0 ? (
                    <ul className="w-full text-xs text-amber-800">
                      {grade.mandatory_categories.map(m => (
                        <li key={m.category}>
                          {m.minimum_ceu} CEU required in {m.category}
                          {m.notes ? ` — ${m.notes}` : ''}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {grade.acceptable_categories.length > 0 ? (
                    <p className="w-full text-xs text-gray-500">
                      Approved categories: {grade.acceptable_categories.join(' · ')}
                    </p>
                  ) : null}
                  {grade.notes ? (
                    <p className="w-full text-xs italic text-gray-500">{grade.notes}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
