import { getCompanyBrand, type CompanyBrand } from '../api/reports';
import { getMergedPrintingSettings, type ReceiptFieldToggles } from '../api/printingSettings';
import { toLocalDateString } from '../utils/localDate';

export interface SaleThermalInput {
  companyId: string;
  invoiceNo: string;
  invoiceDate: string;
  customerName: string;
  customerPhone?: string | null;
  items: Array<{ productName: string; quantity: number; total: number }>;
  subtotal: number;
  discount: number;
  tax: number;
  studioCharges: number;
  /** Sale amount before studio add-on */
  saleAmount: number;
  /** Grand total (sale + studio when applicable) */
  grandTotal: number;
  paid: number;
  due: number;
  notes?: string | null;
  generatedBy?: string | null;
}

function wrapLine(text: string, maxChars: number): string[] {
  const t = text.trim();
  if (t.length <= maxChars) return [t];
  const out: string[] = [];
  let rest = t;
  while (rest.length > maxChars) {
    let breakAt = rest.lastIndexOf(' ', maxChars);
    if (breakAt < 8) breakAt = maxChars;
    out.push(rest.slice(0, breakAt).trim());
    rest = rest.slice(breakAt).trim();
  }
  if (rest) out.push(rest);
  return out;
}

function fmtMoney(n: number): string {
  return `Rs. ${(Math.abs(n) < 0.005 ? 0 : n).toLocaleString('en-PK', { maximumFractionDigits: 0 })}`;
}

function headerLines(brand: CompanyBrand, fields: ReceiptFieldToggles, maxChars: number): string[] {
  const lines: string[] = [];
  if (fields.showLogo && brand.logoUrl) {
    lines.push('[LOGO]');
  }
  lines.push(brand.name.toUpperCase());
  if (fields.showCompanyAddress && brand.address) {
    lines.push(...wrapLine(brand.address, maxChars));
  }
  const cityLine = [brand.city, brand.country].filter(Boolean).join(', ');
  if (fields.showCompanyAddress && cityLine) lines.push(cityLine);
  if (fields.showPhone && brand.phone) lines.push(`Tel: ${brand.phone}`);
  if (fields.showEmail && brand.email) lines.push(brand.email);
  lines.push('--------------------------------');
  return lines;
}

/**
 * Build ESC/POS text lines for a sale invoice (58mm / 80mm).
 * Discount / tax / studio lines omitted when zero (saves paper).
 */
export async function buildSaleThermalReceiptLines(
  input: SaleThermalInput,
  paperSize: '58mm' | '80mm' = '80mm',
): Promise<string[]> {
  const maxChars = paperSize === '58mm' ? 32 : 42;
  const [brand, { data: settings }] = await Promise.all([
    getCompanyBrand(input.companyId),
    getMergedPrintingSettings(input.companyId),
  ]);
  const fields = settings.fields;

  const lines: string[] = [
    ...headerLines(brand, fields, maxChars),
    'INVOICE',
    `No: ${input.invoiceNo}`,
    `Date: ${toLocalDateString(input.invoiceDate)}`,
    '',
    'Bill To:',
    ...wrapLine(input.customerName, maxChars),
  ];
  if (input.customerPhone?.trim()) {
    lines.push(...wrapLine(input.customerPhone.trim(), maxChars));
  }
  lines.push('--------------------------------');

  for (const it of input.items) {
    const name = it.productName || 'Item';
    lines.push(...wrapLine(name, maxChars));
    lines.push(`  ${Number(it.quantity).toFixed(2)} x ${fmtMoney(it.total)}`);
  }

  lines.push('--------------------------------');
  lines.push(`Subtotal: ${fmtMoney(input.subtotal)}`);

  if (fields.showDiscount && input.discount > 0.005) {
    lines.push(`Discount: -${fmtMoney(input.discount)}`);
  }
  if (fields.showTax && input.tax > 0.005) {
    lines.push(`Tax: ${fmtMoney(input.tax)}`);
  }
  if (fields.showStudioCost && input.studioCharges > 0.005) {
    lines.push(`Studio: ${fmtMoney(input.studioCharges)}`);
  }

  lines.push(`TOTAL: ${fmtMoney(input.grandTotal)}`);
  lines.push(`Paid: ${fmtMoney(input.paid)}`);
  if (input.due > 0.005) {
    lines.push(`Due: ${fmtMoney(input.due)}`);
  }

  if (fields.showNotes && input.notes?.trim()) {
    lines.push('--------------------------------');
    lines.push(...wrapLine(`Note: ${input.notes.trim()}`, maxChars));
  }
  if (input.generatedBy?.trim()) {
    lines.push(`By: ${input.generatedBy.trim()}`);
  }

  lines.push('', 'Thank you!', '');
  return lines;
}

/** Map SalesHome sale record to thermal input. */
export function saleRecordToThermalInput(
  companyId: string,
  raw: Record<string, unknown>,
  displayNo: string,
  customerName: string,
  createdByName?: string,
): SaleThermalInput {
  const itemsRaw = (raw.items as Array<Record<string, unknown>>) || [];
  const items = itemsRaw.map((it) => ({
    productName: String(
      it.product_name ?? (it.product as { name?: string } | null)?.name ?? 'Item',
    ),
    quantity: Number(it.quantity ?? 0),
    total: Number(it.total ?? 0),
  }));

  const subtotal = Number(raw.subtotal ?? raw.total_amount ?? raw.total ?? 0);
  const discount = Number(raw.discount_amount ?? raw.discount ?? 0);
  const tax = Number(raw.tax_amount ?? 0);
  const studioCharges = Number(raw.studio_charges ?? 0);
  const saleAmount = Number(raw.total_amount ?? raw.total ?? subtotal);
  const grandTotal = Number(raw.grand_total ?? saleAmount + studioCharges);
  const paid = Number(raw.total_received ?? raw.paid_amount ?? 0);
  const due = Number(raw.balance_due ?? Math.max(0, grandTotal - paid));

  const cust = raw.customer as { phone?: string } | null;

  return {
    companyId,
    invoiceNo: displayNo,
    invoiceDate: String(raw.invoice_date || raw.created_at || ''),
    customerName,
    customerPhone:
      cust?.phone ?? (raw.contact_phone as string) ?? (raw.contact_number as string) ?? null,
    items: items.length ? items : [{ productName: 'Sale', quantity: 1, total: saleAmount }],
    subtotal,
    discount,
    tax,
    studioCharges,
    saleAmount,
    grandTotal,
    paid,
    due,
    notes: (raw.notes as string) || null,
    generatedBy: createdByName || null,
  };
}
