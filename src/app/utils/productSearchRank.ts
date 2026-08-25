/** Extract digits from SKU / search (keeps leading zeros). */
export function extractProductSkuNumericPart(sku: string): string {
  return String(sku || '').replace(/\D/g, '');
}

/** Strip leading zeros for numeric equality (e.g. 001 → 1). */
export function normalizeProductSkuNumeric(numStr: string): string {
  return String(numStr || '').replace(/^0+/, '') || '0';
}

/** Digit token appears as a whole number in text (not part of a longer number). */
export function hasWordBoundaryDigitMatch(text: string, digits: string): boolean {
  if (!text || !digits) return false;
  try {
    const re = new RegExp(`(^|[^0-9])${digits}([^0-9]|$)`);
    return re.test(text);
  } catch {
    return false;
  }
}

function isDigitHeavyTerm(term: string): boolean {
  const digits = extractProductSkuNumericPart(term);
  if (digits.length < 2) return false;
  const compact = term.replace(/[\s.\-_]/g, '');
  return digits.length >= Math.ceil(compact.length * 0.6);
}

/**
 * Whether search term matches SKU under tightened rules (no reverse-substring noise).
 */
export function matchesProductSku(sku: string, searchTerm: string): boolean {
  return rankProductSearchHit({ sku, name: '' }, searchTerm) < 99;
}

/**
 * Rank a product hit for picker lists. Lower = better.
 * 0 = exact normalized SKU digits (1296 → PRD-1296)
 * 1 = full SKU text equality
 * 2 = SKU suffix / soft digit contains (query length ≥ 4)
 * 3 = name/description whole-number or text match
 * 99 = no match
 */
export function rankProductSearchHit(
  product: { name?: string | null; sku?: string | null; description?: string | null },
  searchTerm: string,
): number {
  const term = String(searchTerm || '').trim();
  if (!term) return 99;

  const name = String(product.name || '');
  const description = String(product.description || '');
  const sku = String(product.sku || '');
  const searchLower = term.toLowerCase();
  const lowerSku = sku.toLowerCase();

  const skuNumeric = extractProductSkuNumericPart(sku);
  const searchNumeric = extractProductSkuNumericPart(term);
  const digitHeavy = isDigitHeavyTerm(term);

  if (digitHeavy && searchNumeric.length > 0) {
    const normalizedSku = normalizeProductSkuNumeric(skuNumeric);
    const normalizedSearch = normalizeProductSkuNumeric(searchNumeric);

    if (normalizedSearch !== '0' && normalizedSku === normalizedSearch) {
      return 0;
    }

    if (lowerSku === searchLower || lowerSku === `prd-${searchLower}`) {
      return 1;
    }

    // Hyphen suffix only (PRD-1296); not digit endsWith (12960 ends with 1296)
    if (searchNumeric.length >= 3) {
      if (
        new RegExp(`-(${searchNumeric}|0*${normalizedSearch})$`, 'i').test(sku)
        && !(searchNumeric.includes(skuNumeric) && skuNumeric.length < searchNumeric.length)
      ) {
        return 2;
      }
    }

    // Soft: whole-number digit token in SKU when query is long enough; never reverse-substring
    if (
      searchNumeric.length >= 4
      && (
        hasWordBoundaryDigitMatch(sku, searchNumeric)
        || hasWordBoundaryDigitMatch(sku, normalizedSearch)
      )
      && !(searchNumeric.includes(skuNumeric) && skuNumeric.length < searchNumeric.length)
    ) {
      return 2;
    }

    const nameHit =
      hasWordBoundaryDigitMatch(name, searchNumeric)
      || hasWordBoundaryDigitMatch(name, normalizedSearch);
    const descHit =
      hasWordBoundaryDigitMatch(description, searchNumeric)
      || hasWordBoundaryDigitMatch(description, normalizedSearch);
    if (nameHit || descHit) return 3;

    return 99;
  }

  // Non-numeric / mixed text search
  if (lowerSku === searchLower) return 0;
  if (lowerSku.includes(searchLower)) return 1;
  if (name.toLowerCase().includes(searchLower) || description.toLowerCase().includes(searchLower)) {
    return 3;
  }
  return 99;
}

/** Prefer exact SKU hits; when any rank-0 exists, keep ranks 0–2 only (drop loose name noise). */
export function preferExactSkuHits<T extends { name?: string | null; sku?: string | null; description?: string | null }>(
  ranked: T[],
  searchTerm: string,
): T[] {
  const term = String(searchTerm || '').trim();
  if (!term || ranked.length === 0) return ranked;
  const hasExact = ranked.some((p) => rankProductSearchHit(p, term) === 0);
  if (!hasExact) return ranked;
  return ranked.filter((p) => rankProductSearchHit(p, term) <= 2);
}

export const PRODUCT_SEARCH_RESULT_CAP = 25;
