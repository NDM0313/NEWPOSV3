/** Build "Parent › Sub" label from expense_categories tree. */
export type ExpenseCategoryNode = { id: string; name: string; parent_id: string | null };

export function buildExpenseCategoryPath(
  categoryId: string,
  categoryById: Map<string, ExpenseCategoryNode>,
): string {
  const path: string[] = [];
  const guard = new Set<string>();
  let cur = categoryById.get(categoryId);
  while (cur && !guard.has(cur.id)) {
    guard.add(cur.id);
    const name = String(cur.name || '').trim();
    if (name) path.unshift(name);
    cur = cur.parent_id ? categoryById.get(cur.parent_id) : undefined;
  }
  return path.join(' › ');
}

export async function loadExpenseCategoryMaps(companyId: string): Promise<{
  categoryById: Map<string, ExpenseCategoryNode>;
  pathByExpenseId: Map<string, string>;
}> {
  const categoryById = new Map<string, ExpenseCategoryNode>();
  const pathByExpenseId = new Map<string, string>();

  const { supabase } = await import('./supabase');
  const [catRes, expRes] = await Promise.all([
    supabase.from('expense_categories').select('id, name, parent_id').eq('company_id', companyId),
    supabase
      .from('expenses')
      .select('id, expense_category_id, category')
      .eq('company_id', companyId)
      .limit(5000),
  ]);

  (catRes.data || []).forEach((c: { id?: string; name?: string; parent_id?: string | null }) => {
    if (c?.id) {
      categoryById.set(String(c.id), {
        id: String(c.id),
        name: String(c.name || ''),
        parent_id: c.parent_id ? String(c.parent_id) : null,
      });
    }
  });

  (expRes.data || []).forEach((e: { id?: string; expense_category_id?: string | null; category?: string }) => {
    if (!e?.id) return;
    const eid = String(e.id);
    if (e.expense_category_id) {
      const path = buildExpenseCategoryPath(String(e.expense_category_id), categoryById);
      if (path) pathByExpenseId.set(eid, path);
    } else if (e.category) {
      const legacy = String(e.category).trim();
      if (legacy) pathByExpenseId.set(eid, legacy);
    }
  });

  return { categoryById, pathByExpenseId };
}

/** Category paths for specific expense document ids (payment reference_id). */
export async function loadExpenseCategoryPathsForIds(
  companyId: string,
  expenseIds: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = [...new Set(expenseIds.filter(Boolean))];
  if (!unique.length) return out;

  const { supabase } = await import('./supabase');
  const { data: expRes } = await supabase
    .from('expenses')
    .select('id, expense_category_id, category')
    .eq('company_id', companyId)
    .in('id', unique);

  const categoryIds = new Set<string>();
  (expRes || []).forEach((e: { expense_category_id?: string | null }) => {
    if (e.expense_category_id) categoryIds.add(String(e.expense_category_id));
  });

  const categoryById = new Map<string, ExpenseCategoryNode>();
  if (categoryIds.size) {
    const { data: cats } = await supabase
      .from('expense_categories')
      .select('id, name, parent_id')
      .eq('company_id', companyId);
    (cats || []).forEach((c: { id?: string; name?: string; parent_id?: string | null }) => {
      if (c?.id) {
        categoryById.set(String(c.id), {
          id: String(c.id),
          name: String(c.name || ''),
          parent_id: c.parent_id ? String(c.parent_id) : null,
        });
      }
    });
  }

  (expRes || []).forEach((e: { id?: string; expense_category_id?: string | null; category?: string }) => {
    if (!e?.id) return;
    const eid = String(e.id);
    if (e.expense_category_id) {
      const path = buildExpenseCategoryPath(String(e.expense_category_id), categoryById);
      if (path) out.set(eid, path);
    } else if (e.category) {
      const legacy = String(e.category).trim();
      if (legacy) out.set(eid, legacy);
    }
  });

  return out;
}
