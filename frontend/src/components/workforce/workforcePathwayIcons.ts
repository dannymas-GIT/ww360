/**
 * Lucide icons for workforce sample-template pathway headers.
 */
import {
  AlertTriangle,
  BadgeCheck,
  CalendarClock,
  GraduationCap,
  Shield,
  type LucideIcon,
} from 'lucide-react';
import type { WorkforcePathwayId } from '@/components/workforce/workforceSampleTemplates';

export const WORKFORCE_PATHWAY_ICONS: Record<WorkforcePathwayId, LucideIcon> = {
  retirement: CalendarClock,
  single_point: AlertTriangle,
  compliance: BadgeCheck,
  emergency: Shield,
  bench: GraduationCap,
};
