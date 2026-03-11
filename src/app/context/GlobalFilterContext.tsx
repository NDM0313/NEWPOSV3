/**
 * Global Filter Engine — DIN COUTURE ERP
 * Centralized date range and branch filters controlled from TopHeader.
 * State persists across module navigation (localStorage).
 * Defaults: Dashboard = Last 7 Days, other modules = Last 30 Days.
 */

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef, ReactNode } from 'react';
import { useSupabase } from './SupabaseContext';

const STORAGE_KEY = 'erp-global-filters';

export type GlobalDateRangeType =
  | 'today'
  | 'last7days'
  | 'last15days'
  | 'last30days'
  | 'last90days'
  | 'thisWeek'
  | 'thisMonth'
  | 'thisYear'
  | 'fromStart'
  | 'customRange';

export type GlobalFilterModule =
  | 'dashboard'
  | 'sales'
  | 'purchases'
  | 'expenses'
  | 'inventory'
  | 'studio'
  | 'accounting'
  | 'reports'
  | 'rentals'
  | 'default';

export interface PersistedFilters {
  dateRangeType: GlobalDateRangeType | null;
  customStartDate: string | null;
  customEndDate: string | null;
  branchId: string | null;
}

function getDateRangeForType(type: GlobalDateRangeType, customStart?: string | null, customEnd?: string | null): { startDate: Date; endDate: Date } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = new Date(today);
  endDate.setHours(23, 59, 59, 999);

  if (type === 'customRange' && customStart && customEnd) {
    const start = new Date(customStart);
    start.setHours(0, 0, 0, 0);
    const end = new Date(customEnd);
    end.setHours(23, 59, 59, 999);
    return { startDate: start, endDate: end };
  }

  switch (type) {
    case 'fromStart':
      return { startDate: new Date(today.getFullYear() - 10, 0, 1), endDate };
    case 'today':
      return { startDate: today, endDate };
    case 'last7days': {
      const s = new Date(today);
      s.setDate(today.getDate() - 6);
      return { startDate: s, endDate };
    }
    case 'last15days': {
      const s = new Date(today);
      s.setDate(today.getDate() - 14);
      return { startDate: s, endDate };
    }
    case 'last30days': {
      const s = new Date(today);
      s.setDate(today.getDate() - 29);
      return { startDate: s, endDate };
    }
    case 'last90days': {
      const s = new Date(today);
      s.setDate(today.getDate() - 89);
      return { startDate: s, endDate };
    }
    case 'thisWeek': {
      const s = new Date(today);
      s.setDate(today.getDate() - today.getDay());
      return { startDate: s, endDate };
    }
    case 'thisMonth': {
      const s = new Date(today.getFullYear(), today.getMonth(), 1);
      return { startDate: s, endDate };
    }
    case 'thisYear': {
      const s = new Date(today.getFullYear(), 0, 1);
      return { startDate: s, endDate };
    }
    default:
      return { startDate: today, endDate };
  }
}

function loadFromStorage(): PersistedFilters {
  const empty: PersistedFilters = { dateRangeType: null, customStartDate: null, customEndDate: null, branchId: null };
  if (typeof window === 'undefined') return empty;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<PersistedFilters>;
    return {
      dateRangeType: parsed.dateRangeType ?? null,
      customStartDate: parsed.customStartDate ?? null,
      customEndDate: parsed.customEndDate ?? null,
      branchId: parsed.branchId ?? null,
    };
  } catch {
    // SecurityError / Access denied when localStorage is blocked (e.g. iframe, strict privacy)
    return empty;
  }
}

function saveToStorage(filters: PersistedFilters) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  } catch (e) {
    console.warn('[GlobalFilter] Failed to persist filters:', e);
  }
}

interface GlobalFilterContextType {
  /** Effective date range type (user selection or module default). */
  dateRangeType: GlobalDateRangeType;
  /** For custom range. */
  customStartDate: string | null;
  customEndDate: string | null;
  /** Start of range (ISO string) for queries. */
  startDate: string;
  /** End of range (ISO string) for queries. */
  endDate: string;
  /** Start/end as Date for components that need it. */
  startDateObj: Date;
  endDateObj: Date;
  /** Branch filter: null or 'all' = all branches, else branch id. */
  branchId: string | null;
  /** Current module (set by pages for default logic). */
  currentModule: GlobalFilterModule;
  setDateRangeType: (type: GlobalDateRangeType) => void;
  setCustomDateRange: (startDate: Date, endDate: Date) => void;
  setBranchId: (id: string | null) => void;
  setCurrentModule: (module: GlobalFilterModule) => void;
  /** Human-readable label for current range (e.g. "Last 30 Days"). */
  getDateRangeLabel: () => string;
}

const GlobalFilterContext = createContext<GlobalFilterContextType | undefined>(undefined);

export function useGlobalFilter() {
  const ctx = useContext(GlobalFilterContext);
  if (!ctx) throw new Error('useGlobalFilter must be used within GlobalFilterProvider');
  return ctx;
}

