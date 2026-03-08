import { supabase } from '@/lib/supabase';

export type ShipmentType = 'Local' | 'Courier';
export type ShipmentStatus = 'Pending' | 'Booked' | 'Dispatched' | 'Delivered';

export interface SaleShipmentRow {
  id: string;
  sale_id: string;
  company_id: string;
  branch_id: string;
  shipment_type: ShipmentType;
  courier_name?: string | null;
  shipment_status: ShipmentStatus;
  tracking_id?: string | null;
  tracking_url?: string | null;
  tracking_documents?: { id: string; name: string; type: string; url: string; uploadedAt: string }[] | null;
  booking_date?: string | null;
  expected_delivery_date?: string | null;
  actual_delivery_date?: string | null;
  actual_cost: number;
  charged_to_customer: number;
  currency: string;
  usd_to_pkr_rate?: number | null;
  rider_phone?: string | null;
  delivery_area?: string | null;
  notes?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CreateShipmentPayload {
  shipment_type: ShipmentType;
  courier_name?: string;
  shipment_status?: ShipmentStatus;
  tracking_id?: string;
  tracking_url?: string;
  actual_cost: number;
  charged_to_customer: number;
  currency?: string;
  usd_to_pkr_rate?: number;
  rider_phone?: string;
  delivery_area?: string;
  notes?: string;
  booking_date?: string;
  expected_delivery_date?: string;
  actual_delivery_date?: string;
}

function rowToShipment(r: SaleShipmentRow) {
  return {
    id: r.id,
    shipmentType: r.shipment_type as ShipmentType,
    courierName: r.courier_name ?? undefined,
    shipmentStatus: r.shipment_status as ShipmentStatus,
    trackingId: r.tracking_id ?? undefined,
    trackingUrl: r.tracking_url ?? undefined,
    trackingDocuments: Array.isArray(r.tracking_documents) ? r.tracking_documents : [],
    bookingDate: r.booking_date ?? undefined,
    expectedDeliveryDate: r.expected_delivery_date ?? undefined,
    actualDeliveryDate: r.actual_delivery_date ?? undefined,
    actualCost: Number(r.actual_cost) || 0,
    chargedToCustomer: Number(r.charged_to_customer) || 0,
    currency: r.currency || 'PKR',
    usdToPkrRate: r.usd_to_pkr_rate != null ? Number(r.usd_to_pkr_rate) : undefined,
    riderPhone: r.rider_phone ?? undefined,
    deliveryArea: r.delivery_area ?? undefined,
    notes: r.notes ?? undefined,
  };
}

export const shipmentService = {
  async getBySaleId(saleId: string): Promise<SaleShipmentRow[]> {
    const { data, error } = await supabase
      .from('sale_shipments')
      .select('*')
      .eq('sale_id', saleId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data || []) as SaleShipmentRow[];
  },

  async create(
    saleId: string,
    companyId: string,
    branchId: string,
    payload: CreateShipmentPayload,
    createdBy?: string | null
  ): Promise<SaleShipmentRow> {
    const row = {
      sale_id: saleId,
      company_id: companyId,
      branch_id: branchId,
      shipment_type: payload.shipment_type,
      courier_name: payload.courier_name || null,
      shipment_status: payload.shipment_status || 'Pending',
      tracking_id: payload.tracking_id || null,
      tracking_url: payload.tracking_url || null,
      actual_cost: payload.actual_cost ?? 0,
      charged_to_customer: payload.charged_to_customer ?? 0,
      currency: payload.currency || 'PKR',
      usd_to_pkr_rate: payload.usd_to_pkr_rate ?? null,
      rider_phone: payload.rider_phone || null,
      delivery_area: payload.delivery_area || null,
      notes: payload.notes || null,
      booking_date: payload.booking_date || null,
      expected_delivery_date: payload.expected_delivery_date || null,
      actual_delivery_date: payload.actual_delivery_date || null,
      created_by: createdBy || null,
      updated_by: createdBy || null,
    };
    const { data, error } = await supabase
      .from('sale_shipments')
      .insert(row)
      .select()
      .single();
    if (error) throw error;
    return data as SaleShipmentRow;
  },

  async update(
    id: string,
    payload: Partial<CreateShipmentPayload> & { tracking_documents?: any },
    updatedBy?: string | null
  ): Promise<SaleShipmentRow> {
    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      updated_by: updatedBy || null,
    };
    if (payload.shipment_type != null) update.shipment_type = payload.shipment_type;
    if (payload.courier_name != null) update.courier_name = payload.courier_name;
    if (payload.shipment_status != null) update.shipment_status = payload.shipment_status;
    if (payload.tracking_id != null) update.tracking_id = payload.tracking_id;
    if (payload.tracking_url != null) update.tracking_url = payload.tracking_url;
    if (payload.actual_cost != null) update.actual_cost = payload.actual_cost;
    if (payload.charged_to_customer != null) update.charged_to_customer = payload.charged_to_customer;
    if (payload.currency != null) update.currency = payload.currency;
    if (payload.usd_to_pkr_rate != null) update.usd_to_pkr_rate = payload.usd_to_pkr_rate;
    if (payload.notes != null) update.notes = payload.notes;
    if (payload.tracking_documents != null) update.tracking_documents = payload.tracking_documents;

    const { data, error } = await supabase
      .from('sale_shipments')
      .update(update)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as SaleShipmentRow;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('sale_shipments').delete().eq('id', id);
    if (error) throw error;
  },
};

export function mapShipmentRowsToUi(rows: SaleShipmentRow[]) {
  return rows.map(rowToShipment);
}
