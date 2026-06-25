import { useCallback, useEffect, useState } from 'react';
import {
  resolveUnifiedLedgerEngineState,
  type ResolveUnifiedLedgerEngineStateOptions,
  type UnifiedLedgerEngineState,
} from '@/app/lib/unifiedLedgerEngineState';

const DEFAULT_STATE: UnifiedLedgerEngineState = {
  mode: 'legacy',
  killSwitchActive: false,
  companyEngineEnabled: false,
  screenFlagEnabled: false,
  pilotEnabled: false,
  localOverride: null,
  rpcAllowed: false,
};

export function useUnifiedLedgerEngineState(
  companyId: string | null | undefined,
  options: ResolveUnifiedLedgerEngineStateOptions = {}
) {
  const [state, setState] = useState<UnifiedLedgerEngineState>(DEFAULT_STATE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!companyId) {
        setState(DEFAULT_STATE);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const resolved = await resolveUnifiedLedgerEngineState(companyId, options);
        if (!cancelled) setState(resolved);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to resolve engine state');
          setState(DEFAULT_STATE);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    companyId,
    options.screenId,
    options.adminTieOut,
    options.shadowForce,
    refreshKey,
  ]);

  return { state, loading, error, refresh };
}
