import { supabase } from '@/lib/supabase';

export type ExpenseCategoryType = 'salary' | 'utility' | 'general';

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
};
