import { getContactWhatsAppPhone } from './contacts';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { formatLocalDateYYYYMMDD, localNowDateString } from '../utils/localDate';
import {
  linkRentalPaymentJournalEntry,
  postRentalAdvanceJournalMobile,
  postRentalExpenseJournalMobile,
  postRentalPartyRevenueJournalMobile,
} from './rentalBookingAccounting';
import { isRealBranchUuid, resolveBranchUuidForWrite } from '../utils/branchId';
import { fetchProductStockByKey } from '../utils/productStockFetch';
import { formatRentalPaymentRef } from '../utils/rentalPaymentRef';

const BLOCKING_RENTAL_STATUSES = ['booked', 'picked_up', 'active', 'overdue'] as const;

export interface RentalAvailabilityConflict {
  rentalId: string;
  bookingNo: string;
  customerName: string;
  pickupDate: string;
  returnDate: string;
  status: string;
}

export interface RentalAvailabilityResult {
  available: boolean;
  conflicts: RentalAvailabilityConflict[];
  message?: string;
  requiresConfirmation?: boolean;
}

function matchesRentalLineVariation(
  lineVariationId: string | null | undefined,
  requestedVariationId?: string | null,
): boolean {
  if (requestedVariationId) return lineVariationId === requestedVariationId;
  return !lineVariationId;
}

async function getRentalProductStock(
  companyId: string,
  productId: string,
  variationId: string | null | undefined,
  branchId?: string | null,
): Promise<number> {
  const map = await fetchProductStockByKey(
    companyId,
    [productId],
    variationId ? [] : [productId],
    variationId ? [productId] : [],
    branchId,
  );
  const key = variationId ? `${productId}_${variationId}` : productId;
  return map[key] ?? 0;
}

/** Check one product for overlapping booked/active rentals (quantity-aware vs stock). */
export async function checkRentalAvailability(params: {
  companyId: string;
  productId: string;
  startDate: string;
  endDate: string;
  requestedQuantity?: number;
  variationId?: string | null;
  excludeRentalId?: string;
  branchId?: string | null;
}): Promise<RentalAvailabilityResult> {
  const {
    companyId,
    productId,
    startDate,
    endDate,
    requestedQuantity = 1,
    variationId,
    excludeRentalId,
    branchId,
  } = params;
  if (!isSupabaseConfigured) return { available: false, conflicts: [], message: 'App not configured.' };

  let query = supabase
    .from('rentals')
    .select('id, booking_no, customer_name, pickup_date, return_date, status')
    .eq('company_id', companyId)
    .in('status', [...BLOCKING_RENTAL_STATUSES])
    .lt('pickup_date', endDate)
    .gte('return_date', startDate);

  if (branchId && branchId !== 'all') query = query.eq('branch_id', branchId);
  if (excludeRentalId) query = query.neq('id', excludeRentalId);

  const { data: rentals, error } = await query;
  if (error) {
    console.error('[rentals.checkRentalAvailability]', error);
    return { available: false, conflicts: [], message: 'Failed to check availability' };
  }

  const rentalIds = (rentals || []).map((r) => r.id as string);
  if (rentalIds.length === 0) return { available: true, conflicts: [] };

  const { data: items, error: itemsErr } = await supabase
    .from('rental_items')
    .select('rental_id, product_id, variation_id, quantity')
    .in('rental_id', rentalIds)
    .eq('product_id', productId);

  if (itemsErr) {
    console.error('[rentals.checkRentalAvailability] rental_items', itemsErr);
    return { available: false, conflicts: [], message: 'Failed to check availability' };
  }

  const matchingLines = (items || []).filter((i) =>
    matchesRentalLineVariation(i.variation_id as string | null | undefined, variationId),
  );

  if (matchingLines.length === 0) return { available: true, conflicts: [] };

  const conflictRentalIds = new Set(matchingLines.map((i) => i.rental_id as string));
  const conflicts: RentalAvailabilityConflict[] = (rentals || [])
    .filter((r) => conflictRentalIds.has(r.id as string))
    .map((r) => ({
      rentalId: r.id as string,
      bookingNo: String(r.booking_no || ''),
      customerName: String(r.customer_name || ''),
      pickupDate: String(r.pickup_date || ''),
      returnDate: String(r.return_date || ''),
      status: String(r.status || ''),
    }));

  const alreadyBookedQty = matchingLines.reduce(
    (sum, i) => sum + (Number(i.quantity) || 0),
    0,
  );
  const stock = await getRentalProductStock(companyId, productId, variationId, branchId);
  const requestedQty = Math.max(0, Number(requestedQuantity) || 0);

  if (stock >= alreadyBookedQty + requestedQty) {
    return { available: true, conflicts: [] };
  }

  if (conflicts.length === 0) return { available: true, conflicts: [] };

  const first = conflicts[0];
  return {
    available: false,
    conflicts,
    requiresConfirmation: true,
    message: `Product is already booked from ${first.pickupDate} to ${first.returnDate} (${first.bookingNo || first.rentalId} - ${first.customerName})`,
  };
}

