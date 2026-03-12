/**
 * Sale shipments for mobile (create shipment: courier, tracking, cost, weight).
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface CreateShipmentPayload {
  courierId?: string | null;   // couriers.id (courier_master_id)
  trackingNumber?: string | null;
  shipmentCost?: number;
  weight?: number | null;
  shipmentStatus?: string | null; // Booked, Picked, In Transit, Out for Delivery, Delivered, Returned, Cancelled
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
  const row = {
    sale_id: saleId,
    company_id: companyId,
    branch_id: branchId,
    shipment_type: 'Courier',
    courier_id: courierId,
    courier_master_id: payload.courierId ?? null,
    courier_name: null,
    weight: payload.weight != null ? payload.weight : null,
    shipment_status: payload.shipmentStatus && ['Booked', 'Picked', 'In Transit', 'Out for Delivery', 'Delivered', 'Returned', 'Cancelled'].includes(payload.shipmentStatus) ? payload.shipmentStatus : 'Booked',
    tracking_id: payload.trackingNumber ?? null,
    tracking_url: null,
    actual_cost: cost,
    charged_to_customer: cost,
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
