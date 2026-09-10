/**
 * Sample template list row + popup preview styled like the Add/Edit dialog.
 * Compact one-line summary in the list; full colorful form preview opens on click.
 */
import { useState, type ReactNode } from 'react';
import { ChevronRight, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  WorkforceEntityDialogShell,
  WorkforceEntityFormGrid,
  WorkforceFormRequiredNote,
} from '@/components/workforce/WorkforceEntityDialogShell';
import {
  WorkforceFieldLabel,
  WorkforceSelectField,
} from '@/components/workforce/WorkforceFormControls';
import {
  WORKFORCE_FORM_MULTILINE_FIELDS,
  workforceEntityChrome,
  workforceFormFieldShellClass,
} from '@/components/workforce/workforceEntityDialogChrome';
import { WORKFORCE_PATHWAY_THEMES } from '@/components/workforce/workforcePathwayThemes';
import { WORKFORCE_PATHWAY_ICONS } from '@/components/workforce/workforcePathwayIcons';
import { ENTITY_SINGULAR_LABEL } from '@/components/workforce/workforceRecordDetailUtils';
import {
  ENTITY_FORM_COLUMNS,
  enumOptionsFor,
  isBooleanField,
  isDateField,
  isNullableBooleanField,
  isRequiredField,
  labelForField,
  labeledEnumOptionsFor,
  referenceFor,
  toDateInputValue,
} from '@/components/workforce/workforcePlanningFormModel';
import {
  formFromSample,
  type SampleTemplateRow,
} from '@/components/workforce/workforceSampleTemplates';
import type { WorkforceEntityType } from '@/services/workforceSuccessionService';

function boolLabel(value: string): string {
  if (value === 'true') return 'Yes';
  if (value === 'false') return 'No';
  return value;
}

function enumLabel(entityType: WorkforceEntityType, field: string, value: string): string {
  const labeled = labeledEnumOptionsFor(entityType, field);
  if (labeled) {
    return labeled.find(o => o.value === value)?.label ?? value;
  }
  return value;
}

interface SampleFieldPreviewProps {
  entityType: WorkforceEntityType;
  field: string;
  form: Record<string, string>;
}

function SampleFieldPreview({ entityType, field, form }: SampleFieldPreviewProps) {
  const required = isRequiredField(entityType, field);
  const value = form[field] ?? '';
  const fieldId = `sample-${entityType}-${field}`;
  const gridClass = workforceFormFieldShellClass(entityType, field);
  const wrap = (content: ReactNode) => <div className={gridClass}>{content}</div>;
  const ref = referenceFor(entityType, field);
  const labeledEnum = labeledEnumOptionsFor(entityType, field);
  const enumOrBool =
    labeledEnum ??
    enumOptionsFor(entityType, field)?.map(opt => ({ value: opt, label: opt })) ??
    (isNullableBooleanField(entityType, field)
      ? [
          { value: 'true', label: 'Yes' },
          { value: 'false', label: 'No' },
        ]
      : isBooleanField(entityType, field)
        ? ['true', 'false'].map(v => ({ value: v, label: v }))
        : undefined);

  if (ref) {
    return wrap(
      <>
        <WorkforceFieldLabel htmlFor={fieldId} label={labelForField(field)} required={required} />
        <WorkforceSelectField
          id={fieldId}
          value=""
          disabled
          placeholder="Select…"
          emptyLabel="Select…"
          allowEmpty={!required}
          onChange={() => undefined}
          options={[]}
        />
      </>
    );
  }

  if (enumOrBool) {
    const displayValue = value ? enumLabel(entityType, field, boolLabel(value)) : '';
    return wrap(
      <>
        <WorkforceFieldLabel htmlFor={fieldId} label={labelForField(field)} required={required} />
        <WorkforceSelectField
          id={fieldId}
          value={value}
          disabled
          placeholder={required ? 'Select…' : '—'}
          emptyLabel={required ? 'Select…' : '—'}
          allowEmpty={!required}
          onChange={() => undefined}
          options={
            displayValue && !enumOrBool.some(o => o.value === value)
              ? [{ value, label: displayValue }]
              : enumOrBool
          }
        />
      </>
    );
  }

  if (isDateField(entityType, field)) {
    return wrap(
      <>
        <WorkforceFieldLabel htmlFor={fieldId} label={labelForField(field)} required={required} />
        <Input
          id={fieldId}
          type="date"
          className="mt-1 bg-white"
          readOnly
          value={toDateInputValue(value)}
        />
      </>
    );
  }

  if (WORKFORCE_FORM_MULTILINE_FIELDS.has(field)) {
    return wrap(
      <>
        <WorkforceFieldLabel htmlFor={fieldId} label={labelForField(field)} required={required} />
        <Textarea
          id={fieldId}
          className="mt-1 min-h-[4.5rem] resize-none bg-white"
          readOnly
          value={value}
        />
      </>
    );
  }

  return wrap(
    <>
      <WorkforceFieldLabel htmlFor={fieldId} label={labelForField(field)} required={required} />
      <Input id={fieldId} className="mt-1 bg-white" readOnly value={value} />
    </>
  );
}

