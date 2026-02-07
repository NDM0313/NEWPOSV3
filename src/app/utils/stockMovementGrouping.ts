/**
 * Stock Movement Grouping Utility
 * 
 * Groups stock movements by (reference_type, reference_id, product_id, variation_id)
 * to show net effect instead of individual delta movements.
 * 
 * This is a UI-only transformation - database remains unchanged for audit trail.
 */

import { InventoryMovementRow } from '../services/inventoryService';

export type ViewMode = 'detailed' | 'grouped';

export interface GroupedMovementRow extends Omit<InventoryMovementRow, 'id' | 'created_at' | 'notes' | 'unit_cost' | 'total_cost' | 'before_qty' | 'after_qty'> {
  id: string; // Composite key for grouped row
  created_at: string; // Latest timestamp from grouped movements
  notes: string | null; // Aggregated notes
  unit_cost?: number; // Weighted average or latest unit_cost
  total_cost?: number; // Sum of total_cost
  before_qty?: number; // First before_qty (if available)
  after_qty?: number; // Last after_qty (if available)
  movement_count: number; // Number of movements in this group
  is_grouped: true; // Flag to identify grouped rows
}

/**
 * Groups stock movements by reference_type, reference_id, product_id, variation_id
 * Calculates net quantities and aggregates other fields
 */
export function groupStockMovements(
  movements: InventoryMovementRow[]
): GroupedMovementRow[] {
  if (movements.length === 0) return [];

  // Group key: reference_type + reference_id + product_id + variation_id
  const groups = new Map<string, InventoryMovementRow[]>();

  movements.forEach((movement) => {
    const groupKey = createGroupKey(movement);
    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey)!.push(movement);
  });

  // Convert groups to grouped rows
  const groupedRows: GroupedMovementRow[] = [];

  groups.forEach((groupMovements, groupKey) => {
    if (groupMovements.length === 0) return;

    // Sort by created_at (newest first) for accurate latest values
    const sorted = [...groupMovements].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    // Calculate net quantities
    const netQuantity = groupMovements.reduce((sum, m) => sum + (m.quantity || 0), 0);
    const netBoxChange = groupMovements.reduce((sum, m) => sum + (m.box_change || 0), 0);
    const netPieceChange = groupMovements.reduce((sum, m) => sum + (m.piece_change || 0), 0);
    const netTotalCost = groupMovements.reduce((sum, m) => sum + (m.total_cost || 0), 0);

    // Calculate weighted average unit_cost
    let weightedAvgUnitCost: number | undefined = undefined;
    const movementsWithCost = groupMovements.filter(m => m.unit_cost != null && m.quantity != null && m.quantity !== 0);
    if (movementsWithCost.length > 0) {
      const totalCost = movementsWithCost.reduce((sum, m) => sum + ((m.unit_cost || 0) * Math.abs(m.quantity || 0)), 0);
      const totalQty = movementsWithCost.reduce((sum, m) => sum + Math.abs(m.quantity || 0), 0);
      if (totalQty > 0) {
        weightedAvgUnitCost = totalCost / totalQty;
      }
    }
    // Fallback to latest unit_cost if weighted avg not available
    if (weightedAvgUnitCost == null && first.unit_cost != null) {
      weightedAvgUnitCost = first.unit_cost;
    }

    // Aggregate notes - extract reference numbers
    const notesSet = new Set<string>();
    groupMovements.forEach(m => {
      if (m.notes) {
        // Extract reference number from notes (e.g., "Sale Edit SL-0011" -> "SL-0011")
        // Pattern: SL-XXXX, PUR-XXXX, STD-XXXX, PAY-XXXX, ADJ-XXXX, INV-XXXX, etc.
        const refMatch = m.notes.match(/(SL-|PUR-|STD-|PAY-|ADJ-|INV-|QT-|SO-|DRAFT-)[A-Z0-9-]+/i);
        if (refMatch) {
          notesSet.add(refMatch[0]);
        } else {
          // If no reference pattern found, use the full note (truncated if too long)
          const note = m.notes.length > 30 ? m.notes.substring(0, 30) + '...' : m.notes;
          notesSet.add(note);
        }
      }
    });
    
    // Create grouped notes
    let groupedNotes: string | null = null;
    if (notesSet.size > 0) {
      const refNumbers = Array.from(notesSet);
      if (refNumbers.length === 1) {
        // Single reference - show with (Net) suffix
        groupedNotes = `${refNumbers[0]} (Net)`;
      } else {
        // Multiple references - show first and count
        groupedNotes = `${refNumbers[0]} (Net, ${groupMovements.length} movements)`;
      }
    } else {
      // No notes - create a generic note based on reference
      if (first.reference_type && first.reference_id) {
        groupedNotes = `${first.reference_type} ${first.reference_id} (Net, ${groupMovements.length} movements)`;
      }
    }

    // Create grouped row
    const groupedRow: GroupedMovementRow = {
      ...first,
      id: `grouped-${groupKey}`, // Composite ID for React key
      quantity: netQuantity,
      box_change: netBoxChange !== 0 ? netBoxChange : undefined,
      piece_change: netPieceChange !== 0 ? netPieceChange : undefined,
      unit_cost: weightedAvgUnitCost,
      total_cost: netTotalCost !== 0 ? netTotalCost : undefined,
      before_qty: first.before_qty, // Use first movement's before_qty
      after_qty: last.after_qty, // Use last movement's after_qty
      created_at: first.created_at, // Latest timestamp
      notes: groupedNotes,
      movement_count: groupMovements.length,
      is_grouped: true,
    };

    groupedRows.push(groupedRow);
  });

  // Sort by latest created_at (newest first)
  return groupedRows.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

/**
 * Creates a unique group key from movement data
 * Format: reference_type|reference_id|product_id|variation_id
 */
function createGroupKey(movement: InventoryMovementRow): string {
  const refType = movement.reference_type || 'none';
  const refId = movement.reference_id || 'none';
  const productId = movement.product_id || 'none';
  const variationId = movement.variation_id || 'none';
  
  return `${refType}|${refId}|${productId}|${variationId}`;
}

// Export for use in components
export { createGroupKey };
