import { supabase } from '@/lib/supabase';

export type ExpenseCategoryType = 'salary' | 'utility' | 'general';

/** Backend/internal expense account codes that must NOT appear in user-facing expense category picker. */
const INTERNAL_EXPENSE_CODES = new Set(['5000', '5010', '5100', '5200', '5300']);
const INTERNAL_EXPENSE_NAMES = /cost of production|cost of studio|shipping expense|extra expense|courier|payable|receivable/i;

/**
 * Slug → preferred COA code for operating expense categories.
 * Used when expense_categories has no account_id; ensures user categories map to one account each.
 */
const CATEGORY_SLUG_TO_CODE: Record<string, string> = {
  rent: '5400',
  utilities: '5500',
  salaries: '5600',
  salary: '5600',
  marketing: '5700',
  travel: '5800',
  office_supplies: '5810',
  repairs: '5820',
  repairs_maintenance: '5820',
  other: '5900',
  miscellaneous: '5900',
};

export interface ExpenseCategoryRow {
  id: string;
  company_id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  type?: ExpenseCategoryType;
  color: string;
  icon: string;
  description: string | null;
  created_at?: string;
}

function nameToSlug(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') || 'other';
}

export type ExpenseCategoryTreeItem = ExpenseCategoryRow & {
  children: ExpenseCategoryTreeItem[];
  isMain: boolean;
  type?: ExpenseCategoryType;
};

const DEFAULT_COLORS = ['blue', 'purple', 'orange', 'green', 'yellow', 'red', 'cyan', 'pink', 'gray'];
const DEFAULT_ICONS = ['Zap', 'Users', 'Car', 'Building2', 'Utensils', 'Wallet', 'Briefcase', 'Home', 'ShoppingCart', 'Other'];

export const expenseCategoryService = {
  async getCategories(companyId: string): Promise<ExpenseCategoryRow[]> {
    const { data, error } = await supabase
      .from('expense_categories')
      .select('*')
      .eq('company_id', companyId)
      .order('name');
    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST204' || error.message?.includes('404') || error.message?.includes('relation') || error.message?.includes('does not exist')) {
        return [];
      }
      throw error;
    }
    return (data || []) as ExpenseCategoryRow[];
  },

  async getTree(companyId: string): Promise<ExpenseCategoryTreeItem[]> {
    const list = await this.getCategories(companyId);
    const main = list.filter((c) => !c.parent_id);
    const byParent: Record<string, ExpenseCategoryRow[]> = {};
    list.forEach((c) => {
      if (c.parent_id) {
        if (!byParent[c.parent_id]) byParent[c.parent_id] = [];
        byParent[c.parent_id].push(c);
      }
    });
    const build = (row: ExpenseCategoryRow): ExpenseCategoryTreeItem => ({
      ...row,
      isMain: !row.parent_id,
      children: (byParent[row.id] || []).map(build),
    });
    return main.map(build);
  },

  async create(companyId: string, payload: { name: string; parent_id?: string | null; type?: ExpenseCategoryType; color?: string; icon?: string; description?: string }): Promise<ExpenseCategoryRow> {
    const name = payload.name.trim();
    const slug = nameToSlug(name);
    const { data, error } = await supabase
      .from('expense_categories')
      .insert({
        company_id: companyId,
        name,
        slug,
        parent_id: payload.parent_id || null,
        type: payload.type || 'general',
        color: payload.color || 'gray',
        icon: payload.icon || 'Other',
        description: payload.description || null,
      })
      .select()
      .single();
    if (error) throw error;
    return data as ExpenseCategoryRow;
  },

  async update(id: string, payload: { name?: string; parent_id?: string | null; type?: ExpenseCategoryType; color?: string; icon?: string; description?: string }): Promise<ExpenseCategoryRow> {
    const updates: Record<string, unknown> = {
      ...(payload.parent_id !== undefined && { parent_id: payload.parent_id }),
      ...(payload.type !== undefined && { type: payload.type }),
      ...(payload.color !== undefined && { color: payload.color }),
      ...(payload.icon !== undefined && { icon: payload.icon }),
      ...(payload.description !== undefined && { description: payload.description }),
    };
    if (payload.name !== undefined) {
      updates.name = payload.name.trim();
      updates.slug = nameToSlug(payload.name);
    }
    const { data, error } = await supabase
      .from('expense_categories')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as ExpenseCategoryRow;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('expense_categories').delete().eq('id', id);
    if (error) throw error;
  },

  getDefaultColors: () => DEFAULT_COLORS,
  getDefaultIcons: () => DEFAULT_ICONS,

  /**
   * Resolve expense account id for a category (for posting). Uses slug → code map; excludes internal/backend accounts.
   * Returns first matching account by code, or first operating expense account (not production/shipping/courier).
   */
  async getExpenseAccountIdForCategory(companyId: string, categorySlug: string): Promise<string | null> {
    const slug = (categorySlug || '').toLowerCase().trim().replace(/\s+/g, '_');
    const code = CATEGORY_SLUG_TO_CODE[slug] || '5900';
    const { data: byCode } = await supabase
      .from('accounts')
      .select('id')
      .eq('company_id', companyId)
      .eq('code', code)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    if (byCode && (byCode as { id: string }).id) return (byCode as { id: string }).id;
    const { data: allExpense } = await supabase
      .from('accounts')
      .select('id, code, name')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .or('type.eq.expense,type.eq.Expense');
    const operating = (allExpense || []).find((a: any) => {
      const c = String(a.code ?? '');
      const n = String(a.name ?? '').toLowerCase();
      if (INTERNAL_EXPENSE_CODES.has(c)) return false;
      if (INTERNAL_EXPENSE_NAMES.test(n)) return false;
      return true;
    });
    return operating ? (operating as { id: string }).id : null;
  },

  /**
   * User-facing operating expense categories only (for dropdowns). Excludes backend/shipping/production.
   * Returns list suitable for Add Entry V2 and main Expenses: Rent, Utilities, Salary, etc.
   */
  async getOperatingCategoriesForPicker(companyId: string): Promise<{ id: string; name: string; slug: string }[]> {
    const list = await this.getCategories(companyId);
    const main = list.filter((c) => !c.parent_id);
    const out = main
      .filter((c) => {
        const n = (c.name || '').toLowerCase();
        const s = (c.slug || '').toLowerCase();
        if (INTERNAL_EXPENSE_NAMES.test(n) || INTERNAL_EXPENSE_NAMES.test(s)) return false;
        return true;
      })
      .map((c) => ({ id: c.id, name: c.name || c.slug || 'Other', slug: c.slug || 'other' }));
    if (out.length > 0) return out;
    return [
      { id: 'rent', name: 'Rent', slug: 'rent' },
      { id: 'utilities', name: 'Electricity / Utilities', slug: 'utilities' },
      { id: 'salaries', name: 'Salary', slug: 'salaries' },
      { id: 'marketing', name: 'Marketing', slug: 'marketing' },
      { id: 'travel', name: 'Travel', slug: 'travel' },
      { id: 'office_supplies', name: 'Office Supplies', slug: 'office_supplies' },
      { id: 'repairs', name: 'Repairs & Maintenance', slug: 'repairs' },
      { id: 'other', name: 'Other', slug: 'other' },
    ];
  },
};
