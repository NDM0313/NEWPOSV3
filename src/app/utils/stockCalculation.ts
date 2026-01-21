/**
 * UNIFIED STOCK CALCULATION UTILITY
 * Single Source of Truth for stock calculations across Dashboard, Drawer, and Ledger
 * 
 * Formula:
 * CURRENT_STOCK = 
 *   OPENING_STOCK (if exists in movements or products table)
 *   + PURCHASE
 *   + RETURN
 *   + TRANSFER_IN
 *   + ADJUSTMENT (positive)
 *   - SALE
 *   - TRANSFER_OUT
 *   - ADJUSTMENT (negative)
 */

export interface StockMovement {
  id?: string;
  movement_type: string;
  quantity: number;
  variation_id?: string | null;
  branch_id?: string | null;
  created_at?: string;
}

export interface StockCalculationResult {
  totalPurchased: number;
  totalSold: number;
  totalReturned: number;
  totalTransferIn: number;
  totalTransferOut: number;
  totalAdjustmentPositive: number;
  totalAdjustmentNegative: number;
  totalAdjustments: number; // Net adjustment
  currentBalance: number; // Final calculated stock
  movementCount: number;
}

/**
 * Calculate stock from movements array
 * This is the SINGLE SOURCE OF TRUTH for stock calculations
 */
export function calculateStockFromMovements(movements: StockMovement[]): StockCalculationResult {
  let totalPurchased = 0;
  let totalSold = 0;
  let totalReturned = 0;
  let totalTransferIn = 0;
  let totalTransferOut = 0;
  let totalAdjustmentPositive = 0;
  let totalAdjustmentNegative = 0;
  let currentBalance = 0; // Start from 0 (opening balance handled separately if needed)

  movements.forEach((movement) => {
    const qty = Number(movement.quantity || 0);
    const movementType = ((movement.movement_type || movement.type || '') as string).toLowerCase();

    // Categorize movements
    if (movementType === 'purchase') {
      totalPurchased += qty;
      currentBalance += qty;
    } else if (movementType === 'sale') {
      const saleQty = Math.abs(qty); // Sale quantities are usually negative
      totalSold += saleQty;
      currentBalance += qty; // Add negative quantity
    } else if (movementType === 'return' || movementType === 'sell_return' || movementType === 'rental_return') {
      totalReturned += qty;
      currentBalance += qty;
    } else if (movementType === 'transfer' || movementType === 'transfer_in') {
      totalTransferIn += qty;
      currentBalance += qty;
    } else if (movementType === 'transfer_out') {
      totalTransferOut += Math.abs(qty);
      currentBalance += qty; // Usually negative
    } else if (movementType === 'adjustment') {
      if (qty > 0) {
        totalAdjustmentPositive += qty;
      } else if (qty < 0) {
        totalAdjustmentNegative += Math.abs(qty);
      }
      currentBalance += qty; // Include adjustment in balance
    }
  });

  const totalAdjustments = totalAdjustmentPositive - totalAdjustmentNegative;

  return {
    totalPurchased,
    totalSold,
    totalReturned,
    totalTransferIn,
    totalTransferOut,
    totalAdjustmentPositive,
    totalAdjustmentNegative,
    totalAdjustments,
    currentBalance,
    movementCount: movements.length,
  };
}

/**
 * Calculate stock with opening balance
 * If opening stock exists in products table, add it to the calculated balance
 */
export function calculateStockWithOpening(
  movements: StockMovement[],
  openingStock: number = 0
): StockCalculationResult {
  const result = calculateStockFromMovements(movements);
  return {
    ...result,
    currentBalance: openingStock + result.currentBalance,
  };
}
