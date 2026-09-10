import { Link } from 'react-router-dom';
import { buildWorkforceTabPath } from '@/components/workforce/workforceContinuityTabs';
import { Calendar, GraduationCap, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useScheduledTrainings } from '@/hooks/useWorkforceSuccession';
import {
  formatDeliveryMode,
  formatTrainingDate,
  takeUpcomingTrainings,
} from './upcomingTrainingUtils';
import { useWorkforceDistrictCode } from './useWorkforceDistrictCode';

interface Props {
  districtCode?: string;
  limit?: number;
}

export function UpcomingTrainingWidget({ districtCode, limit = 5 }: Props) {
  const resolvedDistrict = useWorkforceDistrictCode(districtCode);
  const trainingsQuery = useScheduledTrainings(
    resolvedDistrict ? { district_code: resolvedDistrict, upcoming_only: true } : undefined
  );

  if (!resolvedDistrict) {
    return (
      <div className="text-sm text-gray-500">
        Select a district on Workforce Continuity to show upcoming training.
      </div>
    );
  }

  if (trainingsQuery.isLoading) {
    return <div className="text-sm text-gray-500">Loading upcoming training…</div>;
  }

  if (trainingsQuery.isError) {
    return <div className="text-sm text-red-600">Could not load upcoming training.</div>;
  }

  const upcoming = takeUpcomingTrainings(trainingsQuery.data?.trainings ?? [], limit);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <GraduationCap className="h-4 w-4 text-indigo-600" />
        <h3 className="text-sm font-semibold text-gray-800">Upcoming Training</h3>
        <Badge variant="outline">{resolvedDistrict}</Badge>
      </div>

      {upcoming.length === 0 ? (
        <p className="text-sm text-gray-500">
          No upcoming trainings scheduled. Add events in Workforce Continuity → Training.
        </p>
      ) : (
        <ul className="space-y-3">
          {upcoming.map(training => (
            <li
              key={training.id}
              className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
            >
              <div className="font-medium text-gray-900">{training.title}</div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatTrainingDate(training.start_datetime)}
                </span>
                {training.location ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {training.location}
                  </span>
                ) : null}
                <span className="capitalize">{formatDeliveryMode(training.delivery_mode)}</span>
              </div>
              <div className="mt-1 text-xs text-gray-500">{training.provider}</div>
            </li>
          ))}
        </ul>
      )}

      <Link to={buildWorkforceTabPath('training', { sub: 'sessions' })}>
        <Button variant="outline" size="sm" className="text-xs">
          Manage trainings →
        </Button>
      </Link>
    </div>
  );
}
