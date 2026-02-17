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

export type RentalStatus = 'draft' | 'booked' | 'rented' | 'returned' | 'overdue' | 'cancelled';

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
}

function normalizePaymentMethod(method: string): string {
  const m = method.toLowerCase().trim();
  const map: Record<string, string> = {
    cash: 'cash', bank: 'bank', card: 'card',
    cheque: 'other', 'mobile wallet': 'other', wallet: 'other',
  };
  return map[m] || 'cash';
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
      sku: item.sku || null,
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
      paidAmount = 0,
      notes = null,
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
    const dueAmount = Math.max(0, totalAmount - paidAmount);

    const bookingNo = await settingsService.getNextDocumentNumber(companyId, branchId, 'rental');

    const { data: rentalData, error: rentalError } = await supabase
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
        paid_amount: paidAmount,
        notes: notes || null,
        created_by: createdBy || null,
      })
      .select('id, booking_no')
      .single();

    if (rentalError) throw rentalError;

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

    // Insert advance payment into rental_payments so it shows in payment history
    if (paidAmount > 0) {
      await supabase.from('rental_payments').insert({
        rental_id: rentalData.id,
        amount: paidAmount,
        method: 'cash',
        reference: 'Advance at booking',
        payment_date: bookingDate,
        payment_type: 'advance',
        created_by: createdBy || null,
      });
    }

    await activityLogService
      .logActivity({
        companyId,
        module: 'rental',
        entityId: rentalData.id,
        entityReference: bookingNo,
        action: 'rental_created',
        newValue: { status: 'booked', totalAmount, itemsCount: items.length },
        performedBy: createdBy || undefined,
        description: `Rental booking ${bookingNo} created`,
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
          sku: item.sku || null,
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

    // DB enum has picked_up/active; use picked_up for "rented"
    const { error: updateErr } = await supabase
      .from('rentals')
      .update({ status: 'picked_up' })
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

    const updatePayload: Record<string, unknown> = {
      status: 'picked_up',
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
      .eq('status', 'picked_up')
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
      .select('id, status, branch_id, booking_no')
      .eq('id', id)
      .single();

    if (fetchErr || !rental) throw new Error('Rental not found');
    const r = rental as any;
    const canReturn = ['rented', 'overdue', 'picked_up', 'active'].includes(r.status || '');
    if (!canReturn) {
      throw new Error('Only rented or overdue rentals can be returned');
    }

    // If penalty > 0, penalty must be paid and document returned
    if (penaltyAmount > 0 && !penaltyPaid) {
      throw new Error('Penalty must be paid before return can be completed');
    }
    if (penaltyAmount > 0 && !documentReturned) {
      throw new Error('Document must be returned to customer before completing return with penalty');
    }
    if (!documentReturned) {
      throw new Error('Please confirm document returned to customer');
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
    }

    const updatePayload: Record<string, unknown> = {
      status: 'returned',
      actual_return_date: actualReturnDate,
      returned_by: performedBy || null,
      condition_type: conditionType,
      damage_notes: damageNotes || null,
      damage_charges: penaltyAmount,
      penalty_paid: penaltyPaid,
      document_returned: documentReturned,
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
    if (r.status !== 'draft') {
      throw new Error('Only draft rentals can be cancelled');
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
    performedBy?: string | null
  ): Promise<RentalPayment> {
    const { data: rental, error: fetchErr } = await supabase
      .from('rentals')
      .select('id, status, paid_amount, due_amount, booking_no')
      .eq('id', rentalId)
      .single();

    if (fetchErr || !rental) throw new Error('Rental not found');
    const r = rental as any;
    // Allow payment: booked (at pickup), rented/overdue (active), picked_up/active (DB), returned (outstanding after return)
    const allowPayment = ['booked', 'rented', 'overdue', 'picked_up', 'active', 'returned', 'closed'].includes(r.status || '');
    if (!allowPayment) {
      throw new Error('Payment allowed only for booked, active/rented or overdue rentals');
    }

    const { data: payment, error: payErr } = await supabase
      .from('rental_payments')
      .insert({
        rental_id: rentalId,
        amount,
        method: normalizePaymentMethod(method),
        reference: reference || null,
        payment_date: new Date().toISOString().split('T')[0],
        payment_type: 'remaining',
        created_by: performedBy || null,
      })
      .select('*')
      .single();

    if (payErr) throw payErr;

    const newPaid = (r.paid_amount ?? 0) + amount;
    const newDue = Math.max(0, (r.due_amount ?? 0) - amount);

    await supabase
      .from('rentals')
      .update({ paid_amount: newPaid, due_amount: newDue })
      .eq('id', rentalId);

    await activityLogService.logActivity({
      companyId,
      module: 'rental',
      entityId: rentalId,
      entityReference: r.rental_no || r.booking_no,
      action: 'payment_added',
      amount,
      paymentMethod: method,
      performedBy: performedBy || undefined,
      description: `Payment ${amount} added to rental ${r.rental_no}`,
    }).catch(() => {});

    return payment as RentalPayment;
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

  async getRentalPayments(rentalId: string): Promise<RentalPayment[]> {
    const { data, error } = await supabase
      .from('rental_payments')
      .select('*')
      .eq('rental_id', rentalId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as RentalPayment[];
  },

  async getAllRentals(companyId: string, branchId?: string | null) {
    // Use explicit FK hint so PostgREST finds rentals->users; omit if schema has no created_by
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
          product:products(*)
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
