import { supabase } from '@/lib/supabase';
import { settingsService } from '@/app/services/settingsService';
import {
  mergeDefaultPayrollSettings,
  type DefaultPayrollSettings,
  type SalarySettingsRow,
  type SalarySettingsUpsert,
} from '@/app/types/payrollSettings';

const DEFAULT_PAYROLL_SETTINGS_KEY = 'default_payroll_settings';
const PAYROLL_SETTINGS_CATEGORY = 'payroll';

export const payrollSettingsService = {
  async getDefaultPayrollSettings(companyId: string): Promise<DefaultPayrollSettings> {
    const row = await settingsService.getSetting(companyId, DEFAULT_PAYROLL_SETTINGS_KEY);
    const raw = row?.value;
    if (raw && typeof raw === 'object') {
      return mergeDefaultPayrollSettings(raw as Partial<DefaultPayrollSettings>);
    }
    return mergeDefaultPayrollSettings(null);
  },

  async saveDefaultPayrollSettings(
    companyId: string,
    settings: DefaultPayrollSettings,
  ): Promise<DefaultPayrollSettings> {
    const merged = mergeDefaultPayrollSettings(settings);
    await settingsService.setSetting(
      companyId,
      DEFAULT_PAYROLL_SETTINGS_KEY,
      merged,
      PAYROLL_SETTINGS_CATEGORY,
      'Global payroll defaults (generation day, GL account codes for future phases)',
    );
    return merged;
  },

  async listSalarySettings(companyId: string): Promise<SalarySettingsRow[]> {
    const { data, error } = await supabase
      .from('salary_settings')
      .select(
        `
        *,
        user:users(full_name, email, role),
        branch:branches(name)
      `,
      )
      .eq('company_id', companyId)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as SalarySettingsRow[];
  },

  async getSalarySettingsForUser(userId: string): Promise<SalarySettingsRow | null> {
    const { data, error } = await supabase
      .from('salary_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return (data as SalarySettingsRow | null) ?? null;
  },

  async upsertSalarySettings(
    companyId: string,
    payload: SalarySettingsUpsert,
    createdBy?: string | null,
  ): Promise<SalarySettingsRow> {
    const row = {
      user_id: payload.user_id,
      company_id: companyId,
      salary_enabled: payload.salary_enabled ?? true,
      basic_monthly_salary: Number(payload.basic_monthly_salary ?? 0),
      generation_day: payload.generation_day ?? null,
      branch_id: payload.branch_id ?? null,
      default_payment_account_id: payload.default_payment_account_id ?? null,
      commission_enabled: payload.commission_enabled ?? true,
      commission_mode: 'existing_sales' as const,
      advance_allowed: payload.advance_allowed ?? false,
      notes: payload.notes ?? null,
      is_active: payload.is_active ?? true,
      ...(createdBy ? { created_by: createdBy } : {}),
    };

    const { data, error } = await supabase
      .from('salary_settings')
      .upsert(row, { onConflict: 'user_id' })
      .select('*')
      .single();

    if (error) throw error;
    return data as SalarySettingsRow;
  },

  async syncFromEmployeeRecord(
    companyId: string,
    userId: string,
    basicSalary: number,
    commissionRate: number,
    isActive: boolean,
  ): Promise<void> {
    const existing = await this.getSalarySettingsForUser(userId);
    if (existing) {
      await this.upsertSalarySettings(companyId, {
        user_id: userId,
        basic_monthly_salary: basicSalary,
        salary_enabled: isActive,
        is_active: isActive,
        commission_enabled: commissionRate > 0 || existing.commission_enabled,
      });
      return;
    }
    await this.upsertSalarySettings(companyId, {
      user_id: userId,
      basic_monthly_salary: basicSalary,
      salary_enabled: isActive,
      is_active: isActive,
      commission_enabled: commissionRate > 0,
    });
  },

  async backfillFromEmployees(companyId?: string | null): Promise<{ inserted: number; ok: boolean }> {
    const { data, error } = await supabase.rpc('backfill_salary_settings_from_employees', {
      p_company_id: companyId ?? null,
    });
    if (error) throw error;
    const payload = (data ?? {}) as { inserted?: number; ok?: boolean };
    return { inserted: Number(payload.inserted ?? 0), ok: payload.ok !== false };
  },

  /** Ensure salary_settings row exists for a company user (from users list, not only employees). */
  async ensureForUser(companyId: string, userId: string): Promise<SalarySettingsRow> {
    const existing = await this.getSalarySettingsForUser(userId);
    if (existing) return existing;
    return this.upsertSalarySettings(companyId, {
      user_id: userId,
      basic_monthly_salary: 0,
      salary_enabled: false,
      commission_enabled: false,
      is_active: true,
    });
  },
};
