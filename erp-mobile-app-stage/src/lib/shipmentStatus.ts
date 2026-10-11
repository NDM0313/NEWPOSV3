/** Map courier_shipments.status (snake) to sale_shipments.shipment_status (title case). */
export const COURIER_STATUS_STEPS = [
  { key: 'booked', label: 'Booked' },
  { key: 'dispatched', label: 'Dispatched' },
  { key: 'in_transit', label: 'In Transit' },
  { key: 'delivered', label: 'Delivered' },
] as const;

export type CourierStatusKey = (typeof COURIER_STATUS_STEPS)[number]['key'];

export function courierStatusToSaleStatus(courierStatus: string): string {
  const s = courierStatus.toLowerCase().replace(/\s+/g, '_');
  if (s === 'in_transit') return 'In Transit';
  if (s === 'dispatched') return 'Dispatched';
  if (s === 'delivered') return 'Delivered';
  if (s === 'booked') return 'Booked';
  if (s === 'pending') return 'Pending';
  return 'Booked';
}

export function saleStatusToCourierStatus(saleStatus: string): string {
  const s = saleStatus.toLowerCase();
  if (s === 'in transit') return 'in_transit';
  if (s === 'dispatched') return 'dispatched';
  if (s === 'delivered') return 'delivered';
  if (s === 'booked') return 'booked';
  return 'booked';
}

export function nextCourierStatus(current: string): CourierStatusKey | null {
  const norm = current.toLowerCase().replace(/\s+/g, '_');
  const idx = COURIER_STATUS_STEPS.findIndex((x) => x.key === norm);
  if (idx < 0) return 'booked';
  if (idx >= COURIER_STATUS_STEPS.length - 1) return null;
  return COURIER_STATUS_STEPS[idx + 1].key;
}

export function statusLabel(status: string): string {
  const step = COURIER_STATUS_STEPS.find((x) => x.key === status.toLowerCase().replace(/\s+/g, '_'));
  return step?.label ?? status.replace(/_/g, ' ');
}
