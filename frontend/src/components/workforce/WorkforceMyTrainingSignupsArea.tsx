import { Calendar, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useMyTrainingEnrollments } from '@/hooks/useWorkforceSuccession';
import {
  DeliveryModeBadge,
  GradeBadge,
  TrainingStatusBadge,
} from '@/components/workforce/workforceBadges';

interface Props {
  districtCode: string;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function sourceBadge(source: string | null | undefined) {
  if (source === 'Learning Stream') {
    return (
      <Badge variant="secondary" className="bg-teal-100 text-teal-800">
        Learning Stream
      </Badge>
    );
  }
  return null;
}

export function WorkforceMyTrainingSignupsArea({ districtCode }: Props) {
  const enrollmentsQuery = useMyTrainingEnrollments(districtCode);
  const enrollments = enrollmentsQuery.data?.enrollments ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">My training sign-ups</h3>
        <p className="text-sm text-gray-500">
          Sessions you registered for in this district. Cancel from the All sessions tab if plans
          change.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {enrollments.map(enr => {
          const t = enr.training;
          if (!t) return null;
          return (
            <Card key={enr.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base leading-snug">{t.title}</CardTitle>
                    <p className="text-sm text-gray-500">{t.provider}</p>
                  </div>
                  <TrainingStatusBadge status={t.status} />
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {sourceBadge(t.catalog_source)}
                  <Badge variant="outline" className="text-xs">
                    Signed up {new Date(enr.enrolled_at).toLocaleDateString()}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 shrink-0" />
                  {formatDateTime(t.start_datetime)}
                </div>
                {t.location ? (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 shrink-0" />
                    {t.location}
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-1.5">
                  <DeliveryModeBadge mode={t.delivery_mode} />
                  {t.target_grades
                    ? t.target_grades.split(',').map(g => (
                        <GradeBadge key={g.trim()} grade={g.trim()} />
                      ))
                    : null}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      {!enrollmentsQuery.isLoading && enrollments.length === 0 ? (
        <div className="rounded-md border p-8 text-center text-sm text-gray-500">
          You have not signed up for any training yet. Browse All sessions to register when your
          manager has enabled operator sign-up.
        </div>
      ) : null}
    </div>
  );
}