export async function checkRentalAvailabilityForItems(params: {
  companyId: string;
  items: Array<{ productId: string; quantity?: number; variationId?: string | null }>;
  startDate: string;
  endDate: string;
  excludeRentalId?: string;
  branchId?: string | null;
}): Promise<RentalAvailabilityResult> {
  for (const item of params.items) {
    const result = await checkRentalAvailability({
      companyId: params.companyId,
      productId: item.productId,
      startDate: params.startDate,
      endDate: params.endDate,
      requestedQuantity: item.quantity ?? 1,
      variationId: item.variationId,
      excludeRentalId: params.excludeRentalId,
      branchId: params.branchId,
    });
    if (!result.available) return result;
  }
  return { available: true, conflicts: [] };
}

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
  /** System booking number (RNT-…). */
  bookingNo: string;
  /** Manual bill book / customer ref (`rentals.document_number`). */
  documentNumber: string;
  /** @deprecated Use bookingNo — kept for minimal churn */
  no: string;
  customer: string;
  customerPhone?: string;
  pickup: string;
  return: string;
  status: string; // UI: draft | booked | rented | returned | overdue | cancelled
  total: number;
  paid: number;
  due: number;
  /** Booking date YYYY-MM-DD for date-range filters */
  bookingDate: string;
  createdBy?: string | null;
  salesmanId?: string | null;
  branchId?: string | null;
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
  /** Manual bill book ref — same as web list `document_number`. */
  documentNumber: string | null;
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
  securityDocumentType: string | null;
  securityDocumentNumber: string | null;
  securityDocumentImageUrl: string | null;
  securityStatus: string | null;
  /** Pickup-held ID (CNIC etc.) — `document_type` / `document_number` on rental */
  pickupDocumentType: string | null;
  pickupDocumentNumber: string | null;
  items: RentalItemRow[];
  payments: RentalPaymentRow[];
}

export interface GetRentalsOptions {
  dateFrom?: string;
  dateTo?: string;
  /** When set, filter to these branch UUIDs (worker / accessible-branch mode). */
  accessibleBranchIds?: string[];
  /** Restrict to rows created by or assigned to this worker. */
  scopeToOwn?: { authUserId: string; profileId?: string | null };
}

/** One line item on the availability calendar grid. */
export interface RentalCalendarItemRow {
  productId: string;
  productName: string;
}

/** Rental row for calendar (items + date span). */
export interface RentalCalendarRental {
  id: string;
  bookingNo: string;
  customerName: string;
  status: string;
  start: string;
  end: string;
  createdBy?: string | null;
  salesmanId?: string | null;
  branchId?: string | null;
  items: RentalCalendarItemRow[];
}

function rentalDateToYmd(val: unknown): string {
  if (val == null || val === '') return '';
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  return formatLocalDateYYYYMMDD(d);
}

function applyRentalOwnScope(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  authUserId: string,
  profileId?: string | null,
) {
  const uid = authUserId?.trim();
  if (!uid) return query;
  const pid = profileId?.trim();
  const parts = [`created_by.eq.${uid}`, `salesman_id.eq.${uid}`];
  if (pid && pid !== uid) {
    parts.push(`created_by.eq.${pid}`, `salesman_id.eq.${pid}`);
  }
  return query.or(parts.join(','));
}

