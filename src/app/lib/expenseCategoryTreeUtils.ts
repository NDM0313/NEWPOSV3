import type { ExpenseCategoryTreeItem } from '@/app/services/expenseCategoryService';

export type CategoryTreeNode = Pick<
  ExpenseCategoryTreeItem,
  'id' | 'name' | 'slug' | 'parent_id' | 'children'
>;

export const MAX_EXPENSE_CATEGORY_DEPTH = 3;

export const MAX_CATEGORY_DEPTH_MESSAGE =
  'Maximum 3 levels: main → sub → re-sub.';

const PATH_SEP = ' › ';

export interface ParentPickerOption {
  id: string;
  label: string;
  depth: number;
}

export interface CategoryLookupResult {
  main: CategoryTreeNode;
  sub?: CategoryTreeNode;
  path: CategoryTreeNode[];
}

function normalizeSlug(v: string): string {
  return String(v || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_');
}

export function formatCategoryPathFromNodes(nodes: CategoryTreeNode[]): string {
  const names = nodes.map((n) => String(n.name || '').trim()).filter(Boolean);
  return names.length ? names.join(PATH_SEP) : '—';
}

export function formatCategoryPath(mainName: string, subName?: string | null): string {
  const main = String(mainName || '').trim();
  const sub = String(subName || '').trim();
  if (!main) return sub || '—';
  if (!sub || sub.toLowerCase() === main.toLowerCase()) return main;
  return `${main}${PATH_SEP}${sub}`;
}

function findPathInSubtree(
  node: CategoryTreeNode,
  id: string,
  trail: CategoryTreeNode[],
): CategoryTreeNode[] | null {
  const next = [...trail, node];
  if (node.id === id) return next;
  for (const child of node.children ?? []) {
    const found = findPathInSubtree(child, id, next);
    if (found) return found;
  }
  return null;
}

export function findPathToCategory(
  tree: CategoryTreeNode[],
  categoryId: string | null | undefined,
): CategoryTreeNode[] | null {
  const id = String(categoryId || '').trim();
  if (!id) return null;
  for (const root of tree) {
    const path = findPathInSubtree(root, id, []);
    if (path) return path;
  }
  return null;
}

export function getNodeDepth(
  tree: CategoryTreeNode[],
  categoryId: string | null | undefined,
): number {
  const path = findPathToCategory(tree, categoryId);
  return path ? path.length - 1 : -1;
}

export function canAddSubcategory(depth: number): boolean {
  return depth >= 0 && depth < MAX_EXPENSE_CATEGORY_DEPTH - 1;
}

export function walkDescendants(node: CategoryTreeNode, visit: (n: CategoryTreeNode, depth: number) => void, depth = 0): void {
  visit(node, depth);
  for (const child of node.children ?? []) {
    walkDescendants(child, visit, depth + 1);
  }
}

function collectIdsUnder(node: CategoryTreeNode): Set<string> {
  const ids = new Set<string>();
  walkDescendants(node, (n) => {
    ids.add(n.id);
  });
  return ids;
}

export function flattenParentPickerOptions(
  tree: CategoryTreeNode[],
  excludeCategoryId?: string | null,
): ParentPickerOption[] {
  const excludeId = String(excludeCategoryId || '').trim();
  const excludeIds = new Set<string>();
  if (excludeId) {
    excludeIds.add(excludeId);
    for (const root of tree) {
      const path = findPathInSubtree(root, excludeId, []);
      if (path) {
        const node = path[path.length - 1];
        collectIdsUnder(node).forEach((id) => excludeIds.add(id));
        break;
      }
    }
  }

  const out: ParentPickerOption[] = [];
  for (const root of tree) {
    walkDescendants(root, (node, depth) => {
      if (excludeIds.has(node.id)) return;
      if (depth >= MAX_EXPENSE_CATEGORY_DEPTH - 1) return;
      const prefix = depth > 0 ? `${'— '.repeat(depth)}` : '';
      out.push({ id: node.id, label: `${prefix}${node.name}`, depth });
    });
  }
  return out;
}

export function collectDescendantNames(main: CategoryTreeNode): {
  names: Set<string>;
  slugs: Set<string>;
} {
  const names = new Set<string>();
  const slugs = new Set<string>();
  walkDescendants(main, (n) => {
    names.add(n.name);
    slugs.add(normalizeSlug(n.slug));
    slugs.add(normalizeSlug(n.name));
  });
  return { names, slugs };
}

export function findCategoryInTree(
  tree: CategoryTreeNode[],
  categoryId: string | null | undefined,
): CategoryLookupResult | null {
  const path = findPathToCategory(tree, categoryId);
  if (!path?.length) return null;
  return {
    main: path[0],
    sub: path.length > 1 ? path[path.length - 1] : undefined,
    path,
  };
}

export function displayLabelForCategoryId(
  tree: CategoryTreeNode[],
  categoryId: string | null | undefined,
  fallbackCategory?: string | null,
): string {
  const path = findPathToCategory(tree, categoryId);
  if (path?.length) return formatCategoryPathFromNodes(path);
  return String(fallbackCategory || '').trim() || '—';
}

export function expenseMatchesMainFilter(
  expenseCategoryLabel: string | null | undefined,
  expenseCategoryId: string | null | undefined,
  main: CategoryTreeNode,
  tree: CategoryTreeNode[],
): boolean {
  const id = String(expenseCategoryId || '').trim();
  if (id) {
    const path = findPathToCategory(tree, id);
    if (path?.[0]?.id === main.id) return true;
  }
  const label = String(expenseCategoryLabel || '').trim();
  if (!label) return false;
  const { names, slugs } = collectDescendantNames(main);
  if (names.has(label)) return true;
  return slugs.has(normalizeSlug(label));
}

export function countExpensesForMain(
  expenses: Array<{ category?: string | null; expense_category_id?: string | null }>,
  main: CategoryTreeNode,
  tree: CategoryTreeNode[],
): number {
  return expenses.filter((e) =>
    expenseMatchesMainFilter(e.category, e.expense_category_id, main, tree),
  ).length;
}

export function countExpensesForNode(
  expenses: Array<{ category?: string | null; expense_category_id?: string | null }>,
  node: CategoryTreeNode,
): number {
  return expenses.filter((e) => {
    const id = String(e.expense_category_id || '').trim();
    if (id && id === node.id) return true;
    return (e.category || '').trim() === node.name;
  }).length;
}

export function countExpensesForSub(
  expenses: Array<{ category?: string | null; expense_category_id?: string | null }>,
  sub: CategoryTreeNode,
): number {
  return countExpensesForNode(expenses, sub);
}

export const CLEARING_CATEGORY_SLUGS = new Set(['stitching', 'dying', 'dyeing', 'lining']);

/** True only when THIS node is stitching/dying/lining — not when a child is. */
export function categoryIsDirect4120Clearing(node: CategoryTreeNode): boolean {
  const slug = normalizeSlug(node.slug);
  const nameSlug = normalizeSlug(node.name);
  return CLEARING_CATEGORY_SLUGS.has(slug) || CLEARING_CATEGORY_SLUGS.has(nameSlug);
}

export function categoryRequires4120Clearing(node: CategoryTreeNode): boolean {
  const slug = normalizeSlug(node.slug);
  const nameSlug = normalizeSlug(node.name);
  if (CLEARING_CATEGORY_SLUGS.has(slug) || CLEARING_CATEGORY_SLUGS.has(nameSlug)) return true;
  return (node.children ?? []).some(categoryRequires4120Clearing);
}

export function collectClearingSlugsUnder(node: CategoryTreeNode): string[] {
  const out: string[] = [];
  walkDescendants(node, (n) => {
    for (const s of [normalizeSlug(n.slug), normalizeSlug(n.name)]) {
      if (CLEARING_CATEGORY_SLUGS.has(s) && !out.includes(s)) out.push(s);
    }
  });
  return out;
}

export function collectCategoryIdsForClearingFilter(
  tree: CategoryTreeNode[],
  categoryId: string | null | undefined,
): string[] {
  const id = String(categoryId || '').trim();
  if (!id) return [];
  const path = findPathToCategory(tree, id);
  if (!path?.length) return [id];
  const node = path[path.length - 1];
  return Array.from(collectIdsUnder(node));
}

export function resolveExpenseCategoryIdFromLevels(
  level1Id: string,
  level2Id: string,
  level3Id: string,
): string {
  return String(level3Id || level2Id || level1Id || '').trim();
}

export function levelIdsFromPath(path: CategoryTreeNode[] | null): {
  level1Id: string;
  level2Id: string;
  level3Id: string;
} {
  if (!path?.length) return { level1Id: '', level2Id: '', level3Id: '' };
  return {
    level1Id: path[0]?.id ?? '',
    level2Id: path[1]?.id ?? '',
    level3Id: path[2]?.id ?? '',
  };
}
