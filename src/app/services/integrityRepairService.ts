/**
 * Integrity Repair Service
 * Auto-diagnosis and auto-fix for stock and contact balance discrepancies.
 * Used by the Developer Integrity Lab for one-click analysis and repair.
 */

import { supabase } from '@/lib/supabase';

// ======================== TYPES ========================

export interface StockIssue {
  productId: string;
  productName: string;
  sku: string;
  variationId?: string | null;
  variationLabel?: string;
  issueType: 'cancel_without_return_adjust' | 'orphan_shipping_stock' | 'negative_stock' | 'movement_mismatch' | 'balance_table_stale';
  description: string;
  expectedStock: number;
  actualStock: number;
  difference: number;
  severity: 'error' | 'warning' | 'info';
  fixable: boolean;
  fixDescription?: string;
  /** Data needed to apply fix */
  fixData?: Record<string, unknown>;
}

export interface StockMovementTrace {
  productId: string;
  productName: string;
  sku: string;
  movements: Array<{
    id: string;
    type: string;
    quantity: number;
    runningTotal: number;
    referenceType: string;
    referenceId: string;
    notes: string;
    createdAt: string;
  }>;
  finalStock: number;
  purchaseTotal: number;
  saleTotal: number;
  returnTotal: number;
  adjustmentTotal: number;
  cancelTotal: number;
  transferTotal: number;
}

export interface ContactBalanceIssue {
  contactId: string;
  contactName: string;
  contactType: string;
  subLedgerCode: string;
  subLedgerAccountId: string;
  glBalance: number;
  operationalBalance: number;
  difference: number;
  issueType: 'purchase_return_not_in_due' | 'orphan_shipping' | 'missing_opening_je' | 'cancelled_sale_residual' | 'payment_not_reflected' | 'unknown';
  description: string;
  fixable: boolean;
  fixDescription?: string;
  fixData?: Record<string, unknown>;
}

// ======================== STOCK INTEGRITY ========================

