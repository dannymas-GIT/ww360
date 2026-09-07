import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  fetchJurisdictionPack,
  fetchPublicJurisdictionPack,
  setActiveState,
  type JurisdictionPack,
} from '@/services/jurisdictionService';
import { AUTH_TOKEN_KEY } from '@/services/authService';

interface JurisdictionContextValue {
  activeState: string;
  pack: JurisdictionPack | null;
  packLoading: boolean;
  switchState: (stateCode: string) => Promise<void>;
  regionLabels: string[];
}

const JurisdictionContext = createContext<JurisdictionContextValue | undefined>(undefined);

const NY_FALLBACK: JurisdictionPack = {
  state_code: 'NY',
  partner_name: 'One Water Workforce',
  section_eyebrow: 'One Water Workforce · New York Section AWWA',
  geography_phrase: 'across New York',
  landing_tagline: 'Built with One Water Workforce · for New York water districts',
  landing_headline_accent: 'for New York utilities.',
  exec_description:
    'Live EPA SDWIS compliance for New York, plus sample program metrics for Learning Stream, onewaterworkforce.org, and utility Continuity reporting until those feeds are connected.',
  landscape_description:
    'State view for New York — active community water systems, compliance pressure, and grade demand estimates.',
  sdwis_default_state: 'NY',
  economic_regions: [],
  exec_tour: { intro: '', sources: '', sdwis: '' },
  analytics_geo_hints: [],
};

export const JurisdictionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, applySessionUser, isAuthenticated } = useAuth();
  const [pack, setPack] = useState<JurisdictionPack | null>(null);
  const [packLoading, setPackLoading] = useState(false);

  const activeState = (user?.active_state_code || 'NY').toUpperCase().slice(0, 2);

  const loadPack = useCallback(async (state: string) => {
    setPackLoading(true);
    try {
      const data = isAuthenticated
        ? await fetchJurisdictionPack(state)
        : await fetchPublicJurisdictionPack(state);
      setPack(data);
    } catch {
      setPack({ ...NY_FALLBACK, state_code: state.toUpperCase().slice(0, 2) });
    } finally {
      setPackLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void loadPack(activeState);
  }, [activeState, loadPack]);

  const switchState = useCallback(
    async (stateCode: string) => {
      const result = await setActiveState(stateCode);
      localStorage.setItem(AUTH_TOKEN_KEY, result.access_token);
      applySessionUser(result.user);
      await loadPack(result.user.active_state_code || stateCode);
    },
    [applySessionUser, loadPack]
  );

  const regionLabels = useMemo(
    () => (pack?.economic_regions?.length ? pack.economic_regions.map(r => r.label) : []),
    [pack]
  );

  const value = useMemo(
    () => ({
      activeState,
      pack,
      packLoading,
      switchState,
      regionLabels,
    }),
    [activeState, pack, packLoading, switchState, regionLabels]
  );

  return <JurisdictionContext.Provider value={value}>{children}</JurisdictionContext.Provider>;
};

/** Landing-only provider (no auth). */
export const PublicJurisdictionProvider: React.FC<{
  stateCode: string;
  children: React.ReactNode;
}> = ({ stateCode, children }) => {
  const [pack, setPack] = useState<JurisdictionPack | null>(null);
  const [packLoading, setPackLoading] = useState(true);

  useEffect(() => {
    setPackLoading(true);
    void fetchPublicJurisdictionPack(stateCode)
      .then(setPack)
      .catch(() => setPack({ ...NY_FALLBACK, state_code: stateCode.toUpperCase().slice(0, 2) }))
      .finally(() => setPackLoading(false));
  }, [stateCode]);

  const regionLabels = pack?.economic_regions?.map(r => r.label) ?? [];

  const value = useMemo(
    () => ({
      activeState: stateCode.toUpperCase().slice(0, 2),
      pack,
      packLoading,
      switchState: async () => {},
      regionLabels,
    }),
    [stateCode, pack, packLoading, regionLabels]
  );

  return <JurisdictionContext.Provider value={value}>{children}</JurisdictionContext.Provider>;
};

export function useJurisdiction(): JurisdictionContextValue {
  const ctx = useContext(JurisdictionContext);
  if (!ctx) throw new Error('useJurisdiction must be used within JurisdictionProvider');
  return ctx;
}

export function useJurisdictionOptional(): JurisdictionContextValue | null {
  return useContext(JurisdictionContext) ?? null;
}

export { NY_FALLBACK as jurisdictionNyFallback };