export interface WorkforceSampleTemplateCardProps {
  entityType: WorkforceEntityType;
  sample: SampleTemplateRow;
  canManage: boolean;
  onUse: () => void;
}

export function WorkforceSampleTemplateCard({
  entityType,
  sample,
  canManage,
  onUse,
}: WorkforceSampleTemplateCardProps) {
  const [open, setOpen] = useState(false);
  const pathwayTheme = WORKFORCE_PATHWAY_THEMES[sample.pathway];
  const { phaseColors, theme: entityTheme } = workforceEntityChrome(entityType);
  const PathwayIcon = WORKFORCE_PATHWAY_ICONS[sample.pathway];
  const columns = ENTITY_FORM_COLUMNS[entityType] ?? [];
  const form = formFromSample(sample, columns);

  const adopt = () => {
    setOpen(false);
    onUse();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`group flex w-full items-center gap-3 rounded-lg border bg-white px-3 py-2.5 text-left shadow-sm transition-colors hover:bg-slate-50/90 ${pathwayTheme.sectionBorder} border-l-4 ${pathwayTheme.cardAccent}`}
        aria-label={`Preview sample template: ${sample.label}`}
      >
        <Badge variant="outline" className={`shrink-0 gap-1 border-0 ${phaseColors.badge}`}>
          <Sparkles className="h-3 w-3" aria-hidden />
          Sample
        </Badge>
        <span className="min-w-0 flex-1 truncate text-sm">
          <span className="font-medium text-gray-900">{sample.label}</span>
          <span className="text-gray-500"> — {sample.why}</span>
        </span>
        <ChevronRight
          className="h-4 w-4 shrink-0 text-gray-400 transition-transform group-hover:translate-x-0.5 group-hover:text-gray-600"
          aria-hidden
        />
      </button>

      <WorkforceEntityDialogShell
        open={open}
        onOpenChange={setOpen}
        entityType={entityType}
        title={`Add ${ENTITY_SINGULAR_LABEL[entityType]}`}
        description={
          <>
            <span className="font-medium text-gray-800">{sample.label}</span>
            <span className="text-gray-600"> — {sample.why}</span>
          </>
        }
        headerGradientClass={pathwayTheme.cardHeader}
        badges={
          <>
            <Badge variant="outline" className={`gap-1 border-0 ${phaseColors.badge}`}>
              <Sparkles className="h-3 w-3" aria-hidden />
              Sample
            </Badge>
            <Badge variant="outline" className="gap-1 border-slate-200 bg-white/80 text-slate-700">
              <PathwayIcon className="h-3 w-3" aria-hidden />
              {sample.pathway.replace(/_/g, ' ')}
            </Badge>
          </>
        }
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!canManage}
              className={entityTheme.primaryButton}
              onClick={adopt}
            >
              Use this template
            </Button>
          </>
        }
      >
        <WorkforceEntityFormGrid>
          <div className="md:col-span-2">
            <WorkforceFormRequiredNote entityType={entityType} />
          </div>
          {columns.map(field => (
            <SampleFieldPreview key={field} entityType={entityType} field={field} form={form} />
          ))}
          <p className="md:col-span-2 rounded-md border border-amber-200/80 bg-amber-50/70 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
            {sample.referenceHint}
          </p>
        </WorkforceEntityFormGrid>
      </WorkforceEntityDialogShell>
    </>
  );
}
