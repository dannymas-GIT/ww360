/**
 * Shared phase colors, layout, and tinted surfaces for workforce entity dialogs.
 */
import type { FormWizardStep } from '@/components/workforce/workforcePlanningFormModel';
import {
  WORKFORCE_TAB_META,
  type WorkforceContinuityTab,
} from '@/components/workforce/workforceContinuityTabs';
import { ENTITY_TO_TAB } from '@/components/workforce/workforceRecordDetailUtils';
import type { WorkforceEntityType } from '@/services/workforceSuccessionService';

export interface WorkforcePhaseDialogTheme {
  headerGradient: string;
  accentBorder: string;
  accentText: string;
  badge: string;
  bodyBg: string;
  footerBg: string;
  fieldShell: string;
  fieldCard: string;
  fieldLabel: string;
  sectionAccent: string;
  aboutTrigger: string;
  aboutContent: string;
  relatedHover: string;
  requiredNote: string;
  primaryButton: string;
}

export const WORKFORCE_PHASE_DIALOG_THEMES: Record<
  FormWizardStep['phase'],
  WorkforcePhaseDialogTheme
> = {
  overview: {
    headerGradient: 'from-indigo-50/90 via-white to-violet-50/40',
    accentBorder: 'border-indigo-600',
    accentText: 'text-indigo-700',
    badge: 'bg-indigo-100 text-indigo-800',
    bodyBg: 'bg-gradient-to-b from-indigo-50/35 via-white to-white',
    footerBg: 'bg-gradient-to-r from-indigo-50/80 via-slate-50 to-white',
    fieldShell: 'rounded-lg border border-indigo-100/80 bg-white/90 px-3 py-2.5 shadow-sm',
    fieldCard: 'border-indigo-100/80 bg-indigo-50/45',
    fieldLabel: 'text-indigo-800/75',
    sectionAccent: 'border-indigo-200 text-indigo-900',
    aboutTrigger: 'border-indigo-100 bg-indigo-50/60 text-indigo-900 hover:bg-indigo-50/90',
    aboutContent: 'border-indigo-100 bg-white',
    relatedHover: 'hover:border-indigo-300 hover:bg-indigo-50/55',
    requiredNote:
      'rounded-md border border-indigo-100 bg-indigo-50/55 px-3 py-2 text-indigo-900/85',
    primaryButton: 'bg-indigo-700 text-white hover:bg-indigo-800',
  },
  plan: {
    headerGradient: 'from-blue-50/90 via-white to-sky-50/45',
    accentBorder: 'border-blue-600',
    accentText: 'text-blue-700',
    badge: 'bg-blue-100 text-blue-800',
    bodyBg: 'bg-gradient-to-b from-blue-50/35 via-white to-white',
    footerBg: 'bg-gradient-to-r from-blue-50/80 via-slate-50 to-white',
    fieldShell: 'rounded-lg border border-blue-100/80 bg-white/90 px-3 py-2.5 shadow-sm',
    fieldCard: 'border-blue-100/80 bg-blue-50/45',
    fieldLabel: 'text-blue-800/75',
    sectionAccent: 'border-blue-200 text-blue-900',
    aboutTrigger: 'border-blue-100 bg-blue-50/60 text-blue-900 hover:bg-blue-50/90',
    aboutContent: 'border-blue-100 bg-white',
    relatedHover: 'hover:border-blue-300 hover:bg-blue-50/55',
    requiredNote: 'rounded-md border border-blue-100 bg-blue-50/55 px-3 py-2 text-blue-900/85',
    primaryButton: 'bg-blue-700 text-white hover:bg-blue-800',
  },
  hire: {
    headerGradient: 'from-amber-50/90 via-white to-orange-50/45',
    accentBorder: 'border-amber-600',
    accentText: 'text-amber-800',
    badge: 'bg-amber-100 text-amber-900',
    bodyBg: 'bg-gradient-to-b from-amber-50/35 via-white to-white',
    footerBg: 'bg-gradient-to-r from-amber-50/80 via-slate-50 to-white',
    fieldShell: 'rounded-lg border border-amber-100/80 bg-white/90 px-3 py-2.5 shadow-sm',
    fieldCard: 'border-amber-100/80 bg-amber-50/45',
    fieldLabel: 'text-amber-900/75',
    sectionAccent: 'border-amber-200 text-amber-950',
    aboutTrigger: 'border-amber-100 bg-amber-50/60 text-amber-950 hover:bg-amber-50/90',
    aboutContent: 'border-amber-100 bg-white',
    relatedHover: 'hover:border-amber-300 hover:bg-amber-50/55',
    requiredNote: 'rounded-md border border-amber-100 bg-amber-50/55 px-3 py-2 text-amber-950/85',
    primaryButton: 'bg-amber-700 text-white hover:bg-amber-800',
  },
  transition: {
    headerGradient: 'from-purple-50/90 via-white to-violet-50/45',
    accentBorder: 'border-purple-600',
    accentText: 'text-purple-700',
    badge: 'bg-purple-100 text-purple-800',
    bodyBg: 'bg-gradient-to-b from-purple-50/35 via-white to-white',
    footerBg: 'bg-gradient-to-r from-purple-50/80 via-slate-50 to-white',
    fieldShell: 'rounded-lg border border-purple-100/80 bg-white/90 px-3 py-2.5 shadow-sm',
    fieldCard: 'border-purple-100/80 bg-purple-50/45',
    fieldLabel: 'text-purple-800/75',
    sectionAccent: 'border-purple-200 text-purple-900',
    aboutTrigger: 'border-purple-100 bg-purple-50/60 text-purple-900 hover:bg-purple-50/90',
    aboutContent: 'border-purple-100 bg-white',
    relatedHover: 'hover:border-purple-300 hover:bg-purple-50/55',
    requiredNote:
      'rounded-md border border-purple-100 bg-purple-50/55 px-3 py-2 text-purple-900/85',
    primaryButton: 'bg-purple-700 text-white hover:bg-purple-800',
  },
  sustain: {
    headerGradient: 'from-emerald-50/90 via-white to-green-50/45',
    accentBorder: 'border-emerald-600',
    accentText: 'text-emerald-700',
    badge: 'bg-emerald-100 text-emerald-800',
    bodyBg: 'bg-gradient-to-b from-emerald-50/35 via-white to-white',
    footerBg: 'bg-gradient-to-r from-emerald-50/80 via-slate-50 to-white',
    fieldShell: 'rounded-lg border border-emerald-100/80 bg-white/90 px-3 py-2.5 shadow-sm',
    fieldCard: 'border-emerald-100/80 bg-emerald-50/45',
    fieldLabel: 'text-emerald-800/75',
    sectionAccent: 'border-emerald-200 text-emerald-900',
    aboutTrigger: 'border-emerald-100 bg-emerald-50/60 text-emerald-900 hover:bg-emerald-50/90',
    aboutContent: 'border-emerald-100 bg-white',
    relatedHover: 'hover:border-emerald-300 hover:bg-emerald-50/55',
    requiredNote:
      'rounded-md border border-emerald-100 bg-emerald-50/55 px-3 py-2 text-emerald-900/85',
    primaryButton: 'bg-emerald-700 text-white hover:bg-emerald-800',
  },
  finish: {
    headerGradient: 'from-slate-50/90 via-white to-white',
    accentBorder: 'border-slate-600',
    accentText: 'text-slate-700',
    badge: 'bg-slate-100 text-slate-800',
    bodyBg: 'bg-gradient-to-b from-slate-50/35 via-white to-white',
    footerBg: 'bg-gradient-to-r from-slate-50/80 via-slate-50 to-white',
    fieldShell: 'rounded-lg border border-slate-100/80 bg-white/90 px-3 py-2.5 shadow-sm',
    fieldCard: 'border-slate-100/80 bg-slate-50/45',
    fieldLabel: 'text-slate-700/75',
    sectionAccent: 'border-slate-200 text-slate-900',
    aboutTrigger: 'border-slate-100 bg-slate-50/60 text-slate-900 hover:bg-slate-50/90',
    aboutContent: 'border-slate-100 bg-white',
    relatedHover: 'hover:border-slate-300 hover:bg-slate-50/55',
    requiredNote: 'rounded-md border border-slate-100 bg-slate-50/55 px-3 py-2 text-slate-800/85',
    primaryButton: 'bg-slate-700 text-white hover:bg-slate-800',
  },
};

