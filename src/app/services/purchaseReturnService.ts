/**
 * Purchase Return service – same rules as Sale Return: FINAL when saved, no edit/delete.
 * On finalize: stock OUT (negative movement), supplier ledger CREDIT (reduces payable).
 */
import { supabase } from '@/lib/supabase';
import { productService } from './productService';
import { getOrCreateLedger, addLedgerEntry } from './ledgerService';

export interface PurchaseReturn {
  id?: string;
  company_id: string;
  branch_id: string;
  original_purchase_id: string;
  return_no?: string;
  return_date: string;
  supplier_id?: string;
  supplier_name: string;
  status: 'draft' | 'final';
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  reason?: string;
  notes?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PurchaseReturnItem {
  id?: string;
  purchase_return_id: string;
  purchase_item_id?: string;
  product_id: string;
  variation_id?: string;
  product_name: string;
  sku: string;
  quantity: number;
  unit?: string;
  unit_price: number;
  total: number;
  notes?: string;
  // Packing fields - preserved from original purchase item
  packing_type?: string;
  packing_quantity?: number;
  packing_unit?: string;
  packing_details?: any; // JSONB - packing details (boxes, pieces, meters)
  // Return packing details - piece-level selection
  return_packing_details?: any; // JSONB - { returned_pieces: [{ box_no, piece_no, meters }], returned_boxes, returned_pieces_count, returned_total_meters }
}

export interface CreatePurchaseReturnData {
  company_id: string;
  branch_id: string;
  original_purchase_id: string;
  return_date: string;
  supplier_id?: string;
  supplier_name: string;
  items: Array<{
    purchase_item_id?: string;
    product_id: string;
    variation_id?: string;
    product_name: string;
    sku: string;
    quantity: number;
    unit?: string;
    unit_price: number;
    total: number;
    notes?: string;
    // Packing fields - preserved from original purchase item
    packing_type?: string;
    packing_quantity?: number;
    packing_unit?: string;
    packing_details?: any; // JSONB - packing details (boxes, pieces, meters)
    return_packing_details?: any; // JSONB - piece-level return selection
  }>;
  reason?: string;
  notes?: string;
  created_by?: string;
  subtotal?: number;
  discount_amount?: number;
  total?: number;
}

export const purchaseReturnService = {
  async createPurchaseReturn(data: CreatePurchaseReturnData): Promise<PurchaseReturn> {
    const { company_id, branch_id, original_purchase_id, return_date, supplier_id, supplier_name, items, reason, notes, created_by, subtotal: providedSubtotal, discount_amount: providedDiscount, total: providedTotal } = data;

    const subtotal = providedSubtotal !== undefined ? providedSubtotal : items.reduce((sum, item) => sum + item.total, 0);
    const discount_amount = providedDiscount !== undefined ? providedDiscount : 0;
    const tax_amount = 0;
    const total = providedTotal !== undefined ? providedTotal : subtotal - discount_amount + tax_amount;

    const return_no = await this.generateReturnNumber(company_id, branch_id);

    const { data: purchaseReturn, error: returnError } = await supabase
      .from('purchase_returns')
      .insert({
        company_id,
        branch_id,
        original_purchase_id,
        return_no,
        return_date,
        supplier_id: supplier_id || null,
        supplier_name,
        status: 'draft',
        subtotal,
        discount_amount,
        tax_amount,
        total,
        reason: reason || null,
        notes: notes || null,
        created_by: created_by || null,
      })
      .select()
      .single();

    if (returnError) throw returnError;
    if (!purchaseReturn) throw new Error('Failed to create purchase return');

    const returnItems = items.map(item => ({
      purchase_return_id: purchaseReturn.id,
      purchase_item_id: item.purchase_item_id || null,
      product_id: item.product_id,
      variation_id: item.variation_id || null,
      product_name: item.product_name,
      sku: item.sku,
      quantity: item.quantity,
      unit: item.unit || 'pcs',
      unit_price: item.unit_price,
      total: item.total,
      notes: item.notes || null,
      // Preserve all packing fields from original purchase item
      packing_type: item.packing_type || null,
      packing_quantity: item.packing_quantity || null,
      packing_unit: item.packing_unit || null,
      packing_details: item.packing_details || null,
      // NEW: Return packing details (piece-level selection)
      return_packing_details: item.return_packing_details || null,
    }));

    const { error: itemsError } = await supabase
      .from('purchase_return_items')
      .insert(returnItems);

    if (itemsError) throw itemsError;

    return purchaseReturn as PurchaseReturn;
  },

  async finalizePurchaseReturn(
    returnId: string,
    companyId: string,
    branchId: string,
    userId?: string
  ): Promise<void> {
    const { data: purchaseReturn, error: returnError } = await supabase
      .from('purchase_returns')
      .select(`
        *,
        items:purchase_return_items(*)
      `)
      .eq('id', returnId)
      .eq('company_id', companyId)
      .single();

    if (returnError) throw returnError;
    if (!purchaseReturn) throw new Error('Purchase return not found');
    if (purchaseReturn.status === 'final') throw new Error('Purchase return already finalized');

    const { data: originalPurchase, error: purchaseError } = await supabase
      .from('purchases')
      .select('po_no, status, supplier_id')
      .eq('id', purchaseReturn.original_purchase_id)
      .single();

    if (purchaseError) throw purchaseError;
    if (!originalPurchase) throw new Error('Original purchase not found');
    if (originalPurchase.status !== 'final' && originalPurchase.status !== 'received') {
      throw new Error('Purchase return allowed only for final/received purchases.');
    }

    // Validate return qty ≤ purchased qty per product/variation
    const { data: purchaseItems } = await supabase
      .from('purchase_items')
      .select('id, product_id, variation_id, quantity, packing_details')
      .eq('purchase_id', purchaseReturn.original_purchase_id);

    if (purchaseItems?.length) {
      for (const retItem of purchaseReturn.items) {
        const orig = purchaseItems.find(
          (p: any) => p.product_id === retItem.product_id && (p.variation_id === retItem.variation_id || (!p.variation_id && !retItem.variation_id))
        );
        if (!orig) throw new Error(`Product ${retItem.product_name} not found in original purchase`);
        const { data: existingReturns } = await supabase
          .from('purchase_return_items')
          .select('quantity')
          .eq('product_id', retItem.product_id)
          .is('variation_id', retItem.variation_id || null)
          .neq('purchase_return_id', returnId);
        const alreadyReturned = (existingReturns || []).reduce((s, r: any) => s + Number(r.quantity), 0);
        if (alreadyReturned + Number(retItem.quantity) > Number(orig.quantity)) {
          throw new Error(`Return qty exceeds purchased qty for ${retItem.product_name}`);
        }
      }
    }

    // Stock movements: NEGATIVE (stock OUT) with proportional box/piece return
    for (const item of purchaseReturn.items) {
      // Calculate proportional box/piece return based on original packing
      let boxChange = 0;
      let pieceChange = 0;
      
      // Get original item to calculate return ratio
      const originalItem = purchaseItems?.find(
        (p: any) => p.product_id === item.product_id && 
        (p.variation_id === item.variation_id || (!p.variation_id && !item.variation_id))
      );
      
      if (originalItem) {
        // Get original packing details from original purchase item (CRITICAL: use original, not return item)
        const originalPacking = originalItem.packing_details || {};
        const originalQty = Number(originalItem.quantity);
        const returnQty = Number(item.quantity);
        
        if (originalQty > 0 && originalPacking) {
          // Calculate return ratio
          const returnRatio = returnQty / originalQty;
          
          // Apply ratio to boxes and pieces proportionally (using ORIGINAL packing structure)
          const originalBoxes = originalPacking.total_boxes || 0;
          const originalPieces = originalPacking.total_pieces || 0;
          
          boxChange = Math.round(originalBoxes * returnRatio * 100) / 100; // Round to 2 decimals
          pieceChange = Math.round(originalPieces * returnRatio * 100) / 100;
        }
      }
      
      await productService.createStockMovement({
        company_id: companyId,
        branch_id: branchId === 'all' ? undefined : branchId,
        product_id: item.product_id,
        variation_id: item.variation_id || undefined,
        movement_type: 'purchase_return',
        quantity: -Number(item.quantity), // NEGATIVE for stock OUT
        unit_cost: Number(item.unit_price),
        total_cost: Number(item.total),
        reference_type: 'purchase_return',
        reference_id: returnId,
        notes: `Purchase Return ${purchaseReturn.return_no || returnId}: ${item.product_name}${item.variation_id ? ' (Variation)' : ''}`,
        created_by: userId,
        box_change: boxChange > 0 ? -boxChange : undefined, // NEGATIVE for stock OUT
        piece_change: pieceChange > 0 ? -pieceChange : undefined, // NEGATIVE for stock OUT
      });
    }

    // Supplier ledger: CREDIT (reduces payable)
    const supplierId = purchaseReturn.supplier_id || originalPurchase.supplier_id;
    if (companyId && supplierId && purchaseReturn.total > 0) {
      const ledger = await getOrCreateLedger(companyId, 'supplier', supplierId, purchaseReturn.supplier_name);
      if (ledger) {
        await addLedgerEntry({
          companyId,
          ledgerId: ledger.id,
          entryDate: purchaseReturn.return_date,
          debit: 0,
          credit: purchaseReturn.total,
          source: 'purchase_return',
          referenceNo: purchaseReturn.return_no || `PRET-${returnId.slice(0, 8)}`,
          referenceId: returnId,
          remarks: `Purchase Return ${purchaseReturn.return_no || returnId}`,
        });
      }
    }

    const { error: updateError } = await supabase
      .from('purchase_returns')
      .update({ status: 'final', updated_at: new Date().toISOString() })
      .eq('id', returnId);

    if (updateError) throw updateError;
  },

  async getPurchaseReturnById(returnId: string, companyId: string): Promise<PurchaseReturn & { items: PurchaseReturnItem[] }> {
    const { data, error } = await supabase
      .from('purchase_returns')
      .select(`
        *,
        items:purchase_return_items(*)
      `)
      .eq('id', returnId)
      .eq('company_id', companyId)
      .single();

    if (error) throw error;
    return data as PurchaseReturn & { items: PurchaseReturnItem[] };
  },

  async getPurchaseReturns(companyId: string, branchId?: string): Promise<(PurchaseReturn & { items: PurchaseReturnItem[] })[]> {
    let query = supabase
      .from('purchase_returns')
      .select(`
        *,
        items:purchase_return_items(*)
      `)
      .eq('company_id', companyId)
      .order('return_date', { ascending: false });

    if (branchId && branchId !== 'all') {
      query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as (PurchaseReturn & { items: PurchaseReturnItem[] })[];
  },

  async getOriginalPurchaseItems(purchaseId: string, companyId: string): Promise<Array<{
    id: string;
    product_id: string;
    variation_id?: string;
    product_name: string;
    sku: string;
    quantity: number;
    unit?: string;
    unit_price: number;
    total: number;
    already_returned?: number;
    // Packing fields - preserved from original purchase item
    packing_type?: string;
    packing_quantity?: number;
    packing_unit?: string;
    packing_details?: any; // JSONB
    // Variation object for display (same as Purchase View)
    variation?: any;
  }>> {
    const { data: items, error } = await supabase
      .from('purchase_items')
      .select(`
        id,
        product_id,
        variation_id,
        product_name,
        sku,
        quantity,
        unit,
        unit_price,
        total,
        packing_type,
        packing_quantity,
        packing_unit,
        packing_details,
        variation:product_variations(*)
      `)
      .eq('purchase_id', purchaseId);

    if (error) throw error;
    if (!items?.length) return [];

    const { data: returns } = await supabase
      .from('purchase_returns')
      .select('id, items:purchase_return_items(product_id, variation_id, quantity, return_packing_details)')
      .eq('original_purchase_id', purchaseId)
      .eq('company_id', companyId)
      .eq('status', 'final');

    const returnedMap: Record<string, number> = {};
    const returnedPiecesMap: Map<string, Set<string>> = new Map(); // Track returned pieces per item
    
    (returns || []).forEach((ret: any) => {
      (ret.items || []).forEach((it: any) => {
        const key = `${it.product_id}_${it.variation_id || 'null'}`;
        returnedMap[key] = (returnedMap[key] || 0) + Number(it.quantity);
        
        // Track returned pieces from return_packing_details
        if (it.return_packing_details && it.return_packing_details.returned_pieces) {
          if (!returnedPiecesMap.has(key)) {
            returnedPiecesMap.set(key, new Set());
          }
          const pieceSet = returnedPiecesMap.get(key)!;
          it.return_packing_details.returned_pieces.forEach((piece: any) => {
            const pieceKey = piece.box_no === 0 
              ? `loose-${piece.piece_no - 1}` 
              : `${piece.box_no}-${piece.piece_no - 1}`;
            pieceSet.add(pieceKey);
          });
        }
      });
    });

    return items.map((item: any) => {
      const key = `${item.product_id}_${item.variation_id || 'null'}`;
      // Extract variation data (same as Purchase View)
      const variation = item.variation || item.product_variations || null;
      const variationSku = variation?.sku || null;
      const finalSku = variationSku || item.sku || 'N/A';
      
      return {
        id: item.id,
        product_id: item.product_id,
        variation_id: item.variation_id || undefined,
        product_name: item.product_name,
        sku: finalSku,
        quantity: Number(item.quantity),
        unit: item.unit || 'pcs',
        unit_price: Number(item.unit_price || 0),
        total: Number(item.total || 0),
        already_returned: returnedMap[key] || 0,
        already_returned_pieces: returnedPiecesMap.get(key) || new Set(), // Set of piece keys already returned
        // Preserve all packing fields from original purchase item
        packing_type: item.packing_type || undefined,
        packing_quantity: item.packing_quantity ? Number(item.packing_quantity) : undefined,
        packing_unit: item.packing_unit || undefined,
        packing_details: item.packing_details || undefined,
        // Include variation object for display (same as Purchase View)
        variation: variation,
      };
    });
  },

  async generateReturnNumber(companyId: string, branchId?: string): Promise<string> {
    const { data: sequence } = await supabase
      .from('document_sequences')
      .select('current_number, prefix, padding')
      .eq('company_id', companyId)
      .eq('document_type', 'purchase_return')
      .eq('branch_id', branchId || null)
      .maybeSingle();

    if (sequence) {
      const nextNumber = (sequence.current_number || 0) + 1;
      const padded = String(nextNumber).padStart(sequence.padding || 4, '0');
      await supabase.from('document_sequences').update({ current_number: nextNumber }).eq('id', sequence.id);
      return `${sequence.prefix}${padded}`;
    }

    const d = new Date();
    return `PRET-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${Date.now().toString().slice(-4)}`;
  },

  async deletePurchaseReturn(returnId: string, companyId: string): Promise<void> {
    const { data: existing } = await supabase
      .from('purchase_returns')
      .select('status')
      .eq('id', returnId)
      .eq('company_id', companyId)
      .single();

    if (existing?.status === 'final') {
      throw new Error('Cannot delete a finalized purchase return. It is locked.');
    }

    const { error } = await supabase
      .from('purchase_returns')
      .delete()
      .eq('id', returnId)
      .eq('company_id', companyId)
      .eq('status', 'draft');

    if (error) throw error;
  },
};
