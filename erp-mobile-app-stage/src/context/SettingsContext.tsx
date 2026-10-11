import React, { createContext, useCallback, useContext, useState } from 'react';
import { getEnablePacking, getNegativeStockAllowed } from '../api/settings';

interface SettingsState {
  enablePacking: boolean;
  negativeStockAllowed: boolean;
  loaded: boolean;
}

interface SettingsContextValue extends SettingsState {
  reload: (companyId: string | null) => Promise<void>;
}

const defaultState: SettingsState = {
  enablePacking: false,
  negativeStockAllowed: false,
  loaded: false,
};

const SettingsContext = createContext<SettingsContextValue>({
  ...defaultState,
  reload: async () => {},
});

/** Per-company feature flags (enable_packing, negative stock, etc.). Call reload(companyId) from App.tsx on login/company change. */
export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SettingsState>(defaultState);

  const reload = useCallback(async (companyId: string | null) => {
    if (!companyId) {
      setState({ enablePacking: false, negativeStockAllowed: false, loaded: true });
      return;
    }
    try {
      const [enablePacking, negativeStockAllowed] = await Promise.all([
        getEnablePacking(companyId),
        getNegativeStockAllowed(companyId),
      ]);
      setState({ enablePacking, negativeStockAllowed, loaded: true });
    } catch {
      setState({ enablePacking: false, negativeStockAllowed: false, loaded: true });
    }
  }, []);

  return (
    <SettingsContext.Provider value={{ ...state, reload }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  return useContext(SettingsContext);
}
