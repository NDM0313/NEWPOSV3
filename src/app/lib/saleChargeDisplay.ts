/** Sale charge row labels (type + tailor/dyer name). */

export type SaleChargeForDisplay = {
  charge_type?: string;
  chargeType?: string;
  amount?: number;
  tailor_name?: string | null;
  expense_category_id?: string | null;
  tailor_contact_id?: string | null;
  expense_category?: { name?: string } | null;
  tailor?: { name?: string } | null;
};

export function formatSaleChargeLabel(type: string): string {
  const t = String(type || 'other').toLowerCase();
  if (t === 'stitching') return 'Stitching';
  if (t === 'lining') return 'Lining';
  if (t === 'dying' || t === 'dyeing') return 'Dyeing';
  if (t === 'shipping') return 'Shipping';
  if (t === 'discount') return 'Discount';
  if (t === 'other') return 'Other';
  return t.charAt(0).toUpperCase() + t.slice(1).replace(/_/g, ' ');
}

export function tailorNameFromCharge(charge: SaleChargeForDisplay): string {
  return (
    String(charge.expense_category?.name || '').trim() ||
    String(charge.tailor?.name || '').trim() ||
    String(charge.tailor_name || '').trim()
  );
}

export function formatSaleChargeDisplayLabel(charge: SaleChargeForDisplay): string {
  const typeLabel = formatSaleChargeLabel(charge.charge_type || charge.chargeType || 'other');
  const tailor = tailorNameFromCharge(charge);
  return tailor ? `${typeLabel} · ${tailor}` : typeLabel;
}

const CHARGE_TYPE_BY_EXPENSE_SLUG: Record<string, string[]> = {
  stitching: ['stitching'],
  lining: ['lining'],
  dying: ['dying', 'dyeing'],
  dyeing: ['dying', 'dyeing'],
};

export type ClearingLineFilterable = {
  expense_category_id?: string | null;
  charge_type?: string;
  tailor_name?: string | null;
};

export type ClearingLinesFilterOptions = {
  expenseCategoryId?: string | null;
  categorySlug?: string | null;
  allowedCategoryIds?: string[];
  categorySlugs?: string[];
};

function chargeTypesForSlugs(slugs: string[]): string[] {
  const want: string[] = [];
  for (const slug of slugs) {
    const s = String(slug || '').toLowerCase().trim();
    if (!s) continue;
    const mapped = CHARGE_TYPE_BY_EXPENSE_SLUG[s] ?? [s];
    for (const w of mapped) {
      if (!want.includes(w)) want.push(w);
    }
  }
  return want;
}

function filterByChargeTypes<T extends ClearingLineFilterable>(lines: T[], want: string[]): T[] {
  if (want.length === 0) return [];
  return lines.filter((l) => {
    const ct = String(l.charge_type || '').toLowerCase();
    return want.some((w) => ct === w || ct.includes(w) || w.includes(ct));
  });
}

export function filterClearingLinesByCategory<T extends ClearingLineFilterable>(
  lines: T[],
  expenseCategoryIdOrOptions?: string | null | ClearingLinesFilterOptions,
  categorySlug?: string | null,
): { lines: T[]; usedFallback: boolean; noCategoryMatch: boolean } {
  const opts: ClearingLinesFilterOptions =
    expenseCategoryIdOrOptions != null &&
    typeof expenseCategoryIdOrOptions === 'object' &&
    !Array.isArray(expenseCategoryIdOrOptions)
      ? expenseCategoryIdOrOptions
      : {
          expenseCategoryId: expenseCategoryIdOrOptions as string | null | undefined,
          categorySlug,
        };

  const id = String(opts.expenseCategoryId || '').trim();
  const slug = String(opts.categorySlug || '').toLowerCase().trim();
  const allowedIds = (opts.allowedCategoryIds ?? []).map((x) => String(x || '').trim()).filter(Boolean);
  const slugs = [
    ...(opts.categorySlugs ?? []).map((s) => String(s || '').toLowerCase().trim()).filter(Boolean),
    ...(slug ? [slug] : []),
  ].filter((s, i, arr) => arr.indexOf(s) === i);

  if (allowedIds.length === 0 && !id && slugs.length === 0) {
    return { lines, usedFallback: false, noCategoryMatch: false };
  }

  if (allowedIds.length > 0) {
    const idSet = new Set(allowedIds);
    const byIds = lines.filter((l) => idSet.has(String(l.expense_category_id || '')));
    if (byIds.length > 0) return { lines: byIds, usedFallback: false, noCategoryMatch: false };
  } else if (id) {
    const byId = lines.filter((l) => String(l.expense_category_id || '') === id);
    if (byId.length > 0) return { lines: byId, usedFallback: false, noCategoryMatch: false };
  }

  const want = chargeTypesForSlugs(slugs);
  if (want.length > 0) {
    const byType = filterByChargeTypes(lines, want);
    if (byType.length > 0) {
      return { lines: byType, usedFallback: true, noCategoryMatch: false };
    }
  }

  if (lines.length > 0) {
    return { lines, usedFallback: true, noCategoryMatch: true };
  }
  return { lines: [], usedFallback: false, noCategoryMatch: false };
}
