import { supabase, isSupabaseConfigured } from '../lib/supabase';

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
    await supabase.from('rental_payments').insert({
      rental_id: rentalData.id,
      amount: paidAmount,
      method: 'cash',
      reference: 'Advance at booking',
      payment_date: bookingDate,
      payment_type: 'advance',
      created_by: userId,
    });
  }

  return { data: { id: rentalData.id, booking_no: rentalData.booking_no || `RNT-${rentalData.id.slice(0, 8)}` }, error: null };
}

export async function getRentals(companyId: string, branchId?: string | null) {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  let q = supabase
    .from('rentals')
    .select('id, booking_no, document_number, customer_name, pickup_date, return_date, status, total_amount, paid_amount, due_amount')
    .eq('company_id', companyId)
    .order('booking_date', { ascending: false })
    .limit(50);
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
      status: String(r.status ?? '—'),
      total: Number(r.total_amount) || 0,
      paid: Number(r.paid_amount) || 0,
      due: Number(r.due_amount) || 0,
    })),
    error: null,
  };
}
