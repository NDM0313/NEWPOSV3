import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getBranchFiscalYearStart } from '../api/branches';

interface FiscalYearContextValue {
  fiscalYearStart: string | null;
}

const FiscalYearContext = createContext<FiscalYearContextValue>({ fiscalYearStart: null });

export function useFiscalYearStart(): string | null {
  return useContext(FiscalYearContext).fiscalYearStart;
}

export function FiscalYearProvider({
  branchId,
  children,
}: {
  branchId: string | null | undefined;
  children: ReactNode;
}) {
  const [fiscalYearStart, setFiscalYearStart] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!branchId) {
      setFiscalYearStart(null);
      return;
    }
    void getBranchFiscalYearStart(branchId).then((value) => {
      if (!cancelled) setFiscalYearStart(value);
    });
    return () => {
      cancelled = true;
    };
  }, [branchId]);

  const value = useMemo(() => ({ fiscalYearStart }), [fiscalYearStart]);

  return <FiscalYearContext.Provider value={value}>{children}</FiscalYearContext.Provider>;
}
