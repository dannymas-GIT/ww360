import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useJurisdictionOptions } from '@/hooks/useJurisdictionOptions';
import {
  joinJurisdictionTags,
  parseJurisdictionTags,
  type JurisdictionOption,
} from '@/services/districtJurisdictionService';
import { Loader2, Radio, Search, X } from 'lucide-react';
import React, { useMemo, useState } from 'react';

export interface JurisdictionTagPickerProps {
  value: string;
  onChange: (value: string) => void;
  stateCode?: string;
  disabled?: boolean;
  className?: string;
}

function stateTagForAbbr(abbr: string, options: JurisdictionOption[]): string | undefined {
  const upper = abbr.trim().toUpperCase();
  if (!upper) return undefined;
  const match = options.find(o => o.level === 'state' && o.state_code === upper);
  return match?.code;
}

function OptionRow({
  option,
  checked,
  disabled,
  onToggle,
}: {
  option: JurisdictionOption;
  checked: boolean;
  disabled?: boolean;
  onToggle: (code: string, next: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-2 hover:bg-muted/40 p-1.5 rounded">
      <Checkbox
        id={`jurisdiction-${option.code}`}
        checked={checked}
        disabled={disabled}
        onChange={e => onToggle(option.code, e.target.checked)}
      />
      <Label htmlFor={`jurisdiction-${option.code}`} className="text-sm cursor-pointer flex-1">
        <span className="font-medium">{option.name}</span>
        <span className="text-muted-foreground ml-1.5 font-mono text-xs">{option.code}</span>
        {option.has_rule_feed ? (
          <Badge variant="secondary" className="ml-2 text-[10px] py-0 h-5">
            <Radio className="w-3 h-3 mr-0.5" />
            Live feed
          </Badge>
        ) : (
          <span className="ml-2 text-[10px] text-muted-foreground">No active feed yet</span>
        )}
      </Label>
    </div>
  );
}

export const JurisdictionTagPicker: React.FC<JurisdictionTagPickerProps> = ({
  value,
  onChange,
  stateCode,
  disabled = false,
  className = '',
}) => {
  const { data: options = [], isLoading, error } = useJurisdictionOptions();
  const [search, setSearch] = useState('');

  const selected = useMemo(() => parseJurisdictionTags(value), [value]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const optionByCode = useMemo(() => {
    const map = new Map<string, JurisdictionOption>();
    for (const o of options) map.set(o.code.toUpperCase(), o);
    return map;
  }, [options]);

  const legacyTags = useMemo(
    () => selected.filter(code => !optionByCode.has(code)),
    [selected, optionByCode]
  );

  const primaryStateTag = useMemo(
    () => (stateCode ? stateTagForAbbr(stateCode, options) : undefined),
    [stateCode, options]
  );

  const selectedStateTags = useMemo(() => {
    const fromSelection = selected.filter(code => optionByCode.get(code)?.level === 'state');
    if (primaryStateTag && !fromSelection.includes(primaryStateTag)) {
      return [primaryStateTag, ...fromSelection];
    }
    return fromSelection;
  }, [selected, optionByCode, primaryStateTag]);

  const countyStateFilter = useMemo(() => {
    const codes = new Set<string>();
    if (stateCode?.trim()) codes.add(stateCode.trim().toUpperCase());
    for (const tag of selectedStateTags) {
      const st = optionByCode.get(tag)?.state_code;
      if (st) codes.add(st);
    }
    return codes;
  }, [stateCode, selectedStateTags, optionByCode]);

  const federalOptions = useMemo(() => options.filter(o => o.level === 'federal'), [options]);

  const stateOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return options.filter(o => {
      if (o.level !== 'state') return false;
      if (!q) return true;
      return (
        o.name.toLowerCase().includes(q) ||
        o.code.toLowerCase().includes(q) ||
        (o.state_code || '').toLowerCase().includes(q)
      );
    });
  }, [options, search]);

  const countyOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return options.filter(o => {
      if (o.level !== 'county') return false;
      if (countyStateFilter.size > 0 && o.state_code && !countyStateFilter.has(o.state_code)) {
        return false;
      }
      if (!q) return true;
      return (
        o.name.toLowerCase().includes(q) ||
        o.code.toLowerCase().includes(q) ||
        (o.fips_code || '').includes(q)
      );
    });
  }, [options, search, countyStateFilter]);

  const toggleTag = (code: string, next: boolean) => {
    const upper = code.trim().toUpperCase();
    const nextSet = new Set(selectedSet);
    if (next) nextSet.add(upper);
    else nextSet.delete(upper);
    onChange(joinJurisdictionTags(nextSet));
  };

  const removeTag = (code: string) => toggleTag(code, false);

  if (isLoading) {
    return (
      <div className={`flex items-center text-sm text-muted-foreground py-4 ${className}`}>
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
        Loading jurisdiction list…
      </div>
    );
  }

  if (error) {
    return (
      <p className={`text-sm text-destructive ${className}`}>
        {error instanceof Error ? error.message : 'Could not load jurisdictions'}
      </p>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map(code => {
            const opt = optionByCode.get(code);
            const isLegacy = !opt;
            return (
              <Badge
                key={code}
                variant={isLegacy ? 'outline' : opt?.has_rule_feed ? 'default' : 'secondary'}
                className="pl-2 pr-1 py-1 gap-1"
              >
                <span className="font-mono text-xs">{code}</span>
                {!isLegacy && opt?.has_rule_feed && (
                  <Radio className="w-3 h-3 opacity-80" aria-label="Live feed" />
                )}
                <button
                  type="button"
                  className="rounded hover:bg-black/10 p-0.5"
                  disabled={disabled}
                  onClick={() => removeTag(code)}
                  aria-label={`Remove ${code}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          placeholder="Search states and counties…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10"
          disabled={disabled}
        />
      </div>

      <div className="border rounded-md divide-y max-h-72 overflow-y-auto">
        <section className="p-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
            Federal
          </p>
          {federalOptions.map(o => (
            <OptionRow
              key={o.code}
              option={o}
              checked={selectedSet.has(o.code)}
              disabled={disabled}
              onToggle={toggleTag}
            />
          ))}
        </section>

        <section className="p-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
            State
          </p>
          {stateOptions.length === 0 ? (
            <p className="text-xs text-muted-foreground px-1.5 py-2">
              No states match your search.
            </p>
          ) : (
            stateOptions.map(o => (
              <OptionRow
                key={o.code}
                option={o}
                checked={selectedSet.has(o.code)}
                disabled={disabled}
                onToggle={toggleTag}
              />
            ))
          )}
        </section>

        <section className="p-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
            County / local
            {countyStateFilter.size > 0 && (
              <span className="font-normal normal-case ml-1">
                ({[...countyStateFilter].join(', ')})
              </span>
            )}
          </p>
          {countyOptions.length === 0 ? (
            <p className="text-xs text-muted-foreground px-1.5 py-2">
              {countyStateFilter.size === 0
                ? 'Select a state above to see counties.'
                : 'No counties match your search for the selected state(s).'}
            </p>
          ) : (
            countyOptions.map(o => (
              <OptionRow
                key={o.code}
                option={o}
                checked={selectedSet.has(o.code)}
                disabled={disabled}
                onToggle={toggleTag}
              />
            ))
          )}
        </section>
      </div>

      {legacyTags.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Custom tags preserved: {legacyTags.join(', ')}
        </p>
      )}
    </div>
  );
};

export { joinJurisdictionTags, parseJurisdictionTags };
