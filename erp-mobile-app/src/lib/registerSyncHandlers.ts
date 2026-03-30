/**
 * Registers sync handlers for offline records.
 * When online, runSync() pushes pending records to Supabase via these handlers.
 */
import { registerSyncHandler } from './syncEngine';
import * as salesApi from '../api/sales';
import * as expensesApi from '../api/expenses';
import * as accountsApi from '../api/accounts';

export function registerAllSyncHandlers(): void {
  registerSyncHandler('sale', async (record) => {
    const p = record.payload as {
      companyId: string;
      branchId: string;
      customerId?: string | null;
      customerName: string;
      contactNumber?: string;
      items: Array<{
        productId: string;
        variationId?: string;
        productName: string;
        sku: string;
        quantity: number;
        unitPrice: number;
        discountAmount?: number;
        taxAmount?: number;
        total: number;
        packingDetails?: { total_boxes?: number; total_pieces?: number };
      }>;
      subtotal: number;
      discountAmount: number;
      taxAmount: number;
      expenses: number;
      total: number;
      paymentMethod: string;
      paidAmount?: number;
      dueAmount?: number;
      paymentAccountId?: string | null;
      notes?: string;
      isStudio: boolean;
      userId: string;
      orderDate?: string;
      deadline?: string;
    };
    const { data, error } = await salesApi.createSale({
      companyId: p.companyId,
      branchId: p.branchId,
      customerId: p.customerId ?? null,
      customerName: p.customerName || 'Walk-in',
      contactNumber: p.contactNumber,
      items: p.items,
      subtotal: p.subtotal,
      discountAmount: p.discountAmount ?? 0,
      taxAmount: p.taxAmount ?? 0,
      expenses: p.expenses ?? 0,
      total: p.total,
      paymentMethod: p.paymentMethod || 'Cash',
      paidAmount: p.paidAmount,
      dueAmount: p.dueAmount,
      paymentAccountId: p.paymentAccountId,
      notes: p.notes,
      isStudio: !!p.isStudio,
      userId: p.userId,
      orderDate: p.orderDate,
      deadline: p.deadline,
    });
    if (error) return { error };
    return { serverId: data!.id };
  });

  registerSyncHandler('expense', async (record) => {
    const p = record.payload as {
      companyId: string;
      branchId: string;
      category: string;
      description: string;
      amount: number;
      paymentMethod: string;
      userId: string;
      paymentAccountId?: string | null;
      receiptUrl?: string | null;
    };
    const { data, error } = await expensesApi.createExpense({
      companyId: p.companyId,
      branchId: p.branchId,
      category: p.category,
      description: p.description,
      amount: p.amount,
      paymentMethod: p.paymentMethod || 'cash',
      userId: p.userId,
      paymentAccountId: p.paymentAccountId,
      receiptUrl: p.receiptUrl,
    });
    if (error) return { error };
    return { serverId: data!.id };
  });

  registerSyncHandler('journal_entry', async (record) => {
    const p = record.payload as {
      companyId: string;
      branchId?: string | null;
      entryDate: string;
      description: string;
      referenceType: string;
      lines: Array<{ accountId: string; debit: number; credit: number; description?: string }>;
      userId?: string | null;
    };
    const { data, error } = await accountsApi.createJournalEntry({
      companyId: p.companyId,
      branchId: p.branchId,
      entryDate: p.entryDate,
      description: p.description,
      referenceType: p.referenceType,
      lines: p.lines,
      userId: p.userId,
    });
    if (error) return { error };
    return { serverId: data!.id };
  });

  registerSyncHandler('payment', async (record) => {
    const p = record.payload as {
      type: 'supplier' | 'worker';
      companyId: string;
      branchId?: string | null;
      purchaseId?: string;
      workerId?: string;
      workerName?: string;
      amount: number;
      paymentDate: string;
      paymentAccountId?: string;
      paymentMethod: string;
      userId?: string;
      notes?: string;
      paymentReference?: string;
      stageId?: string | null;
    };
    if (p.type === 'supplier' && p.purchaseId && p.paymentAccountId && p.branchId) {
      const { data, error } = await accountsApi.recordSupplierPayment({
        companyId: p.companyId,
        branchId: p.branchId,
        purchaseId: p.purchaseId,
        amount: p.amount,
        paymentDate: p.paymentDate,
        paymentAccountId: p.paymentAccountId,
        paymentMethod: (p.paymentMethod || 'cash') as 'cash' | 'bank' | 'card' | 'other',
        userId: p.userId,
      });
      if (error) return { error };
      return { serverId: data!.payment_id };
    }
    if (p.type === 'worker' && p.workerId && p.paymentAccountId) {
      const { data, error } = await accountsApi.recordWorkerPayment({
        companyId: p.companyId,
        branchId: p.branchId ?? null,
        workerId: p.workerId,
        workerName: p.workerName,
        amount: p.amount,
        paymentDate: p.paymentDate,
        paymentAccountId: p.paymentAccountId,
        paymentMethod: p.paymentMethod || 'cash',
        userId: p.userId ?? null,
        notes: p.notes,
        paymentReference: p.paymentReference,
        stageId: p.stageId ?? null,
      });
      if (error) return { error };
      return { serverId: data!.id };
    }
    return { error: 'Invalid payment payload' };
  });
}