export interface UpdateRentalMetaInput {
  documentNumber?: string | null;
  notes?: string | null;
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
  /** Manual bill book ref → `rentals.document_number` (not booking_no). */
  documentNumber?: string | null;
  /** Optional salesman + commission (mirrors sales commission). Persisted on rentals.salesman_id / commission_*. */
  salesmanId?: string | null;
  commissionPercent?: number | null;
  /** Optional security document (NSC) captured at booking. Mirrors web ERP. */
  securityDocumentType?: string | null;
  securityDocumentNumber?: string | null;
  securityDocumentImageUrl?: string | null;
  /** Devaluation / shop costs — same as web `rental_expenses`; not added into `rental_charges`. */
  expenses?: Array<{ description: string; amount: number }>;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    ratePerDay: number;
    durationDays: number;
    total: number;
    /** When the product has variations, the specific variation picked. */
    variationId?: string | null;
    /** Optional human-readable variation label (e.g. "Red / Large") — stored in notes for display. */
    variationLabel?: string | null;
  }>;
  /** Skip overlap check after user confirmed "Book anyway?" */
  skipAvailabilityCheck?: boolean;
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
    documentNumber = null,
    salesmanId = null,
    commissionPercent = null,
    securityDocumentType = null,
    securityDocumentNumber = null,
    securityDocumentImageUrl = null,
    expenses = [],
    items,
    skipAvailabilityCheck = false,
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

  let normalizedExpenses = expenses || [];
  if (normalizedExpenses.length === 0) {
    const { data: dRow } = await supabase
      .from('settings')
      .select('value')
      .eq('company_id', companyId)
      .eq('key', 'default_dress_devaluation')
      .maybeSingle();
    const raw = dRow?.value;
    const defaultDevaluation = typeof raw === 'number' ? raw : Number(raw);
    normalizedExpenses = [
      {
        description: 'Dress devaluation (wear)',
        amount: Number.isFinite(defaultDevaluation) && defaultDevaluation >= 0 ? defaultDevaluation : 5000,
      },
    ];
  }
  const normalizedExpenseTotal = normalizedExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const commissionEligible = Math.max(0, rentalCharges - normalizedExpenseTotal);
  const commissionPct = commissionPercent != null && Number.isFinite(commissionPercent) ? Number(commissionPercent) : null;
  const commissionAmount =
    commissionPct != null && commissionPct > 0
      ? Math.round(commissionEligible * (commissionPct / 100) * 100) / 100
      : 0;

  let effectiveBranchId: string;
  try {
    effectiveBranchId = await resolveBranchUuidForWrite(
      companyId,
      branchId,
      'No branch set up. Add a branch in Settings to create rentals.',
    );
  } catch (err) {
    return { data: null, error: (err as Error).message ?? 'Failed to resolve branch.' };
  }

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
      return {
        data: null,
        error: availability.message || 'Selected dates conflict with an existing booking.',
      };
    }
  }

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
    paid_amount: paidAmount,
    due_amount: dueAmount,
    notes,
  };
  const docNumTrim = documentNumber != null ? String(documentNumber).trim() : '';
  if (docNumTrim) rentalPayload.document_number = docNumTrim;
  if (salesmanId) rentalPayload.salesman_id = salesmanId;
  if (commissionPct != null && salesmanId) {
    rentalPayload.commission_percent = commissionPct;
    rentalPayload.commission_amount = commissionAmount;
    rentalPayload.commission_eligible_amount = commissionEligible;
    rentalPayload.commission_status = commissionAmount > 0 ? 'pending' : null;
  }
  if (normalizedExpenses.length > 0 && normalizedExpenseTotal > 0) {
    rentalPayload.rental_expenses = normalizedExpenses;
  }
  if (securityDocumentType) rentalPayload.security_document_type = securityDocumentType;
  if (securityDocumentNumber) rentalPayload.security_document_number = securityDocumentNumber.trim() || null;
  if (securityDocumentImageUrl) rentalPayload.security_document_image_url = securityDocumentImageUrl;
  if (securityDocumentType || securityDocumentNumber || securityDocumentImageUrl) {
    rentalPayload.security_status = 'collected';
  }

  const itemsJson = items.map((i) => {
    const row: Record<string, unknown> = {
      product_id: i.productId,
      product_name: i.variationLabel ? `${i.productName} — ${i.variationLabel}` : i.productName,
      quantity: i.quantity,
      rate_per_day: i.ratePerDay,
      duration_days: i.durationDays,
      total: i.total,
    };
    if (i.variationId) row.variation_id = i.variationId;
    return row;
  });

  let rpcBody = rentalPayload;
  const tryRpc = async (payload: Record<string, unknown>) =>
    supabase.rpc('create_rental_booking', {
      p_company_id: companyId,
      p_branch_id: effectiveBranchId,
      p_rental: payload,
      p_items: itemsJson,
      p_created_by: userId,
    });

  let { data: rpcRaw, error: rpcErr } = await tryRpc(rpcBody);
  if (rpcErr) {
    const msg = String(rpcErr.message || '');
    if (msg.includes('rental_expenses') || msg.includes('commission') || msg.includes('salesman_id')) {
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
  if (rpcErr) return { data: null, error: rpcErr.message };

  const rpc = rpcRaw as { success?: boolean; rental_id?: string; booking_no?: string; error?: string } | null;
  if (!rpc?.success || !rpc.rental_id) {
    return { data: null, error: rpc?.error ?? 'Rental create failed.' };
  }

  const rentalData = { id: rpc.rental_id, booking_no: rpc.booking_no ?? null };

  if (docNumTrim) {
    const { error: docPatchErr } = await supabase
      .from('rentals')
      .update({ document_number: docNumTrim })
      .eq('id', rentalData.id);
    if (docPatchErr) {
      console.warn('[rentals.createBooking] document_number patch:', docPatchErr.message);
    }
  }

  const bookingNoDisplay = rentalData.booking_no || `RNT-${rentalData.id.slice(0, 8)}`;

  if (paidAmount > 0) {
    if (!advancePaymentAccountId) {
      await supabase.from('rental_items').delete().eq('rental_id', rentalData.id);
      await supabase.from('rentals').delete().eq('id', rentalData.id);
      return { data: null, error: 'Select payment account for advance (required for ledger posting).' };
    }
    let method = (advancePaymentMethod === 'bank' || advancePaymentMethod === 'other') ? advancePaymentMethod : 'cash';
    const { data: acc, error: accErr } = await supabase
      .from('accounts')
      .select('id, type')
      .eq('id', advancePaymentAccountId)
      .eq('company_id', companyId)
      .eq('is_active', true)
      .single();
    if (accErr || !acc) {
      await supabase.from('rental_items').delete().eq('rental_id', rentalData.id);
      await supabase.from('rentals').delete().eq('id', rentalData.id);
      return { data: null, error: 'Invalid or inactive payment account. Select an account from the list.' };
    }
    const t = String((acc as Record<string, unknown>).type ?? '').toLowerCase();
    method = t === 'bank' || t === 'asset' ? 'bank' : t === 'mobile_wallet' ? 'other' : 'cash';

    const { data: payRow, error: payInsErr } = await supabase
      .from('rental_payments')
      .insert({
        rental_id: rentalData.id,
        amount: paidAmount,
        method,
        reference: formatRentalPaymentRef(bookingNoDisplay),
        payment_date: bookingDate,
        payment_type: 'advance',
        payment_account_id: advancePaymentAccountId,
        created_by: userId,
      })
      .select('id')
      .single();
    if (payInsErr || !payRow) {
      await supabase.from('rental_items').delete().eq('rental_id', rentalData.id);
      await supabase.from('rentals').delete().eq('id', rentalData.id);
      return { data: null, error: payInsErr?.message ?? 'Failed to record advance payment.' };
    }

    const je = await postRentalAdvanceJournalMobile({
      companyId,
      branchId: effectiveBranchId,
      rentalId: rentalData.id,
      bookingNo: bookingNoDisplay,
      customerName: customerName,
      amount: paidAmount,
      paymentAccountId: advancePaymentAccountId,
      entryDate: bookingDate,
      userId,
      customerId,
      rentalCharges,
      securityDeposit,
      rentalPaymentId: (payRow as { id: string }).id,
    });
    if (je.error || !je.journalEntryId) {
      await supabase.from('rental_payments').delete().eq('id', (payRow as { id: string }).id);
      await supabase.from('rental_items').delete().eq('rental_id', rentalData.id);
      await supabase.from('rentals').delete().eq('id', rentalData.id);
      return {
        data: null,
        error: je.error || 'Ledger: could not post rental advance (party AR or Cr Rental Advance).',
      };
    }
    await linkRentalPaymentJournalEntry((payRow as { id: string }).id, je.journalEntryId);
  } else if (customerId && rentalCharges > 0) {
    const rev = await postRentalPartyRevenueJournalMobile({
      companyId,
      branchId: effectiveBranchId,
      rentalId: rentalData.id,
      customerId,
      customerName,
      rentalCharges,
      entryDate: bookingDate,
      userId,
    });
    if (rev.error) {
      console.warn('[rentals.createBooking] Party AR revenue JE skipped:', rev.error);
    }
  }

  if (normalizedExpenses.length > 0 && normalizedExpenseTotal > 0) {
    const exJe = await postRentalExpenseJournalMobile({
      companyId,
      branchId: effectiveBranchId,
      rentalId: rentalData.id,
      bookingNo: bookingNoDisplay,
      expenses: normalizedExpenses,
      entryDate: bookingDate,
      userId,
      customerId: customerId || null,
      customerName,
    });
    if (exJe.error) {
      console.warn('[rentals.createBooking] Rental expense JE skipped:', exJe.error);
    }
  }

  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('accountingEntriesChanged'));
      window.dispatchEvent(new CustomEvent('ledgerUpdated', { detail: { ledgerType: 'customer', entityId: customerId } }));
    } catch {
      /* non-browser */
    }
  }

  return { data: { id: rentalData.id, booking_no: bookingNoDisplay }, error: null };
}

