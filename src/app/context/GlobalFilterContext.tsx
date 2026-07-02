/**
 * Global Filter Engine — DIN COUTURE ERP
 * Centralized date range and branch filters controlled from TopHeader.
 * State persists across module navigation (localStorage).
 * Defaults: Dashboard = Last 7 Days, other modules = Last 30 Days.
 */

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef, ReactNode } from 'react';
import { useSupabase } from './SupabaseContext';
import { safeLocalStorageGetItem, safeLocalStorageSetItem } from '@/app/lib/safeBrowserStorage';
import { formatLocalDateYYYYMMDD, parseLocalDateInput } from '@/app/utils/localDate';
import { getLastBusinessWeekRange, getThisBusinessWeekRange } from '@/app/utils/businessWeek';
import {
  getFinancialYearRange,
  getLastFinancialYearRange,
  formatFinancialYearRangeLabel,
  formatLastFinancialYearRangeLabel,
  FISCAL_YEAR_CONFIG_UPDATED_EVENT,
  type FiscalYearConfig,
} from '@/app/utils/financialYear';
import { resolveFiscalYearConfig } from '@/app/lib/resolveFiscalYearConfig';
import { dispatchDataInvalidated, type InvalidationDomain } from '@/app/lib/dataInvalidationBus';
import { branchService } from '@/app/services/branchService';

const STORAGE_KEY = 'erp-global-filters';

export type GlobalDateRangeType =
  | 'today'
  | 'last7days'
  | 'last15days'
  | 'last30days'
  | 'last90days'
  | 'thisWeek'
  | 'lastWeek'
  | 'thisMonth'
  | 'thisYear'
  | 'currentFinancialYear'
  | 'lastFinancialYear'
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

function getDateRangeForType(
  type: GlobalDateRangeType,
  customStart?: string | null,
  customEnd?: string | null,
  fiscalYearConfig?: FiscalYearConfig | null,
): { startDate: Date; endDate: Date } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = new Date(today);
  endDate.setHours(23, 59, 59, 999);

  if (type === 'customRange' && customStart && customEnd) {
    const start = parseLocalDateInput(customStart);
    start.setHours(0, 0, 0, 0);
    const end = parseLocalDateInput(customEnd);
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
    case 'thisWeek':
      return getThisBusinessWeekRange(today);
    case 'lastWeek':
      return getLastBusinessWeekRange(today);
    case 'thisMonth': {
      const s = new Date(today.getFullYear(), today.getMonth(), 1);
      return { startDate: s, endDate };
    }
    case 'thisYear': {
      const s = new Date(today.getFullYear(), 0, 1);
      return { startDate: s, endDate };
    }
    case 'currentFinancialYear': {
      const { start, end } = getFinancialYearRange(fiscalYearConfig);
      const cappedEnd = end > endDate ? endDate : end;
      return { startDate: start, endDate: cappedEnd };
    }
    case 'lastFinancialYear': {
      const { start, end } = getLastFinancialYearRange(fiscalYearConfig);
      return { startDate: start, endDate: end };
    }
    default:
      return { startDate: today, endDate };
  }
}

