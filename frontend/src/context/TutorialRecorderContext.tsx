/**
 * Global tutorial recorder session — survives route changes while recording.
 */
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

export interface TutorialRecorderLaunchOptions {
  documentTitle?: string;
  /** When set, publish saves to the Document Studio library. */
  studioTarget?: {
    scope?: string;
    folderId?: string;
    /** Update this tutorial document on publish instead of creating a new draft. */
    existingDocumentId?: string;
  };
  /** Route when recorder was opened (pathname + search). */
  originRoute?: string;
  onPublished?: (docId: string) => void;
  onSaved?: () => void;
  /** Sync controlled open state (sidebar entry). */
  onOpenChange?: (open: boolean) => void;
}

interface TutorialRecorderContextValue {
  isOpen: boolean;
  launch: TutorialRecorderLaunchOptions | null;
  openRecorder: (options: TutorialRecorderLaunchOptions) => void;
  closeRecorder: () => void;
  /** True while a recording session is active (recording or post-stop review). */
  sessionActive: boolean;
  setSessionActive: (active: boolean) => void;
}

const TutorialRecorderContext = createContext<TutorialRecorderContextValue | null>(null);

export function TutorialRecorderProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [launch, setLaunch] = useState<TutorialRecorderLaunchOptions | null>(null);
  const callbacksRef = useRef<{
    onPublished?: (docId: string) => void;
    onSaved?: () => void;
  }>({});

  const openRecorder = useCallback(
    (options: TutorialRecorderLaunchOptions) => {
      callbacksRef.current = {};
      if (options.onPublished) callbacksRef.current.onPublished = options.onPublished;
      if (options.onSaved) callbacksRef.current.onSaved = options.onSaved;
      setLaunch({
        ...options,
        originRoute: options.originRoute ?? `${location.pathname}${location.search}`,
      });
      setIsOpen(true);
    },
    [location.pathname, location.search]
  );

  const launchRef = useRef<TutorialRecorderLaunchOptions | null>(null);
  launchRef.current = launch;

  const closeRecorder = useCallback(() => {
    launchRef.current?.onOpenChange?.(false);
    setIsOpen(false);
    setSessionActive(false);
  }, []);

  const value = useMemo(
    () => ({
      isOpen,
      launch,
      openRecorder,
      closeRecorder,
      sessionActive,
      setSessionActive,
    }),
    [isOpen, launch, openRecorder, closeRecorder, sessionActive]
  );

  return (
    <TutorialRecorderContext.Provider value={value}>{children}</TutorialRecorderContext.Provider>
  );
}

export function useTutorialRecorder() {
  const ctx = useContext(TutorialRecorderContext);
  if (!ctx) {
    throw new Error('useTutorialRecorder must be used within TutorialRecorderProvider');
  }
  return ctx;
}

/** Optional hook for entry points outside the provider tree (returns null). */
export function useTutorialRecorderOptional() {
  return useContext(TutorialRecorderContext);
}

export function getTutorialRecorderCallbacks(
  launch: TutorialRecorderLaunchOptions | null
): { onPublished?: (docId: string) => void; onSaved?: () => void } {
  return {
    ...(launch?.onPublished ? { onPublished: launch.onPublished } : {}),
    ...(launch?.onSaved ? { onSaved: launch.onSaved } : {}),
  };
}
