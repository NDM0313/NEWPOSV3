export type FinancialReportType =
  | 'trial-balance'
  | 'profit-loss'
  | 'customers-suppliers'
  | 'balance-basis-guide'
  | 'balance-sheet'
  | 'sales-profit'
  | 'inventory-valuation'
  | 'ledger-statement-v2'
  | 'remaining-balance';

const FINANCIAL_REPORT_TYPES = new Set<string>([
  'trial-balance',
  'profit-loss',
  'customers-suppliers',
  'balance-basis-guide',
  'balance-sheet',
  'sales-profit',
  'inventory-valuation',
  'ledger-statement-v2',
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

export function isValidFinancialReportType(value: string | null | undefined): value is FinancialReportType {
  return Boolean(value && FINANCIAL_REPORT_TYPES.has(value));
}

export function buildNavOpenUrl(
  viewId: string,
  opts?: { financial?: FinancialReportType }
): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  if (viewId === 'reports' && opts?.financial === 'ledger-statement-v2') {
    return `${origin}/reports/ledger-statement-center-v2`;
  }
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
} {
  if (typeof window === 'undefined') return { view: null, financial: null };
  const pathname = window.location.pathname;
  if (pathname === '/reports/ledger-statement-center-v2') {
    return { view: 'reports', financial: 'ledger-statement-v2' };
  }
  const specialView = VIEW_BY_SPECIAL_PATH[pathname];
  if (specialView) return { view: specialView, financial: null };
  if (pathname !== '/') return { view: null, financial: null };
  const params = new URLSearchParams(window.location.search);
  const view = params.get('view');
  const financialRaw = params.get('financial');
  return {
    view,
    financial: isValidFinancialReportType(financialRaw) ? financialRaw : null,
  };
}

export function syncNavUrlToHistory(viewId: string, opts?: { financial?: FinancialReportType }): void {
  if (typeof window === 'undefined') return;
  if (viewId === 'reports' && opts?.financial === 'ledger-statement-v2') {
    const target = '/reports/ledger-statement-center-v2';
    if (window.location.pathname !== target) {
      window.history.replaceState({}, '', target);
    }
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
