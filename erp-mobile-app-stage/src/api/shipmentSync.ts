/**
 * Keep sale_shipments in sync with courier_shipments for GL posting (reference_type=shipment).
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { CourierShipmentRow } from './courierShipments';
import { courierStatusToSaleStatus } from '../lib/shipmentStatus';
import { postSaleShipmentJournal } from './shipmentAccounting';

export interface SyncSaleShipmentResult {
  saleShipmentId: string | null;
  journalEntryId?: string | null;
  glError?: string | null;
  glSkipped?: boolean;
}

export async function syncSaleShipmentFromCourier(params: {
  courier: CourierShipmentRow;
  saleId: string;
  companyId: string;
  branchId: string;
  dbUserId?: string | null;
  chargedToCustomer?: number;
  courierMasterId?: string | null;
}): Promise<{ data: SyncSaleShipmentResult | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: 'App not configured.' };
  const { courier, saleId, companyId, branchId, dbUserId, chargedToCustomer, courierMasterId } = params;
  const cost = Number(courier.shipment_cost) || 0;
  const charged = chargedToCustomer ?? cost;
  const saleStatus = courierStatusToSaleStatus(courier.status);
  const bookingDate = (courier as CourierShipmentRow & { booking_date?: string }).booking_date
    ?? courier.created_at?.slice(0, 10)
    ?? new Date().toISOString().slice(0, 10);
  const expectedDelivery = (courier as CourierShipmentRow & { expected_delivery_date?: string | null })
    .expected_delivery_date ?? null;

  let courierContactId: string | null = null;
  let courierName: string | null = courier.courier?.name ?? null;
  const cmId = courierMasterId ?? courier.courier_id;
  if (cmId) {
    const { data: cRow } = await supabase
      .from('couriers')
      .select('contact_id, name')
      .eq('id', cmId)
      .maybeSingle();
    courierContactId = (cRow as { contact_id?: string } | null)?.contact_id ?? null;
    courierName = (cRow as { name?: string } | null)?.name ?? courierName;
  }

  const { data: existing } = await supabase
    .from('sale_shipments')
    .select('id')
    .eq('sale_id', saleId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const row = {
    sale_id: saleId,
    company_id: companyId,
    branch_id: branchId,
    shipment_type: 'Courier',
    courier_id: courierContactId,
    courier_master_id: cmId ?? null,
    courier_name: courierName,
    shipment_status: saleStatus,
    tracking_id: courier.tracking_number ?? null,
    actual_cost: cost,
    charged_to_customer: charged,
    booking_date: bookingDate,
    expected_delivery_date: expectedDelivery,
    currency: 'PKR',
    updated_by: dbUserId ?? null,
  };

  let saleShipmentId: string | null = (existing as { id?: string } | null)?.id ?? null;

  if (saleShipmentId) {
    const { error: upErr } = await supabase.from('sale_shipments').update(row).eq('id', saleShipmentId);
    if (upErr) return { data: null, error: upErr.message };
  } else {
    const { data: ins, error: insErr } = await supabase
      .from('sale_shipments')
      .insert({ ...row, created_by: dbUserId ?? null })
      .select('id')
      .single();
    if (insErr) return { data: null, error: insErr.message };
    saleShipmentId = (ins as { id: string }).id;
  }

  const gl = await postSaleShipmentJournal(saleShipmentId!, dbUserId ?? null);
  return {
    data: {
      saleShipmentId,
      journalEntryId: gl.journalEntryId,
      glError: gl.success ? null : gl.error ?? 'GL posting failed',
      glSkipped: gl.skipped,
    },
    error: null,
  };
}

export async function updateCourierAndSyncSale(params: {
  courierShipmentId: string;
  saleId: string;
  companyId: string;
  branchId: string;
  dbUserId?: string | null;
  updates: {
    status?: string;
    tracking_number?: string | null;
    shipment_cost?: number;
    booking_date?: string | null;
    expected_delivery_date?: string | null;
    notes?: string | null;
  };
  chargedToCustomer?: number;
}): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) return { error: 'App not configured.' };
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (params.updates.status != null) {
    patch.status = params.updates.status;
    if (params.updates.status === 'dispatched') patch.dispatched_at = new Date().toISOString();
    if (params.updates.status === 'delivered') patch.delivered_at = new Date().toISOString();
  }
  if (params.updates.tracking_number !== undefined) patch.tracking_number = params.updates.tracking_number;
  if (params.updates.shipment_cost !== undefined) patch.shipment_cost = params.updates.shipment_cost;
  if (params.updates.booking_date !== undefined) patch.booking_date = params.updates.booking_date;
  if (params.updates.expected_delivery_date !== undefined) {
    patch.expected_delivery_date = params.updates.expected_delivery_date;
  }
  if (params.updates.notes !== undefined) patch.notes = params.updates.notes;

  const { data: cs, error: upErr } = await supabase
    .from('courier_shipments')
    .update(patch)
    .eq('id', params.courierShipmentId)
    .select('*, courier:couriers(id, name, tracking_url)')
    .single();
  if (upErr) return { error: upErr.message };

  const syncRes = await syncSaleShipmentFromCourier({
    courier: cs as CourierShipmentRow,
    saleId: params.saleId,
    companyId: params.companyId,
    branchId: params.branchId,
    dbUserId: params.dbUserId,
    chargedToCustomer: params.chargedToCustomer,
  });
  if (syncRes.error) return { error: syncRes.error };
  return { error: null };
}
