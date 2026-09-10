import { useState } from 'react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CEU_CUSTOM_VALUE,
  type RefOption,
} from '@/components/workforce/workforcePlanningFormModel';

interface FieldLabelProps {
  label: string;
  required?: boolean;
  htmlFor?: string;
}

export function WorkforceFieldLabel({ label, required, htmlFor }: FieldLabelProps) {
  return (
    <label htmlFor={htmlFor} className="text-xs font-medium text-gray-600">
      {label}
      {required && <span className="ml-0.5 text-red-600">*</span>}
    </label>
  );
}

interface WorkforceSelectFieldProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: RefOption[];
  placeholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
  allowEmpty?: boolean;
}

export function WorkforceSelectField({
  id,
  value,
  onChange,
  options,
  placeholder = 'Select…',
  emptyLabel = '— none —',
  disabled = false,
  allowEmpty = true,
}: WorkforceSelectFieldProps) {
  const selectValue = value || (allowEmpty ? '__empty__' : undefined);

  return (
    <Select
      value={selectValue}
      disabled={disabled}
      onValueChange={v => onChange(v === '__empty__' ? '' : v)}
    >
      <SelectTrigger id={id} className="mt-1">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowEmpty && <SelectItem value="__empty__">{emptyLabel}</SelectItem>}
        {options.map(opt => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface WorkforceDateFieldProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}

export function WorkforceDateField({ id, value, onChange, required }: WorkforceDateFieldProps) {
  return (
    <Input
      id={id}
      type="date"
      className="mt-1"
      aria-required={required}
      value={value}
      onChange={e => onChange(e.target.value)}
    />
  );
}

interface WorkforcePriorOrCustomFieldProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  emptyLabel?: string;
  required?: boolean;
  inputType?: 'text' | 'number';
  inputStep?: string;
}

/** Dropdown of saved values with an option to enter a new value. */
export function WorkforcePriorOrCustomField({
  id,
  value,
  onChange,
  options,
  placeholder = 'Select saved value…',
  emptyLabel = '— none —',
  required = false,
  inputType = 'text',
  inputStep,
}: WorkforcePriorOrCustomFieldProps) {
  const inOptions = value !== '' && options.includes(value);
  const [forceCustom, setForceCustom] = useState(false);
  const showCustom = forceCustom || (value !== '' && !inOptions);
  const selectValue = showCustom ? CEU_CUSTOM_VALUE : value || (required ? undefined : '__empty__');

  if (options.length === 0) {
    return (
      <Input
        id={id}
        className="mt-1"
        type={inputType}
        step={inputStep}
        aria-required={required}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={required ? 'Enter value…' : emptyLabel}
      />
    );
  }

  return (
    <div className="mt-1 space-y-2">
      <Select
        value={selectValue}
        onValueChange={v => {
          if (v === CEU_CUSTOM_VALUE) {
            setForceCustom(true);
            if (inOptions) onChange('');
            return;
          }
          setForceCustom(false);
          if (v === '__empty__') {
            onChange('');
            return;
          }
          onChange(v);
        }}
      >
        <SelectTrigger id={id}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {!required && <SelectItem value="__empty__">{emptyLabel}</SelectItem>}
          {options.map(opt => (
            <SelectItem key={opt} value={opt}>
              {opt}
            </SelectItem>
          ))}
          <SelectItem value={CEU_CUSTOM_VALUE}>Enter new value…</SelectItem>
        </SelectContent>
      </Select>
      {(showCustom || forceCustom) && (
        <Input
          type={inputType}
          step={inputStep}
          aria-required={required}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={inputType === 'number' ? 'Enter hours…' : 'Enter new value…'}
        />
      )}
    </div>
  );
}
