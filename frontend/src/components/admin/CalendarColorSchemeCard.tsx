import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { useTenantAuthContext, type TenantAuthContext } from '@/hooks/useTenantAuthContext';
import {
  CALENDAR_FILL_PATTERN_OPTIONS,
  DEFAULT_CALENDAR_COLOR_SCHEME,
  fetchCalendarColorScheme,
  mergeCalendarColorScheme,
  saveCalendarColorScheme,
  type CalendarColorKey,
  type CalendarColorScheme,
} from '@/services/calendarColorService';
import { chipStyle } from '@/components/sampling/calendarColors';
import { Palette } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

export interface CalendarColorSchemeDistrictRow {
  district_code: string;
  district_name: string;
}

function filterDistrictsForEditor(
  districts: CalendarColorSchemeDistrictRow[],
  ctx: TenantAuthContext | undefined
): CalendarColorSchemeDistrictRow[] {
  if (!ctx) return districts;
  if (ctx.is_global_admin || ctx.is_system_admin) return districts;
  const acc = ctx.accessible_districts ?? [];
  if (acc.length >= 1 && acc[0] === '*') return districts;
  const allowed = new Set(acc);
  if (ctx.district_code) allowed.add(ctx.district_code);
  return districts.filter(d => allowed.has(d.district_code));
}

const ROWS: { key: CalendarColorKey; label: string }[] = [
  { key: 'scheduled', label: 'Scheduled (unassigned)' },
  { key: 'assigned', label: 'Assigned' },
  { key: 'in_progress', label: 'In progress (on-site)' },
  { key: 'waiting_lab', label: 'Awaiting lab results' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'completed', label: 'Completed' },
  { key: 'assumed_complete', label: 'Assumed fulfilled (before cutoff)' },
];

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function relLuminance(hex: string): number | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const r = lin(rgb.r);
  const g = lin(rgb.g);
  const b = lin(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a: string, b: string): number | null {
  const L1 = relLuminance(a);
  const L2 = relLuminance(b);
  if (L1 == null || L2 == null) return null;
  const hi = Math.max(L1, L2);
  const lo = Math.min(L1, L2);
  return (hi + 0.05) / (lo + 0.05);
}

export interface CalendarColorSchemeCardProps {
  districts: CalendarColorSchemeDistrictRow[];
}

export default function CalendarColorSchemeCard({ districts }: CalendarColorSchemeCardProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: tenantCtx, isLoading: tenantLoading } = useTenantAuthContext();

  const visible = useMemo(
    () => filterDistrictsForEditor(districts, tenantCtx),
    [districts, tenantCtx]
  );

  const [districtCode, setDistrictCode] = useState<string>('');
  const [draft, setDraft] = useState<CalendarColorScheme>({ ...DEFAULT_CALENDAR_COLOR_SCHEME });
  const [baseline, setBaseline] = useState<CalendarColorScheme>({
    ...DEFAULT_CALENDAR_COLOR_SCHEME,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (tenantLoading || visible.length === 0) return;
    const preferred =
      visible.find(d => d.district_code === tenantCtx?.district_code)?.district_code ||
      visible[0].district_code;
    setDistrictCode(prev =>
      prev && visible.some(v => v.district_code === prev) ? prev : preferred
    );
  }, [tenantLoading, visible, tenantCtx?.district_code]);

  useEffect(() => {
    if (!districtCode) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetchCalendarColorScheme(districtCode);
        const merged = mergeCalendarColorScheme(res.scheme);
        if (!cancelled) {
          setDraft(merged);
          setBaseline(merged);
        }
      } catch (e) {
        if (!cancelled) {
          toast({
            variant: 'destructive',
            title: 'Could not load calendar colors',
            description: e instanceof Error ? e.message : 'Unknown error',
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [districtCode, toast]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);

  const updateTriplet = (
    key: CalendarColorKey,
    field: 'bg' | 'border' | 'text' | 'pattern',
    value: string
  ) => {
    setDraft(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  };

  const resetRow = (key: CalendarColorKey) => {
    setDraft(prev => ({ ...prev, [key]: { ...DEFAULT_CALENDAR_COLOR_SCHEME[key] } }));
  };

  const resetAll = () => {
    setDraft({ ...DEFAULT_CALENDAR_COLOR_SCHEME });
  };

  const handleSave = async () => {
    if (!districtCode) return;
    setSaving(true);
    try {
      await saveCalendarColorScheme(districtCode, draft);
      setBaseline({ ...draft });
      await qc.invalidateQueries({ queryKey: ['calendar-color-scheme'] });
      toast({ title: 'Saved', description: `Calendar colors updated for ${districtCode}` });
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Save failed',
        description: e instanceof Error ? e.message : 'Unknown error',
      });
    } finally {
      setSaving(false);
    }
  };

  if (visible.length === 0) {
    return null;
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          Sample schedule calendar colors
        </CardTitle>
        <CardDescription>
          Customize chip colors and fill patterns on the sampling calendar (day/week/month views).
          Patterns help distinguish active field/lab states from solid fills. District admins can
          override defaults; collectors see the legend on the calendar page.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="max-w-xs space-y-2">
          <Label>District</Label>
          <Select
            value={districtCode}
            onValueChange={setDistrictCode}
            disabled={loading || visible.length === 1}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select district" />
            </SelectTrigger>
            <SelectContent>
              {visible.map(d => (
                <SelectItem key={d.district_code} value={d.district_code}>
                  {d.district_code} — {d.district_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {ROWS.map(({ key, label }) => {
          const tri = draft[key];
          const cr = contrastRatio(tri.bg, tri.text);
          const lowContrast = cr != null && cr < 3;
          return (
            <div
              key={key}
              className="flex flex-col gap-2 rounded-md border border-border p-3 md:flex-row md:items-center md:justify-between"
            >
              <div className="flex items-center gap-3 min-w-[200px]">
                <div
                  className="text-xs px-2 py-1 rounded max-w-[140px] truncate"
                  style={chipStyle(draft, key)}
                >
                  Preview
                </div>
                <div>
                  <div className="font-medium text-sm">{label}</div>
                  {lowContrast && (
                    <p className="text-xs text-amber-700 mt-1">
                      Low contrast between fill and text ({cr?.toFixed(2)}:1). Consider darker text
                      or lighter fill for readability.
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <Label className="text-xs">Fill</Label>
                  <Input
                    type="color"
                    className="h-9 w-14 p-0 cursor-pointer"
                    value={tri.bg}
                    onChange={e => updateTriplet(key, 'bg', e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Border</Label>
                  <Input
                    type="color"
                    className="h-9 w-14 p-0 cursor-pointer"
                    value={tri.border}
                    onChange={e => updateTriplet(key, 'border', e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Text</Label>
                  <Input
                    type="color"
                    className="h-9 w-14 p-0 cursor-pointer"
                    value={tri.text}
                    onChange={e => updateTriplet(key, 'text', e.target.value)}
                  />
                </div>
                <div className="min-w-[160px]">
                  <Label className="text-xs">Fill pattern</Label>
                  <Select
                    value={tri.pattern ?? 'none'}
                    onValueChange={v => updateTriplet(key, 'pattern', v)}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CALENDAR_FILL_PATTERN_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value} className="text-xs">
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => resetRow(key)}>
                  Reset row
                </Button>
              </div>
            </div>
          );
        })}

        <div className="flex flex-wrap gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={resetAll} disabled={loading || saving}>
            Reset all to defaults
          </Button>
          <Button type="button" onClick={handleSave} disabled={!dirty || loading || saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
