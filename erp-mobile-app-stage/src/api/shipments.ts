/**
 * Sale shipments for mobile (create shipment: courier, tracking, cost, weight).
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface CreateShipmentPayload {
  courierId?: string | null;
  trackingNumber?: string | null;
  shipmentCost?: number;
  weight?: number | null;
  shipmentStatus?: string | null;
  shipmentType?: 'Courier' | 'Local';
  chargedToCustomer?: number;
  bookingDate?: string | null;
  expectedDeliveryDate?: string | null;
}

export async function listRecentSaleShipments(
  companyId: string,
  limit = 100,
): Promise<{ data: Array<Record<string, unknown>>; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  const { data, error } = await supabase
    .from('sale_shipments')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return { data: [], error: error.message };
  return { data: data || [], error: null };
}

export async function getShipmentsBySaleId(saleId: string): Promise<{ data: Array<Record<string, unknown>>; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  const { data, error } = await supabase
    .from('sale_shipments')
    .select('*')
    .eq('sale_id', saleId)
    .order('created_at', { ascending: true });
  if (error) return { data: [], error: error.message };
  return { data: data || [], error: null };
}

export async function createShipment(
  saleId: string,
  companyId: string,
  branchId: string,
  payload: CreateShipmentPayload,
  createdBy?: string | null
): Promise<{ data: { id: string } | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: 'App not configured.' };
  let courierId: string | null = null;
  if (payload.courierId) {
    const { data: courier } = await supabase
      .from('couriers')
      .select('contact_id')
      .eq('id', payload.courierId)
      .maybeSingle();
    courierId = (courier as { contact_id?: string } | null)?.contact_id ?? null;
  }
  const cost = Number(payload.shipmentCost) || 0;
  const charged = Number(payload.chargedToCustomer ?? cost) || cost;
  const shipType = payload.shipmentType === 'Local' ? 'Local' : 'Courier';
  const row = {
    sale_id: saleId,
    company_id: companyId,
    branch_id: branchId,
    shipment_type: shipType,
    courier_id: courierId,
    courier_master_id: payload.courierId ?? null,
    courier_name: null,
    weight: payload.weight != null ? payload.weight : null,
    shipment_status: payload.shipmentStatus && ['Booked', 'Picked', 'In Transit', 'Out for Delivery', 'Delivered', 'Returned', 'Cancelled'].includes(payload.shipmentStatus) ? payload.shipmentStatus : 'Booked',
    tracking_id: payload.trackingNumber ?? null,
    tracking_url: null,
    actual_cost: cost,
    charged_to_customer: charged,
    booking_date: payload.bookingDate ?? new Date().toISOString().slice(0, 10),
    expected_delivery_date: payload.expectedDeliveryDate ?? null,
    currency: 'PKR',
    created_by: createdBy ?? null,
    updated_by: createdBy ?? null,
  };
  const { data, error } = await supabase
    .from('sale_shipments')
    .insert(row)
    .select('id')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as { id: string }, error: null };
}

export async function updateShipment(
  shipmentId: string,
  payload: Partial<CreateShipmentPayload>,
  updatedBy?: string | null,
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) return { error: 'App not configured.' };
  const patch: Record<string, unknown> = { updated_by: updatedBy ?? null };
  if (payload.shipmentStatus != null) patch.shipment_status = payload.shipmentStatus;
  if (payload.trackingNumber !== undefined) patch.tracking_id = payload.trackingNumber;
  if (payload.shipmentCost !== undefined) patch.actual_cost = payload.shipmentCost;
  if (payload.chargedToCustomer !== undefined) patch.charged_to_customer = payload.chargedToCustomer;
  if (payload.bookingDate !== undefined) patch.booking_date = payload.bookingDate;
  if (payload.expectedDeliveryDate !== undefined) patch.expected_delivery_date = payload.expectedDeliveryDate;
  const { error } = await supabase.from('sale_shipments').update(patch).eq('id', shipmentId);
  if (error) return { error: error.message };
  return { error: null };
}
