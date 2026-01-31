/**
 * Rental Service – Full ERP standard (Sale/Purchase level)
 * Status flow: draft → rented → returned | overdue | cancelled
 * Inventory: stock_movements rental_out (finalize), rental_in (receiveReturn)
 * Payments: rental_payments table; rentals.paid_amount/due_amount updated
 */

import { supabase } from '@/lib/supabase';
import { activityLogService } from '@/app/services/activityLogService';

export type RentalStatus = 'draft' | 'rented' | 'returned' | 'overdue' | 'cancelled';

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

  async updateRental(
    id: string,
    companyId: string,
    updates: Partial<Pick<Rental, 'customer_id' | 'customer_name' | 'start_date' | 'expected_return_date' | 'notes'>>,
    items: RentalItem[] | null
  ): Promise<void> {
    const { data: existing, error: fetchErr } = await supabase
      .from('rentals')
      .select('status, rental_no')
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
      .select('id, status, branch_id, rental_no')
      .eq('id', id)
      .single();

    if (fetchErr || !rental) throw new Error('Rental not found');
    const r = rental as any;
    if (r.status !== 'draft') throw new Error('Only draft rentals can be finalized');

    const { data: items, error: itemsErr } = await supabase
      .from('rental_items')
      .select('id, product_id, quantity, unit, boxes, pieces')
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
        unit: item.unit || null,
        box_change: item.boxes != null ? -Number(item.boxes) : null,
        piece_change: item.pieces != null ? -Number(item.pieces) : null,
      });
      if (movErr) throw movErr;
    }

    const { error: updateErr } = await supabase
      .from('rentals')
      .update({ status: 'rented' })
      .eq('id', id);

    if (updateErr) throw updateErr;

    await activityLogService.logActivity({
      companyId,
      module: 'rental',
      entityId: id,
      entityReference: r.rental_no,
      action: 'rental_finalized',
      oldValue: { status: 'draft' },
      newValue: { status: 'rented' },
      performedBy: performedBy || undefined,
      description: `Rental ${r.rental_no} finalized – stock out`,
    }).catch(() => {});
  },

  async receiveReturn(
    id: string,
    companyId: string,
    actualReturnDate: string,
    performedBy?: string | null
  ): Promise<void> {
    const { data: rental, error: fetchErr } = await supabase
      .from('rentals')
      .select('id, status, branch_id, rental_no')
      .eq('id', id)
      .single();

    if (fetchErr || !rental) throw new Error('Rental not found');
    const r = rental as any;
    if (r.status !== 'rented' && r.status !== 'overdue') {
      throw new Error('Only rented or overdue rentals can be returned');
    }

    const { data: items, error: itemsErr } = await supabase
      .from('rental_items')
      .select('id, product_id, quantity, unit, boxes, pieces')
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
        unit: item.unit || null,
        box_change: item.boxes != null ? Number(item.boxes) : null,
        piece_change: item.pieces != null ? Number(item.pieces) : null,
      });
      if (movErr) throw movErr;
    }

    const { error: updateErr } = await supabase
      .from('rentals')
      .update({
        status: 'returned',
        actual_return_date: actualReturnDate,
      })
      .eq('id', id);

    if (updateErr) throw updateErr;

    await activityLogService.logActivity({
      companyId,
      module: 'rental',
      entityId: id,
      entityReference: r.rental_no,
      action: 'rental_returned',
      oldValue: { status: r.status },
      newValue: { status: 'returned', actual_return_date: actualReturnDate },
      performedBy: performedBy || undefined,
      description: `Rental ${r.rental_no} returned – stock in`,
    }).catch(() => {});
  },

  async cancelRental(id: string, companyId: string, performedBy?: string | null): Promise<void> {
    const { data: rental, error: fetchErr } = await supabase
      .from('rentals')
      .select('id, status, rental_no')
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
      entityReference: r.rental_no,
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
      .select('id, status, paid_amount, due_amount, rental_no')
      .eq('id', rentalId)
      .single();

    if (fetchErr || !rental) throw new Error('Rental not found');
    const r = rental as any;
    if (r.status !== 'rented' && r.status !== 'overdue') {
      throw new Error('Payment allowed only for rented or overdue rentals');
    }

    const { data: payment, error: payErr } = await supabase
      .from('rental_payments')
      .insert({
        rental_id: rentalId,
        amount,
        method: normalizePaymentMethod(method),
        reference: reference || null,
        payment_date: new Date().toISOString().split('T')[0],
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
      entityReference: r.rental_no,
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

    const { data: rentalRow } = await supabase.from('rentals').select('rental_no, paid_amount, total_amount').eq('id', rentalId).single();
    const rentalNo = (rentalRow as any)?.rental_no;

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
    let query = supabase
      .from('rentals')
      .select(`
        *,
        customer:contacts(name, phone),
        branch:branches(id, name, code),
        created_by_user:users(id, full_name, email),
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
        created_by_user:users(id, full_name, email),
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
      .select('id, status, rental_no')
      .eq('id', id)
      .single();

    if (fetchErr || !rental) throw new Error('Rental not found');
    const r = rental as any;
    if (r.status !== 'draft') {
      throw new Error('Only draft rentals can be deleted. Cancel instead.');
    }

    await supabase.from('rental_items').delete().eq('rental_id', id);
    const { error: delErr } = await supabase.from('rentals').delete().eq('id', id);
    if (delErr) throw delErr;

    await activityLogService.logActivity({
      companyId,
      module: 'rental',
      entityId: id,
      entityReference: r.rental_no,
      action: 'rental_deleted',
      performedBy: performedBy || undefined,
      description: `Rental ${r.rental_no} deleted`,
    }).catch(() => {});
  },
};