function loadFromStorage(): PersistedFilters {
  const empty: PersistedFilters = { dateRangeType: null, customStartDate: null, customEndDate: null, branchId: null };
  if (typeof window === 'undefined') return empty;
  try {
    const raw = safeLocalStorageGetItem(STORAGE_KEY);
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
    safeLocalStorageSetItem(STORAGE_KEY, JSON.stringify(filters));
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
  /** Start of range (local calendar YYYY-MM-DD) for queries. */
  startDate: string;
  /** End of range (local calendar YYYY-MM-DD) for queries. */
  endDate: string;
  /** Start/end as Date for components that need it. */
  startDateObj: Date;
  endDateObj: Date;
  /** Branch filter: null or 'all' = all branches, else branch id. */
  branchId: string | null;
  /** Current module (set by pages for default logic). */
  currentModule: GlobalFilterModule;
  /** Resolved fiscal year config from settings / branch / company. */
  fiscalYearConfig: FiscalYearConfig | null;
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

const BRANCH_FILTER_INVALIDATION_DOMAINS: InvalidationDomain[] = [
  'sales',
  'purchases',
  'expenses',
  'accounting',
  'inventory',
  'rentals',
  'studio',
  'reports',
];

function dispatchFilterInvalidation(
  companyId: string,
  branchId: string | null,
  reason: 'branch_filter_changed' | 'date_filter_changed',
) {
  for (const domain of BRANCH_FILTER_INVALIDATION_DOMAINS) {
    dispatchDataInvalidated({
      domain,
      companyId,
      branchId,
      reason,
    });
  }
}

export const GlobalFilterProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { setBranchId: setSupabaseBranchId, companyId } = useSupabase();
  const [currentModule, setCurrentModuleState] = useState<GlobalFilterModule>(DEFAULT_MODULE);
  const [persisted, setPersisted] = useState<PersistedFilters>(loadFromStorage);
  const [fiscalYearConfig, setFiscalYearConfig] = useState<FiscalYearConfig | null>(null);
  const [fiscalYearRefreshToken, setFiscalYearRefreshToken] = useState(0);
  const initialSyncDone = useRef(false);
  const persistedRef = useRef(persisted);
  persistedRef.current = persisted;

  const refreshFiscalYearConfig = useCallback(() => {
    setFiscalYearRefreshToken((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!companyId) {
      setFiscalYearConfig(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const config = await resolveFiscalYearConfig(companyId, persisted.branchId);
        if (!cancelled) setFiscalYearConfig(config);
      } catch {
        if (!cancelled) setFiscalYearConfig(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, persisted.branchId, fiscalYearRefreshToken]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onFiscalUpdated = () => refreshFiscalYearConfig();
    window.addEventListener(FISCAL_YEAR_CONFIG_UPDATED_EVENT, onFiscalUpdated);
    return () => window.removeEventListener(FISCAL_YEAR_CONFIG_UPDATED_EVENT, onFiscalUpdated);
  }, [refreshFiscalYearConfig]);

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
      if (persistedRef.current.branchId === id) return;
      const next = { ...persistedRef.current, branchId: id };
      saveToStorage(next);
      setPersisted(next);
      setSupabaseBranchId?.(id);
      if (companyId) {
        dispatchFilterInvalidation(companyId, id, 'branch_filter_changed');
      }
    },
    [setSupabaseBranchId, companyId]
  );

  // Do not sync Supabase -> persisted; only persisted -> Supabase on init.
  // Single-branch auto-set is done in TopHeader via setGlobalBranchId(branches[0].id).

  const setDateRangeType = useCallback(
    (type: GlobalDateRangeType) => {
      setPersisted((prev) => {
        const next = { ...prev, dateRangeType: type };
        saveToStorage(next);
        return next;
      });
      if (companyId) {
        dispatchFilterInvalidation(companyId, persistedRef.current.branchId, 'date_filter_changed');
      }
    },
    [companyId],
  );

  const setCustomDateRange = useCallback(
    (startDate: Date, endDate: Date) => {
      const start = formatLocalDateYYYYMMDD(startDate);
      const end = formatLocalDateYYYYMMDD(endDate);
      setPersisted((prev) => {
        const next = { ...prev, dateRangeType: 'customRange', customStartDate: start, customEndDate: end };
        saveToStorage(next);
        return next;
      });
      if (companyId) {
        dispatchFilterInvalidation(companyId, persistedRef.current.branchId, 'date_filter_changed');
      }
    },
    [companyId],
  );

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
        persisted.customEndDate,
        fiscalYearConfig,
      ),
    [effectiveDateType, persisted.customStartDate, persisted.customEndDate, fiscalYearConfig]
  );

  const startDate = useMemo(
    () => (startDateObj ? formatLocalDateYYYYMMDD(startDateObj) : formatLocalDateYYYYMMDD(new Date())),
    [startDateObj]
  );
  const endDate = useMemo(
    () => (endDateObj ? formatLocalDateYYYYMMDD(endDateObj) : formatLocalDateYYYYMMDD(new Date())),
    [endDateObj]
  );

  const getDateRangeLabel = useCallback((): string => {
    const type = effectiveDateType;
    if (type === 'customRange' && persisted.customStartDate && persisted.customEndDate) {
      const s = new Date(persisted.customStartDate);
      const e = new Date(persisted.customEndDate);
      return `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    }
    if (type === 'currentFinancialYear') {
      return formatFinancialYearRangeLabel(fiscalYearConfig);
    }
    if (type === 'lastFinancialYear') {
      return formatLastFinancialYearRangeLabel(fiscalYearConfig);
    }
    const labels: Record<GlobalDateRangeType, string> = {
      fromStart: 'From start',
      today: 'Today',
      last7days: 'Last 7 Days',
      last15days: 'Last 15 Days',
      last30days: 'Last 30 Days',
      last90days: 'Last 90 Days',
      thisWeek: 'This Week (Sat–Fri)',
      lastWeek: 'Last Week (Sat–Fri)',
      thisMonth: 'This Month',
      thisYear: 'This Year',
      currentFinancialYear: 'Current Financial Year',
      lastFinancialYear: 'Last Financial Year',
      customRange: 'Custom Range',
    };
    return labels[type] ?? 'Last 30 Days';
  }, [effectiveDateType, persisted.customStartDate, persisted.customEndDate, fiscalYearConfig]);

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
      fiscalYearConfig,
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
      fiscalYearConfig,
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
