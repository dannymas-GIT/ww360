/**
 * Choose a public water system (PWSID) for display, with optional EPA search.
 * Utility district_admin/manager: Link & sync to their district.
 * National/state reviewers: in-app preview; optional save to analysis sets.
 */
import { PwsPreviewPanel } from '@/components/admin/PwsPreviewPanel';
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
import { useAuth } from '@/context/AuthContext';
import {
  useAddAnalysisSetItem,
  useCreateAnalysisSet,
  useLinkSDWISSystem,
  useSaveDistrictRememberedPwsid,
  useSDWISAnalysisSets,
  useSDWISDistrictRememberedPwsids,
  useSDWISLinkedSystems,
  useSDWISLookup,
  useSDWISPreview,
} from '@/hooks/useSDWIS';
import { useDistricts } from '@/hooks/useDistricts';
import {
  derivePwsSearchQuery,
  rankPwsLookupRows,
  suggestedAnalysisSetName,
  type SDWISLookupRow,
} from '@/services/sdwisService';
import { Check, Link2, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

/** Radix Select requires non-empty item values; means “use tenant context district”. */
const DISTRICT_SELECT_DEFAULT = '__tenant_default__';
const ANALYSIS_SET_NEW = '__new_analysis_set__';

export interface DistrictPwsLinkConfigSectionProps {
  /** When set (typical DA hub), district picker is hidden and this code is used. */
  lockedDistrictCode?: string;
  /** Optional district list from hub; falls back to useDistricts(). */
  districts?: { district_code: string; district_name: string }[];
  /** Show link to full SDWIS compliance viewer. */
  showComplianceLink?: boolean;
  /** District display name — pre-fills EPA search when autoSuggestPws is on. */
  districtName?: string;
  /** Two-letter state code for EPA search (defaults to NY). */
  stateCode?: string;
  /** Auto-run EPA lookup and show ranked suggested matches. */
  autoSuggestPws?: boolean;
  /**
   * `select` (default): in-app preview for national/state reviewers.
   * `link`: utility district_admin/manager — Link & sync to their district.
   */
  mode?: 'select' | 'link';
}

export function DistrictPwsLinkConfigSection({
  lockedDistrictCode,
  districts: districtsProp,
  showComplianceLink = false,
  districtName,
  stateCode,
  autoSuggestPws = false,
  mode = 'select',
}: DistrictPwsLinkConfigSectionProps) {
  const { isDistrictManager, isStateAdmin, isPlatformAdmin, hasAnyRole } = useAuth();
  const isReviewer =
    isStateAdmin || isPlatformAdmin || hasAnyRole('national_observer', 'oww_partner');
  const allowLinkSync = mode === 'link' && isDistrictManager;
  const allowRemembered = allowLinkSync;

  const { data: districtsFromHook, isLoading: districtsLoading } = useDistricts();
  const districts = districtsProp ?? districtsFromHook;
  const filteredDistricts = useMemo(() => {
    if (!lockedDistrictCode) return districts || [];
    return (districts || []).filter(d => d.district_code === lockedDistrictCode);
  }, [districts, lockedDistrictCode]);

  const { data: systems, refetch: refetchSystems } = useSDWISLinkedSystems();
  const { data: rememberedRows } = useSDWISDistrictRememberedPwsids();
  const { mutate: saveRememberedMutate } = useSaveDistrictRememberedPwsid();
  const saveRememberedMutateRef = useRef(saveRememberedMutate);
  saveRememberedMutateRef.current = saveRememberedMutate;

  const [linkDistrictCode, setLinkDistrictCode] = useState<string | null>(
    lockedDistrictCode ?? null
  );

  const rememberedByDistrict = useMemo(() => {
    const m = new Map<string, string>();
    (rememberedRows || []).forEach(r => m.set(r.district_code, r.pwsid));
    return m;
  }, [rememberedRows]);

  const resolvedDistrictName =
    districtName?.trim() || filteredDistricts[0]?.district_name?.trim() || lockedDistrictCode || '';
  const resolvedStateCode = (stateCode || 'NY').trim().toUpperCase().slice(0, 2);
  const autoSearchQuery = useMemo(
    () => derivePwsSearchQuery(resolvedDistrictName, lockedDistrictCode),
    [resolvedDistrictName, lockedDistrictCode]
  );

  const [lookupState, setLookupState] = useState(resolvedStateCode || 'NY');
  const [lookupQ, setLookupQ] = useState('');
  const [lookupOpen, setLookupOpen] = useState(false);
  const [manualSearch, setManualSearch] = useState(false);

  const lookupEnabled = autoSuggestPws ? !manualSearch : lookupOpen;
  const effectiveLookupQ = autoSuggestPws && !manualSearch ? autoSearchQuery : lookupQ;
  const lookupQueryReady = effectiveLookupQ.trim().length >= 2;
  const {
    data: lookupRows,
    isFetching: lookupBusy,
    isError: lookupError,
    error: lookupErr,
  } = useSDWISLookup(lookupState, effectiveLookupQ, lookupEnabled && lookupQueryReady);

  const rankedLookupRows = useMemo(
    () => rankPwsLookupRows(lookupRows || [], effectiveLookupQ),
    [lookupRows, effectiveLookupQ]
  );

  const [linkPwsid, setLinkPwsid] = useState('');
  const [selectedRow, setSelectedRow] = useState<SDWISLookupRow | null>(null);
  const [hasChosen, setHasChosen] = useState(false);
  const linkMut = useLinkSDWISSystem();
  const { data: analysisSets } = useSDWISAnalysisSets(isReviewer);
  const createSetMut = useCreateAnalysisSet();
  const addItemMut = useAddAnalysisSetItem();
  const [analysisSetId, setAnalysisSetId] = useState<string>(ANALYSIS_SET_NEW);
  const [newReviewName, setNewReviewName] = useState('');
  const debounceSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (lockedDistrictCode) {
      setLinkDistrictCode(lockedDistrictCode);
    }
  }, [lockedDistrictCode]);

  useEffect(() => {
    if (!autoSuggestPws) return;
    if (resolvedStateCode.length === 2) {
      setLookupState(resolvedStateCode);
    }
    setManualSearch(false);
    setLookupOpen(true);
  }, [autoSuggestPws, lockedDistrictCode, resolvedStateCode, autoSearchQuery]);

  const persistRememberedPwsid = (districtCode: string, pwsid: string) => {
    const p = pwsid.trim().toUpperCase();
    if (!districtCode || p.length < 7) return;
    saveRememberedMutateRef.current({ districtCode, pwsid: p });
  };

  const effectiveDistrictCode = lockedDistrictCode ?? linkDistrictCode;

  const applySelection = (pwsid: string, row?: SDWISLookupRow | null) => {
    const pid = pwsid.trim().toUpperCase();
    if (!pid) return;
    setLinkPwsid(pid);
    setHasChosen(true);
    let chosenRow: SDWISLookupRow | null = null;
    if (row && row.pwsid.toUpperCase() === pid) {
      chosenRow = row;
    } else {
      chosenRow = rankedLookupRows.find(r => r.pwsid.toUpperCase() === pid) || null;
    }
    setSelectedRow(chosenRow);
    if (isReviewer && analysisSetId === ANALYSIS_SET_NEW) {
      setNewReviewName(suggestedAnalysisSetName(chosenRow?.pws_name, pid));
    }
    if (allowRemembered && effectiveDistrictCode) {
      persistRememberedPwsid(effectiveDistrictCode, pid);
    }
  };

  /** Pre-fill PWSID when district is selected and field empty: linked system, then remembered. */
  useEffect(() => {
    if (!effectiveDistrictCode || linkPwsid.trim()) return;
    const linked = systems?.find(s => (s.district_code || '') === effectiveDistrictCode);
    if (linked?.pwsid) {
      setLinkPwsid(linked.pwsid);
      setSelectedRow({
        pwsid: linked.pwsid,
        pws_name: linked.pws_name,
        state_code: linked.state_code,
        population_served:
          linked.population_served != null ? String(linked.population_served) : null,
        snc: linked.snc,
      });
      return;
    }
    const remembered = rememberedByDistrict.get(effectiveDistrictCode);
    if (remembered) setLinkPwsid(remembered);
  }, [effectiveDistrictCode, linkPwsid, systems, rememberedByDistrict]);

  /** Debounced save when user types a PWSID with an explicit district selected. */
  useEffect(() => {
    if (!allowRemembered || !effectiveDistrictCode) return;
    const raw = linkPwsid.trim().toUpperCase();
    if (raw.length < 7) return;
    if (debounceSaveRef.current) clearTimeout(debounceSaveRef.current);
    const district = effectiveDistrictCode;
    debounceSaveRef.current = setTimeout(() => {
      saveRememberedMutateRef.current({ districtCode: district, pwsid: raw });
      debounceSaveRef.current = null;
    }, 600);
    return () => {
      if (debounceSaveRef.current) clearTimeout(debounceSaveRef.current);
    };
  }, [allowRemembered, effectiveDistrictCode, linkPwsid]);

  const handleDistrictChange = (value: string) => {
    if (lockedDistrictCode) return;
    if (value === DISTRICT_SELECT_DEFAULT) {
      setLinkDistrictCode(null);
      setLinkPwsid('');
      setSelectedRow(null);
      return;
    }
    setLinkDistrictCode(value);
    const d = districts?.find(x => x.district_code === value);
    if (d) {
      setLookupQ(derivePwsSearchQuery(d.district_name, d.district_code));
      setManualSearch(false);
      setLookupOpen(true);
    }
    const linked = systems?.find(s => (s.district_code || '') === value);
    const remembered = rememberedByDistrict.get(value);
    const next = linked?.pwsid ?? remembered ?? '';
    setLinkPwsid(next);
    if (linked?.pwsid) {
      setSelectedRow({
        pwsid: linked.pwsid,
        pws_name: linked.pws_name,
        state_code: linked.state_code,
        population_served:
          linked.population_served != null ? String(linked.population_served) : null,
        snc: linked.snc,
      });
    } else {
      setSelectedRow(null);
    }
  };

  const handleSelect = () => {
    if (!linkPwsid.trim()) return;
    applySelection(linkPwsid);
  };

  const handleLink = async () => {
    if (!allowLinkSync || !linkPwsid.trim()) return;
    const pid = linkPwsid.trim().toUpperCase();
    if (effectiveDistrictCode) {
      persistRememberedPwsid(effectiveDistrictCode, pid);
    }
    await linkMut.mutateAsync({
      pwsid: pid,
      districtCode: effectiveDistrictCode ?? undefined,
    });
    setHasChosen(true);
    await refetchSystems();
  };

  const handleRunManualSearch = () => {
    setManualSearch(true);
    if (!lookupQ.trim() && autoSearchQuery.length >= 2) {
      setLookupQ(autoSearchQuery);
    }
    setLookupOpen(true);
  };

  const linkedForDistrict = effectiveDistrictCode
    ? systems?.find(s => (s.district_code || '') === effectiveDistrictCode)
    : undefined;

  const showLookupResults =
    lookupEnabled && lookupQueryReady && (autoSuggestPws || lookupOpen || manualSearch);

  const selectedPwsid = (selectedRow?.pwsid || linkPwsid).trim().toUpperCase();
  const showPreview = hasChosen && selectedPwsid.length >= 7 && !allowLinkSync;
  const {
    data: preview,
    isLoading: previewLoading,
    isError: previewError,
    error: previewErr,
  } = useSDWISPreview(showPreview ? selectedPwsid : null, lookupState);

  const handleSaveToAnalysis = async () => {
    if (!selectedPwsid || !isReviewer) return;
    let setId =
      analysisSetId && analysisSetId !== ANALYSIS_SET_NEW ? Number(analysisSetId) : 0;
    if (!setId) {
      const name = newReviewName.trim() || suggestedAnalysisSetName(selectedRow?.pws_name, selectedPwsid);
      if (!name.trim()) return;
      const created = await createSetMut.mutateAsync(name.trim());
      setId = created.id;
      setAnalysisSetId(String(setId));
    }
    await addItemMut.mutateAsync({
      setId,
      item: {
        pwsid: selectedPwsid,
        pws_name: selectedRow?.pws_name,
        state_code: selectedRow?.state_code || lookupState,
        population_served: selectedRow?.population_served
          ? Number(selectedRow.population_served)
          : undefined,
        snc: selectedRow?.snc,
      },
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Public water system (PWS)</CardTitle>
          <CardDescription className="text-base leading-relaxed">
            {allowLinkSync
              ? 'Link a district’s EPA public water system ID so SDWIS violations, enforcement, and compliance reporting can use live federal data.'
              : 'Search EPA and choose a PWSID to view landscape compliance fields. Choosing a system does not link or sync it into WW360.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!lockedDistrictCode && (
            <>
              {districtsLoading ? (
                <p className="text-sm text-muted-foreground">Loading districts…</p>
              ) : (
                <div className="space-y-1">
                  <Label htmlFor="pws-district">Utility / district (optional)</Label>
                  <Select
                    value={linkDistrictCode ?? DISTRICT_SELECT_DEFAULT}
                    onValueChange={handleDistrictChange}
                  >
                    <SelectTrigger id="pws-district" className="min-h-[44px] text-base">
                      <SelectValue placeholder="Select a district" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={DISTRICT_SELECT_DEFAULT}>
                        No district — view PWS data only
                      </SelectItem>
                      {(districts || []).map(d => (
                        <SelectItem key={d.district_code} value={d.district_code}>
                          {d.district_name
                            ? `${d.district_name} (${d.district_code})`
                            : d.district_code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}
          {lockedDistrictCode && (resolvedDistrictName || filteredDistricts[0]) && (
            <p className="text-sm text-muted-foreground">
              Configuring PWS for{' '}
              <strong>
                {resolvedDistrictName || filteredDistricts[0]?.district_name || lockedDistrictCode}{' '}
                ({lockedDistrictCode})
              </strong>
              .
            </p>
          )}
          {allowLinkSync && linkedForDistrict && (
            <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
              Linked: <span className="font-mono font-medium">{linkedForDistrict.pwsid}</span>
              {linkedForDistrict.pws_name ? ` — ${linkedForDistrict.pws_name}` : ''}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {allowLinkSync ? 'Link a PWS' : 'Chosen PWS'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="link-pws">PWSID (e.g. NY3503549)</Label>
              <div className="flex gap-2">
                <Input
                  id="link-pws"
                  value={linkPwsid}
                  onChange={e => {
                    setLinkPwsid(e.target.value);
                    setSelectedRow(null);
                    setHasChosen(false);
                  }}
                  placeholder="9-character PWSID"
                  className="font-mono min-h-[44px] text-base"
                />
                {allowLinkSync ? (
                  <Button
                    onClick={() => void handleLink()}
                    disabled={linkMut.isPending || !linkPwsid.trim()}
                    className="min-h-[44px] text-base shrink-0"
                  >
                    <Link2 className="h-4 w-4 mr-1" />
                    Link & sync
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={handleSelect}
                    disabled={linkPwsid.trim().length < 7}
                    className="min-h-[44px] text-base shrink-0"
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Select
                  </Button>
                )}
              </div>
            </div>
            {allowLinkSync && linkMut.isError && (
              <p className="text-sm text-destructive">
                {(linkMut.error as Error)?.message || 'Link failed'}
              </p>
            )}
            {allowLinkSync && linkMut.isSuccess && (
              <p className="text-sm text-emerald-700">
                Linked {linkMut.data.pwsid} — {linkMut.data.violations_synced} violations,{' '}
                {linkMut.data.enforcement_synced} enforcement actions synced.
              </p>
            )}
            {isReviewer && showPreview && (
              <div className="space-y-3 pt-2 border-t">
                <Label htmlFor="analysis-set">Save to a named review (optional)</Label>
                <div className="flex flex-wrap gap-2">
                  <Select
                    value={analysisSetId}
                    onValueChange={value => {
                      setAnalysisSetId(value);
                      if (value === ANALYSIS_SET_NEW) {
                        setNewReviewName(
                          suggestedAnalysisSetName(selectedRow?.pws_name, selectedPwsid)
                        );
                      }
                    }}
                  >
                    <SelectTrigger id="analysis-set" className="min-h-[44px] min-w-[12rem] text-base">
                      <SelectValue placeholder="Add to existing or new review" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ANALYSIS_SET_NEW}>Create new review</SelectItem>
                      {(analysisSets || []).map(s => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {s.name} ({s.items.length})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {analysisSetId === ANALYSIS_SET_NEW && (
                    <Input
                      id="review-name"
                      className="min-h-[44px] min-w-[12rem] flex-1 text-base"
                      value={newReviewName}
                      onChange={e => setNewReviewName(e.target.value)}
                      placeholder="e.g. West Hempstead comparison"
                      aria-label="Review name"
                    />
                  )}
                  <Button
                    type="button"
                    variant="secondary"
                    className="min-h-[44px] text-base shrink-0"
                    disabled={
                      addItemMut.isPending ||
                      createSetMut.isPending ||
                      (analysisSetId === ANALYSIS_SET_NEW && !newReviewName.trim())
                    }
                    onClick={() => void handleSaveToAnalysis()}
                  >
                    Save for comparison
                  </Button>
                </div>
                <p className="text-sm text-slate-600">
                  Name each review so you can find it later on Water Systems → Analysis.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {autoSuggestPws && !manualSearch ? 'Suggested matches (EPA)' : 'Search EPA (live)'}
            </CardTitle>
            {autoSuggestPws && !manualSearch && autoSearchQuery.length >= 2 ? (
              <CardDescription className="text-sm">
                Searching for &ldquo;{autoSearchQuery}&rdquo; in {lookupState}
              </CardDescription>
            ) : (
              <CardDescription className="text-sm leading-relaxed">
                Case does not matter. Search a town name, a close spelling, an acronym like{' '}
                <span className="font-mono text-slate-700">WWD</span>, or a full PWSID.
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2 flex-wrap">
              <Input
                className="w-20 min-h-[44px] font-mono text-base"
                maxLength={2}
                value={lookupState}
                onChange={e => {
                  setManualSearch(true);
                  setLookupState(e.target.value.toUpperCase());
                }}
                placeholder="ST"
                aria-label="State code"
              />
              <Input
                className="min-h-[44px] min-w-[8rem] flex-1 text-base"
                value={manualSearch || !autoSuggestPws ? lookupQ : autoSearchQuery}
                onChange={e => {
                  setManualSearch(true);
                  setLookupQ(e.target.value);
                }}
                onFocus={() => {
                  if (autoSuggestPws && !manualSearch) {
                    setManualSearch(true);
                    setLookupQ(autoSearchQuery);
                  }
                }}
                placeholder="e.g. westbury, WWD, or NY2902856"
                aria-label="EPA system name, acronym, or full PWSID"
              />
              <Button
                type="button"
                variant="secondary"
                className="min-h-[44px] text-base"
                onClick={handleRunManualSearch}
                disabled={lookupState.length !== 2 || !lookupQueryReady || lookupBusy}
              >
                <Search className="h-4 w-4 mr-1" />
                Search
              </Button>
            </div>
            <p className="text-sm leading-relaxed text-slate-600">
              Results are ranked by similarity. Click Use to preview compliance data in WW360
              {allowLinkSync ? ', then Link & sync to your district' : ''}.
            </p>
            {showLookupResults && (
              <div className="max-h-48 overflow-auto rounded-md border text-base">
                {lookupBusy ? (
                  <p className="p-3 text-slate-600">Searching EPA…</p>
                ) : lookupError ? (
                  <p className="p-3 text-base text-destructive">
                    {(lookupErr as Error)?.message || 'EPA search failed'}
                  </p>
                ) : !rankedLookupRows.length ? (
                  <p className="p-3 text-base leading-relaxed text-slate-600">
                    No close matches in {lookupState}. Try another spelling, a longer place name, or
                    paste the 9-character PWSID into Chosen PWS.
                  </p>
                ) : (
                  <ul className="divide-y">
                    {rankedLookupRows.map(r => (
                      <li
                        key={r.pwsid}
                        className="flex cursor-pointer justify-between gap-2 p-3 hover:bg-muted/50"
                        onClick={() => applySelection(r.pwsid, r)}
                      >
                        <span className="min-w-0">
                          <span className="font-mono font-medium">{r.pwsid}</span>
                          <span className="ml-2 text-slate-600">{r.pws_name}</span>
                          {r.match_reason ? (
                            <span className="mt-1 block text-sm text-slate-500">
                              {r.match_reason}
                              {typeof r.match_score === 'number'
                                ? ` · ${Math.round(r.match_score)}% similar`
                                : ''}
                            </span>
                          ) : null}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          type="button"
                          className="min-h-[44px] shrink-0 text-base"
                        >
                          Use
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {autoSuggestPws && !manualSearch && lookupBusy && !showLookupResults && (
              <p className="text-sm text-slate-600">Loading suggested matches…</p>
            )}
          </CardContent>
        </Card>
      </div>

      {showPreview && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preview in WW360</CardTitle>
            <CardDescription className="text-base">
              Violations and enforcement from EPA — session only unless saved to an analysis set.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {previewLoading ? (
              <p className="text-base text-slate-600">Loading compliance preview…</p>
            ) : previewError ? (
              <p className="text-base text-destructive">
                {(previewErr as Error)?.message || 'Preview failed'}
              </p>
            ) : preview ? (
              <PwsPreviewPanel preview={preview} />
            ) : null}
          </CardContent>
        </Card>
      )}

      {showComplianceLink && allowLinkSync && (
        <p className="text-sm text-muted-foreground">
          After linking, view ongoing compliance on{' '}
          <Link to="/water-systems/compliance" className="text-primary underline">
            Our water system
          </Link>
          .
        </p>
      )}
      {showComplianceLink && isReviewer && !allowLinkSync && (
        <p className="text-sm text-muted-foreground">
          Saved systems for charts and comparison live on{' '}
          <Link to="/water-systems/analysis" className="text-primary underline">
            Water Systems → Analysis
          </Link>
          .
        </p>
      )}
    </div>
  );
}
