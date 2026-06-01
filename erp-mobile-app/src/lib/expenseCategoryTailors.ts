import type { ExpenseCategoryTreeItem } from '../api/expenses';

export type TailorPickerOption = { id: string; name: string };

const EXTRA_TYPE_PARENT_SLUGS: Record<string, string[]> = {
  stitching: ['stitching'],
  lining: ['lining'],
  dying: ['dying', 'dyeing'],
  dyeing: ['dying', 'dyeing'],
  cargo: ['transport', 'travel', 'cargo'],
  other: [],
};

function normalizeSlug(slug: string): string {
  return (slug || '').toLowerCase().trim().replace(/\s+/g, '_');
}

/** Sub-categories under main nodes matching extra expense type (e.g. Stitching → tailor names). */
export function getTailorOptionsForExtraType(
  tree: ExpenseCategoryTreeItem[],
  extraType: string,
): TailorPickerOption[] {
  const want = EXTRA_TYPE_PARENT_SLUGS[normalizeSlug(extraType)] ?? [];
  if (want.length === 0) return [];

  const out: TailorPickerOption[] = [];
  for (const main of tree) {
    const mainSlug = normalizeSlug(main.slug);
    const mainName = normalizeSlug(main.name);
    const matches =
      want.includes(mainSlug) ||
      want.some((w) => mainName.includes(w) || mainSlug.includes(w));
    if (!matches) continue;
    for (const child of main.children ?? []) {
      if (child.id && child.name) out.push({ id: child.id, name: child.name });
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export function tailorNameByCategoryId(
  tree: ExpenseCategoryTreeItem[],
  categoryId: string | undefined,
): string | undefined {
  if (!categoryId) return undefined;
  for (const main of tree) {
    if (main.id === categoryId) return main.name;
    for (const child of main.children ?? []) {
      if (child.id === categoryId) return child.name;
    }
  }
  return undefined;
}
