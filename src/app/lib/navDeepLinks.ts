/** @deprecated ledger-statement-v2 removed from Reports — redirects to Accounting Account Statements */
export type FinancialReportType =
  | 'trial-balance'
  | 'profit-loss'
  | 'customers-suppliers'
  | 'balance-basis-guide'
  | 'balance-sheet'
  | 'sales-profit'
  | 'inventory-valuation'
  | 'remaining-balance';

const FINANCIAL_REPORT_TYPES = new Set<string>([
  'trial-balance',
  'profit-loss',
  'customers-suppliers',
  'balance-basis-guide',
  'balance-sheet',
  'sales-profit',
  'inventory-valuation',
  'remaining-balance',
]);

/** Views that use a dedicated pathname instead of `/?view=`. */
const SPECIAL_PATH_BY_VIEW: Record<string, string> = {
  'financial-trace-center': '/admin/financial-trace-center',
  'permission-inspector': '/admin/permission-inspector',
  'developer-integrity-lab': '/admin/developer-integrity-lab',
  'accounting-developer-center': '/admin/accounting-developer-center',
  'accounting-test-bench': '/admin/accounting-test-bench',
  'accounting-edit-trace': '/test/accounting-edit-trace',
  'ar-ap-truth-lab': '/test/ar-ap-truth-lab',
  'expense-edit-trace': '/test/expense-edit-trace',
};

const VIEW_BY_SPECIAL_PATH: Record<string, string> = Object.fromEntries(
  Object.entries(SPECIAL_PATH_BY_VIEW).map(([view, path]) => [path, view])
);

/** Legacy URL — opens Accounting → Account Statements (V2 embedded). */
export const LEGACY_LEDGER_STATEMENT_V2_PATH = '/reports/ledger-statement-center-v2';

export function isValidFinancialReportType(value: string | null | undefined): value is FinancialReportType {
  return Boolean(value && FINANCIAL_REPORT_TYPES.has(value));
}

export function buildNavOpenUrl(
  viewId: string,
  opts?: { financial?: FinancialReportType }
): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const specialPath = SPECIAL_PATH_BY_VIEW[viewId];
  if (specialPath) return `${origin}${specialPath}`;
  const params = new URLSearchParams();
  params.set('view', viewId);
  if (viewId === 'reports' && opts?.financial) {
    params.set('financial', opts.financial);
  }
  return `${origin}/?${params.toString()}`;
}

export function parseNavLocationFromUrl(): {
  view: string | null;
  financial: FinancialReportType | null;
  /** Set when legacy ledger V2 path is used — Accounting should open Account Statements. */
  openAccountStatements?: boolean;
} {
  if (typeof window === 'undefined') return { view: null, financial: null };
  const pathname = window.location.pathname;
  if (pathname === LEGACY_LEDGER_STATEMENT_V2_PATH) {
    return { view: 'accounting', financial: null, openAccountStatements: true };
  }
  const specialView = VIEW_BY_SPECIAL_PATH[pathname];
  if (specialView) return { view: specialView, financial: null };
  if (pathname !== '/') return { view: null, financial: null };
  const params = new URLSearchParams(window.location.search);
  const view = params.get('view');
  const financialRaw = params.get('financial');
  if (financialRaw === 'ledger-statement-v2') {
    return { view: 'accounting', financial: null, openAccountStatements: true };
  }
  return {
    view,
    financial: isValidFinancialReportType(financialRaw) ? financialRaw : null,
  };
}

export function syncNavUrlToHistory(viewId: string, opts?: { financial?: FinancialReportType }): void {
  if (typeof window === 'undefined') return;
  if (window.location.pathname === LEGACY_LEDGER_STATEMENT_V2_PATH && viewId === 'accounting') {
    window.history.replaceState({}, '', '/?view=accounting');
    return;
  }
  const specialPath = SPECIAL_PATH_BY_VIEW[viewId];
  if (specialPath) {
    if (window.location.pathname !== specialPath) {
      window.history.replaceState({}, '', specialPath);
    }
    return;
  }
  const params = new URLSearchParams();
  params.set('view', viewId);
  if (viewId === 'reports' && opts?.financial) {
    params.set('financial', opts.financial);
  }
  const next = `/?${params.toString()}`;
  const current = `${window.location.pathname}${window.location.search}`;
  if (current !== next) {
    window.history.replaceState({}, '', next);
  }
}
