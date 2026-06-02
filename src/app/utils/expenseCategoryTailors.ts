import type { ExpenseCategoryTreeItem } from '@/app/services/expenseCategoryService';
import { findPathToCategory } from '@/app/lib/expenseCategoryTreeUtils';

export type TailorPickerOption = { id: string; name: string };

const EXTRA_TYPE_PARENT_SLUGS: Record<string, string[]> = {
  stitching: ['stitching'],
  lining: ['lining'],
  dying: ['dying', 'dyeing'],
  dyeing: ['dying', 'dyeing'],
  cargo: ['transport', 'travel', 'cargo'],
  other: [],
};

const HUB_MAIN_TOKENS = ['service', 'shop'];

function normalizeSlug(slug: string): string {
  return (slug || '').toLowerCase().trim().replace(/\s+/g, '_');
}

function isHubMain(main: ExpenseCategoryTreeItem): boolean {
  const mainSlug = normalizeSlug(main.slug);
  const mainName = normalizeSlug(main.name);
  return HUB_MAIN_TOKENS.some(
    (h) => mainSlug === h || mainSlug.includes(h) || mainName.includes(h),
  );
}

function childMatchesExtraTokens(child: ExpenseCategoryTreeItem, want: string[]): boolean {
  if (!want.length) return false;
  const cs = normalizeSlug(child.slug);
  const cn = normalizeSlug(child.name);
  return want.some(
    (w) => cs === w || cn === w || cs.includes(w) || cn.includes(w) || w.includes(cs),
  );
}

function isLeaf(node: ExpenseCategoryTreeItem): boolean {
  return (node.children?.length ?? 0) === 0;
}

function collectLeaves(
  node: ExpenseCategoryTreeItem,
  add: (opt: TailorPickerOption) => void,
): void {
  if (isLeaf(node)) {
    if (node.id && node.name) add({ id: node.id, name: node.name });
    return;
  }
  for (const child of node.children ?? []) {
    collectLeaves(child, add);
  }
}

function collectLeavesUnderMatchingBranch(
  node: ExpenseCategoryTreeItem,
  want: string[],
  underMatch: boolean,
  add: (opt: TailorPickerOption) => void,
): void {
  const matches = want.length > 0 && childMatchesExtraTokens(node, want);
  const active = underMatch || matches;
  if (active) {
    if (isLeaf(node)) {
      if (node.id && node.name) add({ id: node.id, name: node.name });
      return;
    }
    for (const child of node.children ?? []) {
      collectLeavesUnderMatchingBranch(child, want, true, add);
    }
    return;
  }
  for (const child of node.children ?? []) {
    collectLeavesUnderMatchingBranch(child, want, false, add);
  }
}

/** Leaf categories under mains matching extra expense type (nested Service › Dying › Ali). */
export function getTailorOptionsForExtraType(
  tree: ExpenseCategoryTreeItem[],
  extraType: string,
): TailorPickerOption[] {
  const typeNorm = normalizeSlug(extraType);
  const want = EXTRA_TYPE_PARENT_SLUGS[typeNorm] ?? [];
  const out: TailorPickerOption[] = [];
  const seen = new Set<string>();

  const add = (opt: TailorPickerOption) => {
    if (!opt.id || seen.has(opt.id)) return;
    seen.add(opt.id);
    out.push(opt);
  };

  for (const main of tree) {
    const mainSlug = normalizeSlug(main.slug);
    const mainName = normalizeSlug(main.name);
    const classicMatch =
      want.length > 0 &&
      (want.includes(mainSlug) ||
        want.some((w) => mainName.includes(w) || mainSlug.includes(w)));

    if (classicMatch) {
      for (const child of main.children ?? []) {
        collectLeaves(child, add);
      }
      if (isLeaf(main) && main.id && main.name) add({ id: main.id, name: main.name });
      continue;
    }

    if (isHubMain(main)) {
      if (want.length > 0) {
        for (const child of main.children ?? []) {
          collectLeavesUnderMatchingBranch(child, want, false, add);
        }
      } else if (typeNorm === 'other') {
        for (const child of main.children ?? []) {
          collectLeaves(child, add);
        }
      }
    }
  }

  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export function tailorNameByCategoryId(
  tree: ExpenseCategoryTreeItem[],
  categoryId: string | undefined,
): string | undefined {
  if (!categoryId) return undefined;
  const path = findPathToCategory(tree, categoryId);
  if (!path?.length) return undefined;
  return path[path.length - 1]?.name;
}
