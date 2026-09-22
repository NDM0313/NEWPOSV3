import { DEFAULT_PAYROLL_GENERATION_DAY } from '@/app/lib/payrollGenerationDate';

/** Stored in settings.key = default_payroll_settings (JSONB). Phase 1 — no auto-post/pay. */
export interface DefaultPayrollSettings {
  generationDay: number;
  defaultPaymentAccountId: string | null;
  salaryExpenseAccountCode: string;
  commissionExpenseAccountCode: string;
  staffPayableAccountCode: string;
  /** Phase 2+ — draft reminder only when true */
  autoCreateDraftOnGenerationDay: boolean;
  requireApprovalBeforePost: boolean;
  requireApprovalBeforePay: boolean;
}

export const DEFAULT_PAYROLL_SETTINGS: DefaultPayrollSettings = {
  generationDay: DEFAULT_PAYROLL_GENERATION_DAY,
  defaultPaymentAccountId: null,
  salaryExpenseAccountCode: '6110',
  commissionExpenseAccountCode: '5110',
  staffPayableAccountCode: '2040',
  autoCreateDraftOnGenerationDay: false,
  requireApprovalBeforePost: true,
  requireApprovalBeforePay: true,
};

export function mergeDefaultPayrollSettings(
  partial: Partial<DefaultPayrollSettings> | null | undefined,
): DefaultPayrollSettings {
  const gen = partial?.generationDay;
  return {
    ...DEFAULT_PAYROLL_SETTINGS,
    ...partial,
    generationDay:
      typeof gen === 'number' && gen >= 1 && gen <= 31
        ? Math.floor(gen)
        : DEFAULT_PAYROLL_SETTINGS.generationDay,
  };
}

export type SalaryCommissionMode = 'existing_sales';

/** Row in salary_settings table. */
export interface SalarySettingsRow {
  user_id: string;
  company_id: string;
  salary_enabled: boolean;
  basic_monthly_salary: number;
  generation_day: number | null;
  branch_id: string | null;
  default_payment_account_id: string | null;
  commission_enabled: boolean;
  commission_mode: SalaryCommissionMode;
  advance_allowed: boolean;
  notes: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  created_by?: string | null;
  /** Joined from users */
  user?: {
    full_name?: string | null;
    email?: string | null;
    role?: string | null;
  };
  branch?: { name?: string | null } | null;
  payment_account?: { name?: string | null; code?: string | null } | null;
}

export type SalarySettingsUpsert = Partial<
  Omit<SalarySettingsRow, 'user_id' | 'company_id' | 'created_at' | 'updated_at' | 'user' | 'branch' | 'payment_account'>
> & {
  user_id: string;
};
