import { createContext, useContext, type ReactNode } from 'react';
import type { ReportHubMode } from '../../../../lib/reportsHubCatalog';

const ReportHubModeContext = createContext<ReportHubMode>('standard');

export function ReportHubModeProvider({
  mode,
  children,
}: {
  mode: ReportHubMode;
  children: ReactNode;
}) {
  return <ReportHubModeContext.Provider value={mode}>{children}</ReportHubModeContext.Provider>;
}

/** Defaults to standard when opened via deep link outside Reports Hub. */
export function useReportHubMode(): ReportHubMode {
  return useContext(ReportHubModeContext);
}

export function isEasyReportHubMode(mode: ReportHubMode): boolean {
  return mode === 'easy';
}
