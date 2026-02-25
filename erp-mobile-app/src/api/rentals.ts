import { supabase, isSupabaseConfigured } from '../lib/supabase';

/** UI status: map DB status (picked_up, active, closed) to web-like labels */
export function mapRentalStatus(dbStatus: string): string {
  const m: Record<string, string> = {
    draft: 'draft',
    booked: 'booked',
    picked_up: 'rented',
    active: 'rented',
    rented: 'rented',
    returned: 'returned',
    closed: 'returned',
    overdue: 'overdue',
    cancelled: 'cancelled',
  };
  return m[dbStatus?.toLowerCase()] ?? dbStatus ?? '—';
}

export interface RentalListItem {
  id: string;
  no: string;
  customer: string;
  pickup: string;
  return: string;
  status: string; // UI: draft | booked | rented | returned | overdue | cancelled
  total: number;
  paid: number;
  due: number;
}

export interface RentalItemRow {
  id: string;
  productId: string;
  productName: string;
  sku?: string;
  quantity: number;
  rate: number;
  total: number;
  unit?: string;
}

export interface RentalPaymentRow {
  id: string;
  amount: number;
  method: string;
  reference: string | null;
  paymentDate: string;
}

export interface RentalDetail {
  id: string;
  bookingNo: string;
  customerId: string | null;
  customerName: string;
  customerPhone?: string;
  branchId: string;
  branchName?: string;
  status: string;
  pickupDate: string;
  returnDate: string;
  actualReturnDate: string | null;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  notes: string | null;
  items: RentalItemRow[];
  payments: RentalPaymentRow[];
}

/** Payment method for advance: maps to Dr Cash/Bank/Other in accounting (Cr Rental Advance). */
export type AdvancePaymentMethod = 'cash' | 'bank' | 'other';

export interface CreateBookingInput {
  companyId: string;
  branchId: string;
  userId: string | null;
  customerId: string;
  customerName: string;
  bookingDate: string;
  pickupDate: string;
  returnDate: string;
  rentalCharges: number;
  securityDeposit?: number;
  paidAmount?: number;
  /** Method for advance payment: cash | bank | other. Used when advancePaymentAccountId not provided. */
  advancePaymentMethod?: AdvancePaymentMethod;
  /** Account ID from chart (accounts table). Validated; method derived from account type. Overrides advancePaymentMethod when set. */
  advancePaymentAccountId?: string | null;
  notes?: string | null;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    ratePerDay: number;
    durationDays: number;
    total: number;
  }>;
}

export async function createBooking(input: CreateBookingInput): Promise<{ data: { id: string; booking_no: string } | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: 'App not configured.' };
  const {
    companyId,
    branchId,
    userId,
    customerId,
    customerName,
    bookingDate,
    pickupDate,
    returnDate,
    rentalCharges,
    securityDeposit = 0,
    paidAmount = 0,
    advancePaymentMethod = 'cash',
    advancePaymentAccountId,
    notes = null,
    items,
  } = input;

  if (!companyId || !branchId || branchId === 'all') return { data: null, error: 'Company and branch required.' };
  if (!items?.length) return { data: null, error: 'At least one item required.' };
  if (!customerId) return { data: null, error: 'Customer required.' };

  const pickup = new Date(pickupDate);
  const ret = new Date(returnDate);
  if (ret < pickup) return { data: null, error: 'Return date must be on or after pickup date.' };

  const durationDays = Math.ceil((ret.getTime() - pickup.getTime()) / (1000 * 60 * 60 * 24)) || 1;
  const totalAmount = rentalCharges + securityDeposit;
  const dueAmount = Math.max(0, totalAmount - paidAmount);

  const { data: rentalData, error: rentalError } = await supabase
    .from('rentals')
    .insert({
      company_id: companyId,
      branch_id: branchId,
      booking_no: null,
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
      due_amount: dueAmount,
      notes,
      created_by: userId,
    })
    .select('id, booking_no')
    .single();

  if (rentalError) return { data: null, error: rentalError.message };

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
    return { data: null, error: itemsError.message };
  }

  if (paidAmount > 0) {
    let method = (advancePaymentMethod === 'bank' || advancePaymentMethod === 'other') ? advancePaymentMethod : 'cash';
    if (advancePaymentAccountId) {
      const { data: acc, error: accErr } = await supabase
        .from('accounts')
        .select('id, type')
        .eq('id', advancePaymentAccountId)
        .eq('company_id', companyId)
        .eq('is_active', true)
        .single();
      if (accErr || !acc) return { data: null, error: 'Invalid or inactive payment account. Select an account from the list.' };
      const t = String((acc as Record<string, unknown>).type ?? '').toLowerCase();
      method = t === 'bank' || t === 'asset' ? t : t === 'mobile_wallet' ? 'other' : 'cash';
    }
    await supabase.from('rental_payments').insert({
      rental_id: rentalData.id,
      amount: paidAmount,
      method,
      reference: 'Advance at booking',
      payment_date: bookingDate,
      payment_type: 'advance',
      created_by: userId,
    });
  }

  return { data: { id: rentalData.id, booking_no: rentalData.booking_no || `RNT-${rentalData.id.slice(0, 8)}` }, error: null };
}

