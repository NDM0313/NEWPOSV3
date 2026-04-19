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
}

function normalizePaymentMethod(method: string): string {
  const m = method.toLowerCase().trim();
  const map: Record<string, string> = {
    cash: 'cash', bank: 'bank', card: 'card',
    cheque: 'other', 'mobile wallet': 'other', wallet: 'other',
  };
  return map[m] || 'cash';
}

/** Sum non-voided rental_payments and update rentals.paid_amount / due_amount */
async function recomputeRentalPaidDueFromActivePayments(rentalId: string): Promise<void> {
  const { data: active, error } = await supabase
    .from('rental_payments')
    .select('amount')
    .eq('rental_id', rentalId)
    .is('voided_at', null);
  if (error) {
    const { data: fallback } = await supabase.from('rental_payments').select('amount').eq('rental_id', rentalId);
    if (!fallback) return;
    const sum = (fallback as { amount?: number }[]).reduce((s, r) => s + (Number(r.amount) || 0), 0);
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
  const sum = (active || []).reduce((s, r: { amount?: number }) => s + (Number(r.amount) || 0), 0);
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
    }).catch(() => {});

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
    notes?: string | null;
    expenses?: Array<{ description: string; amount: number }>;
    items: Array<{
      productId: string;
      productName: string;
      quantity: number;
      ratePerDay: number;
      durationDays: number;
      total: number;
    }>;
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
      notes = null,
      expenses = [],
      items,
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

    const availability = await checkRentalAvailabilityForItems({
      companyId,
      items: items.map((i) => ({ productId: i.productId })),
      startDate: pickupDate,
      endDate: returnDate,
      branchId,
    });
    if (!availability.available) {
      throw new Error(availability.message || 'Selected dates conflict with an existing booking');
    }

    const durationDays = Math.ceil((ret.getTime() - pickup.getTime()) / (1000 * 60 * 60 * 24)) || 1;
    const totalAmount = rentalCharges + securityDeposit;
    // Capture advance payment if provided (collected at booking time)
    const effectivePaid = Math.max(0, Number(advanceAmount) || 0);
    const dueAmount = Math.max(0, totalAmount - effectivePaid);

    const bookingNo = await settingsService.getNextDocumentNumber(companyId, branchId, 'rental');

    let rentalData: any;
    let rentalError: any;
    ({ data: rentalData, error: rentalError } = await supabase
      .from('rentals')
      .insert({
        company_id: companyId,
        branch_id: branchId,
        booking_no: bookingNo,
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
        notes: notes || null,
        created_by: createdBy || null,
        ...(expenses && expenses.length > 0 ? { rental_expenses: expenses } : {}),
      })
      .select('id, booking_no')
      .single());

    // If rental_expenses column doesn't exist, retry without it
    if (rentalError && String(rentalError.message || '').includes('rental_expenses')) {
      const { data: retryData, error: retryErr } = await supabase
        .from('rentals')
        .insert({
          company_id: companyId, branch_id: branchId, booking_no: bookingNo,
          booking_date: bookingDate, customer_id: customerId, customer_name: customerName,
          status: 'booked', pickup_date: pickupDate, return_date: returnDate,
          duration_days: durationDays, rental_charges: rentalCharges,
          security_deposit: securityDeposit, total_amount: totalAmount,
          paid_amount: effectivePaid, due_amount: dueAmount,
          notes: notes || null, created_by: createdBy || null,
        })
        .select('id, booking_no')
        .single();
      if (retryErr) throw retryErr;
      rentalData = retryData;
    } else if (rentalError) {
      throw rentalError;
    }

    const itemsPayload = items.map((i) => ({
      rental_id: rentalData.id,
      product_id: i.productId,
      product_name: i.productName,
      quantity: i.quantity,
      rate_per_day: i.ratePerDay,
      duration_days: i.durationDays,
      total: i.total,
    }));

    const { error: itemsError } = await supabase.from('rental_items').insert(itemsPayload);

    if (itemsError) {
      await supabase.from('rentals').delete().eq('id', rentalData.id);
      throw itemsError;
    }

    // Record advance payment if provided
    if (effectivePaid > 0) {
      await supabase.from('rental_payments').insert({
        rental_id: rentalData.id,
        amount: effectivePaid,
        method: 'cash',
        reference: `Advance - ${bookingNo}`,
        payment_date: bookingDate,
        created_by: createdBy || null,
      });
    }

    // Post rental expense JE if expenses exist (Dr Rental Expense 5300 / Cr Cash 1000)
    if (expenses && expenses.length > 0) {
      const totalExpense = expenses.reduce((sum: number, e: { amount: number }) => sum + (Number(e.amount) || 0), 0);
      if (totalExpense > 0) {
        try {
          const { accountingService } = await import('./accountingService');
          const getAccId = async (code: string) => {
            const { data } = await supabase.from('accounts').select('id').eq('code', code).eq('company_id', companyId).eq('is_active', true).maybeSingle();
            return data?.id as string | null;
          };
          const expAccId = await getAccId('5300') || await getAccId('6100');
          const cashAccId = await getAccId('1000');
          if (expAccId && cashAccId) {
            const expDesc = expenses.map((e: { description: string; amount: number }) => `${e.description}: Rs ${e.amount}`).join(', ');
            await accountingService.createEntry(
              { id: '', company_id: companyId, entry_no: `JE-REXP-${Date.now()}`, entry_date: bookingDate, description: `Rental expense — ${bookingNo} (${expDesc})`, reference_type: 'expense', reference_id: rentalData.id, created_by: createdBy || undefined },
              [
                { id: '', journal_entry_id: '', account_id: expAccId, debit: totalExpense, credit: 0, description: `Rental Expense — ${bookingNo}` },
                { id: '', journal_entry_id: '', account_id: cashAccId, debit: 0, credit: totalExpense, description: `Cash — rental expense ${bookingNo}` },
              ]
            );
          }
        } catch (expErr) { console.warn('[rentalService] Rental expense JE failed:', expErr); }
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
      .catch(() => {});

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
      items: items.map((i: any) => ({ productId: i.productId })),
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
      .catch(() => {});
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
    }).catch(() => {});
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
    }).catch(() => {});
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
      document_number: documentNumber,
      document_expiry: documentExpiry || null,
      document_received: documentReceived,
      remaining_payment_confirmed: remainingPaymentConfirmed,
      credit_flag: deliverOnCredit === true,
      notes: notes || r.notes || null,
    };
    if (documentFrontImage) updatePayload.document_front_image = documentFrontImage;
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
    }).catch(() => {});
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
    },
    performedBy?: string | null
  ): Promise<void> {
    const { actualReturnDate, notes, conditionType, damageNotes, penaltyAmount, penaltyPaid, documentReturned } = params;

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

    // Record penalty payment in rental_payments when penalty paid
    if (penaltyAmount > 0 && penaltyPaid) {
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
    }).catch(() => {});
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
    }).catch(() => {});
  },

  async addPayment(
    rentalId: string,
    companyId: string,
    amount: number,
    method: string,
    reference?: string,
    performedBy?: string | null,
    options?: { paymentType?: 'advance' | 'remaining'; paymentDate?: string; paymentAccountId?: string }
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

    const insertPayload: Record<string, unknown> = {
      rental_id: rentalId,
      amount,
      method: normalizePaymentMethod(method),
      reference: reference || null,
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

    await activityLogService.logActivity({
      companyId,
      module: 'rental',
      entityId: rentalId,
      entityReference: r.rental_no || r.booking_no,
      action: 'payment_added',
      amount,
      paymentMethod: method,
      performedBy: performedBy || undefined,
      description: `Payment ${amount} added to rental ${r.rental_no || r.booking_no || rentalId}`,
    }).catch(() => {});

    return payment as RentalPayment;
  },

  async linkJournalEntryToRentalPayment(rentalPaymentId: string, journalEntryId: string): Promise<void> {
    const { error } = await supabase
      .from('rental_payments')
      .update({ journal_entry_id: journalEntryId })
      .eq('id', rentalPaymentId);
    if (error && !String(error.message || '').toLowerCase().includes('journal_entry')) {
      console.warn('[rentalService] linkJournalEntryToRentalPayment:', error.message);
    }
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
      .select('id, amount')
      .eq('id', paymentId)
      .eq('rental_id', rentalId)
      .single();

    if (payErr || !payment) throw new Error('Payment not found');
    const paymentAmount = Number((payment as any).amount);

    const { data: rentalRow } = await supabase.from('rentals').select('booking_no, paid_amount, total_amount').eq('id', rentalId).single();
    const rentalNo = (rentalRow as any)?.booking_no;

    const { error: delErr } = await supabase.from('rental_payments').delete().eq('id', paymentId);
    if (delErr) throw delErr;

    if (rentalRow) {
      const r = rentalRow as any;
      const newPaid = Math.max(0, (r.paid_amount ?? 0) - paymentAmount);
      const total = r.total_amount ?? 0;
      const newDue = Math.max(0, total - newPaid);
      await supabase.from('rentals').update({ paid_amount: newPaid, due_amount: newDue }).eq('id', rentalId);
    }

    await activityLogService.logActivity({
      companyId,
      module: 'rental',
      entityId: rentalId,
      entityReference: rentalNo ?? undefined,
      action: 'payment_deleted',
      amount: paymentAmount,
      performedBy: performedBy || undefined,
      description: `Payment ${paymentAmount} deleted from rental`,
    }).catch(() => {});
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

  async getAllRentals(companyId: string, branchId?: string | null) {
    // No created_by_user:users join – production DB may have no FK rentals→users (PGRST200)
    let query = supabase
      .from('rentals')
      .select(`
        *,
        customer:contacts(name, phone),
        branch:branches(id, name, code),
        items:rental_items(
          *,
          product:products(name, sku)
        )
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (branchId && branchId !== 'all') {
      query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
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
    }).catch(() => {});
  },
};
