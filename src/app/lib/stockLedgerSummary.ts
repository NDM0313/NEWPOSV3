/**
 * Shared stock movement summary for Full Stock Ledger and Inventory Count history.
 * Authoritative input: stock_movements rows only (do not add document tables on top).
 */

export type LedgerMovementLike = {
  movement_type?: string | null;
  type?: string | null;
  reference_type?: string | null;
  quantity?: number | null;
  box_change?: number | null;
  piece_change?: number | null;
  created_at?: string | null;
};

export type StockLedgerSummary = {
  totalPurchased: number;
  totalSold: number;
  /** Period gross issued on rent (abs of rental_out). */
  rentOutGross: number;
  /** Period gross rental returns (rental_in / rental_return, positive qty summed). */
  rentalReturnsGross: number;
  /**
   * Outstanding on rent from the provided movement set:
   * sum(abs(rental_out)) - sum(rental_in/rental_return).
   * Pass full-history movements for "currently out"; period-filtered rows only for period net.
   */
  currentlyOutOnRent: number;
  totalSaleReturns: number;
  totalPurchaseReturns: number;
  totalAdjustmentPositive: number;
  totalAdjustmentNegative: number;
  totalAdjustments: number;
  totalIn: number;
  totalOut: number;
  currentBalance: number;
  totalPurchasedBox: number;
  totalPurchasedPiece: number;
  totalSoldBox: number;
  totalSoldPiece: number;
  totalAdjustmentBox: number;
  totalAdjustmentPiece: number;
  currentBox: number;
  currentPiece: number;
  /** @deprecated use rentOutGross — kept for FullStockLedger card label compatibility */
  totalRented: number;
  /** @deprecated mixed returns; prefer rentalReturnsGross / totalSaleReturns */
  totalReturned: number;
};

function mtOf(m: LedgerMovementLike): string {
  return String(m.movement_type || m.type || '')
    .toLowerCase()
    .trim();
}

function rtOf(m: LedgerMovementLike): string {
  return String(m.reference_type || '')
    .toLowerCase()
    .trim();
}

/** Skip obvious void/cancel reversal rows from gross rental cards when typed as cancelled. */
export function isCancelledStockMovement(m: LedgerMovementLike): boolean {
  const mt = mtOf(m);
  return mt === 'sale_cancelled' || mt === 'purchase_cancelled' || mt.endsWith('_cancelled');
}

export function summarizeStockMovements(movements: LedgerMovementLike[]): StockLedgerSummary {
  let totalPurchased = 0;
  let totalSold = 0;
  let rentOutGross = 0;
  let rentalReturnsGross = 0;
  let totalSaleReturns = 0;
  let totalPurchaseReturns = 0;
  let totalAdjustmentPositive = 0;
  let totalAdjustmentNegative = 0;
  let currentBalance = 0;
  let totalPurchasedBox = 0;
  let totalPurchasedPiece = 0;
  let totalSoldBox = 0;
  let totalSoldPiece = 0;
  let totalAdjustmentBox = 0;
  let totalAdjustmentPiece = 0;
  let currentBox = 0;
  let currentPiece = 0;

  for (const movement of movements) {
    if (isCancelledStockMovement(movement)) {
      const qtyC = Number(movement.quantity || 0);
      const boxC = Number(movement.box_change ?? 0);
      const pieceC = Number(movement.piece_change ?? 0);
      currentBalance += qtyC;
      currentBox += boxC;
      currentPiece += pieceC;
      continue;
    }

    const qty = Number(movement.quantity || 0);
    const boxCh = Number(movement.box_change ?? 0);
    const pieceCh = Number(movement.piece_change ?? 0);
    const movementType = mtOf(movement);
    const referenceType = rtOf(movement);

    if (movementType === 'purchase' || referenceType === 'purchase') {
      totalPurchased += qty;
      totalPurchasedBox += boxCh;
      totalPurchasedPiece += pieceCh;
    } else if (movementType === 'sale' || referenceType === 'sale') {
      totalSold += Math.abs(qty);
      totalSoldBox += Math.abs(boxCh);
      totalSoldPiece += Math.abs(pieceCh);
    } else if (movementType === 'rental_out') {
      rentOutGross += Math.abs(qty);
    } else if (movementType === 'rental_in' || movementType === 'rental_return') {
      rentalReturnsGross += Math.abs(qty);
    } else if (
      movementType === 'sale_return' ||
      movementType === 'sell_return' ||
      movementType === 'return'
    ) {
      totalSaleReturns += Math.abs(qty);
    } else if (movementType === 'purchase_return') {
      totalPurchaseReturns += Math.abs(qty);
    } else if (movementType === 'adjustment') {
      if (qty > 0) totalAdjustmentPositive += qty;
      else if (qty < 0) totalAdjustmentNegative += Math.abs(qty);
      totalAdjustmentBox += boxCh;
      totalAdjustmentPiece += pieceCh;
    }

    currentBalance += qty;
    currentBox += boxCh;
    currentPiece += pieceCh;
  }

  const currentlyOutOnRent = Math.max(0, Math.round((rentOutGross - rentalReturnsGross) * 10000) / 10000);
  const totalAdjustments = totalAdjustmentPositive - totalAdjustmentNegative;
  const totalIn =
    totalPurchased + totalSaleReturns + rentalReturnsGross + totalAdjustmentPositive;
  const totalOut = totalSold + rentOutGross + totalPurchaseReturns + totalAdjustmentNegative;

  return {
    totalPurchased,
    totalSold,
    rentOutGross,
    rentalReturnsGross,
    currentlyOutOnRent,
    totalSaleReturns,
    totalPurchaseReturns,
    totalAdjustmentPositive,
    totalAdjustmentNegative,
    totalAdjustments,
    totalIn,
    totalOut,
    currentBalance,
    totalPurchasedBox,
    totalPurchasedPiece,
    totalSoldBox,
    totalSoldPiece,
    totalAdjustmentBox,
    totalAdjustmentPiece,
    currentBox,
    currentPiece,
    totalRented: rentOutGross,
    totalReturned: rentalReturnsGross + totalSaleReturns,
  };
}