/** Use when component may render outside GlobalFilterProvider (e.g. during HMR or provider re-mount). Returns null when outside provider. */
export function useGlobalFilterOptional(): GlobalFilterContextType | null {
  const ctx = useContext(GlobalFilterContext);
  return ctx ?? null;
}

const DEFAULT_MODULE: GlobalFilterModule = 'default';

export const GlobalFilterProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { setBranchId: setSupabaseBranchId, branchId: supabaseBranchId } = useSupabase();
  const [currentModule, setCurrentModuleState] = useState<GlobalFilterModule>(DEFAULT_MODULE);
  const [persisted, setPersisted] = useState<PersistedFilters>(loadFromStorage);
  const initialSyncDone = useRef(false);

  // Hydrate SupabaseContext branchId from persisted on first load (once we have Supabase)
  useEffect(() => {
    if (initialSyncDone.current) return;
    if (persisted.branchId && setSupabaseBranchId) {
      setSupabaseBranchId(persisted.branchId);
      initialSyncDone.current = true;
    }
  }, [persisted.branchId, setSupabaseBranchId]);

  // Keep SupabaseContext in sync when user changes branch in header (header calls setBranchId here and setBranchId in Supabase)
  const setBranchId = useCallback(
    (id: string | null) => {
      setPersisted((prev) => {
        const next = { ...prev, branchId: id };
        saveToStorage(next);
        return next;
      });
      setSupabaseBranchId?.(id);
    },
    [setSupabaseBranchId]
  );

  // Do not sync Supabase -> persisted; only persisted -> Supabase on init.
  // Single-branch auto-set is done in TopHeader via setGlobalBranchId(branches[0].id).

  const setDateRangeType = useCallback((type: GlobalDateRangeType) => {
    setPersisted((prev) => {
      const next = { ...prev, dateRangeType: type };
      saveToStorage(next);
      return next;
    });
  }, []);

  const setCustomDateRange = useCallback((startDate: Date, endDate: Date) => {
    const start = startDate.toISOString().slice(0, 10);
    const end = endDate.toISOString().slice(0, 10);
    setPersisted((prev) => {
      const next = { ...prev, dateRangeType: 'customRange', customStartDate: start, customEndDate: end };
      saveToStorage(next);
      return next;
    });
  }, []);

  const setCurrentModule = useCallback((module: GlobalFilterModule) => {
    setCurrentModuleState(module);
  }, []);

  const effectiveDateType: GlobalDateRangeType = useMemo(() => {
    if (persisted.dateRangeType) return persisted.dateRangeType;
    return currentModule === 'dashboard' ? 'last7days' : 'last30days';
  }, [persisted.dateRangeType, currentModule]);

  const { startDate: startDateObj, endDate: endDateObj } = useMemo(
    () =>
      getDateRangeForType(
        effectiveDateType,
        persisted.customStartDate,
        persisted.customEndDate
      ),
    [effectiveDateType, persisted.customStartDate, persisted.customEndDate]
  );

  const startDate = useMemo(() => startDateObj?.toISOString() ?? new Date().toISOString(), [startDateObj]);
  const endDate = useMemo(() => endDateObj?.toISOString() ?? new Date().toISOString(), [endDateObj]);

  const getDateRangeLabel = useCallback((): string => {
    const type = effectiveDateType;
    if (type === 'customRange' && persisted.customStartDate && persisted.customEndDate) {
      const s = new Date(persisted.customStartDate);
      const e = new Date(persisted.customEndDate);
      return `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    }
    const labels: Record<GlobalDateRangeType, string> = {
      fromStart: 'From start',
      today: 'Today',
      last7days: 'Last 7 Days',
      last15days: 'Last 15 Days',
      last30days: 'Last 30 Days',
      last90days: 'Last 90 Days',
      thisWeek: 'This Week',
      thisMonth: 'This Month',
      thisYear: 'This Year',
      customRange: 'Custom Range',
    };
    return labels[type] ?? 'Last 30 Days';
  }, [effectiveDateType, persisted.customStartDate, persisted.customEndDate]);

  const value = useMemo<GlobalFilterContextType>(
    () => ({
      dateRangeType: effectiveDateType,
      customStartDate: persisted.customStartDate,
      customEndDate: persisted.customEndDate,
      startDate,
      endDate,
      startDateObj,
      endDateObj,
      branchId: persisted.branchId,
      currentModule,
      setDateRangeType,
      setCustomDateRange,
      setBranchId,
      setCurrentModule,
      getDateRangeLabel,
    }),
    [
      effectiveDateType,
      persisted.customStartDate,
      persisted.customEndDate,
      persisted.branchId,
      currentModule,
      startDate,
      endDate,
      startDateObj,
      endDateObj,
      setDateRangeType,
      setCustomDateRange,
      setBranchId,
      setCurrentModule,
      getDateRangeLabel,
    ]
  );

  return (
    <GlobalFilterContext.Provider value={value}>
      {children}
    </GlobalFilterContext.Provider>
  );
};
