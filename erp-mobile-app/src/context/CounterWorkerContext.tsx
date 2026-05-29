import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { AuthProfile } from '../api/auth';
import type { User } from '../types';
import {
  COUNTER_WRONG_PIN_MESSAGE,
  COUNTER_WRONG_USER_MESSAGE,
  verifyWorkerPin,
  type CounterWorkerProfile,
} from '../lib/counterWorkerRegistry';
import { markUnlocked } from '../lib/pinLock';
import { usePermissions } from './PermissionContext';

export type { CounterWorkerProfile } from '../lib/counterWorkerRegistry';

export function authProfileToCounterWorker(profile: AuthProfile): CounterWorkerProfile {
  return {
    userId: profile.userId,
    profileId: profile.profileId,
    name: profile.name,
    email: profile.email,
    role: profile.role,
    branchId: profile.branchId ?? null,
    branchLocked: profile.branchLocked,
    companyId: profile.companyId ?? '',
  };
}

export type SelectWorkerResult = { ok: true } | { ok: false; error: string };

interface CounterWorkerContextValue {
  activeCounterWorkerProfile: CounterWorkerProfile | null;
  isCounterLocked: boolean;
  activateWorker: (profile: CounterWorkerProfile) => void;
  activateWorkerFromAuthProfile: (profile: AuthProfile) => void;
  selectWorker: (
    pin: string,
    expectedUserId?: string | null,
    companyId?: string | null,
  ) => Promise<SelectWorkerResult>;
  temporaryLock: () => void;
  requestCounterLock: () => void;
  unlockCounter: () => void;
  resetCounterState: () => void;
}

const CounterWorkerContext = createContext<CounterWorkerContextValue | null>(null);

export function CounterWorkerProvider({ children }: { children: React.ReactNode }) {
  const { reload } = usePermissions();
  const [activeCounterWorkerProfile, setActiveCounterWorkerProfile] = useState<CounterWorkerProfile | null>(null);
  const [isCounterLocked, setIsCounterLocked] = useState(false);

  const activateWorker = useCallback((profile: CounterWorkerProfile) => {
    setActiveCounterWorkerProfile(profile);
    setIsCounterLocked(false);
  }, []);

  const activateWorkerFromAuthProfile = useCallback(
    (profile: AuthProfile) => {
      activateWorker(authProfileToCounterWorker(profile));
    },
    [activateWorker],
  );

  const selectWorker = useCallback(
    async (
      pin: string,
      expectedUserId?: string | null,
      companyId?: string | null,
    ): Promise<SelectWorkerResult> => {
      const profile = await verifyWorkerPin(pin, expectedUserId, companyId);
      if (!profile) {
        return {
          ok: false,
          error: expectedUserId ? COUNTER_WRONG_USER_MESSAGE : COUNTER_WRONG_PIN_MESSAGE,
        };
      }
      activateWorker(profile);
      markUnlocked();
      return { ok: true };
    },
    [activateWorker],
  );

  const temporaryLock = useCallback(() => {
    setActiveCounterWorkerProfile(null);
    setIsCounterLocked(true);
  }, []);

  const requestCounterLock = useCallback(() => {
    setIsCounterLocked(true);
  }, []);

  const unlockCounter = useCallback(() => {
    setIsCounterLocked(false);
  }, []);

  const resetCounterState = useCallback(() => {
    setActiveCounterWorkerProfile(null);
    setIsCounterLocked(false);
  }, []);

  useEffect(() => {
    const worker = activeCounterWorkerProfile;
    if (!worker?.userId || !worker.role) return;
    void reload(worker.userId, worker.role, worker.profileId, worker.companyId || undefined);
  }, [activeCounterWorkerProfile, reload]);

  const value = useMemo(
    (): CounterWorkerContextValue => ({
      activeCounterWorkerProfile,
      isCounterLocked,
      activateWorker,
      activateWorkerFromAuthProfile,
      selectWorker,
      temporaryLock,
      requestCounterLock,
      unlockCounter,
      resetCounterState,
    }),
    [
      activeCounterWorkerProfile,
      isCounterLocked,
      activateWorker,
      activateWorkerFromAuthProfile,
      selectWorker,
      temporaryLock,
      requestCounterLock,
      unlockCounter,
      resetCounterState,
    ],
  );

  return <CounterWorkerContext.Provider value={value}>{children}</CounterWorkerContext.Provider>;
}

export function useCounterWorker(): CounterWorkerContextValue {
  const ctx = useContext(CounterWorkerContext);
  if (!ctx) {
    throw new Error('useCounterWorker must be used within CounterWorkerProvider');
  }
  return ctx;
}

export function useEffectiveWorkerId(sessionUserId: string): string {
  const { activeCounterWorkerProfile } = useCounterWorker();
  return activeCounterWorkerProfile?.userId ?? sessionUserId;
}

export function useEffectiveWorkerRole(sessionRole: string): string {
  const { activeCounterWorkerProfile } = useCounterWorker();
  return activeCounterWorkerProfile?.role ?? sessionRole;
}

export function useEffectiveWorkerProfileId(): string | null {
  const { activeCounterWorkerProfile } = useCounterWorker();
  return activeCounterWorkerProfile?.profileId ?? null;
}

export interface EffectiveWorkerProfile {
  userId: string;
  profileId: string | null;
  displayName: string;
  email: string;
  role: string;
  branchId: string | null;
  isWorkerActive: boolean;
  sessionUser: User;
}

/** Composite identity: counter worker when active, else Supabase session user. */
export function useEffectiveWorkerProfile(sessionUser: User | null): EffectiveWorkerProfile | null {
  const { activeCounterWorkerProfile } = useCounterWorker();
  return useMemo((): EffectiveWorkerProfile | null => {
    if (!sessionUser) return null;
    const worker = activeCounterWorkerProfile;
    if (worker) {
      return {
        userId: worker.userId,
        profileId: worker.profileId ?? null,
        displayName: worker.name?.trim() || sessionUser.name,
        email: worker.email?.trim() || sessionUser.email,
        role: worker.role || sessionUser.role,
        branchId: worker.branchId ?? null,
        isWorkerActive: true,
        sessionUser,
      };
    }
    return {
      userId: sessionUser.id,
      profileId: sessionUser.profileId ?? null,
      displayName: sessionUser.name,
      email: sessionUser.email,
      role: sessionUser.role,
      branchId: sessionUser.branchId ?? null,
      isWorkerActive: false,
      sessionUser,
    };
  }, [activeCounterWorkerProfile, sessionUser]);
}
