import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Who } from '../engine/types';
import { checkParentPin } from '../db/db';

/**
 * Vivi mode is the default. Parent mode is PIN-protected and drops back to Vivi mode after ten
 * minutes in the background or when the parent taps "Back to Vivi". Everything parent mode can see
 * is listed on the "What a parent can see" card, which Vivi can open any time.
 */
interface ModeApi {
  mode: Who;
  enterParent: (pin: string) => Promise<boolean>;
  leaveParent: () => void;
}
const Ctx = createContext<ModeApi>({ mode: 'athlete', enterParent: async () => false, leaveParent: () => undefined });
export const useMode = () => useContext(Ctx);

const RELOCK_AFTER_MS = 10 * 60 * 1000;

export function ModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<Who>('athlete');
  const enterParent = useCallback(async (pin: string) => {
    const ok = await checkParentPin(pin);
    if (ok) setMode('parent');
    return ok;
  }, []);
  const leaveParent = useCallback(() => setMode('athlete'), []);
  useEffect(() => {
    if (mode !== 'parent') return;
    let hiddenAt = 0;
    const onVis = () => {
      if (document.visibilityState === 'hidden') hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > RELOCK_AFTER_MS) setMode('athlete');
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [mode]);
  const api = useMemo(() => ({ mode, enterParent, leaveParent }), [mode, enterParent, leaveParent]);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
