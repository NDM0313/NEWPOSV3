import type { EditActionPlan, EditImpactDomain } from '@/app/lib/accountingEditClassification';

export type AccountingEditModuleKey =
  | 'sales'
  | 'purchases'
  | 'customer_payments'
  | 'supplier_payments'
  | 'expenses'
  | 'inventory';

/** Regression expectations for the unified trace bench. */
export interface ScenarioDomainExpectation {
  /** Subset of domains that must appear (order ignored). */
  mustIncludeDomains: EditImpactDomain[];
  /** Domains that must not appear. */
  mustExcludeDomains?: EditImpactDomain[];
  actionPlan: Partial<EditActionPlan> & Pick<EditActionPlan, 'touchPayments'>;
  /** If true, FULL_REVERSE_REPOST is forbidden for this scenario. */
  forbidFullReverse: boolean;
}

export interface AccountingEditScenario {
  key: string;
  title: string;
  module: AccountingEditModuleKey;
  expected: ScenarioDomainExpectation;
  patch: (base: Record<string, unknown>) => Record<string, unknown>;
}

function moveDateSameMonth(iso: string): string {
  const d = new Date(iso || new Date().toISOString().slice(0, 10));
  d.setDate(Math.min(28, Math.max(1, d.getDate() === 1 ? 2 : d.getDate() - 1)));
  return d.toISOString().slice(0, 10);
}

function moveDateCrossMonth(iso: string): string {
  const d = new Date(iso || new Date().toISOString().slice(0, 10));
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
}

const H = (): ScenarioDomainExpectation => ({
  mustIncludeDomains: ['HEADER_ONLY'],
  mustExcludeDomains: ['ACCOUNTING_IMPACT', 'INVENTORY_IMPACT'],
  actionPlan: {
    updateHeader: true,
    adjustAccounting: false,
    adjustInventory: false,
    touchPayments: false,
  },
  forbidFullReverse: true,
});

const A = (): ScenarioDomainExpectation => ({
  mustIncludeDomains: ['ACCOUNTING_IMPACT'],
  mustExcludeDomains: ['INVENTORY_IMPACT'],
  actionPlan: {
    updateHeader: false,
    adjustAccounting: true,
    adjustInventory: false,
    touchPayments: false,
  },
  forbidFullReverse: true,
});

const I_A = (): ScenarioDomainExpectation => ({
  mustIncludeDomains: ['INVENTORY_IMPACT', 'ACCOUNTING_IMPACT'],
  actionPlan: {
    updateHeader: false,
    adjustAccounting: true,
    adjustInventory: true,
    touchPayments: false,
  },
  forbidFullReverse: true,
});

/** Notes / metadata only — no GL. */
const N = (): ScenarioDomainExpectation => ({
  mustIncludeDomains: ['HEADER_ONLY'],
  mustExcludeDomains: ['ACCOUNTING_IMPACT', 'INVENTORY_IMPACT'],
  actionPlan: {
    updateHeader: true,
    adjustAccounting: false,
    adjustInventory: false,
    touchPayments: false,
  },
  forbidFullReverse: true,
});

