import type { ExtraServiceClearingLine } from '../api/expenses';

export type ClearingAllocation = {
  saleChargeId: string;
  saleId: string;
  tailorContactId: string | null;
  expenseCategoryId: string | null;
  invoiceNo: string;
  amount: number;
};

/** RPC returns newest-first — reverse for oldest-invoice-first FIFO. */
export function sortClearingLinesFifo(lines: ExtraServiceClearingLine[]): ExtraServiceClearingLine[] {
  return [...lines].reverse();
}

export function totalClearingOpen(lines: ExtraServiceClearingLine[]): number {
  return lines.reduce((sum, l) => sum + Math.max(0, Number(l.open_balance) || 0), 0);
}

/** Greedy FIFO: min(remaining, line.open_balance) per line until amount covered. */
export function allocateClearingFifo(
  amount: number,
  lines: ExtraServiceClearingLine[],
): { allocations: ClearingAllocation[]; totalOpen: number; remainder: number } {
  const sorted = sortClearingLinesFifo(lines);
  const totalOpen = totalClearingOpen(sorted);
  let remaining = Math.max(0, Number(amount) || 0);
  const allocations: ClearingAllocation[] = [];

  for (const line of sorted) {
    if (remaining <= 0.005) break;
    const open = Math.max(0, Number(line.open_balance) || 0);
    if (open <= 0.005) continue;
    const chunk = Math.min(remaining, open);
    allocations.push({
      saleChargeId: line.sale_charge_id,
      saleId: line.sale_id,
      tailorContactId: line.tailor_contact_id,
      expenseCategoryId: line.expense_category_id,
      invoiceNo: line.invoice_no,
      amount: Math.round(chunk * 100) / 100,
    });
    remaining -= chunk;
  }

  const remainder = Math.max(0, Math.round(remaining * 100) / 100);
  return { allocations, totalOpen, remainder };
}

export function allocationFromExplicitLine(
  line: ExtraServiceClearingLine,
  amount: number,
): ClearingAllocation {
  return {
    saleChargeId: line.sale_charge_id,
    saleId: line.sale_id,
    tailorContactId: line.tailor_contact_id,
    expenseCategoryId: line.expense_category_id,
    invoiceNo: line.invoice_no,
    amount,
  };
}

/** One expense: FIFO 4120 chunks across open lines; remainder posts to category expense. */
export function planHybridServiceExpense(
  amount: number,
  lines: ExtraServiceClearingLine[],
  explicitLine?: ExtraServiceClearingLine | null,
): {
  clearingParts: ClearingAllocation[];
  categoryAmount: number;
  primarySaleChargeId: string | null;
} {
  const amt = Math.max(0, Number(amount) || 0);
  if (amt <= 0) {
    return { clearingParts: [], categoryAmount: 0, primarySaleChargeId: null };
  }

  let orderLines: ExtraServiceClearingLine[];
  if (explicitLine) {
    const rest = sortClearingLinesFifo(
      lines.filter((l) => l.sale_charge_id !== explicitLine.sale_charge_id),
    );
    orderLines = [explicitLine, ...rest];
  } else {
    orderLines = sortClearingLinesFifo(lines);
  }

  const { allocations, remainder } = allocateClearingFifo(amt, orderLines);
  return {
    clearingParts: allocations,
    categoryAmount: remainder,
    primarySaleChargeId: allocations[0]?.saleChargeId ?? null,
  };
}
