/**
 * Fresh-company proof checklist — run against a new company after seed + first flows.
 * Each item maps to Integrity Lab / Reports / COA audit; GL truth = journals.
 */
export const FRESH_COMPANY_SIGNOFF_ITEMS = [
  { id: 'coa_hierarchy', label: 'COA hierarchy audit', hint: 'Developer Integrity Lab → H · COA audit; ensureDefaultAccounts' },
  { id: 'account_health', label: 'Account health cards', hint: 'Accounting dashboard / integrity health where exposed' },
  { id: 'trial_balance', label: 'Trial balance equation', hint: 'Integrity Lab company checks — TB difference ≈ 0' },
  { id: 'balance_sheet', label: 'Balance sheet equation', hint: 'Reports → Balance sheet; assets = liabilities + equity' },
  { id: 'inventory_gl', label: 'Inventory GL parity', hint: 'Integrity — Inventory GL vs valuation (1200 vs movements report)' },
  { id: 'ap_reconcile', label: 'AP reconciliation', hint: 'AR/AP center + company snapshot; ops payables vs 2000 net credit' },
  { id: 'ar_reconcile', label: 'AR reconciliation', hint: 'Ops receivables vs 1100; sales final only in RPC' },
  { id: 'journal_payment_link', label: 'Journal / payment linkage', hint: 'Integrity — payments missing JE link; posting gate' },
  { id: 'opening_balances', label: 'Opening balances visibility', hint: 'Contacts OB + OB journals; reader parity' },
  { id: 'default_coa', label: 'Default COA structure', hint: 'ensureDefaultAccounts; 1200 under 1090; AP under 2090' },
] as const;
