import type { WorkforceScheduledTraining } from '@/services/workforceSuccessionService';

export function filterUpcomingTrainings(
  trainings: WorkforceScheduledTraining[],
  referenceDate: Date = new Date()
): WorkforceScheduledTraining[] {
  const startOfToday = new Date(referenceDate);
  startOfToday.setHours(0, 0, 0, 0);

  return trainings
    .filter(training => {
      const start = new Date(training.start_datetime);
      return !Number.isNaN(start.getTime()) && start >= startOfToday;
    })
    .sort((a, b) => new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime());
}

export function takeUpcomingTrainings(
  trainings: WorkforceScheduledTraining[],
  limit = 5,
  referenceDate?: Date
): WorkforceScheduledTraining[] {
  return filterUpcomingTrainings(trainings, referenceDate).slice(0, limit);
}

export function formatTrainingDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDeliveryMode(mode: string): string {
  return mode.replace(/_/g, ' ');
}
