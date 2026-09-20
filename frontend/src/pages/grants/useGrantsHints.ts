import { useCallback, useEffect, useState } from 'react';
import { GRANTS_HINTS_STORAGE_KEY } from './grantsHints';

function readEnabled(): boolean {
  try {
    const raw = localStorage.getItem(GRANTS_HINTS_STORAGE_KEY);
    if (raw == null) return true;
    return raw !== '0' && raw !== 'false';
  } catch {
    return true;
  }
}

/** Grants Studio hover hints — on by default; persisted so users can shut them off. */
export function useGrantsHints() {
  const [enabled, setEnabledState] = useState(true);

  useEffect(() => {
    setEnabledState(readEnabled());
  }, []);

  const setEnabled = useCallback((next: boolean) => {
    setEnabledState(next);
    try {
      localStorage.setItem(GRANTS_HINTS_STORAGE_KEY, next ? '1' : '0');
    } catch {
      /* ignore quota / private mode */
    }
  }, []);

  const toggle = useCallback(() => {
    setEnabled(!enabled);
  }, [enabled, setEnabled]);

  return { hintsEnabled: enabled, setHintsEnabled: setEnabled, toggleHints: toggle };
}
