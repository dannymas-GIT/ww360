import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import React from 'react';

export type SearchableOption = string | { value: string; label: string };

export interface SearchableSelectProps {
  value?: string;
  options: Array<SearchableOption>;
  onChange: (value: string) => void;
  placeholder?: string;
  triggerClassName?: string;
  emptyMessage?: string;
  disabled?: boolean;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  value,
  options,
  onChange,
  placeholder = 'Select...',
  triggerClassName,
  emptyMessage = 'No results',
}) => {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const normalized = React.useMemo(() => {
    return options.map(opt => (typeof opt === 'string' ? { value: opt, label: opt } : opt));
  }, [options]);

  const filtered = React.useMemo(() => {
    const lower = query.toLowerCase();
    return normalized.filter(
      opt => opt.label.toLowerCase().includes(lower) || opt.value.toLowerCase().includes(lower)
    );
  }, [normalized, query]);

  React.useEffect(() => {
    if (open) {
      // Slight delay to ensure the portal content is mounted
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    } else {
      setQuery('');
    }
  }, [open]);

  return (
    <Select value={value ?? ''} onValueChange={val => onChange(val)} onOpenChange={setOpen}>
      <SelectTrigger className={triggerClassName}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent position="popper">
        {/* Search input inside dropdown */}
        <div className="p-1 sticky top-0 z-10 bg-popover">
          <Input
            ref={inputRef}
            placeholder="Type to filter..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              // Prevent Radix Select typeahead from stealing focus
              e.stopPropagation();
            }}
            onKeyDownCapture={e => {
              e.stopPropagation();
            }}
            className="h-8 text-sm"
          />
        </div>
        {filtered.length === 0 ? (
          <div className="px-2 py-2 text-sm text-muted-foreground">{emptyMessage}</div>
        ) : (
          filtered.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
};

export default SearchableSelect;
