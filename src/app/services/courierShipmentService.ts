/**
 * Wholesale: Courier shipments (Step 5).
 * One shipment per packing list; links to couriers table. Print: CourierSlipTemplate.
 */
import { supabase } from '@/lib/supabase';

export interface CourierShipmentRow {
  id: string;
  company_id: string;
  packing_list_id: string;
  courier_id: string | null;
  tracking_number: string | null;
  shipment_cost: number;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  courier?: { id: string; name: string; tracking_url: string | null } | null;
}

export interface CreateCourierShipmentPayload {
  companyId: string;
  packingListId: string;
  courierId?: string | null;
  trackingNumber?: string | null;
  shipmentCost?: number;
  notes?: string | null;
  createdBy?: string | null;
}

export const courierShipmentService = {
  async listByPackingList(packingListId: string): Promise<CourierShipmentRow[]> {
    const { data, error } = await supabase
      .from('courier_shipments')
      .select('*, courier:couriers(id, name, tracking_url)')
      .eq('packing_list_id', packingListId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map((r: any) => ({
      ...r,
      courier: r.courier ?? null,
    })) as CourierShipmentRow[];
  },

  async listByCompany(companyId: string, options?: { status?: string; limit?: number }): Promise<CourierShipmentRow[]> {
    let q = supabase
      .from('courier_shipments')
      .select('*, courier:couriers(id, name, tracking_url)')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    if (options?.status) q = q.eq('status', options.status);
    if (options?.limit) q = q.limit(options.limit);
    const { data, error } = await q;
    if (error) throw error;
    return (data || []).map((r: any) => ({
      ...r,
      courier: r.courier ?? null,
    })) as CourierShipmentRow[];
  },

  async getById(id: string): Promise<CourierShipmentRow | null> {
    const { data, error } = await supabase
      .from('courier_shipments')
      .select('*, courier:couriers(id, name, tracking_url)')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const r = data as any;
    return { ...r, courier: r.courier ?? null } as CourierShipmentRow;
  },

  async create(payload: CreateCourierShipmentPayload): Promise<CourierShipmentRow> {
    const { data, error } = await supabase
      .from('courier_shipments')
      .insert({
        company_id: payload.companyId,
        packing_list_id: payload.packingListId,
        courier_id: payload.courierId ?? null,
        tracking_number: payload.trackingNumber ?? null,
        shipment_cost: payload.shipmentCost ?? 0,
        status: 'pending',
        notes: payload.notes ?? null,
        created_by: payload.createdBy ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return data as CourierShipmentRow;
  },

  async update(
    id: string,
    updates: Partial<Pick<CourierShipmentRow, 'courier_id' | 'tracking_number' | 'shipment_cost' | 'status' | 'notes'>>
  ): Promise<void> {
    const { error } = await supabase
      .from('courier_shipments')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('courier_shipments').delete().eq('id', id);
    if (error) throw error;
  },
};
