import React, { createContext, useCallback, useContext, useState } from 'react';
import { getEnablePacking } from '../api/settings';

interface SettingsState {
  enablePacking: boolean;
  loaded: boolean;
}

interface SettingsContextValue extends SettingsState {
  reload: (companyId: string | null) => Promise<void>;
}

const defaultState: SettingsState = {
  enablePacking: false,
  loaded: false,
};

const SettingsContext = createContext<SettingsContextValue>({
  ...defaultState,
  reload: async () => {},
});

/** Per-company feature flags (enable_packing, etc.). Call reload(companyId) from App.tsx on login/company change. */
export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SettingsState>(defaultState);

  const reload = useCallback(async (companyId: string | null) => {
    if (!companyId) {
      setState({ enablePacking: false, loaded: true });
      return;
    }
    try {
      const enablePacking = await getEnablePacking(companyId);
      setState({ enablePacking, loaded: true });
    } catch {
      setState({ enablePacking: false, loaded: true });
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
