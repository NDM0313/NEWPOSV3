/**
 * All-Branches count grouping: product/variation summary + per-branch lines.
 * Pure helpers — no I/O.
 */

export type BranchCountSlice = {
  branch_id: string;
  system_qty_baseline: number;
  physical_qty: number | null;
  count_status: 'uncounted' | 'counted_zero' | 'counted_qty';
  difference: number | null;
};

export type GroupedCountKey = {
  product_id: string;
  variation_id: string | null;
};

export function groupKey(productId: string, variationId?: string | null): string {
  return `${productId}::${variationId || ''}`;
}

export type GroupedCountProduct<T extends { product_id: string; variation_id?: string | null }> = {
  key: string;
  product_id: string;
  variation_id: string | null;
  lines: T[];
  systemTotal: number;
  physical: ReturnType<typeof sumConfirmedPhysical>;
};

/** Group flat branch lines into product/variation summary rows. */
export function groupLinesByProductVariation<
  T extends {
    product_id: string;
    variation_id?: string | null;
    system_qty_baseline: number;
    physical_qty: number | null;
    count_status: string;
  }
>(lines: T[]): GroupedCountProduct<T>[] {
  const map = new Map<string, T[]>();
  for (const line of lines) {
    const k = groupKey(line.product_id, line.variation_id);
    const arr = map.get(k) || [];
    arr.push(line);
    map.set(k, arr);
  }
  return [...map.entries()].map(([key, groupLines]) => {
    const first = groupLines[0];
    return {
      key,
      product_id: first.product_id,
      variation_id: first.variation_id ?? null,
      lines: groupLines,
      systemTotal: sumSystemQty(groupLines),
      physical: sumConfirmedPhysical(groupLines),
    };
  });
}

/** Combined ERP expected = sum of branch baselines. */
export function sumSystemQty(slices: Array<{ system_qty_baseline: number }>): number {
  return Math.round(slices.reduce((s, x) => s + (Number(x.system_qty_baseline) || 0), 0) * 10000) / 10000;
}

/**
 * Sum of confirmed shop counts only. Blank/uncounted branches excluded (not treated as zero).
 * Returns { total, partial } where partial means at least one branch still uncounted.
 */
export function sumConfirmedPhysical(
  slices: Array<{ physical_qty: number | null; count_status: string }>
): { total: number | null; partial: boolean; confirmedCount: number; uncountedCount: number } {
  let total = 0;
  let confirmed = 0;
  let uncounted = 0;
  for (const s of slices) {
    if (s.count_status === 'uncounted' || s.physical_qty == null) {
      uncounted += 1;
      continue;
    }
    confirmed += 1;
    total += Number(s.physical_qty) || 0;
  }
  if (confirmed === 0) {
    return { total: null, partial: uncounted > 0, confirmedCount: 0, uncountedCount: uncounted };
  }
  return {
    total: Math.round(total * 10000) / 10000,
    partial: uncounted > 0,
    confirmedCount: confirmed,
    uncountedCount: uncounted,
  };
}

export function branchDifference(
  physicalQty: number | null,
  systemQty: number
): number | null {
  if (physicalQty == null) return null;
  return Math.round((Number(physicalQty) - Number(systemQty || 0)) * 10000) / 10000;
}

/**
 * Example: A expected 2 / counted 3, B expected 3 / counted 2 →
 * combined system 5, combined physical 5, but branch diffs +1 and -1 remain visible.
 */
export function demonstrateCrossBranchSwap(): {
  systemTotal: number;
  physicalTotal: number;
  branchDiffs: number[];
} {
  const slices: BranchCountSlice[] = [
    {
      branch_id: 'A',
      system_qty_baseline: 2,
      physical_qty: 3,
      count_status: 'counted_qty',
      difference: 1,
    },
    {
      branch_id: 'B',
      system_qty_baseline: 3,
      physical_qty: 2,
      count_status: 'counted_qty',
      difference: -1,
    },
  ];
  const systemTotal = sumSystemQty(slices);
  const phys = sumConfirmedPhysical(slices);
  return {
    systemTotal,
    physicalTotal: phys.total ?? 0,
    branchDiffs: slices.map((s) => branchDifference(s.physical_qty, s.system_qty_baseline) ?? 0),
  };
}