/** @deprecated Use WORKFORCE_PHASE_DIALOG_THEMES via workforceEntityChrome(). */
export const WORKFORCE_PHASE_HEADER_GRADIENTS: Record<FormWizardStep['phase'], string> =
  Object.fromEntries(
    Object.entries(WORKFORCE_PHASE_DIALOG_THEMES).map(([phase, theme]) => [
      phase,
      theme.headerGradient,
    ])
  ) as Record<FormWizardStep['phase'], string>;

export function workforceEntityChrome(entityType: WorkforceEntityType) {
  const tabId = ENTITY_TO_TAB[entityType] as WorkforceContinuityTab;
  const tabMeta = WORKFORCE_TAB_META[tabId];
  const theme = WORKFORCE_PHASE_DIALOG_THEMES[tabMeta.phase];

  return {
    tabMeta,
    theme,
    phaseColors: { active: `${theme.accentBorder} ${theme.accentText}`, badge: theme.badge },
    accentBorder: theme.accentBorder,
    accentText: theme.accentText,
    headerGradient: theme.headerGradient,
  };
}

/** Shared wide dialog width for workforce entity modals. */
export const WORKFORCE_ENTITY_DIALOG_MAX_WIDTH = 'max-w-3xl';

/** Two-column form layout used in Add/Edit and sample preview dialogs. */
export const WORKFORCE_ENTITY_FORM_GRID_CLASS = 'grid grid-cols-1 gap-x-5 gap-y-3 md:grid-cols-2';

/** Three-column read-only detail grid in record detail dialogs. */
export const WORKFORCE_ENTITY_DETAIL_GRID_CLASS =
  'grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3';

export const WORKFORCE_FORM_MULTILINE_FIELDS = new Set([
  'notes',
  'description',
  'summary',
  'training_plan_summary',
  'planning_scope_notes',
]);

export function workforceFormFieldGridClass(field: string): string {
  return WORKFORCE_FORM_MULTILINE_FIELDS.has(field) ? 'md:col-span-2' : '';
}

export function workforceDetailFieldGridClass(field: string): string {
  return WORKFORCE_FORM_MULTILINE_FIELDS.has(field) ? 'sm:col-span-2 lg:col-span-3' : '';
}

export function workforceFormFieldShellClass(
  entityType: WorkforceEntityType,
  field: string
): string {
  const { theme } = workforceEntityChrome(entityType);
  return `${workforceFormFieldGridClass(field)} ${theme.fieldShell}`;
}

export function workforceDetailFieldCardClass(
  entityType: WorkforceEntityType,
  field: string
): string {
  const { theme } = workforceEntityChrome(entityType);
  return `rounded-md border px-3 py-2 ${theme.fieldCard} ${workforceDetailFieldGridClass(field)}`;
}