export const integrityRepairService = {

  /**
   * Full stock movement trace for all products. Returns per-product breakdown.
   */
  async traceAllStock(companyId: string): Promise<StockMovementTrace[]> {
    const { data: products } = await supabase
      .from('products')
      .select('id, name, sku')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('name');
    if (!products?.length) return [];

    const productIds = products.map(p => p.id);
    const { data: movements } = await supabase
      .from('stock_movements')
      .select('id, product_id, variation_id, movement_type, quantity, reference_type, reference_id, notes, created_at')
      .eq('company_id', companyId)
      .in('product_id', productIds)
      .order('created_at', { ascending: true });

    const traces: StockMovementTrace[] = [];
    for (const p of products as any[]) {
      const pMov = (movements || []).filter((m: any) => m.product_id === p.id);
      let running = 0;
      let purchaseTotal = 0, saleTotal = 0, returnTotal = 0, adjustmentTotal = 0, cancelTotal = 0, transferTotal = 0;

      const traced = pMov.map((m: any) => {
        const qty = Number(m.quantity) || 0;
        running += qty;
        const mt = (m.movement_type || '').toLowerCase();
        if (mt === 'purchase' || mt === 'opening_stock') purchaseTotal += Math.abs(qty);
        else if (mt === 'sale') saleTotal += Math.abs(qty);
        else if (mt.includes('return')) returnTotal += Math.abs(qty);
        else if (mt === 'adjustment') adjustmentTotal += qty;
        else if (mt.includes('cancel')) cancelTotal += Math.abs(qty);
        else if (mt.includes('transfer')) transferTotal += Math.abs(qty);

        return {
          id: m.id,
          type: m.movement_type,
          quantity: qty,
          runningTotal: Math.round(running * 100) / 100,
          referenceType: m.reference_type || '',
          referenceId: m.reference_id || '',
          notes: m.notes || '',
          createdAt: m.created_at || '',
        };
      });

      traces.push({
        productId: p.id,
        productName: p.name,
        sku: p.sku,
        movements: traced,
        finalStock: Math.round(running * 100) / 100,
        purchaseTotal, saleTotal, returnTotal, adjustmentTotal, cancelTotal, transferTotal,
      });
    }
    return traces;
  },

  /**
   * Diagnose stock issues across all products.
   */
  async diagnoseStockIssues(companyId: string): Promise<StockIssue[]> {
    const issues: StockIssue[] = [];
    const traces = await this.traceAllStock(companyId);

    for (const trace of traces) {
      // Issue: negative stock
      if (trace.finalStock < 0) {
        issues.push({
          productId: trace.productId,
          productName: trace.productName,
          sku: trace.sku,
          issueType: 'negative_stock',
          description: `Negative stock: ${trace.finalStock}. Check for missing purchases or duplicate sales.`,
          expectedStock: 0,
          actualStock: trace.finalStock,
          difference: trace.finalStock,
          severity: 'warning',
          fixable: false,
        });
      }

      // Issue: SALE_CANCELLED that might not account for returns
      const cancelMovements = trace.movements.filter(m => m.type.toLowerCase().includes('cancel') && m.referenceType === 'sale');
      for (const cm of cancelMovements) {
        // Find the original sale movement
        const saleMov = trace.movements.find(m =>
          m.type.toLowerCase() === 'sale' && m.referenceId === cm.referenceId
        );
        if (!saleMov) continue;

        const originalQty = Math.abs(saleMov.quantity);
        const cancelQty = Math.abs(cm.quantity);

        // Find return movements for this sale
        const { data: returns } = await supabase
          .from('sale_returns')
          .select('id, status')
          .eq('original_sale_id', cm.referenceId)
          .neq('status', 'void');

        if (returns && returns.length > 0) {
          const returnIds = returns.map(r => r.id);
          const returnMov = trace.movements.filter(m =>
            m.type.toLowerCase().includes('return') && returnIds.includes(m.referenceId)
          );
          const returnedQty = returnMov.reduce((s, m) => s + Math.abs(m.quantity), 0);

          if (cancelQty > originalQty - returnedQty + 0.01) {
            const expected = Math.max(0, originalQty - returnedQty);
            issues.push({
              productId: trace.productId,
              productName: trace.productName,
              sku: trace.sku,
              issueType: 'cancel_without_return_adjust',
              description: `SALE_CANCELLED reversed ${cancelQty} but ${returnedQty} already returned. Should reverse ${expected.toFixed(2)}.`,
              expectedStock: trace.finalStock - (cancelQty - expected),
              actualStock: trace.finalStock,
              difference: cancelQty - expected,
              severity: 'error',
              fixable: true,
              fixDescription: `Update SALE_CANCELLED qty from ${cancelQty} to ${expected.toFixed(2)}`,
              fixData: { movementId: cm.id, currentQty: cancelQty, correctQty: expected, saleId: cm.referenceId },
            });
          }
        }
      }
    }

    return issues;
  },

  /**
   * Fix a stock issue by applying the correction.
   */
  async fixStockIssue(issue: StockIssue): Promise<{ success: boolean; error?: string }> {
    try {
      if (issue.issueType === 'cancel_without_return_adjust' && issue.fixData) {
        const { movementId, correctQty } = issue.fixData as { movementId: string; correctQty: number };
        const { error } = await supabase
          .from('stock_movements')
          .update({
            quantity: correctQty,
            notes: `[AUTO-FIX] Adjusted from ${issue.fixData.currentQty} to ${correctQty} (return already reversed ${issue.difference} units)`,
          })
          .eq('id', movementId);
        if (error) return { success: false, error: error.message };
        return { success: true };
      }
      return { success: false, error: 'No auto-fix available for this issue type' };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Unknown error' };
    }
  },

  // ======================== CONTACT BALANCE INTEGRITY ========================

  /**
   * Diagnose contact balance mismatches between operational and GL.
   */
  async diagnoseContactIssues(companyId: string): Promise<ContactBalanceIssue[]> {
    const issues: ContactBalanceIssue[] = [];

    // Get contacts
    const { data: contacts } = await supabase.from('contacts')
      .select('id, name, type, opening_balance, supplier_opening_balance')
      .eq('company_id', companyId)
      .in('type', ['customer', 'supplier', 'both']);

    // Get sub-ledger accounts — for "both" type contacts, store AR and AP separately
    const { data: subAccounts } = await supabase.from('accounts')
      .select('id, code, name, linked_contact_id')
      .eq('company_id', companyId).eq('is_active', true)
      .not('linked_contact_id', 'is', null);
    const subMap = new Map<string, { id: string; code: string }>();
    const subMapAR = new Map<string, { id: string; code: string }>();
    const subMapAP = new Map<string, { id: string; code: string }>();
    (subAccounts || []).forEach((a: any) => {
      if (a.code?.startsWith('AR-')) subMapAR.set(a.linked_contact_id, { id: a.id, code: a.code });
      else if (a.code?.startsWith('AP-')) subMapAP.set(a.linked_contact_id, { id: a.id, code: a.code });
      subMap.set(a.linked_contact_id, { id: a.id, code: a.code });
    });

    // GL balances
    const subIds = (subAccounts || []).map((a: any) => a.id);
    const glMap = new Map<string, number>();
    if (subIds.length > 0) {
      const { data: entries } = await supabase.from('journal_entries').select('id')
        .eq('company_id', companyId).or('is_void.is.null,is_void.eq.false');
      const jeIds = (entries || []).map((e: any) => e.id);
      if (jeIds.length > 0) {
        const { data: lines } = await supabase.from('journal_entry_lines')
          .select('account_id, debit, credit').in('journal_entry_id', jeIds).in('account_id', subIds);
        (lines || []).forEach((l: any) => glMap.set(l.account_id, (glMap.get(l.account_id) || 0) + (Number(l.debit) || 0) - (Number(l.credit) || 0)));
      }
    }

    // Sales (include cancelled to track payments), purchases, returns, payments
    const { data: allSales } = await supabase.from('sales').select('id, customer_id, total, paid_amount, due_amount, status').eq('company_id', companyId).in('status', ['final', 'cancelled']);
    const sales = (allSales || []).filter((s: any) => s.status === 'final');
    const cancelledSales = (allSales || []).filter((s: any) => s.status === 'cancelled');
    const cancelledSaleIds = new Set(cancelledSales.map((s: any) => s.id));
    const { data: purchases } = await supabase.from('purchases').select('id, supplier_id, total, paid_amount, due_amount, status').eq('company_id', companyId).in('status', ['final', 'received']);
    const { data: allReturns } = await supabase.from('sale_returns').select('id, customer_id, original_sale_id, total, status').eq('company_id', companyId).eq('status', 'final');
    // Exclude returns against cancelled sales from operational calc
    const returns = (allReturns || []).filter((r: any) => !cancelledSaleIds.has(r.original_sale_id));
    const { data: payments } = await supabase.from('payments').select('id, contact_id, amount, payment_type, reference_type, reference_id, voided_at').eq('company_id', companyId);

    // Check for purchase returns too
    const { data: purchaseReturns } = await supabase.from('purchase_returns')
      .select('id, purchase_id, total, status')
      .eq('company_id', companyId).eq('status', 'final');

    for (const c of (contacts || []) as any[]) {
      const isCustomer = c.type === 'customer' || c.type === 'both';
      const isSupplier = c.type === 'supplier' || c.type === 'both';

      // For "both" type: check AR (customer side). For supplier-only: check AP.
      const sub = isCustomer ? (subMapAR.get(c.id) || subMap.get(c.id)) : (subMapAP.get(c.id) || subMap.get(c.id));
      if (!sub) continue;

      const rawGl = glMap.get(sub.id) || 0;
      const glBal = (sub.code?.startsWith('AP-')) ? Math.abs(rawGl) : rawGl;

      // Calculate operational — GL is source of truth; operational is approximate
      let operational = 0;
      if (isCustomer) {
        const opening = Number(c.opening_balance) || 0;
        const salesDue = (sales || []).filter((s: any) => s.customer_id === c.id).reduce((sum: number, s: any) => sum + Math.max(0, Number(s.due_amount) || 0), 0);
        const returnTotal = (returns || []).filter((r: any) => r.customer_id === c.id).reduce((sum: number, r: any) => sum + (Number(r.total) || 0), 0);
        // Account for payments on cancelled sales (these reduce the receivable but aren't in sales.due)
        const cancelledPayments = cancelledSales
          .filter((s: any) => s.customer_id === c.id)
          .reduce((sum: number, s: any) => sum + (Number(s.paid_amount) || 0), 0);
        // Account for shipping on cancelled sales still on AR
        const { data: shipJes } = await supabase.from('journal_entries')
          .select('id, reference_id').eq('company_id', companyId).eq('reference_type', 'shipment').eq('is_void', false);
        let cancelledShipping = 0;
        for (const sje of (shipJes || []) as any[]) {
          if (cancelledSaleIds.has(sje.reference_id)) {
            const { data: slines } = await supabase.from('journal_entry_lines').select('debit').eq('journal_entry_id', sje.id).eq('account_id', sub.id);
            cancelledShipping += (slines || []).reduce((s: number, l: any) => s + (Number(l.debit) || 0), 0);
          }
        }
        operational = opening + salesDue - returnTotal - cancelledPayments + cancelledShipping;
      }
      if (isSupplier && !isCustomer) {
        const opening = Number(c.supplier_opening_balance) || Number(c.opening_balance) || 0;
        const purchDue = (purchases || []).filter((p: any) => p.supplier_id === c.id).reduce((sum: number, p: any) => sum + Math.max(0, Number(p.due_amount) || 0), 0);
        operational = opening + purchDue;
      }

      const diff = Math.round((operational - glBal) * 100) / 100;
      if (Math.abs(diff) < 1) continue; // No significant difference

      // Diagnose root cause
      let issueType: ContactBalanceIssue['issueType'] = 'unknown';
      let description = `Operational (${operational.toLocaleString()}) vs GL (${glBal.toLocaleString()}) differ by ${diff.toLocaleString()}`;
      let fixable = false;
      let fixDescription: string | undefined;
      let fixData: Record<string, unknown> | undefined;

      if (isSupplier) {
        // Check purchase returns not reflected in due_amount
        const supplierPurchases = (purchases || []).filter((p: any) => p.supplier_id === c.id);
        for (const p of supplierPurchases) {
          const pReturns = (purchaseReturns || []).filter((r: any) => r.purchase_id === p.id);
          const returnAmt = pReturns.reduce((s: number, r: any) => s + (Number(r.total) || 0), 0);
          if (returnAmt > 0) {
            const expectedDue = Math.max(0, Number(p.total) - Number(p.paid_amount) - returnAmt);
            if (Math.abs(Number(p.due_amount) - expectedDue) > 0.5) {
              issueType = 'purchase_return_not_in_due';
              description = `Purchase ${(p as any).po_no}: due_amount=${p.due_amount} but should be ${expectedDue} (return of ${returnAmt} not subtracted)`;
              fixable = true;
              fixDescription = `Update purchase due_amount from ${p.due_amount} to ${expectedDue}`;
              fixData = { purchaseId: p.id, currentDue: p.due_amount, correctDue: expectedDue };
              break;
            }
          }
        }
      }

      if (isCustomer && issueType === 'unknown') {
        // Check cancelled sale residual (payments + returns creating mismatch)
        const custCancelledSales = cancelledSales.filter((s: any) => s.customer_id === c.id);
        if (custCancelledSales.length > 0) {
          issueType = 'cancelled_sale_residual';
          const totalPaid = custCancelledSales.reduce((s: number, cs: any) => s + (Number(cs.paid_amount) || 0), 0);
          description = `Cancelled sale(s) with payments (${totalPaid.toLocaleString()}) creating GL vs operational mismatch. GL is correct — trust GL balance of ${glBal.toLocaleString()}.`;
          fixable = true;
          fixDescription = 'Accept GL as truth (no DB change needed — operational calc limitation)';
          fixData = { action: 'accept_gl', glBalance: glBal };
        }
      }

      if (isCustomer && issueType === 'unknown') {
        // Check orphan shipping JEs
        const { data: shipJes } = await supabase.from('journal_entries')
          .select('id, description, reference_id')
          .eq('company_id', companyId).eq('reference_type', 'shipment')
          .eq('is_void', false);
        for (const sje of (shipJes || []) as any[]) {
          // Check if the parent sale is cancelled
          const { data: parentSale } = await supabase.from('sales').select('status')
            .eq('id', sje.reference_id).maybeSingle();
          if (parentSale && parentSale.status === 'cancelled') {
            // Check if shipping JE has lines on this contact's sub-ledger
            const { data: shipLines } = await supabase.from('journal_entry_lines')
              .select('debit').eq('journal_entry_id', sje.id).eq('account_id', sub.id);
            const shipAmt = (shipLines || []).reduce((s: number, l: any) => s + (Number(l.debit) || 0), 0);
            if (shipAmt > 0) {
              issueType = 'orphan_shipping';
              description = `Shipping JE (${shipAmt.toLocaleString()}) not voided after sale cancelled`;
              fixable = true;
              fixDescription = `Void orphan shipping JE`;
              fixData = { jeId: sje.id, amount: shipAmt };
              break;
            }
          }
        }
      }

      issues.push({
        contactId: c.id,
        contactName: c.name,
        contactType: c.type,
        subLedgerCode: sub.code,
        subLedgerAccountId: sub.id,
        glBalance: glBal,
        operationalBalance: operational,
        difference: diff,
        issueType,
        description,
        fixable,
        fixDescription,
        fixData,
      });
    }

    return issues;
  },

  /**
   * Fix a contact balance issue.
   */
  async fixContactIssue(issue: ContactBalanceIssue, companyId: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (issue.issueType === 'purchase_return_not_in_due' && issue.fixData) {
        const { purchaseId, correctDue } = issue.fixData as { purchaseId: string; correctDue: number };
        const { error } = await supabase.from('purchases')
          .update({ due_amount: correctDue })
          .eq('id', purchaseId);
        if (error) return { success: false, error: error.message };
        return { success: true };
      }
      if (issue.issueType === 'cancelled_sale_residual') {
        // GL is correct — this is an operational calc limitation, not a data issue.
        // No DB change needed. The fix is acknowledging GL as truth.
        return { success: true };
      }
      if (issue.issueType === 'orphan_shipping' && issue.fixData) {
        const { jeId } = issue.fixData as { jeId: string };
        const { error } = await supabase.from('journal_entries')
          .update({ is_void: true, void_reason: '[AUTO-FIX] Shipping JE orphaned after sale cancelled', voided_at: new Date().toISOString() })
          .eq('id', jeId);
        if (error) return { success: false, error: error.message };
        return { success: true };
      }
      if (issue.issueType === 'missing_opening_je' && issue.fixData) {
        // Create opening balance JE
        const { contactId, amount, equityAccountId } = issue.fixData as { contactId: string; amount: number; equityAccountId: string };
        const { data: newJe, error: jeErr } = await supabase.from('journal_entries').insert({
          company_id: companyId,
          entry_no: 'JE-AUTO-OPEN-' + Date.now(),
          entry_date: new Date().toISOString().split('T')[0],
          description: `[AUTO-FIX] Opening balance for ${issue.contactName}`,
          reference_type: 'opening_balance_contact_ar',
          reference_id: contactId,
        }).select('id').single();
        if (jeErr) return { success: false, error: jeErr.message };
        const { error: lineErr } = await supabase.from('journal_entry_lines').insert([
          { journal_entry_id: newJe.id, account_id: issue.subLedgerAccountId, debit: amount, credit: 0, description: `Opening balance ${issue.contactName}` },
          { journal_entry_id: newJe.id, account_id: equityAccountId, debit: 0, credit: amount, description: `Opening balance equity ${issue.contactName}` },
        ]);
        if (lineErr) return { success: false, error: lineErr.message };
        return { success: true };
      }
      return { success: false, error: 'No auto-fix available for this issue type' };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Unknown error' };
    }
  },
};
