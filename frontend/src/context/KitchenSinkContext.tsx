import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  personaKeyFromUser,
  resolveWorkspaceProfile,
  type WorkspaceProfile,
} from '@/utils/workspaceProfile';
import {
  readKitchenSink,
  writeKitchenSink,
} from '@/utils/kitchenSinkPreference';
import { ACTOR_TOKEN_KEY } from '@/services/impersonationService';

interface KitchenSinkContextValue {
  kitchenSink: boolean;
  setKitchenSink: (enabled: boolean) => void;
  workspaceProfile: WorkspaceProfile;
  personaKey: string | null;
  actorUserId: number | null;
}

const KitchenSinkContext = React.createContext<KitchenSinkContextValue | undefined>(undefined);

function resolveActorUserIdFromToken(actorToken: string | null): number | null {
  if (!actorToken) return null;
  try {
    const payload = JSON.parse(atob(actorToken.split('.')[1] ?? '')) as { sub?: string };
    const sub = payload.sub;
    return sub ? Number(sub) : null;
  } catch {
    return null;
  }
}

export const KitchenSinkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const impersonating = Boolean(user?.impersonation?.active);
  const personaKey = personaKeyFromUser(user);
  const workspaceProfile = resolveWorkspaceProfile(user, personaKey);
  const actorUserId = impersonating
    ? resolveActorUserIdFromToken(localStorage.getItem(ACTOR_TOKEN_KEY))
    : (user?.id ?? null);

  const [kitchenSink, setKitchenSinkState] = useState(false);

  useEffect(() => {
    if (actorUserId != null) {
      setKitchenSinkState(readKitchenSink(actorUserId));
    } else {
      setKitchenSinkState(false);
    }
  }, [actorUserId]);

  const setKitchenSink = useCallback(
    (enabled: boolean) => {
      if (actorUserId == null) return;
      writeKitchenSink(actorUserId, enabled);
      setKitchenSinkState(enabled);
    },
    [actorUserId]
  );

  const value = useMemo(
    () => ({
      kitchenSink,
      setKitchenSink,
      workspaceProfile,
      personaKey,
      actorUserId,
    }),
    [kitchenSink, setKitchenSink, workspaceProfile, personaKey, actorUserId]
  );

  return <KitchenSinkContext.Provider value={value}>{children}</KitchenSinkContext.Provider>;
};

export function useKitchenSink(): KitchenSinkContextValue {
  const ctx = React.useContext(KitchenSinkContext);
  if (!ctx) throw new Error('useKitchenSink must be used within KitchenSinkProvider');
  return ctx;
}
