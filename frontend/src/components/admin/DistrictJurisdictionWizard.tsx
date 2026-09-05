import { JurisdictionTagPicker } from '@/components/admin/JurisdictionTagPicker';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
import { US_STATE_CODES } from '@/constants/usStates';
import {
  backfillDistrictJurisdictionFromSdwis,
  fetchDistrictJurisdiction,
  saveDistrictJurisdiction,
  validateJurisdictionTags,
  type JurisdictionDraft,
} from '@/services/districtJurisdictionService';
import {
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MapPin,
  Shield,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const WIZARD_STEPS = [
  { id: 'state', title: 'State', description: 'Primacy state for your PWS' },
  { id: 'tags', title: 'Regulatory tags', description: 'EPA, state, and local codes' },
  { id: 'primacy', title: 'Primacy agency', description: 'Optional agency label' },
  { id: 'sdwis', title: 'SDWIS assist', description: 'Fill gaps from EPA link' },
  { id: 'review', title: 'Review', description: 'Confirm and save' },
] as const;

function defaultTagsForState(state: string): string {
  const s = state.trim().toUpperCase();
  if (!s) return 'EPA';
  if (s === 'NY') return 'EPA,NYS';
  return `EPA,ST_${s}`;
}

export interface DistrictJurisdictionWizardProps {
  districtCode: string;
  pwsLinked?: boolean;
  onConfiguredChange?: (configured: boolean) => void;
}

export const DistrictJurisdictionWizard: React.FC<DistrictJurisdictionWizardProps> = ({
  districtCode,
  pwsLinked = false,
  onConfiguredChange,
}) => {
  const { toast } = useToast();
  const [stepIndex, setStepIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [draft, setDraft] = useState<JurisdictionDraft>({
    state_code: '',
    jurisdiction_codes: '',
    primacy_agency: '',
  });
  const [normalizedTags, setNormalizedTags] = useState<string[]>([]);

  const step = WIZARD_STEPS[stepIndex];
  const isLast = stepIndex === WIZARD_STEPS.length - 1;

  // Keep the latest callback in a ref so `load` doesn't depend on its identity.
  // Parents often pass inline arrows; depending on them re-ran the load effect on
  // every parent render (spinner flashing / infinite reload loop).
  const onConfiguredChangeRef = useRef(onConfiguredChange);
  useEffect(() => {
    onConfiguredChangeRef.current = onConfiguredChange;
  }, [onConfiguredChange]);

  const toastRef = useRef(toast);
  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!districtCode) return;
    if (!opts?.silent) {
      setLoading(true);
    }
    try {
      const data = await fetchDistrictJurisdiction(districtCode);
      setDraft({
        state_code: data.state_code || '',
        jurisdiction_codes: data.jurisdiction_codes || '',
        primacy_agency: data.primacy_agency || '',
      });
      const configured = Boolean(
        (data.state_code || '').trim() && (data.jurisdiction_codes || '').trim()
      );
      onConfiguredChangeRef.current?.(configured);
      if (data.jurisdiction_codes?.trim()) {
        const tags = await validateJurisdictionTags(data.jurisdiction_codes);
        setNormalizedTags(tags);
      } else {
        setNormalizedTags([]);
      }
    } catch (e) {
      toastRef.current({
        variant: 'destructive',
        title: 'Could not load jurisdiction',
        description: e instanceof Error ? e.message : 'Unknown error',
      });
    } finally {
      if (!opts?.silent) {
        setLoading(false);
      }
      setHasLoaded(true);
    }
  }, [districtCode]);

  useEffect(() => {
    setHasLoaded(false);
    setStepIndex(0);
    void load();
  }, [districtCode, load]);

  const runPreview = async () => {
    setBusy('preview');
    try {
      const tags = await validateJurisdictionTags(draft.jurisdiction_codes);
      setNormalizedTags(tags);
      toast({
        title: 'Normalized tags',
        description: tags.length ? tags.join(', ') : 'No tags — add codes such as EPA,NYS,NASSAU',
      });
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Validation failed',
        description: e instanceof Error ? e.message : 'Unknown error',
      });
    } finally {
      setBusy(null);
    }
  };

  const runBackfill = async () => {
    setBusy('backfill');
    try {
      const result = await backfillDistrictJurisdictionFromSdwis(districtCode);
      toast({
        title: 'SDWIS backfill complete',
        description: result.updated
          ? `Updated: ${(result.fields || []).join(', ')}`
          : 'No empty fields to fill from SDWIS',
      });
      await load();
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Backfill failed',
        description: e instanceof Error ? e.message : 'Unknown error',
      });
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    setBusy('save');
    try {
      await saveDistrictJurisdiction(districtCode, draft);
      onConfiguredChangeRef.current?.(true);
      toast({ title: 'Jurisdiction saved', description: `Updated ${districtCode}` });
      await load({ silent: true });
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Save failed',
        description: e instanceof Error ? e.message : 'Unknown error',
      });
    } finally {
      setBusy(null);
    }
  };

  const canAdvance = useMemo(() => {
    if (step.id === 'state') return Boolean(draft.state_code.trim());
    if (step.id === 'tags') return Boolean(draft.jurisdiction_codes.trim());
    return true;
  }, [step.id, draft]);

  if (!districtCode) {
    return (
      <p className="text-sm text-muted-foreground">Select a district to configure jurisdiction.</p>
    );
  }

  // Only blank the card on the very first load for a district; background
  // refreshes (e.g. after save/backfill) keep the card mounted to avoid layout jumps.
  if (loading && !hasLoaded) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Loading jurisdiction…
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Shield className="h-5 w-5" />
          Establish regulatory jurisdiction
        </CardTitle>
        <CardDescription>
          Sets state and jurisdiction tags used for MCL matching, regulatory alerts, and SDWIS
          alignment for <strong>{districtCode}</strong>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <ol className="flex flex-wrap gap-2">
          {WIZARD_STEPS.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setStepIndex(i)}
                className={`text-left rounded-lg border px-3 py-2 min-w-[7rem] transition-colors ${
                  i === stepIndex
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'hover:bg-muted/50'
                }`}
              >
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Step {i + 1}
                </span>
                <span className="block text-sm font-medium">{s.title}</span>
              </button>
            </li>
          ))}
        </ol>

        {step.id === 'state' && (
          <div className="space-y-4 max-w-md">
            <Label htmlFor="jurisdiction-state">Primacy state</Label>
            <Select
              value={draft.state_code || '__unset__'}
              onValueChange={v => {
                const state = v === '__unset__' ? '' : v;
                setDraft(d => ({
                  ...d,
                  state_code: state,
                  jurisdiction_codes:
                    d.jurisdiction_codes.trim() || (state ? defaultTagsForState(state) : ''),
                }));
              }}
            >
              <SelectTrigger id="jurisdiction-state" className="min-h-10">
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__unset__">— Select —</SelectItem>
                {US_STATE_CODES.map(code => (
                  <SelectItem key={code} value={code}>
                    {code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              We suggest starting tags with federal EPA plus your state code (e.g. NY → EPA,NYS).
            </p>
          </div>
        )}

        {step.id === 'tags' && (
          <div className="space-y-4">
            <div>
              <Label>Regulatory jurisdiction tags</Label>
              <p className="text-xs text-muted-foreground mt-1 mb-2">
                Select federal, state, and county tags used for MCL matching and regulatory alerts.
              </p>
              <JurisdictionTagPicker
                value={draft.jurisdiction_codes}
                onChange={codes => setDraft(d => ({ ...d, jurisdiction_codes: codes }))}
                stateCode={draft.state_code}
              />
            </div>

            <Collapsible>
              <CollapsibleTrigger className="text-sm text-muted-foreground hover:text-foreground py-1">
                <span>Advanced: edit raw codes</span>
                <ChevronDown className="w-4 h-4" />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <Label htmlFor="jurisdiction-codes">Jurisdiction codes (comma-separated)</Label>
                <Input
                  id="jurisdiction-codes"
                  className="font-mono mt-1"
                  placeholder="EPA,NYS,NASSAU"
                  value={draft.jurisdiction_codes}
                  onChange={e => setDraft(d => ({ ...d, jurisdiction_codes: e.target.value }))}
                />
              </CollapsibleContent>
            </Collapsible>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={busy === 'preview'}
              onClick={() => void runPreview()}
            >
              {busy === 'preview' ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Preview normalized tags
            </Button>
            {normalizedTags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {normalizedTags.map(t => (
                  <Badge key={t} variant="secondary">
                    {t}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        {step.id === 'primacy' && (
          <div className="space-y-4 max-w-lg">
            <Label htmlFor="primacy-agency">Primacy agency (optional)</Label>
            <Input
              id="primacy-agency"
              placeholder="e.g. NYS DOH, NJ DEP"
              value={draft.primacy_agency}
              onChange={e => setDraft(d => ({ ...d, primacy_agency: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              Display label for reports and audit — does not change tag matching.
            </p>
          </div>
        )}

        {step.id === 'sdwis' && (
          <div className="space-y-4 max-w-lg">
            {pwsLinked ? (
              <>
                <p className="text-sm text-muted-foreground">
                  If state or tags are still empty, SDWIS can fill them from your linked PWS record
                  (only updates NULL fields).
                </p>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy === 'backfill'}
                  onClick={() => void runBackfill()}
                >
                  {busy === 'backfill' ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <MapPin className="h-4 w-4 mr-2" />
                  )}
                  Run SDWIS backfill
                </Button>
              </>
            ) : (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-3">
                Link your PWS on the <strong>PWS / EPA</strong> tab first to enable SDWIS-assisted
                jurisdiction backfill.
              </p>
            )}
          </div>
        )}

        {step.id === 'review' && (
          <div className="space-y-3 text-sm border rounded-lg p-4 bg-muted/30">
            <p>
              <span className="text-muted-foreground">State:</span>{' '}
              <strong>{draft.state_code || '—'}</strong>
            </p>
            <p>
              <span className="text-muted-foreground">Codes:</span>{' '}
              <code className="text-xs">{draft.jurisdiction_codes || '—'}</code>
            </p>
            <p>
              <span className="text-muted-foreground">Primacy:</span> {draft.primacy_agency || '—'}
            </p>
            {normalizedTags.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {normalizedTags.map(t => (
                  <Badge key={t} variant="outline">
                    {t}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2 pt-2 border-t">
          <Button
            type="button"
            variant="outline"
            disabled={stepIndex === 0 || !!busy}
            onClick={() => setStepIndex(i => Math.max(0, i - 1))}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            {isLast ? (
              <Button
                type="button"
                disabled={!canAdvance || busy === 'save'}
                onClick={() => void save()}
              >
                {busy === 'save' ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                Save jurisdiction
              </Button>
            ) : (
              <Button
                type="button"
                disabled={!canAdvance || !!busy}
                onClick={() => setStepIndex(i => Math.min(WIZARD_STEPS.length - 1, i + 1))}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
