/**
 * Rental Service – Full ERP standard (Sale/Purchase level)
 * Status flow: draft → rented → returned | overdue | cancelled
 * Inventory: stock_movements rental_out (finalize), rental_in (receiveReturn)
 * Payments: rental_payments table; rentals.paid_amount/due_amount updated
 */

import { supabase } from '@/lib/supabase';
import { activityLogService } from '@/app/services/activityLogService';
import { settingsService } from '@/app/services/settingsService';
import { checkRentalAvailabilityForItems } from '@/app/services/rentalAvailabilityService';
import { syncJournalEntryDateByDocumentRefs } from '@/app/services/journalTransactionDateSyncService';
import { formatRentalPaymentRef, isRcvReference } from '@/app/lib/rentalPaymentRef';
import { isLiquidityPaymentAccount } from '@/app/lib/liquidityPaymentAccount';
import { voidJournalEntries } from '@/app/services/accountingIntegrityService';
import { voidPaymentAfterJournalReversal } from '@/app/services/paymentLifecycleService';

/** Next customer receipt number (RCV-*) for a rental payment — same sequence as sale receipts. */
async function nextRentalCustomerReceiptRef(
  companyId: string,
  rentalId: string,
  branchId?: string | null
): Promise<string> {
  let docBranch = branchId ?? null;
  if (!docBranch && rentalId) {
    const { data: rental } = await supabase.from('rentals').select('branch_id').eq('id', rentalId).maybeSingle();
    docBranch = (rental as { branch_id?: string | null } | null)?.branch_id ?? null;
  }
  try {
    const { documentNumberService } = await import('@/app/services/documentNumberService');
    return await documentNumberService.getNextDocumentNumber(companyId, docBranch, 'customer_receipt');
  } catch {
    const { generatePaymentReference } = await import('@/app/utils/paymentUtils');
    return generatePaymentReference(null);
  }
}

/** RPC requires a real branch UUID; map sentinel "default" to first company branch. */
async function resolveBranchIdForRental(companyId: string, branchId: string): Promise<string> {
  if (branchId && branchId !== 'default') return branchId;
  const { data } = await supabase.from('branches').select('id').eq('company_id', companyId).limit(1).maybeSingle();
  const first = data?.id;
  if (!first) throw new Error('No branch set up. Add a branch in Settings to create rentals.');
  return first;
}

export type RentalStatus = 'draft' | 'booked' | 'active' | 'rented' | 'picked_up' | 'returned' | 'overdue' | 'cancelled';