export async function getRentals(
  companyId: string,
  branchId?: string | null,
  opts?: GetRentalsOptions
): Promise<{ data: RentalListItem[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  let q = supabase
    .from('rentals')
    .select(
      'id, booking_no, document_number, booking_date, customer_name, customer_id, pickup_date, return_date, status, total_amount, paid_amount, due_amount, branch_id, created_by, salesman_id, customer:contacts(phone, mobile)'
    )
    .eq('company_id', companyId)
    .order('booking_date', { ascending: false })
    .limit(500);
  const branchIds = opts?.accessibleBranchIds?.filter(Boolean) ?? [];
  if (branchIds.length > 0) {
    q = q.in('branch_id', branchIds);
  } else if (branchId && branchId !== 'all' && branchId !== 'default') {
    q = q.eq('branch_id', branchId);
  }
  if (opts?.scopeToOwn?.authUserId) {
    q = applyRentalOwnScope(q, opts.scopeToOwn.authUserId, opts.scopeToOwn.profileId);
  }
  if (opts?.dateFrom) q = q.gte('booking_date', opts.dateFrom);
  if (opts?.dateTo) q = q.lte('booking_date', opts.dateTo);
  const { data, error } = await q;
  if (error) return { data: [], error: error.message };
  return {
    data: (data || []).map((r: Record<string, unknown>) => {
      const customer = r.customer as { phone?: string | null; mobile?: string | null } | null;
      const customerPhone = customer ? getContactWhatsAppPhone(customer) : '';
      const bookingNo = String(r.booking_no || `RNT-${String(r.id ?? '').slice(0, 8)}`);
      const documentNumber = r.document_number != null ? String(r.document_number).trim() : '';
      const bookingDate = r.booking_date
        ? new Date(r.booking_date as string).toISOString().slice(0, 10)
        : r.pickup_date
          ? new Date(r.pickup_date as string).toISOString().slice(0, 10)
          : '';
      return {
        id: String(r.id ?? ''),
        bookingNo,
        documentNumber,
        no: bookingNo,
        customer: String(r.customer_name ?? '—'),
        customerPhone: customerPhone || undefined,
        pickup: r.pickup_date ? new Date(r.pickup_date as string).toISOString().slice(0, 10) : '—',
        return: r.return_date ? new Date(r.return_date as string).toISOString().slice(0, 10) : '—',
        status: mapRentalStatus(String(r.status ?? '')),
        total: Number(r.total_amount) || 0,
        paid: Number(r.paid_amount) || 0,
        due: Number(r.due_amount) || 0,
        bookingDate,
        createdBy: r.created_by != null ? String(r.created_by) : null,
        salesmanId: r.salesman_id != null ? String(r.salesman_id) : null,
        branchId: r.branch_id != null ? String(r.branch_id) : null,
      };
    }),
    error: null,
  };
}

/** Calendar availability: rentals with line items; no booking_date range (overlap filtered in UI). */
export async function getRentalsForCalendar(
  companyId: string,
  branchId?: string | null,
  opts?: Pick<GetRentalsOptions, 'accessibleBranchIds' | 'scopeToOwn'>,
): Promise<{ data: RentalCalendarRental[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  // Match list query columns only (production uses pickup_date/return_date; start_date may not exist).
  let q = supabase
    .from('rentals')
    .select(
      `id, booking_no, customer_name, status,
      booking_date, pickup_date, return_date,
      branch_id, created_by, salesman_id,
      items:rental_items(id, product_id, product_name)`,
    )
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(500);
  const branchIds = opts?.accessibleBranchIds?.filter(Boolean) ?? [];
  if (branchIds.length > 0) {
    q = q.in('branch_id', branchIds);
  } else if (branchId && branchId !== 'all' && branchId !== 'default') {
    q = q.eq('branch_id', branchId);
  }
  if (opts?.scopeToOwn?.authUserId) {
    q = applyRentalOwnScope(q, opts.scopeToOwn.authUserId, opts.scopeToOwn.profileId);
  }
  const { data, error } = await q;
  if (error) return { data: [], error: error.message };
  return {
    data: (data || []).map((r: Record<string, unknown>) => {
      const bookingNo = String(r.booking_no || `RNT-${String(r.id ?? '').slice(0, 8)}`);
      const start =
        rentalDateToYmd(r.pickup_date) ||
        rentalDateToYmd(r.booking_date);
      const end = rentalDateToYmd(r.return_date);
      const rawItems = (r.items as Array<Record<string, unknown>>) || [];
      return {
        id: String(r.id ?? ''),
        bookingNo,
        customerName: String(r.customer_name ?? ''),
        status: mapRentalStatus(String(r.status ?? '')),
        start,
        end,
        createdBy: r.created_by != null ? String(r.created_by) : null,
        salesmanId: r.salesman_id != null ? String(r.salesman_id) : null,
        branchId: r.branch_id != null ? String(r.branch_id) : null,
        items: rawItems.map((i) => ({
          productId: String(i.product_id ?? ''),
          productName: String(i.product_name ?? ''),
        })),
      };
    }),
    error: null,
  };
}

/** Patch manual bill ref / notes on draft or booked rentals only. */
export async function updateRentalMeta(
  rentalId: string,
  patch: UpdateRentalMetaInput
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) return { error: 'App not configured.' };
  const { data: row, error: fetchErr } = await supabase.from('rentals').select('status').eq('id', rentalId).maybeSingle();
  if (fetchErr || !row) return { error: fetchErr?.message ?? 'Rental not found.' };
  const st = String((row as { status?: string }).status ?? '').toLowerCase();
  if (!['draft', 'booked'].includes(st)) {
    return { error: 'Bill ref and notes can only be edited on draft or booked rentals.' };
  }
  const upd: Record<string, unknown> = {};
  if (patch.documentNumber !== undefined) {
    const v = patch.documentNumber != null ? String(patch.documentNumber).trim() : '';
    upd.document_number = v || null;
  }
  if (patch.notes !== undefined) upd.notes = patch.notes;
  if (Object.keys(upd).length === 0) return { error: null };
  const { error } = await supabase.from('rentals').update(upd).eq('id', rentalId);
  return { error: error?.message ?? null };
}

export async function getRentalById(rentalId: string): Promise<{ data: RentalDetail | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: 'App not configured.' };
  const { data: rental, error: rErr } = await supabase
    .from('rentals')
    .select('*, branch:branches(id, name, code), customer:contacts(id, name, phone, mobile)')
    .eq('id', rentalId)
    .single();
  if (rErr || !rental) return { data: null, error: rErr?.message ?? 'Rental not found.' };

  const { data: items, error: iErr } = await supabase
    .from('rental_items')
    .select('id, product_id, product_name, quantity, rate_per_day, duration_days, total')
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
  const customer = r.customer as { phone?: string | null; mobile?: string | null } | null;
  const itemList = (items || []) as Array<Record<string, unknown>>;
  const paymentList = (payments || []) as Array<Record<string, unknown>>;

  const bookingNo = String(r.booking_no || `RNT-${String(r.id).slice(0, 8)}`);
  const documentNumber =
    r.document_number != null && String(r.document_number).trim() !== ''
      ? String(r.document_number).trim()
      : null;

  return {
    data: {
      id: String(r.id),
      bookingNo,
      documentNumber,
      customerId: r.customer_id ? String(r.customer_id) : null,
      customerName: String(r.customer_name ?? ''),
      customerPhone: customer ? getContactWhatsAppPhone(customer) : undefined,
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
      securityDocumentType: (r.security_document_type as string) ?? null,
      securityDocumentNumber: (r.security_document_number as string) ?? null,
      securityDocumentImageUrl: (r.security_document_image_url as string) ?? null,
      securityStatus: (r.security_status as string) ?? null,
      pickupDocumentType: (r.document_type as string) ?? null,
      pickupDocumentNumber: (r.document_number as string) ?? null,
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
      payments: paymentList.map((p) => {
        const rawDate = p.payment_date ?? p.created_at;
        const paymentDate =
          typeof rawDate === 'string'
            ? rawDate.slice(0, 10)
            : rawDate instanceof Date
              ? rawDate.toISOString().slice(0, 10)
              : '';
        return {
          id: String(p.id),
          amount: Number(p.amount) ?? 0,
          method: String(p.method ?? ''),
          reference: (p.reference as string) ?? null,
          paymentDate,
        };
      }),
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

export interface AddRentalPaymentParams {
  rentalId: string;
  companyId: string;
  branchId?: string | null;
  amount: number;
  /** 'cash' | 'bank' | 'card' | 'wallet' | 'other' */
  method: string;
  reference?: string;
  notes?: string;
  /** Cash/Bank/Wallet account UUID (accounts table) selected by user. */
  paymentAccountId?: string | null;
  paymentDate?: string;
  paymentAt?: string | null;
  userId?: string | null;
}

export interface AddRentalPaymentResult {
  error: string | null;
  paymentId?: string | null;
  referenceNumber?: string | null;
}

/**
 * Record a rental payment with full accounting:
 *   1. Call record_payment_with_accounting (reference_type = 'rental')
 *        -> Dr selected cash/bank, Cr rental customer AR sub-account
 *        -> updates rentals.paid_amount / due_amount
 *   2. Insert a row into rental_payments for rental-module display parity.
 *
 * Backward compatible: when paymentAccountId is null, falls back to the
 * legacy path (rental_payments insert only) so existing callers keep working.
 */
export async function addRentalPayment(
  paramsOrId: AddRentalPaymentParams | string,
  legacyCompanyId?: string,
  legacyAmount?: number,
  legacyMethod?: string,
  legacyReference?: string,
  legacyUserId?: string | null,
): Promise<AddRentalPaymentResult> {
  if (!isSupabaseConfigured) return { error: 'App not configured.' };

  const params: AddRentalPaymentParams = typeof paramsOrId === 'string'
    ? {
        rentalId: paramsOrId,
        companyId: legacyCompanyId ?? '',
        amount: legacyAmount ?? 0,
        method: legacyMethod ?? 'cash',
        reference: legacyReference,
        userId: legacyUserId,
      }
    : paramsOrId;

  const { data: rental, error: fetchErr } = await supabase
    .from('rentals')
    .select('id, status, paid_amount, due_amount, booking_no, branch_id, customer_id')
    .eq('id', params.rentalId)
    .single();
  if (fetchErr || !rental) return { error: fetchErr?.message ?? 'Rental not found.' };
  const r = rental as Record<string, unknown>;
  const status = String(r.status ?? '');
  if (!['booked', 'rented', 'overdue', 'picked_up', 'active', 'returned', 'closed'].includes(status)) {
    return { error: 'Payment not allowed for this status.' };
  }

  const normalizedMethod = normalizePaymentMethod(params.method);
  const paymentDate = params.paymentDate ?? localNowDateString();
  const rawBranchId = params.branchId ?? (r.branch_id as string | null) ?? null;
  const bookingNo = String(r.booking_no || '').trim();
  const rentalPaymentRef =
    String(params.reference || '').trim() || (bookingNo ? formatRentalPaymentRef(bookingNo) : null);
  let paymentId: string | null = null;
  let referenceNumber: string | null = null;

  if (params.paymentAccountId && params.companyId) {
    let branchResolved: string;
    try {
      const preferRentalBranch = isRealBranchUuid(r.branch_id as string) ? String(r.branch_id) : null;
      branchResolved = await resolveBranchUuidForWrite(
        params.companyId,
        isRealBranchUuid(rawBranchId) ? rawBranchId : preferRentalBranch,
        'Branch required for rental payment.',
      );
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Branch required for rental payment.' };
    }
    // Pass reference_number as null so the DB trigger assigns a unique value atomically.
    // This avoids the "payments_reference_number_unique" race that occurred when two
    // quick payments independently fetched the same next-number from the client side.
    const { data: rpcData, error: rpcErr } = await supabase.rpc('record_payment_with_accounting', {
      p_company_id: params.companyId,
      p_branch_id: branchResolved,
      p_payment_type: 'received',
      p_reference_type: 'rental',
      p_reference_id: params.rentalId,
      p_amount: params.amount,
      p_payment_method: normalizedMethod === 'wallet' ? 'other' : normalizedMethod,
      p_payment_date: paymentDate,
      p_payment_account_id: params.paymentAccountId,
      p_reference_number: null,
      p_notes: params.notes ?? params.reference ?? null,
      p_created_by: params.userId ?? null,
      p_worker_stage_id: null,
    });

    if (rpcErr) return { error: rpcErr.message };
    const rpcRes = rpcData as { success?: boolean; payment_id?: string; reference_number?: string; error?: string };
    if (!rpcRes?.success) return { error: rpcRes?.error ?? 'Payment failed.' };
    paymentId = rpcRes.payment_id ?? null;
    referenceNumber = rpcRes.reference_number ?? null;

    if (!referenceNumber && paymentId) {
      try {
        const { data: row } = await supabase.from('payments').select('reference_number').eq('id', paymentId).maybeSingle();
        if (row && (row as { reference_number?: string }).reference_number) {
          referenceNumber = String((row as { reference_number?: string }).reference_number);
        }
      } catch {
        // best-effort only
      }
    }

    try {
      await supabase.from('rental_payments').insert({
        rental_id: params.rentalId,
        amount: params.amount,
        method: normalizedMethod,
        reference: rentalPaymentRef,
        payment_date: paymentDate,
        payment_type: 'remaining',
        payment_account_id: params.paymentAccountId ?? null,
        created_by: params.userId ?? null,
      });
    } catch {
      // rental_payments insert is informational; RPC already updated rentals totals.
    }

    if (paymentId && params.paymentAt) {
      const { patchPaymentCreatedAt } = await import('./paymentTimestamp');
      await patchPaymentCreatedAt(paymentId, params.paymentAt);
    }

    return { error: null, paymentId, referenceNumber };
  }

  await supabase.from('rental_payments').insert({
    rental_id: params.rentalId,
    amount: params.amount,
    method: normalizedMethod,
    reference: rentalPaymentRef,
    payment_date: paymentDate,
    payment_type: 'remaining',
    payment_account_id: params.paymentAccountId ?? null,
    created_by: params.userId ?? null,
  });

  const newPaid = (Number(r.paid_amount) ?? 0) + params.amount;
  const newDue = Math.max(0, (Number(r.due_amount) ?? 0) - params.amount);
  await supabase.from('rentals').update({ paid_amount: newPaid, due_amount: newDue }).eq('id', params.rentalId);
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

export async function deleteRental(rentalId: string, _companyId: string): Promise<{ error: string | null }> {
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

export async function cancelRental(rentalId: string, _companyId: string): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) return { error: 'App not configured.' };
  const { data: rental, error: fetchErr } = await supabase.from('rentals').select('id, status').eq('id', rentalId).single();
  if (fetchErr || !rental) return { error: fetchErr?.message ?? 'Rental not found.' };
  const r = rental as Record<string, unknown>;
  if (String(r.status) === 'cancelled') return { error: null };
  if (!['draft', 'booked'].includes(String(r.status))) return { error: 'Only draft or booked can be cancelled.' };
  const { error: updateErr } = await supabase.from('rentals').update({ status: 'cancelled' }).eq('id', rentalId);
  return { error: updateErr?.message ?? null };
}
