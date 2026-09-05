/**
 * Link a public water system (PWSID) and search EPA — used in District Admin Hub
 * and on the SDWIS Compliance page.
 */
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
import {
  useLinkSDWISSystem,
  useSaveDistrictRememberedPwsid,
  useSDWISDistrictRememberedPwsids,
  useSDWISLinkedSystems,
  useSDWISLookup,
} from '@/hooks/useSDWIS';
import { useDistricts } from '@/hooks/useDistricts';
import { derivePwsSearchQuery, rankPwsLookupRows } from '@/services/sdwisService';
import { Link2, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

/** Radix Select requires non-empty item values; means “use tenant context district”. */
const DISTRICT_SELECT_DEFAULT = '__tenant_default__';

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
}

export function DistrictPwsLinkConfigSection({
  lockedDistrictCode,
  districts: districtsProp,
  showComplianceLink = false,
  districtName,
  stateCode,
  autoSuggestPws = false,
}: DistrictPwsLinkConfigSectionProps) {
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
  const linkMut = useLinkSDWISSystem();
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

  /** Pre-fill PWSID when district is selected and field empty: linked system, then remembered. */
  useEffect(() => {
    if (!effectiveDistrictCode || linkPwsid.trim()) return;
    const linked = systems?.find(s => (s.district_code || '') === effectiveDistrictCode);
    if (linked?.pwsid) {
      setLinkPwsid(linked.pwsid);
      return;
    }
    const remembered = rememberedByDistrict.get(effectiveDistrictCode);
    if (remembered) setLinkPwsid(remembered);
  }, [effectiveDistrictCode, linkPwsid, systems, rememberedByDistrict]);

  /** Debounced save when user types a PWSID with an explicit district selected. */
  useEffect(() => {
    if (!effectiveDistrictCode) return;
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
  }, [effectiveDistrictCode, linkPwsid]);

  const handleDistrictChange = (value: string) => {
    if (lockedDistrictCode) return;
    if (value === DISTRICT_SELECT_DEFAULT) {
      setLinkDistrictCode(null);
      setLinkPwsid('');
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
    setLinkPwsid(linked?.pwsid ?? remembered ?? '');
  };

  const handleLink = async () => {
    if (!linkPwsid.trim()) return;
    const pid = linkPwsid.trim().toUpperCase();
    if (effectiveDistrictCode) {
      persistRememberedPwsid(effectiveDistrictCode, pid);
    }
    await linkMut.mutateAsync({
      pwsid: pid,
      districtCode: effectiveDistrictCode ?? undefined,
    });
    setLinkPwsid('');
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Public water system (PWS)</CardTitle>
          <CardDescription>
            Link your district&apos;s EPA public water system ID so SDWIS violations, enforcement,
            and compliance reporting can use live federal data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!lockedDistrictCode && (
            <>
              <p className="text-sm text-muted-foreground">
                Pick a water district by name to pre-fill the EPA search and to control which
                district a linked PWS is assigned to. When you choose a PWSID (search or type), it
                is saved for that district so the next visit pre-fills the link field.
              </p>
              {districtsLoading ? (
                <p className="text-sm text-muted-foreground">Loading districts…</p>
              ) : (
                <div className="space-y-2 max-w-md">
                  <Label htmlFor="sdwis-district">Water district</Label>
                  <Select
                    value={linkDistrictCode ?? DISTRICT_SELECT_DEFAULT}
                    onValueChange={handleDistrictChange}
                  >
                    <SelectTrigger id="sdwis-district" className="w-full max-w-md">
                      <SelectValue placeholder="Select district" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={DISTRICT_SELECT_DEFAULT}>
                        Account default (from your login)
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
          {linkedForDistrict && (
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
            <CardTitle className="text-base">Link a PWS</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="link-pws">PWSID (e.g. NY3503549)</Label>
              <div className="flex gap-2">
                <Input
                  id="link-pws"
                  value={linkPwsid}
                  onChange={e => setLinkPwsid(e.target.value)}
                  placeholder="9-character PWSID"
                  className="font-mono"
                />
                <Button
                  onClick={() => void handleLink()}
                  disabled={linkMut.isPending || !linkPwsid.trim()}
                >
                  <Link2 className="h-4 w-4 mr-1" />
                  Link & sync
                </Button>
              </div>
            </div>
            {linkMut.isError && (
              <p className="text-sm text-destructive">
                {(linkMut.error as Error)?.message || 'Link failed'}
              </p>
            )}
            {linkMut.isSuccess && (
              <p className="text-sm text-emerald-700">
                Linked {linkMut.data.pwsid} — {linkMut.data.violations_synced} violations,{' '}
                {linkMut.data.enforcement_synced} enforcement actions synced.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {autoSuggestPws && !manualSearch ? 'Suggested matches (EPA)' : 'Search EPA (live)'}
            </CardTitle>
            {autoSuggestPws && !manualSearch && autoSearchQuery.length >= 2 && (
              <CardDescription>
                Searching for &ldquo;{autoSearchQuery}&rdquo; in {lookupState}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2 flex-wrap">
              <Input
                className="w-20 font-mono"
                maxLength={2}
                value={lookupState}
                onChange={e => {
                  setManualSearch(true);
                  setLookupState(e.target.value.toUpperCase());
                }}
                placeholder="ST"
              />
              <Input
                className="flex-1 min-w-[8rem]"
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
                placeholder="Name or PWSID fragment"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={handleRunManualSearch}
                disabled={lookupState.length !== 2 || !lookupQueryReady || lookupBusy}
              >
                <Search className="h-4 w-4 mr-1" />
                Search
              </Button>
            </div>
            {showLookupResults && (
              <div className="border rounded-md max-h-48 overflow-auto text-sm">
                {lookupBusy ? (
                  <p className="p-2 text-muted-foreground">Searching EPA…</p>
                ) : lookupError ? (
                  <p className="p-2 text-destructive text-sm">
                    {(lookupErr as Error)?.message || 'EPA search failed'}
                  </p>
                ) : !rankedLookupRows.length ? (
                  <p className="p-2 text-muted-foreground">
                    No matches found. Try a different name or state.
                  </p>
                ) : (
                  <ul className="divide-y">
                    {rankedLookupRows.map(r => (
                      <li
                        key={r.pwsid}
                        className="p-2 flex justify-between gap-2 hover:bg-muted/50 cursor-pointer"
                        onClick={() => {
                          setLinkPwsid(r.pwsid);
                          if (effectiveDistrictCode) {
                            persistRememberedPwsid(effectiveDistrictCode, r.pwsid);
                          }
                        }}
                      >
                        <span>
                          <span className="font-mono font-medium">{r.pwsid}</span>
                          <span className="text-muted-foreground ml-2">{r.pws_name}</span>
                        </span>
                        <Button size="sm" variant="ghost" type="button">
                          Use
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {autoSuggestPws && !manualSearch && lookupBusy && !showLookupResults && (
              <p className="text-sm text-muted-foreground">Loading suggested matches…</p>
            )}
          </CardContent>
        </Card>
      </div>

      {showComplianceLink && (
        <p className="text-sm text-muted-foreground">
          View violations and enforcement details on{' '}
          <Link to="/water-systems/compliance" className="text-primary underline">
            SDWIS Compliance
          </Link>
          .
        </p>
      )}
    </div>
  );
}
