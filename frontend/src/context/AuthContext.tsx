import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  fetchMe,
  getStoredToken,
  login as apiLogin,
  logout as apiLogout,
  redeemHandoff,
  type WW360User,
} from '@/services/authService';

interface AuthContextValue {
  user: WW360User | null;
  userRoles: string[];
  loading: boolean;
  isAuthenticated: boolean;
  isOwwPartner: boolean;
  isStateAdmin: boolean;
  isPlatformAdmin: boolean;
  activeStateCode: string;
  /** AquaSafe-compatible aliases used by ported workforce UI */
  isAdmin: boolean;
  isGlobalAdmin: boolean;
  isSystemAdmin: boolean;
  isCeuAdmin: boolean;
  isWorkforceOperator: boolean;
  isDistrictUser: boolean;
  isDistrictManager: boolean;
  canManageWorkforce: boolean;
  actingDistrictCode: string | null;
  login: (username: string, password: string) => Promise<void>;
  applySessionUser: (user: WW360User) => void;
  redeemHandoffCode: (code: string) => Promise<void>;
  logout: () => void;
  hasAnyRole: (...roles: string[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<WW360User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      setUser(await fetchMe());
    } catch {
      apiLogout();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  const login = useCallback(async (username: string, password: string) => {
    const data = await apiLogin(username, password);
    setUser(data.user);
  }, []);

  const applySessionUser = useCallback((next: WW360User) => {
    setUser(next);
  }, []);

  const redeemHandoffCode = useCallback(async (code: string) => {
    const data = await redeemHandoff(code);
    setUser(data.user);
  }, []);

  const logout = useCallback(() => {
    apiLogout();
    setUser(null);
  }, []);

  const hasAnyRole = useCallback(
    (...roles: string[]) => {
      const mine = Array.isArray(user?.roles) ? user!.roles : [];
      return roles.some(r => mine.includes(r));
    },
    [user]
  );

  const userRoles = user?.roles ?? [];
  const isPlatformAdmin = hasAnyRole('platform_admin');
  const isStateAdmin = hasAnyRole('state_admin', 'oww_partner');

  const value = useMemo(
    () => ({
      user,
      userRoles,
      loading,
      isAuthenticated: !!user,
      isOwwPartner: hasAnyRole('oww_partner'),
      isStateAdmin,
      isPlatformAdmin,
      activeStateCode: user?.active_state_code ?? 'NY',
      isAdmin: isPlatformAdmin || hasAnyRole('district_admin', 'admin'),
      isGlobalAdmin: isPlatformAdmin,
      isSystemAdmin: isPlatformAdmin,
      isCeuAdmin: hasAnyRole('ceu_admin'),
      isWorkforceOperator: hasAnyRole('workforce_operator', 'ceu_user', 'district_operator'),
      isDistrictUser: hasAnyRole(
        'district_admin',
        'district_manager',
        'district_operator',
        'ceu_user',
        'district_viewer'
      ),
      isDistrictManager: hasAnyRole('district_admin', 'district_manager', 'ceu_manager', 'workforce_manager'),
      canManageWorkforce: hasAnyRole(
        'district_admin',
        'admin',
        'ceu_admin',
        'workforce_manager',
        'district_manager',
        'ceu_manager'
      ),
      actingDistrictCode: user?.districts?.[0] ?? null,
      login,
      applySessionUser,
      redeemHandoffCode,
      logout,
      hasAnyRole,
    }),
    [user, loading, login, applySessionUser, redeemHandoffCode, logout, hasAnyRole, userRoles, isPlatformAdmin, isStateAdmin]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