export async function getRentals(companyId: string, branchId?: string | null): Promise<{ data: RentalListItem[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  let q = supabase
    .from('rentals')
    .select('id, booking_no, document_number, customer_name, pickup_date, return_date, status, total_amount, paid_amount, due_amount')
    .eq('company_id', companyId)
    .order('booking_date', { ascending: false })
    .limit(100);
  if (branchId && branchId !== 'all') q = q.eq('branch_id', branchId);
  const { data, error } = await q;
  if (error) return { data: [], error: error.message };
  return {
    data: (data || []).map((r: Record<string, unknown>) => ({
      id: String(r.id ?? ''),
      no: String(r.booking_no || r.document_number || `RNT-${String(r.id ?? '').slice(0, 8)}`),
      customer: String(r.customer_name ?? '—'),
      pickup: r.pickup_date ? new Date(r.pickup_date as string).toISOString().slice(0, 10) : '—',
      return: r.return_date ? new Date(r.return_date as string).toISOString().slice(0, 10) : '—',
      status: mapRentalStatus(String(r.status ?? '')),
      total: Number(r.total_amount) || 0,
      paid: Number(r.paid_amount) || 0,
      due: Number(r.due_amount) || 0,
    })),
    error: null,
  };
}

export async function getRentalById(rentalId: string): Promise<{ data: RentalDetail | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: 'App not configured.' };
  const { data: rental, error: rErr } = await supabase
    .from('rentals')
    .select('*, branch:branches(id, name, code), customer:contacts(id, name, phone)')
    .eq('id', rentalId)
    .single();
  if (rErr || !rental) return { data: null, error: rErr?.message ?? 'Rental not found.' };

  const { data: items, error: iErr } = await supabase
    .from('rental_items')
    .select('id, product_id, product_name, sku, quantity, rate_per_day, rate, total, unit')
    .eq('rental_id', rentalId)
    .order('id');
  if (iErr) return { data: null, error: iErr.message };

  const { data: payments, error: pErr } = await supabase
    .from('rental_payments')
    .select('id, amount, method, reference, payment_date, created_at')
    .eq('rental_id', rentalId)
    .order('created_at', { ascending: false });
  if (pErr) return { data: null, error: pErr.message };

  const r = rental as Record<string, unknown>;
  const branch = r.branch as { name?: string; code?: string } | null;
  const customer = r.customer as { phone?: string } | null;
  const itemList = (items || []) as Array<Record<string, unknown>>;
  const paymentList = (payments || []) as Array<Record<string, unknown>>;

  return {
    data: {
      id: String(r.id),
      bookingNo: String(r.booking_no || r.document_number || ''),
      customerId: r.customer_id ? String(r.customer_id) : null,
      customerName: String(r.customer_name ?? ''),
      customerPhone: customer?.phone,
      branchId: String(r.branch_id ?? ''),
      branchName: branch ? [branch.code, branch.name].filter(Boolean).join(' | ') : undefined,
      status: mapRentalStatus(String(r.status ?? '')),
      pickupDate: r.pickup_date ? new Date(r.pickup_date as string).toISOString().slice(0, 10) : '',
      returnDate: r.return_date ? new Date(r.return_date as string).toISOString().slice(0, 10) : '',
      actualReturnDate: r.actual_return_date ? new Date(r.actual_return_date as string).toISOString().slice(0, 10) : null,
      totalAmount: Number(r.total_amount) ?? 0,
      paidAmount: Number(r.paid_amount) ?? 0,
      dueAmount: Number(r.due_amount) ?? 0,
      notes: (r.notes as string) ?? null,
      items: itemList.map((i) => ({
        id: String(i.id),
        productId: String(i.product_id),
        productName: String(i.product_name ?? ''),
        sku: i.sku as string | undefined,
        quantity: Number(i.quantity) ?? 0,
        rate: Number(i.rate_per_day ?? i.rate ?? 0),
        total: Number(i.total) ?? 0,
        unit: i.unit as string | undefined,
      })),
      payments: paymentList.map((p) => ({
        id: String(p.id),
        amount: Number(p.amount) ?? 0,
        method: String(p.method ?? ''),
        reference: (p.reference as string) ?? null,
        paymentDate: (p.payment_date ?? (p.created_at as string)?.slice(0, 10)) ?? '',
      })),
    },
    error: null,
  };
}

