/**
 * Color themes for workforce sample-template pathway groups and cards.
 */
import type { WorkforcePathwayId } from '@/components/workforce/workforceSampleTemplates';

export interface WorkforcePathwayTheme {
  sectionBorder: string;
  sectionHeader: string;
  sectionTitle: string;
  sectionBody: string;
  cardRing: string;
  cardHeader: string;
  cardAccent: string;
}

export const WORKFORCE_PATHWAY_THEMES: Record<WorkforcePathwayId, WorkforcePathwayTheme> = {
  retirement: {
    sectionBorder: 'border-indigo-200',
    sectionHeader: 'bg-gradient-to-r from-indigo-50 via-violet-50/90 to-white',
    sectionTitle: 'text-indigo-900',
    sectionBody: 'text-indigo-900/80',
    cardRing: 'ring-indigo-200/80',
    cardHeader: 'from-indigo-50/90 via-white to-sky-50/40',
    cardAccent: 'border-indigo-500',
  },
  single_point: {
    sectionBorder: 'border-amber-200',
    sectionHeader: 'bg-gradient-to-r from-amber-50 via-orange-50/90 to-white',
    sectionTitle: 'text-amber-950',
    sectionBody: 'text-amber-900/85',
    cardRing: 'ring-amber-200/80',
    cardHeader: 'from-amber-50/90 via-white to-orange-50/40',
    cardAccent: 'border-amber-500',
  },
  compliance: {
    sectionBorder: 'border-sky-200',
    sectionHeader: 'bg-gradient-to-r from-sky-50 via-blue-50/90 to-white',
    sectionTitle: 'text-sky-950',
    sectionBody: 'text-sky-900/85',
    cardRing: 'ring-sky-200/80',
    cardHeader: 'from-sky-50/90 via-white to-blue-50/40',
    cardAccent: 'border-sky-500',
  },
  emergency: {
    sectionBorder: 'border-rose-200',
    sectionHeader: 'bg-gradient-to-r from-rose-50 via-red-50/90 to-white',
    sectionTitle: 'text-rose-950',
    sectionBody: 'text-rose-900/85',
    cardRing: 'ring-rose-200/80',
    cardHeader: 'from-rose-50/90 via-white to-red-50/40',
    cardAccent: 'border-rose-500',
  },
  bench: {
    sectionBorder: 'border-emerald-200',
    sectionHeader: 'bg-gradient-to-r from-emerald-50 via-green-50/90 to-white',
    sectionTitle: 'text-emerald-950',
    sectionBody: 'text-emerald-900/85',
    cardRing: 'ring-emerald-200/80',
    cardHeader: 'from-emerald-50/90 via-white to-lime-50/40',
    cardAccent: 'border-emerald-500',
  },
};