export interface Rental {
  id?: string;
  company_id: string;
  branch_id: string;
  rental_no?: string;
  customer_id: string | null;
  customer_name: string;
  start_date: string;
  expected_return_date: string;
  actual_return_date?: string | null;
  status: RentalStatus;
  total_amount: number;
  paid_amount: number;
  due_amount: number;
  notes?: string | null;
  created_by: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface RentalItem {
  id?: string;
  rental_id?: string;
  product_id: string;
  product_name?: string;
  sku?: string;
  quantity: number;
  unit?: string;
  boxes?: number | null;
  pieces?: number | null;
  packing_details?: Record<string, unknown> | null;
  rate: number;
  total: number;
  notes?: string | null;
}

export interface RentalPayment {
  id?: string;
  rental_id: string;
  amount: number;
  method: string;
  reference?: string | null;
  payment_date?: string;
  created_by?: string | null;
  created_at?: string;
  journal_entry_id?: string | null;
  voided_at?: string | null;
  payment_account_id?: string | null;
  /** advance | remaining | penalty — when present */
  payment_type?: string | null;
}

function normalizePaymentMethod(method: string): string {
  const m = method.toLowerCase().trim();
  const map: Record<string, string> = {
    cash: 'cash', bank: 'bank', card: 'card',
    cheque: 'other', 'mobile wallet': 'other', wallet: 'other',
  };
  return map[m] || 'cash';
}

function rentalPaymentCountsTowardInvoicePaid(paymentType: string | null | undefined): boolean {
  return String(paymentType || '').toLowerCase() !== 'penalty';
}

/** Sum non-voided rental_payments (excluding penalty/damage lines) and update rentals.paid_amount / due_amount */
async function recomputeRentalPaidDueFromActivePayments(rentalId: string): Promise<void> {
  const { data: active, error } = await supabase
    .from('rental_payments')
    .select('amount, payment_type')
    .eq('rental_id', rentalId)
    .is('voided_at', null);
  if (error) {
    const { data: fallback } = await supabase.from('rental_payments').select('amount, payment_type').eq('rental_id', rentalId);
    if (!fallback) return;
    const sum = (fallback as { amount?: number; payment_type?: string | null }[])
      .filter((r) => rentalPaymentCountsTowardInvoicePaid(r.payment_type))
      .reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const { data: r } = await supabase.from('rentals').select('total_amount').eq('id', rentalId).maybeSingle();
    const total = Number((r as { total_amount?: number })?.total_amount ?? 0) || 0;
    const newDue = Math.max(0, total - sum);
    try {
      await supabase.from('rentals').update({ paid_amount: sum, due_amount: newDue }).eq('id', rentalId);
    } catch {
      return;
    }
    return;
  }
  const sum = (active || [])
    .filter((r: { payment_type?: string | null }) => rentalPaymentCountsTowardInvoicePaid(r.payment_type))
    .reduce((s, r: { amount?: number }) => s + (Number(r.amount) || 0), 0);
  const { data: r } = await supabase.from('rentals').select('total_amount').eq('id', rentalId).maybeSingle();
  const total = Number((r as { total_amount?: number })?.total_amount ?? 0) || 0;
  const newDue = Math.max(0, total - sum);
  const { error: uErr } = await supabase.from('rentals').update({ paid_amount: sum, due_amount: newDue }).eq('id', rentalId);
  if (uErr && (String(uErr.message || '').includes('due_amount') || String(uErr.code || '') === 'PGRST204')) {
    await supabase.from('rentals').update({ paid_amount: sum }).eq('id', rentalId);
  }
}

export const rentalService = {
  async createRental(
    companyId: string,
    createdBy: string | null,
    rental: Omit<Rental, 'id' | 'rental_no' | 'created_at' | 'updated_at'>,
    items: RentalItem[]
  ): Promise<Rental & { id: string }> {
    if (!rental.branch_id) throw new Error('Branch is required');
    if (!items?.length) throw new Error('At least one item is required');
    if (new Date(rental.expected_return_date) < new Date(rental.start_date)) {
      throw new Error('Expected return date must be on or after start date');
    }

    const total_amount = items.reduce((sum, i) => sum + (i.total || 0), 0);
    const due_amount = total_amount - (rental.paid_amount || 0);

    const { data: rentalData, error: rentalError } = await supabase
      .from('rentals')
      .insert({
        company_id: companyId,
        branch_id: rental.branch_id,
        rental_no: undefined,
        customer_id: rental.customer_id || null,
        customer_name: rental.customer_name,
        start_date: rental.start_date,
        expected_return_date: rental.expected_return_date,
        status: 'draft',
        total_amount,
        paid_amount: rental.paid_amount ?? 0,
        due_amount,
        notes: rental.notes || null,
        created_by: createdBy || null,
      })
      .select('*')
      .single();

    if (rentalError) throw rentalError;

    const itemsWithRentalId = items.map((item) => ({
      rental_id: rentalData.id,
      product_id: item.product_id,
      product_name: item.product_name || null,
      quantity: item.quantity,
      unit: item.unit || 'piece',
      boxes: item.boxes ?? null,
      pieces: item.pieces ?? null,
      packing_details: item.packing_details ?? null,
      rate: item.rate,
      total: item.total,
      notes: item.notes || null,
    }));

    const { error: itemsError } = await supabase.from('rental_items').insert(itemsWithRentalId);

    if (itemsError) {
      await supabase.from('rentals').delete().eq('id', rentalData.id);
      throw itemsError;
    }

    await activityLogService.logActivity({
      companyId,
      module: 'rental',
      entityId: rentalData.id,
      entityReference: rentalData.rental_no,
      action: 'rental_created',
      newValue: { status: 'draft', total_amount, itemsCount: items.length },
      performedBy: createdBy || undefined,
      description: `Rental ${rentalData.rental_no} created`,
    }).catch((e) => console.warn('[RENTAL SERVICE] Activity log failed:', e));

    return rentalData;
  },

  /**
   * Create rental booking – uses rentals table schema (booking_no, pickup_date, return_date, etc.)
   * For RentalBookingDrawer and booking flows.
   */
  async createBooking(params: {
    companyId: string;
    branchId: string;
    createdBy: string | null;
    customerId: string;
    customerName: string;
    bookingDate: string;
    pickupDate: string;
    returnDate: string;
    rentalCharges: number;
    securityDeposit?: number;
    paidAmount?: number;
    /** Cash/bank account for advance GL (defaults to 1000). */
    advancePaymentAccountId?: string | null;
    notes?: string | null;
    expenses?: Array<{ description: string; amount: number }>;
    salesmanId?: string | null;
    commissionAmount?: number;
    commissionPercent?: number | null;
    commissionEligibleAmount?: number | null;
    items: Array<{
      productId: string;
      productName: string;
      quantity: number;
      ratePerDay: number;
      durationDays: number;
      total: number;
      variationId?: string | null;
    }>;
    skipAvailabilityCheck?: boolean;
    /** Manual bill book ref → rentals.document_number (not booking_no). */
    documentNumber?: string | null;
  }): Promise<{ id: string; booking_no: string }> {
    const {
      companyId,
      branchId,
      createdBy,
      customerId,
      customerName,
      bookingDate,
      pickupDate,
      returnDate,
      rentalCharges,
      securityDeposit = 0,
      paidAmount: advanceAmount = 0,
      advancePaymentAccountId = null,
      notes = null,
      expenses = [],
      salesmanId = null,
      commissionAmount = 0,
      commissionPercent = null,
      commissionEligibleAmount = null,
      items,
      skipAvailabilityCheck = false,
      documentNumber = null,
    } = params;

    if (!items?.length) throw new Error('At least one item is required');
    if (!customerId) throw new Error('Customer is required');
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(customerId)) {
      throw new Error('Please select a valid customer from the list. Use "Quick Add" to create a new customer.');
    }
    const pickup = new Date(pickupDate);
    const ret = new Date(returnDate);
    if (ret < pickup) throw new Error('Return date must be on or after pickup date');

    const effectiveBranchId = await resolveBranchIdForRental(companyId, branchId);

    if (!skipAvailabilityCheck) {
      const availability = await checkRentalAvailabilityForItems({
        companyId,
        items: items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          variationId: i.variationId,
        })),
        startDate: pickupDate,
        endDate: returnDate,
        branchId: effectiveBranchId,
      });
      if (!availability.available) {
        throw new Error(availability.message || 'Selected dates conflict with an existing booking');
      }
    }

    const durationDays = Math.ceil((ret.getTime() - pickup.getTime()) / (1000 * 60 * 60 * 24)) || 1;
    const totalAmount = rentalCharges + securityDeposit;
    const defaultDevaluation = await settingsService.getDefaultDressDevaluation(companyId).catch(() => 5000);
    const normalizedExpenses =
      expenses && expenses.length > 0
        ? expenses
        : [{ description: 'Dress devaluation (wear)', amount: defaultDevaluation }];
    // Capture advance payment if provided (collected at booking time)
    const effectivePaid = Math.max(0, Number(advanceAmount) || 0);
    const dueAmount = Math.max(0, totalAmount - effectivePaid);

    const rentalPayload: Record<string, unknown> = {
      booking_date: bookingDate,
      customer_id: customerId,
      customer_name: customerName,
      status: 'booked',
      pickup_date: pickupDate,
      return_date: returnDate,
      duration_days: durationDays,
      rental_charges: rentalCharges,
      security_deposit: securityDeposit,
      total_amount: totalAmount,
      paid_amount: effectivePaid,
      due_amount: dueAmount,
      notes,
    };
    if (normalizedExpenses && normalizedExpenses.length > 0) {
      rentalPayload.rental_expenses = normalizedExpenses;
    }
    if (salesmanId) {
      rentalPayload.salesman_id = salesmanId;
      rentalPayload.commission_amount = commissionAmount || 0;
      rentalPayload.commission_percent = commissionPercent;
      rentalPayload.commission_eligible_amount = commissionEligibleAmount ?? rentalCharges;
      rentalPayload.commission_status = commissionAmount > 0 ? 'pending' : null;
    }

    const itemsJson = items.map((i) => ({
      product_id: i.productId,
      product_name: i.productName,
      quantity: i.quantity,
      rate_per_day: i.ratePerDay,
      duration_days: i.durationDays,
      total: i.total,
    }));

    console.log('[rentalService] createBooking commission data:', { salesmanId, commissionAmount, commissionPercent, commissionEligibleAmount });

    let rpcBody = rentalPayload;
    const tryRpc = async (payload: Record<string, unknown>) =>
      supabase.rpc('create_rental_booking', {
        p_company_id: companyId,
        p_branch_id: effectiveBranchId,
        p_rental: payload,
        p_items: itemsJson,
        p_created_by: createdBy,
      });

    let { data: rpcRaw, error: rpcErr } = await tryRpc(rpcBody);
    if (rpcErr) {
      const msg = String(rpcErr.message || '');
      if (msg.includes('rental_expenses') || msg.includes('commission') || msg.includes('salesman_id')) {
        console.warn('[rentalService] Retrying create_rental_booking without commission/expense columns');
        const fallback = { ...rentalPayload };
        delete fallback.rental_expenses;
        delete fallback.salesman_id;
        delete fallback.commission_percent;
        delete fallback.commission_amount;
        delete fallback.commission_eligible_amount;
        delete fallback.commission_status;
        rpcBody = fallback;
        const retry = await tryRpc(fallback);
        rpcRaw = retry.data;
        rpcErr = retry.error;
      }
    }
    if (rpcErr) throw rpcErr;

    const rpc = rpcRaw as { success?: boolean; rental_id?: string; booking_no?: string; error?: string } | null;
    if (!rpc?.success || !rpc.rental_id) {
      throw new Error(rpc?.error || 'Rental create failed.');
    }

    const rentalData = { id: rpc.rental_id, booking_no: rpc.booking_no ?? '' };
    const bookingNo = rentalData.booking_no;

    const docNumTrim = documentNumber != null ? String(documentNumber).trim() : '';
    if (docNumTrim) {
      const { error: docPatchErr } = await supabase
        .from('rentals')
        .update({ document_number: docNumTrim })
        .eq('id', rentalData.id);
      if (docPatchErr) {
        console.warn('[rentalService] Failed to patch manual bill ref:', docPatchErr.message);
      }
    }

    // Party AR GL (named customer): revenue (when charges > 0) + optional advance cash receipt
    if (customerId) {
      try {
        const {
          postRentalPartyRevenueIfNeeded,
          postRentalPartyDiscountIfNeeded,
          postRentalPartyCashReceipt,
          fetchRentalArAmounts,
        } = await import('./rentalPartyArAccounting');
        const { accountHelperService } = await import('./accountHelperService');
        if (rentalCharges > 0) {
          await postRentalPartyRevenueIfNeeded({
            companyId,
            branchId: effectiveBranchId,
            rentalId: rentalData.id,
            customerId,
            customerName,
            rentalCharges,
            entryDate: bookingDate,
            createdBy: createdBy || null,
          });
          const am = await fetchRentalArAmounts(rentalData.id);
          if (am && am.discountAmount > 0) {
            await postRentalPartyDiscountIfNeeded({
              companyId,
              branchId: effectiveBranchId,
              rentalId: rentalData.id,
              customerId,
              customerName,
              discountAmount: am.discountAmount,
              entryDate: bookingDate,
              createdBy: createdBy || null,
            });
          }
        }
        if (effectivePaid > 0) {
          const payIns = await supabase
            .from('rental_payments')
            .insert({
              rental_id: rentalData.id,
              amount: effectivePaid,
              method: 'cash',
              reference: await nextRentalCustomerReceiptRef(companyId, rentalData.id, effectiveBranchId),
              payment_date: bookingDate,
              created_by: createdBy || null,
              ...(advancePaymentAccountId ? { payment_account_id: advancePaymentAccountId } : {}),
            })
            .select('id')
            .single();
          const payId = (payIns.data as { id?: string } | null)?.id;
          const cashId =
            advancePaymentAccountId ||
            (await accountHelperService.getAccountByCode('1000', companyId))?.id ||
            null;
          if (payId && cashId) {
            const { journalEntryId } = await postRentalPartyCashReceipt({
              companyId,
              branchId: effectiveBranchId,
              rentalId: rentalData.id,
              rentalPaymentId: payId,
              customerId,
              customerName,
              amount: effectivePaid,
              paymentAccountId: cashId,
              rentalCharges,
              securityDeposit,
              entryDate: bookingDate,
              createdBy: createdBy || null,
              description: `Rental booking advance — ${bookingNo}`,
            });
            if (journalEntryId) {
              await rentalService.linkJournalEntryToRentalPayment(payId, journalEntryId);
            }
          }
        }
      } catch (rentalGlErr) {
        console.warn('[rentalService] createBooking party AR GL failed:', rentalGlErr);
      }
    } else if (effectivePaid > 0) {
      await supabase.from('rental_payments').insert({
        rental_id: rentalData.id,
        amount: effectivePaid,
        method: 'cash',
        reference: await nextRentalCustomerReceiptRef(companyId, rentalData.id, effectiveBranchId),
        payment_date: bookingDate,
        created_by: createdBy || null,
      });
    }

    // Dress devaluation (wear): Dr Rental Income (4200) / Cr expense (5300/6100) via RPC for named customers.
    if (normalizedExpenses && normalizedExpenses.length > 0) {
      const totalExpense = normalizedExpenses.reduce((sum: number, e: { amount: number }) => sum + (Number(e.amount) || 0), 0);
      if (totalExpense > 0) {
        try {
          const { postRentalPartyDevaluationIfNeeded } = await import('./rentalPartyArAccounting');
          const res = await postRentalPartyDevaluationIfNeeded({
            companyId,
            branchId: effectiveBranchId,
            rentalId: rentalData.id,
            customerId,
            customerName,
            amount: totalExpense,
            expenses: normalizedExpenses as { description: string; amount: number }[],
            bookingNo,
            entryDate: bookingDate,
            createdBy: createdBy || null,
          });
          if (!res.skipped && !res.journalEntryId && res.reason && res.reason !== 'rpc_error') {
            console.warn('[rentalService] Rental devaluation JE failed:', res.reason);
          }
        } catch (expErr) {
          console.warn('[rentalService] Rental devaluation / expense JE failed:', expErr);
        }
      }
    }

    await activityLogService
      .logActivity({
        companyId,
        module: 'rental',
        entityId: rentalData.id,
        entityReference: bookingNo,
        action: 'rental_created',
        newValue: { status: 'booked', totalAmount, advancePaid: effectivePaid, itemsCount: items.length },
        performedBy: createdBy || undefined,
        description: `Rental booking ${bookingNo} created${effectivePaid > 0 ? ` (Advance: Rs ${effectivePaid.toLocaleString()})` : ''}`,
      })
      .catch((e) => console.warn('[RENTAL SERVICE] Activity log failed:', e));

    return { id: rentalData.id, booking_no: rentalData.booking_no };
  },

  /**
   * Update rental booking – for booking schema (pickup_date, return_date, etc.)
   */
  async updateBooking(
    id: string,
    companyId: string,
    updates: {
      customerId?: string;
      customerName?: string;
      pickupDate?: string;
      returnDate?: string;
      rentalCharges?: number;
      securityDeposit?: number;
      paidAmount?: number;
      notes?: string | null;
      documentNumber?: string | null;
      salesmanId?: string | null;
      items?: Array<{
        productId: string;
        productName: string;
        quantity: number;
        ratePerDay: number;
        durationDays: number;
        total: number;
      }>;
    }
  ): Promise<void> {
    const { data: existing, error: fetchErr } = await supabase
      .from('rentals')
      .select('id, status, booking_no, pickup_date, return_date, branch_id')
      .eq('id', id)
      .single();

    if (fetchErr || !existing) throw new Error('Rental not found');
    const r = existing as any;
    if (r.status !== 'draft' && r.status !== 'booked') {
      throw new Error('Only draft or booked rentals can be edited');
    }

    const pickupDate = updates.pickupDate ?? r.pickup_date;
    const returnDate = updates.returnDate ?? r.return_date;
    const items = updates.items && updates.items.length > 0
      ? updates.items
      : await (async () => {
          const { data: ri } = await supabase.from('rental_items').select('product_id, product_name, quantity, rate_per_day, duration_days, total').eq('rental_id', id);
          return (ri || []).map((i: any) => ({
            productId: i.product_id,
            productName: i.product_name,
            quantity: i.quantity,
            ratePerDay: i.rate_per_day,
            durationDays: i.duration_days,
            total: i.total,
          }));
        })();

    const availability = await checkRentalAvailabilityForItems({
      companyId,
      items: items.map((i: { productId: string; quantity?: number; variationId?: string | null }) => ({
        productId: i.productId,
        quantity: i.quantity,
        variationId: i.variationId,
      })),
      startDate: pickupDate,
      endDate: returnDate,
      excludeRentalId: id,
      branchId: r.branch_id,
    });
    if (!availability.available) {
      throw new Error(availability.message || 'Selected dates conflict with an existing booking');
    }

    const payload: Record<string, unknown> = {};
    if (updates.customerId !== undefined) payload.customer_id = updates.customerId;
    if (updates.customerName !== undefined) payload.customer_name = updates.customerName;
    if (updates.pickupDate !== undefined) payload.pickup_date = updates.pickupDate;
    if (updates.returnDate !== undefined) payload.return_date = updates.returnDate;
    if (updates.rentalCharges !== undefined) payload.rental_charges = updates.rentalCharges;
    if (updates.securityDeposit !== undefined) payload.security_deposit = updates.securityDeposit;
    if (updates.paidAmount !== undefined) payload.paid_amount = updates.paidAmount;
    if (updates.notes !== undefined) payload.notes = updates.notes;
    if (updates.documentNumber !== undefined) {
      const v = updates.documentNumber != null ? String(updates.documentNumber).trim() : '';
      payload.document_number = v || null;
    }
    if (updates.salesmanId !== undefined) payload.salesman_id = updates.salesmanId || null;

    if (updates.items && updates.items.length > 0) {
      const rentalCharges = updates.items.reduce((s, i) => s + i.total, 0);
      const durationDays = updates.items[0]?.durationDays ?? 1;
      payload.rental_charges = rentalCharges;
      payload.duration_days = durationDays;
      payload.total_amount = rentalCharges + (updates.securityDeposit ?? 0);
      const paid = updates.paidAmount ?? (r.paid_amount ?? 0);
      payload.due_amount = Math.max(0, (rentalCharges + (updates.securityDeposit ?? 0)) - paid);

      await supabase.from('rental_items').delete().eq('rental_id', id);
      await supabase.from('rental_items').insert(
        updates.items.map((i) => ({
          rental_id: id,
          product_id: i.productId,
          product_name: i.productName,
          quantity: i.quantity,
          rate_per_day: i.ratePerDay,
          duration_days: i.durationDays,
          total: i.total,
        }))
      );
    } else if (updates.rentalCharges !== undefined || updates.securityDeposit !== undefined) {
      const { data: curr } = await supabase.from('rentals').select('rental_charges, security_deposit, paid_amount').eq('id', id).single();
      const cr = curr as any;
      const total = (updates.rentalCharges ?? cr.rental_charges ?? 0) + (updates.securityDeposit ?? cr.security_deposit ?? 0);
      const paid = updates.paidAmount ?? cr.paid_amount ?? 0;
      payload.total_amount = total;
      payload.due_amount = Math.max(0, total - paid);
    }

    if (Object.keys(payload).length > 0) {
      const { error: updateErr } = await supabase.from('rentals').update(payload).eq('id', id);
      if (updateErr) throw updateErr;
    }

    await activityLogService
      .logActivity({
        companyId,
        module: 'rental',
        entityId: id,
        entityReference: r.booking_no || r.rental_no,
        action: 'rental_edited',
        newValue: updates,
        performedBy: undefined,
        description: `Rental ${r.booking_no || r.rental_no} updated`,
      })
      .catch((e) => console.warn('[RENTAL SERVICE] Activity log failed:', e));
  },

  /** Patch manual bill ref / notes on draft or booked rentals only. */
  async updateRentalMeta(
    rentalId: string,
    patch: { documentNumber?: string | null; notes?: string | null }
  ): Promise<void> {
    const { data: row, error: fetchErr } = await supabase
      .from('rentals')
      .select('status')
      .eq('id', rentalId)
      .maybeSingle();
    if (fetchErr || !row) throw new Error(fetchErr?.message ?? 'Rental not found');
    const st = String((row as { status?: string }).status ?? '').toLowerCase();
    if (!['draft', 'booked'].includes(st)) {
      throw new Error('Bill ref and notes can only be edited on draft or booked rentals.');
    }
    const upd: Record<string, unknown> = {};
    if (patch.documentNumber !== undefined) {
      const v = patch.documentNumber != null ? String(patch.documentNumber).trim() : '';
      upd.document_number = v || null;
    }
    if (patch.notes !== undefined) upd.notes = patch.notes;
    if (Object.keys(upd).length === 0) return;
    const { error } = await supabase.from('rentals').update(upd).eq('id', rentalId);
    if (error) throw error;
  },

  async updateRental(
    id: string,
    companyId: string,
    updates: Partial<Pick<Rental, 'customer_id' | 'customer_name' | 'start_date' | 'expected_return_date' | 'notes'>>,
    items: RentalItem[] | null
  ): Promise<void> {
    const { data: existing, error: fetchErr } = await supabase
      .from('rentals')
      .select('status, booking_no')
      .eq('id', id)
      .single();

    if (fetchErr || !existing) throw new Error('Rental not found');
    if ((existing as any).status !== 'draft') {
      throw new Error('Only draft rentals can be edited');
    }

    let total_amount: number | undefined;
    if (items && items.length > 0) {
      total_amount = items.reduce((sum, i) => sum + (i.total || 0), 0);
      await supabase.from('rental_items').delete().eq('rental_id', id);
      await supabase.from('rental_items').insert(
        items.map((item) => ({
          rental_id: id,
          product_id: item.product_id,
          product_name: item.product_name || null,
          quantity: item.quantity,
          unit: item.unit || 'piece',
          boxes: item.boxes ?? null,
          pieces: item.pieces ?? null,
          packing_details: item.packing_details ?? null,
          rate: item.rate,
          total: item.total,
          notes: item.notes || null,
        }))
      );
    }

    const payload: Record<string, unknown> = { ...updates };
    if (total_amount !== undefined) {
      const { data: r } = await supabase.from('rentals').select('paid_amount').eq('id', id).single();
      const paid = (r as any)?.paid_amount ?? 0;
      payload.total_amount = total_amount;
      payload.due_amount = total_amount - paid;
    }

    const { error: updateErr } = await supabase.from('rentals').update(payload).eq('id', id);
    if (updateErr) throw updateErr;

    await activityLogService.logActivity({
      companyId,
      module: 'rental',
      entityId: id,
      entityReference: (existing as any).rental_no,
      action: 'rental_edited',
      newValue: updates,
      description: `Rental ${(existing as any).rental_no} updated`,
    }).catch((e) => console.warn('[RENTAL SERVICE] Activity log failed:', e));
  },

  async finalizeRental(id: string, companyId: string, performedBy?: string | null): Promise<void> {
    const { data: rental, error: fetchErr } = await supabase
      .from('rentals')
      .select('id, status, branch_id, booking_no')
      .eq('id', id)
      .single();

    if (fetchErr || !rental) throw new Error('Rental not found');
    const r = rental as any;
    if (r.status !== 'draft' && r.status !== 'booked') throw new Error('Only draft or booked rentals can be finalized');

    const { data: items, error: itemsErr } = await supabase
      .from('rental_items')
      .select('id, product_id, quantity')
      .eq('rental_id', id);

    if (itemsErr) throw itemsErr;
    const itemList = (items || []) as any[];

    for (const item of itemList) {
      const qty = -Number(item.quantity);
      const { error: movErr } = await supabase.from('stock_movements').insert({
        company_id: companyId,
        branch_id: r.branch_id,
        product_id: item.product_id,
        movement_type: 'rental_out',
        quantity: qty,
        unit_cost: 0,
        total_cost: 0,
        reference_type: 'rental',
        reference_id: id,
        created_by: performedBy || null,
      });
      if (movErr) throw movErr;
    }

    // DB enum: 'booked' | 'active' | 'returned' | 'overdue' | 'cancelled'
    const { error: updateErr } = await supabase
      .from('rentals')
      .update({ status: 'active' })
      .eq('id', id);

    if (updateErr) throw updateErr;

    await activityLogService.logActivity({
      companyId,
      module: 'rental',
      entityId: id,
      entityReference: r.rental_no || r.booking_no,
      action: 'rental_finalized',
      oldValue: { status: 'draft' },
      newValue: { status: 'rented' },
      performedBy: performedBy || undefined,
      description: `Rental ${r.rental_no} finalized – stock out`,
    }).catch((e) => console.warn('[RENTAL SERVICE] Activity log failed:', e));
  },

  /**
   * Mark rental as picked up – for booked status only. Sets status=picked_up, document details, stock movement.
   */
  async markAsPickedUp(
    id: string,
    companyId: string,
    params: {
      actualPickupDate: string;
      notes?: string;
      documentType: string;
      documentNumber: string;
      documentExpiry?: string;
      documentReceived: boolean;
      remainingPaymentConfirmed: boolean;
      deliverOnCredit?: boolean;
      documentFrontImage?: string;
      documentBackImage?: string;
      customerPhoto?: string;
    },
    performedBy?: string | null
  ): Promise<void> {
    const { actualPickupDate, notes, documentType, documentNumber, documentExpiry, documentReceived, remainingPaymentConfirmed, deliverOnCredit, documentFrontImage, documentBackImage, customerPhoto } = params;
    const { data: rental, error: fetchErr } = await supabase
      .from('rentals')
      .select('id, status, branch_id, booking_no, pickup_date, total_amount, paid_amount, due_amount, customer_id, customer_name')
      .eq('id', id)
      .single();

    if (fetchErr || !rental) throw new Error('Rental not found');
    const r = rental as any;
    if (r.status !== 'booked') {
      throw new Error('Only booked rentals can be marked as picked up');
    }

    const remaining = (Number(r.total_amount) || 0) - (Number(r.paid_amount) || 0);
    if (!deliverOnCredit && (!remainingPaymentConfirmed || remaining > 0)) {
      throw new Error('Full payment required before delivery');
    }

    const pickupDate = r.pickup_date || '';
    if (actualPickupDate < pickupDate) {
      throw new Error('Pickup date cannot be before the booking start date');
    }

    // Document expiry validation
    if (documentExpiry) {
      const expDate = new Date(documentExpiry);
      const pickDate = new Date(actualPickupDate);
      if (expDate < pickDate) {
        throw new Error('Document has expired. Please provide a valid document.');
      }
    }

    const { data: items, error: itemsErr } = await supabase
      .from('rental_items')
      .select('id, product_id, quantity')
      .eq('rental_id', id);

    if (itemsErr) throw itemsErr;
    const itemList = (items || []) as any[];

    // Stock sufficiency check before rental_out
    for (const item of itemList) {
      const { data: stockRows } = await supabase
        .from('stock_movements').select('quantity')
        .eq('company_id', companyId).eq('product_id', item.product_id);
      const currentStock = (stockRows || []).reduce((s: number, m: any) => s + (Number(m.quantity) || 0), 0);
      if (currentStock < Number(item.quantity)) {
        throw new Error(`Insufficient stock: available ${currentStock}, required ${item.quantity}`);
      }
    }

    for (const item of itemList) {
      const qty = -Number(item.quantity);
      const { error: movErr } = await supabase.from('stock_movements').insert({
        company_id: companyId,
        branch_id: r.branch_id,
        product_id: item.product_id,
        movement_type: 'rental_out',
        quantity: qty,
        unit_cost: 0,
        total_cost: 0,
        reference_type: 'rental',
        reference_id: id,
        created_by: performedBy || null,
      });
      if (movErr) throw movErr;
    }

    const updatePayload: Record<string, unknown> = {
      status: 'active',
      actual_pickup_date: actualPickupDate,
      picked_up_by: performedBy || null,
      document_type: documentType,
      document_expiry: documentExpiry || null,
      document_received: documentReceived,
      remaining_payment_confirmed: remainingPaymentConfirmed,
      credit_flag: deliverOnCredit === true,
      notes: notes || r.notes || null,
      security_document_type: documentType,
      security_document_number: documentNumber?.trim() || null,
      security_status: 'collected',
    };
    if (documentFrontImage) {
      updatePayload.document_front_image = documentFrontImage;
      updatePayload.security_document_image_url = documentFrontImage;
    }
    if (documentBackImage) updatePayload.document_back_image = documentBackImage;
    if (customerPhoto) updatePayload.customer_photo = customerPhoto;

    const { error: updateErr } = await supabase
      .from('rentals')
      .update(updatePayload)
      .eq('id', id);

    if (updateErr) throw updateErr;

    await activityLogService.logActivity({
      companyId,
      module: 'rental',
      entityId: id,
      entityReference: r.booking_no,
      action: 'rental_picked_up',
      oldValue: { status: 'booked' },
      newValue: { status: 'picked_up', actual_pickup_date: actualPickupDate, document_received: documentReceived },
      performedBy: performedBy || undefined,
      description: `Rental picked up with document received`,
    }).catch((e) => console.warn('[RENTAL SERVICE] Activity log failed:', e));
  },

  /**
   * Auto-mark overdue: picked_up rentals where return_date < today → overdue
   */
  async markOverdueRentals(companyId: string): Promise<number> {
    const today = new Date().toISOString().slice(0, 10);
    const { data: rows, error } = await supabase
      .from('rentals')
      .select('id, booking_no')
      .eq('company_id', companyId)
      .in('status', ['active', 'picked_up'])
      .lt('return_date', today);

    if (error || !rows?.length) return 0;

    for (const r of rows) {
      await supabase.from('rentals').update({ status: 'overdue' }).eq('id', r.id);
      await activityLogService.logActivity({
        companyId,
        module: 'rental',
        entityId: r.id,
        entityReference: (r as { booking_no?: string }).booking_no,
        action: 'status_change',
        oldValue: { status: 'rented' },
        newValue: { status: 'overdue' },
        description: `Rental ${(r as { booking_no?: string }).booking_no || r.id} marked overdue`,
      }).catch((e) => console.warn('[RENTAL SERVICE] Activity log overdue failed:', e));
    }
    return rows.length;
  },

  async receiveReturn(
    id: string,
    companyId: string,
    params: {
      actualReturnDate: string;
      notes?: string;
      conditionType: string;
      damageNotes?: string;
      penaltyAmount: number;
      penaltyPaid: boolean;
      documentReturned: boolean;
      /** When true, penalty was already recorded via UnifiedPaymentDialog (rental_payments + JE); skip duplicate insert */
      penaltyPaymentPreRecorded?: boolean;
    },
    performedBy?: string | null
  ): Promise<void> {
    const { actualReturnDate, notes, conditionType, damageNotes, penaltyAmount, penaltyPaid, documentReturned, penaltyPaymentPreRecorded } = params;

    const { data: rental, error: fetchErr } = await supabase
      .from('rentals')
      .select('id, status, branch_id, booking_no, security_deposit')
      .eq('id', id)
      .single();

    if (fetchErr || !rental) throw new Error('Rental not found');
    const r = rental as any;
    const canReturn = ['rented', 'overdue', 'picked_up', 'active'].includes(r.status || '');
    if (!canReturn) {
      throw new Error('Only rented or overdue rentals can be returned');
    }

    // Validate penalty and document return
    // penaltyPaid=false means "credit" mode — penalty added to customer balance, not blocked
    if (!documentReturned) {
      throw new Error('Please confirm document returned to customer');
    }
    // Warn if penalty exceeds security deposit
    const secDep = Number(r.security_deposit ?? 0);
    if (penaltyAmount > secDep && penaltyAmount > 0) {
      console.warn(`[RENTAL] Penalty Rs ${penaltyAmount} exceeds security deposit Rs ${secDep}. Customer owes additional Rs ${penaltyAmount - secDep}`);
    }

    const { data: items, error: itemsErr } = await supabase
      .from('rental_items')
      .select('id, product_id, quantity')
      .eq('rental_id', id);

    if (itemsErr) throw itemsErr;
    const itemList = (items || []) as any[];

    for (const item of itemList) {
      const qty = Number(item.quantity);
      const { error: movErr } = await supabase.from('stock_movements').insert({
        company_id: companyId,
        branch_id: r.branch_id,
        product_id: item.product_id,
        movement_type: 'rental_in',
        quantity: qty,
        unit_cost: 0,
        total_cost: 0,
        reference_type: 'rental',
        reference_id: id,
        created_by: performedBy || null,
      });
      if (movErr) throw movErr;

      // Increment rental_count for depreciation tracking
      try {
        const { data: prod } = await supabase.from('products').select('rental_count').eq('id', item.product_id).maybeSingle();
        const currentCount = Number((prod as any)?.rental_count) || 0;
        await supabase.from('products').update({ rental_count: currentCount + 1 }).eq('id', item.product_id);
      } catch { /* rental_count column may not exist yet */ }
    }

    const securityDeposit = Number(r.security_deposit ?? 0);
    const refundAmount = Math.max(0, securityDeposit - penaltyAmount);

    const updatePayload: Record<string, unknown> = {
      status: 'returned',
      actual_return_date: actualReturnDate,
      returned_by: performedBy || null,
      condition_type: conditionType,
      damage_notes: damageNotes || null,
      damage_charges: penaltyAmount,
      penalty_paid: penaltyPaid,
      document_returned: documentReturned,
      refund_amount: refundAmount,
    };
    if (notes) updatePayload.notes = notes;

    const { error: updateErr } = await supabase
      .from('rentals')
      .update(updatePayload)
      .eq('id', id);

    if (updateErr) throw updateErr;

    // Record penalty payment in rental_payments when penalty paid (unless Unified dialog already did)
    if (penaltyAmount > 0 && penaltyPaid && !penaltyPaymentPreRecorded) {
      await supabase.from('rental_payments').insert({
        rental_id: id,
        amount: penaltyAmount,
        method: 'cash',
        reference: `Penalty - ${conditionType}${damageNotes ? `: ${damageNotes.substring(0, 50)}` : ''}`,
        payment_date: actualReturnDate,
        payment_type: 'penalty',
        created_by: performedBy || null,
      });
    }

    await activityLogService.logActivity({
      companyId,
      module: 'rental',
      entityId: id,
      entityReference: r.rental_no || r.booking_no,
      action: 'rental_returned',
      oldValue: { status: r.status },
      newValue: { status: 'returned', actual_return_date: actualReturnDate, document_returned: documentReturned },
      performedBy: performedBy || undefined,
      description: `Rental returned and document handed back`,
    }).catch((e) => console.warn('[RENTAL SERVICE] Activity log failed:', e));
  },

  async cancelRental(id: string, companyId: string, performedBy?: string | null): Promise<void> {
    const { data: rental, error: fetchErr } = await supabase
      .from('rentals')
      .select('id, status, booking_no')
      .eq('id', id)
      .single();

    if (fetchErr || !rental) throw new Error('Rental not found');
    const r = rental as any;
    if (!['draft', 'booked'].includes(r.status || '')) {
      throw new Error('Only draft or booked rentals can be cancelled');
    }

    const { error: updateErr } = await supabase.from('rentals').update({ status: 'cancelled' }).eq('id', id);
    if (updateErr) throw updateErr;

    await activityLogService.logActivity({
      companyId,
      module: 'rental',
      entityId: id,
      entityReference: r.rental_no || r.booking_no,
      action: 'rental_cancelled',
      oldValue: { status: 'draft' },
      newValue: { status: 'cancelled' },
      performedBy: performedBy || undefined,
      description: `Rental ${r.rental_no} cancelled`,
    }).catch((e) => console.warn('[RENTAL SERVICE] Activity log failed:', e));
  },

  async addPayment(
    rentalId: string,
    companyId: string,
    amount: number,
    method: string,
    reference?: string,
    performedBy?: string | null,
    options?: {
      paymentType?: 'advance' | 'remaining' | 'penalty';
      paymentDate?: string;
      paymentAccountId?: string;
      /** Shown on rental_payments.reference for penalty lines */
      penaltyReferenceNote?: string;
    }
  ): Promise<RentalPayment> {
    // Schema variants: some DBs have booking_no only (no rental_no); due_amount may be missing (derive from total − paid).
    const { data: rental, error: fetchErr } = await supabase
      .from('rentals')
      .select('id, status, paid_amount, total_amount, booking_no')
      .eq('id', rentalId)
      .maybeSingle();

    if (fetchErr || !rental) throw new Error(fetchErr?.message || 'Rental not found');
    const r = rental as any;
    // Allow payment: booked (at pickup), rented/overdue (active), picked_up/active (DB), returned (outstanding after return)
    const allowPayment = ['booked', 'rented', 'overdue', 'picked_up', 'active', 'returned', 'closed'].includes(r.status || '');
    if (!allowPayment) {
      throw new Error('Payment allowed only for booked, active/rented or overdue rentals');
    }

    const payType = options?.paymentType ?? 'remaining';
    const payDay = (options?.paymentDate || new Date().toISOString()).split('T')[0];
    const isPenalty = payType === 'penalty';
    const bookingNo = String(r.booking_no || '').trim();
    const receiptRef = isPenalty
      ? options?.penaltyReferenceNote || reference || 'Rental penalty / damage'
      : reference && isRcvReference(reference)
        ? String(reference).trim()
        : await nextRentalCustomerReceiptRef(companyId, rentalId);

    const insertPayload: Record<string, unknown> = {
      rental_id: rentalId,
      amount,
      method: normalizePaymentMethod(method),
      reference: receiptRef || null,
      payment_date: payDay,
      created_by: performedBy || null,
    };
    insertPayload.payment_type = payType;
    if (options?.paymentAccountId) {
      insertPayload.payment_account_id = options.paymentAccountId;
    }

    let { data: payment, error: payErr } = await supabase.from('rental_payments').insert(insertPayload).select('*').single();
    if (payErr && String(payErr.message || '').includes('payment_type')) {
      delete insertPayload.payment_type;
      const retry = await supabase.from('rental_payments').insert(insertPayload).select('*').single();
      payment = retry.data;
      payErr = retry.error;
    }
    if (
      payErr &&
      (String(payErr.message || '').toLowerCase().includes('payment_account') ||
        String(payErr.message || '').includes('payment_account_id'))
    ) {
      delete (insertPayload as any).payment_account_id;
      const retry2 = await supabase.from('rental_payments').insert(insertPayload).select('*').single();
      payment = retry2.data;
      payErr = retry2.error;
    }
    if (payErr) throw payErr;

    // Penalty / damage charges are not part of rental invoice paid_amount (avoids distorting due vs rental total)
    if (!isPenalty) {
      const newPaid = (r.paid_amount ?? 0) + amount;
      const totalAmt = Number(r.total_amount ?? 0);
      const newDue = Math.max(0, totalAmt - newPaid);

      const { error: updErr } = await supabase
        .from('rentals')
        .update({ paid_amount: newPaid, due_amount: newDue })
        .eq('id', rentalId);

      if (updErr && (String(updErr.message || '').includes('due_amount') || String(updErr.code || '') === 'PGRST204')) {
        await supabase.from('rentals').update({ paid_amount: newPaid }).eq('id', rentalId);
      } else if (updErr) {
        throw updErr;
      }
    }

    await activityLogService.logActivity({
      companyId,
      module: 'rental',
      entityId: rentalId,
      entityReference: r.rental_no || r.booking_no,
      action: 'payment_added',
      amount,
      paymentMethod: method,
      performedBy: performedBy || undefined,
      description: isPenalty
        ? `Penalty / damage ${amount} recorded for rental ${r.rental_no || r.booking_no || rentalId}`
        : `Payment ${amount} added to rental ${r.rental_no || r.booking_no || rentalId}`,
    }).catch((e) => console.warn('[RENTAL SERVICE] Activity log failed:', e));

    return payment as RentalPayment;
  },

  /** Cash/bank/wallet debit leg on a posted rental JE (for Roznamcha + payment_account_id backfill). */
  async resolveLiquidityAccountFromJournal(journalEntryId: string): Promise<string | null> {
    const { data: lines } = await supabase
      .from('journal_entry_lines')
      .select('account_id, debit, account:accounts(id, name, type, code)')
      .eq('journal_entry_id', journalEntryId);
    for (const line of lines || []) {
      const rawAcc = (line as any).account;
      const acc = Array.isArray(rawAcc) ? rawAcc[0] : rawAcc;
      if (!acc || !isLiquidityPaymentAccount(acc)) continue;
      const debit = Number((line as any).debit) || 0;
      if (debit <= 0) continue;
      return String((line as any).account_id || acc.id || '');
    }
    return null;
  },

  /** Link JE + backfill payment_account_id and canonical REN-*-PAY reference when missing. */
  async syncRentalPaymentGlLink(rentalPaymentId: string, journalEntryId: string): Promise<void> {
    const liquidityAccountId = await this.resolveLiquidityAccountFromJournal(journalEntryId);
    const { data: rp } = await supabase
      .from('rental_payments')
      .select('reference, rental_id, payment_account_id')
      .eq('id', rentalPaymentId)
      .maybeSingle();

    const storedRef = String((rp as { reference?: string } | null)?.reference || '').trim();
    const patch: Record<string, unknown> = { journal_entry_id: journalEntryId };
    if (liquidityAccountId && !(rp as { payment_account_id?: string } | null)?.payment_account_id) {
      patch.payment_account_id = liquidityAccountId;
    }
    // Assign RCV only when reference is missing — never overwrite stored RCV or legacy refs.
    if (!storedRef) {
      const rentalId = (rp as { rental_id?: string } | null)?.rental_id;
      if (rentalId) {
        const { data: rental } = await supabase.from('rentals').select('company_id, branch_id').eq('id', rentalId).maybeSingle();
        const cid = String((rental as { company_id?: string } | null)?.company_id || '').trim();
        if (cid) {
          patch.reference = await nextRentalCustomerReceiptRef(
            cid,
            rentalId,
            (rental as { branch_id?: string | null } | null)?.branch_id
          );
        }
      }
    }

    const { error } = await supabase.from('rental_payments').update(patch).eq('id', rentalPaymentId);
    if (error && !String(error.message || '').toLowerCase().includes('journal_entry')) {
      console.warn('[rentalService] syncRentalPaymentGlLink:', error.message);
    }
  },

  async linkJournalEntryToRentalPayment(rentalPaymentId: string, journalEntryId: string): Promise<void> {
    await this.syncRentalPaymentGlLink(rentalPaymentId, journalEntryId);
  },

  /** Resolve the JE created for this rental payment (link row after posting). */
  async findLatestJournalEntryForRental(companyId: string, rentalId: string, createdAfterIso: string): Promise<string | null> {
    const { data } = await supabase
      .from('journal_entries')
      .select('id')
      .eq('company_id', companyId)
      .eq('reference_type', 'rental')
      .eq('reference_id', rentalId)
      .gte('created_at', createdAfterIso)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return (data as { id?: string } | null)?.id ?? null;
  },

  /**
   * After journal reversal (correction_reversal), void the rental_payments row linked to the original JE
   * and recompute rental paid/due. Journal remains audit trail.
   */
  async voidRentalPaymentByReversedJournal(companyId: string, originalJournalEntryId: string): Promise<boolean> {
    let linked: { id: string; rental_id: string } | null = null;
    const q1 = await supabase
      .from('rental_payments')
      .select('id, rental_id, amount')
      .eq('journal_entry_id', originalJournalEntryId)
      .is('voided_at', null)
      .maybeSingle();
    if (!q1.error && q1.data) linked = q1.data as { id: string; rental_id: string };
    else if (q1.error && String(q1.error.message || '').toLowerCase().includes('voided')) {
      const q2 = await supabase
        .from('rental_payments')
        .select('id, rental_id, amount')
        .eq('journal_entry_id', originalJournalEntryId)
        .maybeSingle();
      if (q2.data && !(q2.data as any).voided_at) linked = q2.data as { id: string; rental_id: string };
    }

    if (linked?.id) {
      await supabase
        .from('rental_payments')
        .update({ voided_at: new Date().toISOString() })
        .eq('id', linked.id);
      await recomputeRentalPaidDueFromActivePayments(String((linked as { rental_id: string }).rental_id));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('rentalPaymentsChanged'));
        window.dispatchEvent(new CustomEvent('accountingEntriesChanged'));
      }
      return true;
    }

    const { data: je } = await supabase
      .from('journal_entries')
      .select('id, reference_type, reference_id, entry_date')
      .eq('id', originalJournalEntryId)
      .eq('company_id', companyId)
      .maybeSingle();
    if (!je || String((je as any).reference_type || '').toLowerCase() !== 'rental' || !(je as any).reference_id) {
      return false;
    }
    const rentalId = String((je as any).reference_id);
    const { data: lines } = await supabase
      .from('journal_entry_lines')
      .select('debit, credit')
      .eq('journal_entry_id', originalJournalEntryId);
    let jeAmount = 0;
    (lines || []).forEach((ln: any) => {
      jeAmount = Math.max(jeAmount, Number(ln.debit) || 0, Number(ln.credit) || 0);
    });
    let { data: candidates, error: candErr } = await supabase
      .from('rental_payments')
      .select('id, amount, voided_at')
      .eq('rental_id', rentalId)
      .is('voided_at', null);
    if (candErr) {
      const r2 = await supabase.from('rental_payments').select('id, amount, voided_at').eq('rental_id', rentalId);
      candidates = ((r2.data || []) as any[]).filter((p) => !p.voided_at);
    }
    const match = (candidates || []).find((c: any) => Math.abs(Number(c.amount) - jeAmount) < 0.02);
    if (!match) return false;
    await supabase
      .from('rental_payments')
      .update({ voided_at: new Date().toISOString(), journal_entry_id: originalJournalEntryId })
      .eq('id', (match as { id: string }).id);
    await recomputeRentalPaidDueFromActivePayments(rentalId);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('rentalPaymentsChanged'));
      window.dispatchEvent(new CustomEvent('accountingEntriesChanged'));
    }
    return true;
  },

  async updateRentalPayment(
    rentalId: string,
    paymentId: string,
    companyId: string,
    updates: {
      amount: number;
      paymentDate: string;
      method: string;
      reference?: string;
      notes?: string;
      accountId?: string;
    }
  ): Promise<void> {
    const { data: row, error: fetchErr } = await supabase
      .from('rental_payments')
      .select('id, amount, journal_entry_id, voided_at')
      .eq('id', paymentId)
      .eq('rental_id', rentalId)
      .maybeSingle();
    if (fetchErr || !row) throw new Error('Payment not found');
    if ((row as { voided_at?: string }).voided_at) throw new Error('Cannot edit a voided rental payment');

    const payDay = String(updates.paymentDate).slice(0, 10);
    const patch: Record<string, unknown> = {
      amount: updates.amount,
      payment_date: payDay,
      method: normalizePaymentMethod(updates.method),
      reference: (updates.reference ?? updates.notes ?? '').trim() || null,
    };
    if (updates.accountId) patch.payment_account_id = updates.accountId;

    const { error: upErr } = await supabase.from('rental_payments').update(patch).eq('id', paymentId);
    if (upErr && String(upErr.message || '').toLowerCase().includes('payment_account')) {
      delete patch.payment_account_id;
      const { error: e2 } = await supabase.from('rental_payments').update(patch).eq('id', paymentId);
      if (e2) throw e2;
    } else if (upErr) throw upErr;

    const jeId = (row as { journal_entry_id?: string | null }).journal_entry_id;
    if (jeId) {
      await supabase.from('journal_entries').update({ entry_date: payDay }).eq('id', jeId).eq('company_id', companyId);
    } else {
      await syncJournalEntryDateByDocumentRefs({
        companyId,
        referenceTypes: ['rental'],
        referenceId: rentalId,
        entryDate: payDay,
      });
    }

    await recomputeRentalPaidDueFromActivePayments(rentalId);

    const oldAmount = Number((row as { amount?: number }).amount ?? 0);
    const newAmount = updates.amount;
    const amountChanged = oldAmount !== newAmount;
    if (amountChanged || updates.method || updates.accountId) {
      const { data: rentalRow } = await supabase
        .from('rentals')
        .select('booking_no, rental_no')
        .eq('id', rentalId)
        .maybeSingle();
      const rentalNo = (rentalRow as { booking_no?: string; rental_no?: string } | null)?.booking_no
        || (rentalRow as { rental_no?: string } | null)?.rental_no;
      const { data: { user } } = await supabase.auth.getUser();
      const description = amountChanged
        ? `Payment edited from Rs ${oldAmount.toLocaleString()} to Rs ${newAmount.toLocaleString()} via ${updates.method}`
        : `Payment updated via ${updates.method}`;
      await activityLogService.logActivity({
        companyId,
        module: 'rental',
        entityId: rentalId,
        entityReference: rentalNo,
        action: 'payment_edited',
        oldValue: oldAmount,
        newValue: newAmount,
        amount: newAmount,
        paymentMethod: updates.method,
        performedBy: user?.id ?? null,
        description,
      }).catch((e) => console.warn('[RENTAL SERVICE] Activity log payment_edited failed:', e));
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('rentalPaymentsChanged'));
      window.dispatchEvent(new CustomEvent('accountingEntriesChanged'));
    }
  },

  async deletePayment(
    paymentId: string,
    rentalId: string,
    companyId: string,
    performedBy?: string | null
  ): Promise<void> {
    const { data: payment, error: payErr } = await supabase
      .from('rental_payments')
      .select('id, amount, journal_entry_id, payment_date, voided_at')
      .eq('id', paymentId)
      .eq('rental_id', rentalId)
      .single();

    if (payErr || !payment) throw new Error('Payment not found');
    if ((payment as any).voided_at) throw new Error('Payment already voided');

    const paymentAmount = Number((payment as any).amount);
    const journalEntryId = (payment as any).journal_entry_id as string | null | undefined;
    const payDay = String((payment as any).payment_date || '').slice(0, 10);

    const { data: rentalRow } = await supabase
      .from('rentals')
      .select('booking_no, paid_amount, total_amount')
      .eq('id', rentalId)
      .single();
    const rentalNo = (rentalRow as any)?.booking_no;

    if (journalEntryId) {
      const voidRes = await voidJournalEntries(companyId, [journalEntryId], 'Rental payment deleted');
      if (!voidRes.success) {
        throw new Error(voidRes.error || 'Failed to void linked journal entry for deleted rental payment');
      }
    }

    if (payDay) {
      const { data: orphanPayments } = await supabase
        .from('payments')
        .select('id, amount')
        .eq('company_id', companyId)
        .eq('reference_id', rentalId)
        .eq('payment_date', payDay)
        .is('voided_at', null);
      for (const row of orphanPayments || []) {
        if (Math.abs(Number((row as any).amount) - paymentAmount) >= 0.02) continue;
        try {
          await voidPaymentAfterJournalReversal({ companyId, paymentId: String((row as any).id) });
        } catch (e) {
          console.warn('[rentalService] deletePayment void orphan payments row:', e);
        }
      }
    }

    const voidedAt = new Date().toISOString();
    const { error: voidErr } = await supabase
      .from('rental_payments')
      .update({ voided_at: voidedAt })
      .eq('id', paymentId);
    if (voidErr) {
      const msg = String(voidErr.message || '').toLowerCase();
      if (msg.includes('voided') || String(voidErr.code || '') === '42703') {
        const { error: delErr } = await supabase.from('rental_payments').delete().eq('id', paymentId);
        if (delErr) throw delErr;
      } else {
        throw voidErr;
      }
    }

    await recomputeRentalPaidDueFromActivePayments(rentalId);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('rentalPaymentsChanged'));
      window.dispatchEvent(new CustomEvent('accountingEntriesChanged'));
    }

    await activityLogService.logActivity({
      companyId,
      module: 'rental',
      entityId: rentalId,
      entityReference: rentalNo ?? undefined,
      action: 'payment_deleted',
      amount: paymentAmount,
      performedBy: performedBy || undefined,
      description: `Payment ${paymentAmount} voided on rental (linked JE voided)`,
    }).catch((e) => console.warn('[RENTAL SERVICE] Activity log failed:', e));
  },

  async getRentalPayments(rentalId: string, options?: { includeVoided?: boolean }): Promise<RentalPayment[]> {
    let q = supabase.from('rental_payments').select('*').eq('rental_id', rentalId).order('payment_date', { ascending: false }).order('created_at', { ascending: false });
    if (!options?.includeVoided) {
      q = q.is('voided_at', null);
    }
    let { data, error } = await q;
    if (error && (String(error.message || '').toLowerCase().includes('voided') || String(error.code || '') === '42703')) {
      const r2 = await supabase
        .from('rental_payments')
        .select('*')
        .eq('rental_id', rentalId)
        .order('payment_date', { ascending: false })
        .order('created_at', { ascending: false });
      data = r2.data;
      error = r2.error;
      if (data && !options?.includeVoided) {
        data = (data as any[]).filter((p: any) => !p.voided_at);
      }
    }
    if (error) throw error;
    return (data || []) as RentalPayment[];
  },

  async getAllRentals(
    companyId: string,
    branchId?: string | null,
    opts?: { limit?: number; offset?: number }
  ): Promise<any[] | { data: any[]; total: number }> {
    const limit = opts?.limit ?? 500;
    const offset = opts?.offset ?? 0;
    // No created_by_user:users join – production DB may have no FK rentals→users (PGRST200)
    let query = supabase
      .from('rentals')
      .select(
        `
        *,
        customer:contacts(name, phone),
        branch:branches(id, name, code),
        items:rental_items(
          *,
          product:products(name, sku)
        )
      `,
        opts ? { count: 'exact' } : undefined
      )
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (branchId && branchId !== 'all') {
      query = query.eq('branch_id', branchId);
    }

    if (opts) {
      query = query.range(offset, offset + limit - 1);
    } else {
      query = query.limit(limit);
    }

    const { data, error, count } = await query;
    if (error) throw error;
    const rows = data || [];
    return opts ? { data: rows, total: count ?? rows.length } : rows;
  },

  async getRental(id: string) {
    const { data, error } = await supabase
      .from('rentals')
      .select(`
        *,
        customer:contacts(*),
        branch:branches(id, name, code),
        items:rental_items(
          *,
          product:products(id, name, sku, cost_price, retail_price, has_variations)
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  async deleteRental(id: string, companyId: string, performedBy?: string | null): Promise<void> {
    const { data: rental, error: fetchErr } = await supabase
      .from('rentals')
      .select('id, status, booking_no')
      .eq('id', id)
      .single();

    if (fetchErr || !rental) throw new Error('Rental not found');
    const r = rental as any;
    if (r.status !== 'draft' && r.status !== 'booked') {
      throw new Error('Only draft or booked rentals can be deleted. Cancel instead.');
    }

    await supabase.from('rental_items').delete().eq('rental_id', id);
    const { error: delErr } = await supabase.from('rentals').delete().eq('id', id);
    if (delErr) throw delErr;

    await activityLogService.logActivity({
      companyId,
      module: 'rental',
      entityId: id,
      entityReference: r.rental_no || r.booking_no,
      action: 'rental_deleted',
      performedBy: performedBy || undefined,
      description: `Rental ${r.rental_no} deleted`,
    }).catch((e) => console.warn('[RENTAL SERVICE] Activity log failed:', e));
  },
};