export async function receiveReturn(
  rentalId: string,
  companyId: string,
  payload: {
    actualReturnDate: string;
    notes?: string;
    conditionType: string;
    damageNotes?: string;
    penaltyAmount: number;
    penaltyPaid: boolean;
    documentReturned: boolean;
    /** Account ID for penalty payment (validated). Method derived from account type. */
    penaltyPaymentAccountId?: string | null;
  },
  userId?: string | null
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) return { error: 'App not configured.' };
  const { data: rental, error: fetchErr } = await supabase.from('rentals').select('id, status, branch_id, due_amount').eq('id', rentalId).single();
  if (fetchErr || !rental) return { error: fetchErr?.message ?? 'Rental not found.' };
  const r = rental as Record<string, unknown>;
  const status = String(r.status ?? '');
  if (!['rented', 'overdue', 'picked_up', 'active'].includes(status)) {
    return { error: 'Only rented or overdue rentals can be returned. Mark as picked up first.' };
  }
  const dueAmount = Number(r.due_amount) ?? 0;
  const penaltyAmount = payload.penaltyAmount ?? 0;
  const balanceAfterPenalty = Math.max(0, dueAmount - (payload.penaltyPaid ? penaltyAmount : 0));
  if (balanceAfterPenalty > 0) {
    return { error: 'Clear balance (remaining rent + penalty) before completing return.' };
  }

  const { data: items } = await supabase.from('rental_items').select('id, product_id, quantity').eq('rental_id', rentalId);
  const itemList = (items || []) as Array<{ product_id: string; quantity: number }>;
  for (const item of itemList) {
    const { error: movErr } = await supabase.from('stock_movements').insert({
      company_id: companyId,
      branch_id: r.branch_id,
      product_id: item.product_id,
      movement_type: 'rental_in',
      quantity: Number(item.quantity),
      unit_cost: 0,
      total_cost: 0,
      reference_type: 'rental',
      reference_id: rentalId,
      created_by: userId ?? null,
    });
    if (movErr) return { error: movErr.message };
  }

  const updatePayload: Record<string, unknown> = {
    status: 'returned',
    actual_return_date: payload.actualReturnDate,
    returned_by: userId ?? null,
    condition_type: payload.conditionType,
    damage_notes: payload.damageNotes ?? null,
    damage_charges: payload.penaltyAmount,
    penalty_paid: payload.penaltyPaid,
    document_returned: payload.documentReturned,
    security_status: 'returned',
  };
  if (payload.notes) updatePayload.notes = payload.notes;

  const { error: updateErr } = await supabase.from('rentals').update(updatePayload).eq('id', rentalId);
  if (updateErr) return { error: updateErr.message };

  if (payload.penaltyAmount > 0 && payload.penaltyPaid) {
    let penaltyMethod = 'cash';
    if (payload.penaltyPaymentAccountId) {
      const { data: acc, error: accErr } = await supabase
        .from('accounts')
        .select('id, type')
        .eq('id', payload.penaltyPaymentAccountId)
        .eq('company_id', companyId)
        .eq('is_active', true)
        .single();
      if (accErr || !acc) return { error: 'Invalid or inactive penalty payment account.' };
      const t = String((acc as Record<string, unknown>).type ?? '').toLowerCase();
      penaltyMethod = t === 'bank' || t === 'asset' ? t : t === 'mobile_wallet' ? 'other' : 'cash';
    }
    await supabase.from('rental_payments').insert({
      rental_id: rentalId,
      amount: payload.penaltyAmount,
      method: penaltyMethod,
      reference: 'Damage/penalty',
      payment_date: payload.actualReturnDate,
      payment_type: 'penalty',
      created_by: userId ?? null,
    });
    const { data: row } = await supabase.from('rentals').select('paid_amount, due_amount').eq('id', rentalId).single();
    const rowr = row as Record<string, number>;
    const newPaid = (rowr?.paid_amount ?? 0) + payload.penaltyAmount;
    const newDue = Math.max(0, (rowr?.due_amount ?? 0) - payload.penaltyAmount);
    await supabase.from('rentals').update({ paid_amount: newPaid, due_amount: newDue }).eq('id', rentalId);
  }
  return { error: null };
}

function normalizePaymentMethod(m: string): string {
  const s = m.toLowerCase().trim();
  if (['cash', 'bank', 'card'].includes(s)) return s;
  return 'cash';
}

