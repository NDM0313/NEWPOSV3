import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { getFeaturePermissionV2, setFeaturePermissionV2Storage } from '@/app/config/featureFlags';

type FeatureFlagContextType = {
  permissionV2: boolean;
  setPermissionV2: (value: boolean) => void;
};

const FeatureFlagContext = createContext<FeatureFlagContextType | undefined>(undefined);

export function FeatureFlagProvider({ children }: { children: React.ReactNode }) {
  const [permissionV2, setPermissionV2State] = useState(getFeaturePermissionV2);

  useEffect(() => {
    setPermissionV2State(getFeaturePermissionV2());
  }, []);

  const setPermissionV2 = useMemo(
    () => (value: boolean) => {
      setFeaturePermissionV2Storage(value);
      setPermissionV2State(value);
    },
    []
  );

  const value = useMemo(
    () => ({ permissionV2, setPermissionV2 }),
    [permissionV2, setPermissionV2]
  );

  return (
    <FeatureFlagContext.Provider value={value}>
      {children}
    </FeatureFlagContext.Provider>
  );
}

export function useFeatureFlag(): FeatureFlagContextType {
  const ctx = useContext(FeatureFlagContext);
  if (ctx === undefined) {
    throw new Error('useFeatureFlag must be used within FeatureFlagProvider');
  }
  return ctx;
}

/** Safe version: when outside provider, defaults to permissionV2 = true so the tab shows. */
export function useFeatureFlagOptional(): FeatureFlagContextType {
  const ctx = useContext(FeatureFlagContext);
  if (ctx !== undefined) return ctx;
  return {
    permissionV2: true,
    setPermissionV2: () => {},
  };
}
