/**
 * Canonical comparison for expense edit classification — avoids false ACCOUNTING_IMPACT
 * when UI sends slug vs list shows label, or null vs "" on optional text fields.
 */

/** null, undefined, "", whitespace-only → stable empty string */
export function normalizeNullableText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\u00a0/g, ' ').trim();
}

/**
 * Known expense category labels (display) → DB slug.
 * Keep in sync with ExpenseContext mapCategoryToSupabase label branch.
 */
const LABEL_TO_SLUG: Record<string, string> = {
  rent: 'rent',
  utilities: 'utilities',
  salaries: 'salaries',
  marketing: 'marketing',
  travel: 'travel',
  'office supplies': 'office_supplies',
  'repairs & maintenance': 'repairs',
  'repairs maintenance': 'repairs',
  other: 'miscellaneous',
};

/**
 * Normalize any category representation (slug, label, mixed case) to a single comparison key.
 */
export function normalizeCategoryForComparison(category: string | null | undefined): string {
  const raw = String(category ?? '').trim();
  if (!raw) return '';
  const lower = raw.toLowerCase();
  // Already a slug token
  if (/^[a-z0-9_]+$/.test(lower)) return lower;
  const spaced = lower.replace(/\s+/g, ' ').trim();
  if (LABEL_TO_SLUG[spaced]) return LABEL_TO_SLUG[spaced];
  return spaced.replace(/\s+/g, '_').replace(/-+/g, '_').replace(/&/g, '').replace(/_+/g, '_');
}

export function expenseCategoriesCanonicallyEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  return normalizeCategoryForComparison(a) === normalizeCategoryForComparison(b);
}