export async function addRentalPayment(
  rentalId: string,
  companyId: string,
  amount: number,
  method: string,
  reference?: string,
  userId?: string | null
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) return { error: 'App not configured.' };
  const { data: rental, error: fetchErr } = await supabase
    .from('rentals')
    .select('id, status, paid_amount, due_amount, booking_no')
    .eq('id', rentalId)
    .single();
  if (fetchErr || !rental) return { error: fetchErr?.message ?? 'Rental not found.' };
  const r = rental as Record<string, unknown>;
  const status = String(r.status ?? '');
  if (!['booked', 'rented', 'overdue', 'picked_up', 'active', 'returned', 'closed'].includes(status)) {
    return { error: 'Payment not allowed for this status.' };
  }

  await supabase.from('rental_payments').insert({
    rental_id: rentalId,
    amount,
    method: normalizePaymentMethod(method),
    reference: reference ?? null,
    payment_date: new Date().toISOString().split('T')[0],
    payment_type: 'remaining',
    created_by: userId ?? null,
  });

  const newPaid = (Number(r.paid_amount) ?? 0) + amount;
  const newDue = Math.max(0, (Number(r.due_amount) ?? 0) - amount);
  await supabase.from('rentals').update({ paid_amount: newPaid, due_amount: newDue }).eq('id', rentalId);
  return { error: null };
}

export async function markRentalPickedUp(
  rentalId: string,
  companyId: string,
  payload: {
    actualPickupDate: string;
    notes?: string;
    documentType: string;
    documentNumber: string;
    /** Optional URL of uploaded security document image */
    securityDocumentImageUrl?: string | null;
    documentReceived: boolean;
    remainingPaymentConfirmed: boolean;
  },
  userId?: string | null
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) return { error: 'App not configured.' };
  const { data: rental, error: fetchErr } = await supabase
    .from('rentals')
    .select('id, status, branch_id, pickup_date, total_amount, paid_amount, booking_no')
    .eq('id', rentalId)
    .single();
  if (fetchErr || !rental) return { error: fetchErr?.message ?? 'Rental not found.' };
  const r = rental as Record<string, unknown>;
  if (String(r.status) !== 'booked') return { error: 'Only booked rentals can be marked as picked up.' };

  const { data: items } = await supabase.from('rental_items').select('id, product_id, quantity').eq('rental_id', rentalId);
  const itemList = (items || []) as Array<{ product_id: string; quantity: number }>;
  for (const item of itemList) {
    const { error: movErr } = await supabase.from('stock_movements').insert({
      company_id: companyId,
      branch_id: r.branch_id,
      product_id: item.product_id,
      movement_type: 'rental_out',
      quantity: -Number(item.quantity),
      unit_cost: 0,
      total_cost: 0,
      reference_type: 'rental',
      reference_id: rentalId,
      created_by: userId ?? null,
    });
    if (movErr) return { error: movErr.message };
  }

  const updatePayload: Record<string, unknown> = {
    status: 'picked_up',
    notes: payload.notes ?? r.notes ?? null,
    security_document_type: payload.documentType ?? null,
    security_document_number: payload.documentNumber?.trim() || null,
    security_document_image_url: payload.securityDocumentImageUrl ?? null,
    security_status: 'collected',
  };
  try {
    const { error: updateErr } = await supabase.from('rentals').update(updatePayload).eq('id', rentalId);
    if (updateErr) return { error: updateErr.message };
  } catch (e) {
    return { error: (e as Error).message };
  }
  return { error: null };
}

export async function deleteRental(rentalId: string, companyId: string): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) return { error: 'App not configured.' };
  const { data: rental, error: fetchErr } = await supabase.from('rentals').select('id, status').eq('id', rentalId).single();
  if (fetchErr || !rental) return { error: fetchErr?.message ?? 'Rental not found.' };
  const r = rental as Record<string, unknown>;
  const status = String(r.status ?? '');
  if (status !== 'draft' && status !== 'booked') return { error: 'Only draft or booked rentals can be deleted.' };
  await supabase.from('rental_items').delete().eq('rental_id', rentalId);
  const { error: delErr } = await supabase.from('rentals').delete().eq('id', rentalId);
  return { error: delErr?.message ?? null };
}

export async function cancelRental(rentalId: string, companyId: string): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) return { error: 'App not configured.' };
  const { data: rental, error: fetchErr } = await supabase.from('rentals').select('id, status').eq('id', rentalId).single();
  if (fetchErr || !rental) return { error: fetchErr?.message ?? 'Rental not found.' };
  const r = rental as Record<string, unknown>;
  if (String(r.status) === 'cancelled') return { error: null };
  if (!['draft', 'booked'].includes(String(r.status))) return { error: 'Only draft or booked can be cancelled.' };
  const { error: updateErr } = await supabase.from('rentals').update({ status: 'cancelled' }).eq('id', rentalId);
  return { error: updateErr?.message ?? null };
}