export const ACCOUNTING_EDIT_SCENARIOS: AccountingEditScenario[] = [
  // —— User regression list (1–13) ——
  {
    key: 'reg_expense_date_only',
    title: '1 Expense: date only',
    module: 'expenses',
    expected: H(),
    patch: (b) => ({ date: moveDateSameMonth(String(b.date || '')) }),
  },
  {
    key: 'reg_expense_notes_only',
    title: '2 Expense: notes only',
    module: 'expenses',
    expected: N(),
    patch: () => ({ notes: `notes-${Date.now()}` }),
  },
  {
    key: 'reg_expense_date_category_slug_noise',
    title: 'Expense: date + UI resends slug (Utilities ≡ utilities)',
    module: 'expenses',
    expected: H(),
    patch: (b) => ({
      date: moveDateSameMonth(String(b.date || '')),
      category: 'utilities',
    }),
  },
  {
    key: 'reg_expense_date_payee_empty',
    title: 'Expense: date + payee null→""',
    module: 'expenses',
    expected: H(),
    patch: (b) => ({ date: moveDateSameMonth(String(b.date || '')), payeeName: '' }),
  },
  {
    key: 'reg_expense_cross_month_slug_noise',
    title: 'Expense: cross-month date + redundant category slug',
    module: 'expenses',
    expected: H(),
    patch: (b) => ({ date: moveDateCrossMonth(String(b.date || '')), category: 'utilities' }),
  },
  {
    key: 'reg_expense_true_category_change',
    title: 'Expense: true category change (Utilities → marketing)',
    module: 'expenses',
    expected: {
      mustIncludeDomains: ['ACCOUNTING_IMPACT'],
      mustExcludeDomains: ['INVENTORY_IMPACT'],
      actionPlan: {
        updateHeader: false,
        adjustAccounting: true,
        adjustInventory: false,
        touchPayments: false,
      },
      forbidFullReverse: true,
    },
    patch: () => ({ category: 'marketing' }),
  },
  {
    key: 'reg_expense_amount_only',
    title: '3 Expense: amount only',
    module: 'expenses',
    expected: {
      mustIncludeDomains: ['ACCOUNTING_IMPACT'],
      mustExcludeDomains: ['INVENTORY_IMPACT'],
      actionPlan: {
        updateHeader: false,
        adjustAccounting: true,
        adjustInventory: false,
        touchPayments: false,
      },
      forbidFullReverse: true,
    },
    patch: (b) => ({ amount: Number(b.amount || 0) + 1 }),
  },
  {
    key: 'reg_sale_date_only',
    title: '4 Sale: date only',
    module: 'sales',
    expected: H(),
    patch: (b) => ({ date: moveDateSameMonth(String(b.date || '')) }),
  },
  {
    key: 'reg_sale_notes_only',
    title: '5 Sale: notes only',
    module: 'sales',
    expected: N(),
    patch: () => ({ notes: `notes-${Date.now()}` }),
  },
  {
    key: 'reg_sale_qty_only',
    title: '6 Sale: quantity only',
    module: 'sales',
    expected: I_A(),
    patch: (b) => ({ itemQtyTotal: Number(b.itemQtyTotal || 1) + 1 }),
  },
  {
    key: 'reg_sale_payment_account_only',
    title: '7 Sale: payment account only',
    module: 'sales',
    expected: A(),
    patch: (b) => ({ paymentAccountId: `${String(b.paymentAccountId || 'acc')}-x` }),
  },
  {
    key: 'reg_purchase_ref_date_only',
    title: '8 Purchase: supplier ref + date only',
    module: 'purchases',
    expected: H(),
    patch: (b) => ({
      supplierRef: `SUPREF-${Date.now()}`,
      date: moveDateSameMonth(String(b.date || '')),
    }),
  },
  {
    key: 'reg_purchase_qty_cost',
    title: '9 Purchase: quantity + cost change',
    module: 'purchases',
    expected: I_A(),
    patch: (b) => ({
      itemQtyTotal: Number(b.itemQtyTotal || 1) + 1,
      itemCostTotal: Number(b.itemCostTotal || 100) + 1,
      stockImpactQty: Number(b.stockImpactQty || 1) + 1,
    }),
  },
  {
    key: 'reg_cust_receipt_note_date',
    title: '10 Customer receipt: note + date only',
    module: 'customer_payments',
    expected: H(),
    patch: (b) => ({ notes: `n-${Date.now()}`, date: moveDateSameMonth(String(b.date || '')) }),
  },
  {
    key: 'reg_cust_receipt_amount_account',
    title: '11 Customer receipt: amount + account',
    module: 'customer_payments',
    expected: {
      mustIncludeDomains: ['ACCOUNTING_IMPACT'],
      mustExcludeDomains: ['INVENTORY_IMPACT'],
      actionPlan: {
        updateHeader: false,
        adjustAccounting: true,
        adjustInventory: false,
        touchPayments: false,
      },
      forbidFullReverse: true,
    },
    patch: (b) => ({ amount: Number(b.amount || 0) + 1, accountId: `${String(b.accountId || 'acc')}-x` }),
  },
  {
    key: 'reg_sup_pay_note_date',
    title: '12 Supplier payment: note + date only',
    module: 'supplier_payments',
    expected: H(),
    patch: (b) => ({ notes: `n-${Date.now()}`, date: moveDateSameMonth(String(b.date || '')) }),
  },
  {
    key: 'reg_sup_pay_amount_account',
    title: '13 Supplier payment: amount + account',
    module: 'supplier_payments',
    expected: {
      mustIncludeDomains: ['ACCOUNTING_IMPACT'],
      mustExcludeDomains: ['INVENTORY_IMPACT'],
      actionPlan: {
        updateHeader: false,
        adjustAccounting: true,
        adjustInventory: false,
        touchPayments: false,
      },
      forbidFullReverse: true,
    },
    patch: (b) => ({ amount: Number(b.amount || 0) + 1, accountId: `${String(b.accountId || 'acc')}-x` }),
  },

  // —— Extra matrix (cross-month header patch, structural deltas) ——
  {
    key: 'sales_ref_only',
    title: 'Sales: reference only',
    module: 'sales',
    expected: H(),
    patch: () => ({ referenceNo: `REF-${Date.now()}` }),
  },
  {
    key: 'sales_date_cross_month',
    title: 'Sales: cross-month date (header patch, no full reverse)',
    module: 'sales',
    expected: H(),
    patch: (b) => ({ date: moveDateCrossMonth(String(b.date || '')) }),
  },
  {
    key: 'sales_customer_change',
    title: 'Sales: customer change',
    module: 'sales',
    expected: {
      mustIncludeDomains: ['ACCOUNTING_IMPACT'],
      mustExcludeDomains: ['INVENTORY_IMPACT'],
      actionPlan: {
        updateHeader: false,
        adjustAccounting: true,
        adjustInventory: false,
        touchPayments: false,
      },
      forbidFullReverse: true,
    },
    patch: (b) => ({ customerId: `${String(b.customerId || 'cust')}-x` }),
  },
  {
    key: 'sales_rate_change',
    title: 'Sales: item rate change',
    module: 'sales',
    expected: A(),
    patch: (b) => ({ itemRateTotal: Number(b.itemRateTotal || 100) + 1 }),
  },
  {
    key: 'purchase_date_cross_month',
    title: 'Purchase: cross-month date',
    module: 'purchases',
    expected: H(),
    patch: (b) => ({ date: moveDateCrossMonth(String(b.date || '')) }),
  },
  {
    key: 'purchase_supplier_change',
    title: 'Purchase: supplier change',
    module: 'purchases',
    expected: {
      mustIncludeDomains: ['ACCOUNTING_IMPACT'],
      actionPlan: {
        updateHeader: false,
        adjustAccounting: true,
        adjustInventory: false,
        touchPayments: false,
      },
      forbidFullReverse: true,
    },
    patch: (b) => ({ supplierId: `${String(b.supplierId || 'sup')}-x` }),
  },
  {
    key: 'expense_date_cross',
    title: 'Expense: cross-month date (header patch)',
    module: 'expenses',
    expected: H(),
    patch: (b) => ({ date: moveDateCrossMonth(String(b.date || '')) }),
  },
  {
    key: 'cust_pay_date_cross',
    title: 'Customer payment: cross-month date',
    module: 'customer_payments',
    expected: H(),
    patch: (b) => ({ date: moveDateCrossMonth(String(b.date || '')) }),
  },
  {
    key: 'cust_pay_alloc_change',
    title: 'Customer payment: allocation change (touches linkage)',
    module: 'customer_payments',
    expected: {
      mustIncludeDomains: ['ACCOUNTING_IMPACT'],
      mustExcludeDomains: ['INVENTORY_IMPACT'],
      actionPlan: {
        updateHeader: false,
        adjustAccounting: true,
        adjustInventory: false,
        touchPayments: true,
      },
      forbidFullReverse: true,
    },
    patch: () => ({ allocationRef: `ALLOC-${Date.now()}` }),
  },
];
