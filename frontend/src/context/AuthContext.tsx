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
  isPlatformAdmin: boolean;
  login: (username: string, password: string) => Promise<void>;
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

  const redeemHandoffCode = useCallback(async (code: string) => {
    const data = await redeemHandoff(code);
    setUser(data.user);
  }, []);

  const logout = useCallback(() => {
    apiLogout();
    setUser(null);
  }, []);

  const hasAnyRole = useCallback(
    (...roles: string[]) => roles.some(r => user?.roles.includes(r)),
    [user]
  );

  const userRoles = user?.roles ?? [];

  const value = useMemo(
    () => ({
      user,
      userRoles,
      loading,
      isAuthenticated: !!user,
      isOwwPartner: hasAnyRole('oww_partner'),
      isPlatformAdmin: hasAnyRole('platform_admin'),
      login,
      redeemHandoffCode,
      logout,
      hasAnyRole,
    }),
    [user, loading, login, redeemHandoffCode, logout, hasAnyRole, userRoles]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
