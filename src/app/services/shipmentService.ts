import { supabase } from '@/lib/supabase';
import {
  shipmentAccountingService,
  ensureCourierContact,
  logShipmentHistory,
} from './shipmentAccountingService';

export type ShipmentType = 'Local' | 'Courier';
export type ShipmentStatus =
  | 'Created'
  | 'Packed'
  | 'Pending'
  | 'Booked'
  | 'Dispatched'
  | 'In Transit'
  | 'Delivered'
  | 'Returned'
  | 'Cancelled';

export interface SaleShipmentRow {
  id: string;
  sale_id: string;
  company_id: string;
  branch_id: string;
  shipment_type: ShipmentType;
  courier_id?: string | null;
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
  courier_id?: string;
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
    courierId: r.courier_id ?? undefined,
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
    createdBy?: string | null,
    invoiceNo?: string
  ): Promise<SaleShipmentRow> {
    // Auto-create courier contact if name provided but id not supplied
    let courierId = payload.courier_id ?? null;
    if (!courierId && payload.courier_name) {
      courierId = await ensureCourierContact(payload.courier_name, companyId);
    }

    const row = {
      sale_id: saleId,
      company_id: companyId,
      branch_id: branchId,
      shipment_type: payload.shipment_type,
      courier_id: courierId,
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

    const shipment = data as SaleShipmentRow;

    // Create journal entries (fire-and-forget — don't fail shipment creation)
    void shipmentAccountingService.createShipmentJournalEntry({
      shipmentId: shipment.id,
      companyId,
      branchId,
      chargedToCustomer: shipment.charged_to_customer,
      actualCost: shipment.actual_cost,
      courierId: shipment.courier_id ?? undefined,
      courierName: shipment.courier_name,
      invoiceNo,
      performedBy: createdBy,
    });

    // Log shipment history
    void logShipmentHistory({
      shipmentId: shipment.id,
      companyId,
      status: 'Shipment Created',
      trackingNumber: shipment.tracking_id,
      courierName: shipment.courier_name,
      chargedToCustomer: shipment.charged_to_customer,
      actualCost: shipment.actual_cost,
      notes: payload.notes,
      createdBy,
    });

    return shipment;
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
    if (payload.courier_id != null) update.courier_id = payload.courier_id;
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

    const shipment = data as SaleShipmentRow;

    // Log history event based on what changed
    const historyStatus = payload.shipment_status
      ? `Status: ${payload.shipment_status}`
      : payload.tracking_id
        ? 'Tracking Updated'
        : 'Shipment Updated';

    void logShipmentHistory({
      shipmentId: shipment.id,
      companyId: shipment.company_id,
      status: historyStatus,
      trackingNumber: shipment.tracking_id,
      courierName: shipment.courier_name,
      chargedToCustomer: shipment.charged_to_customer,
      actualCost: shipment.actual_cost,
      notes: typeof payload.notes === 'string' ? payload.notes : undefined,
      createdBy: updatedBy,
    });

    return shipment;
  },

  async delete(id: string, performedBy?: string | null): Promise<void> {
    // Fetch shipment before deleting to reverse journal entries
    const { data: existing } = await supabase
      .from('sale_shipments')
      .select('company_id, branch_id, courier_name, charged_to_customer, actual_cost')
      .eq('id', id)
      .maybeSingle();

    if (existing) {
      void shipmentAccountingService.reverseShipmentJournalEntry({
        shipmentId: id,
        companyId: existing.company_id,
        branchId: existing.branch_id,
        chargedToCustomer: Number(existing.charged_to_customer) || 0,
        actualCost: Number(existing.actual_cost) || 0,
        courierName: existing.courier_name,
        performedBy,
      });
    }

    const { error } = await supabase.from('sale_shipments').delete().eq('id', id);
    if (error) throw error;
  },

  /**
   * Get shipment history for a shipment.
   */
  async getHistory(shipmentId: string) {
    return shipmentAccountingService.getShipmentHistory(shipmentId);
  },
};

export function mapShipmentRowsToUi(rows: SaleShipmentRow[]) {
  return rows.map(rowToShipment);
}
