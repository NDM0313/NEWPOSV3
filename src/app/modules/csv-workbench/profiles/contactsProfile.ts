/**
 * Contacts CSV profile — parse, validate, per-row commit via contactService.
 */

import { parseCsvToStructured } from '../parseCsv';
import { serializeCsvMatrix } from '../serializeCsv';
import { DEFAULT_IMPORT_CHUNK_SIZE, runChunkedAllSettled } from '../chunkedCommit';
import type { CsvEntityProfile, CsvRowValidation, CsvWorkbenchResult, ParsedCsv } from '../types';
import { contactService, type Contact } from '@/app/services/contactService';

export const CONTACT_CANONICAL_HEADERS = [
  'name',
  'type',
  'email',
  'phone',
  'mobile',
  'address',
  'city',
  'state',
  'country',
  'postal_code',
  'notes',
  'opening_balance',
  'credit_limit',
  'payment_terms',
  'worker_role',
  'worker_default_rate',
] as const;

export const CONTACT_CSV_HEADER_ALIASES: Record<string, string> = {
  name: 'name',
  type: 'type',
  email: 'email',
  phone: 'phone',
  mobile: 'mobile',
  address: 'address',
  city: 'city',
  state: 'state',
  country: 'country',
  'postal code': 'postal_code',
  postal_code: 'postal_code',
  zip: 'postal_code',
  notes: 'notes',
  'opening balance': 'opening_balance',
  opening_balance: 'opening_balance',
  'credit limit': 'credit_limit',
  credit_limit: 'credit_limit',
  'payment terms': 'payment_terms',
  payment_terms: 'payment_terms',
  'worker role': 'worker_role',
  worker_role: 'worker_role',
  'worker default rate': 'worker_default_rate',
  worker_default_rate: 'worker_default_rate',
};

export type ContactCsvType = 'customer' | 'supplier' | 'both' | 'worker';

export interface ParsedContactRow {
  name: string;
  type: ContactCsvType;
  email?: string;
  phone?: string;
  mobile?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  notes?: string;
  opening_balance?: number;
  credit_limit?: number;
  payment_terms?: number;
  worker_role?: string;
  worker_default_rate?: number;
}

export type ParsedContactRowWithIndex = ParsedContactRow & {
  _sourceRowIndex: number;
  /** Present when CSV `type` cell is invalid; row is blocked from import */
  invalidTypeRaw?: string;
};

export interface ContactImportRowError {
  rowIndex: number;
  contactName: string;
  message: string;
  type: 'validation' | 'failed';
}

export interface ContactImportSummary {
  created: number;
  skipped: number;
  failed: number;
  errors: ContactImportRowError[];
}

export const CONTACT_VALID_TYPES: readonly ContactCsvType[] = ['customer', 'supplier', 'both', 'worker'];

const VALID_TYPES = new Set<ContactCsvType>(CONTACT_VALID_TYPES);

function buildHeaderIndexMap(headers: string[]): Record<string, number> {
  const colMap: Record<string, number> = {};
  headers.forEach((raw, i) => {
    const h = raw.trim().toLowerCase();
    const key = CONTACT_CSV_HEADER_ALIASES[h] ?? h.replace(/\s+/g, '_');
    colMap[key] = i;
  });
  return colMap;
}

function parseContactType(raw: string): ContactCsvType | null {
  const t = raw.trim().toLowerCase();
  if (t === 'supplier') return 'supplier';
  if (t === 'both') return 'both';
  if (t === 'worker' || t === 'wrk' || t === 'employee') return 'worker';
  if (t === 'customer' || t === '') return 'customer';
  return VALID_TYPES.has(t as ContactCsvType) ? (t as ContactCsvType) : null;
}

export function buildContactsBlankTemplate(): string {
  const emptyRow = CONTACT_CANONICAL_HEADERS.map(() => '');
  return serializeCsvMatrix([[...CONTACT_CANONICAL_HEADERS], emptyRow]);
}

export function buildContactsSampleTemplate(): string {
  return serializeCsvMatrix([
    [...CONTACT_CANONICAL_HEADERS],
    [
      'John Customer',
      'customer',
      'john@example.com',
      '0300-1234567',
      '',
      '123 Main St',
      'Karachi',
      '',
      'Pakistan',
      '',
      'Customer since 2024',
      '5000',
      '',
      '',
      '',
      '',
    ],
    [
      'Jane Supplier',
      'supplier',
      'jane@example.com',
      '0300-7654321',
      '',
      '456 Trade Ave',
      'Lahore',
      '',
      '',
      '',
      'Preferred supplier',
      '',
      '',
      '30',
      '',
      '',
    ],
    [
      'Studio Helper',
      'worker',
      '',
      '',
      '0300-9999999',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      'Tailor',
      '500',
    ],
  ]);
}

function rowsFromParsedCsvWithIndices(parsed: ParsedCsv): ParsedContactRowWithIndex[] {
  const header = parsed.headers.map((h) => h.trim().toLowerCase());
  const colMap = buildHeaderIndexMap(parsed.headers);
  const nameIdx = colMap.name ?? header.findIndex((h) => CONTACT_CSV_HEADER_ALIASES[h] === 'name');
  if (nameIdx < 0) return [];

  const out: ParsedContactRowWithIndex[] = [];
  for (let ri = 0; ri < parsed.rows.length; ri++) {
    const cells = parsed.rows[ri]!;
    const name = (cells[nameIdx] ?? '').trim();
    if (!name) continue;

    const typeRaw = (cells[colMap.type ?? -1] ?? 'customer').trim();
    const parsedType = parseContactType(typeRaw);
    const invalidTypeRaw = parsedType === null && typeRaw.length > 0 ? typeRaw : undefined;
    const type: ContactCsvType = parsedType ?? 'customer';

    const openingRaw = (cells[colMap.opening_balance ?? -1] ?? '').trim();
    let opening_balance: number | undefined;
    if (openingRaw !== '') {
      const ob = parseFloat(openingRaw);
      opening_balance = Number.isNaN(ob) ? undefined : ob;
    }
    const creditRaw = (cells[colMap.credit_limit ?? -1] ?? '').trim();
    const credit_limit = creditRaw ? parseFloat(creditRaw) : undefined;
    const termsRaw = (cells[colMap.payment_terms ?? -1] ?? '').trim();
    const payment_terms = termsRaw ? parseInt(termsRaw, 10) : undefined;
    const workerRateRaw = (cells[colMap.worker_default_rate ?? -1] ?? '').trim();
    const worker_default_rate = workerRateRaw ? parseFloat(workerRateRaw) : undefined;

    out.push({
      _sourceRowIndex: ri + 2,
      name,
      type,
      invalidTypeRaw,
      email: (cells[colMap.email ?? -1] ?? '').trim() || undefined,
      phone: (cells[colMap.phone ?? -1] ?? '').trim() || undefined,
      mobile: (cells[colMap.mobile ?? -1] ?? '').trim() || undefined,
      address: (cells[colMap.address ?? -1] ?? '').trim() || undefined,
      city: (cells[colMap.city ?? -1] ?? '').trim() || undefined,
      state: (cells[colMap.state ?? -1] ?? '').trim() || undefined,
      country: (cells[colMap.country ?? -1] ?? '').trim() || undefined,
      postal_code: (cells[colMap.postal_code ?? -1] ?? '').trim() || undefined,
      notes: (cells[colMap.notes ?? -1] ?? '').trim() || undefined,
      opening_balance: opening_balance !== undefined && !Number.isNaN(opening_balance) ? opening_balance : undefined,
      credit_limit: credit_limit !== undefined && !Number.isNaN(credit_limit) ? credit_limit : undefined,
      payment_terms: payment_terms !== undefined && !Number.isNaN(payment_terms) ? payment_terms : undefined,
      worker_role: (cells[colMap.worker_role ?? -1] ?? '').trim() || undefined,
      worker_default_rate:
        worker_default_rate !== undefined && !Number.isNaN(worker_default_rate) ? worker_default_rate : undefined,
    });
  }
  return out;
}

/**
 * Preview-time: rows with a name but an invalid `type` cell (not customer/supplier/both/worker aliases).
 * Empty type defaults to customer — no error.
 */
export function validateContactsRawTypes(parsed: ParsedCsv): CsvRowValidation[] {
  const header = parsed.headers.map((h) => h.trim().toLowerCase());
  const colMap = buildHeaderIndexMap(parsed.headers);
  const nameIdx = colMap.name ?? header.findIndex((h) => CONTACT_CSV_HEADER_ALIASES[h] === 'name');
  if (nameIdx < 0) return [];

  const issues: CsvRowValidation[] = [];
  const allowed = CONTACT_VALID_TYPES.join(', ');

  for (let ri = 0; ri < parsed.rows.length; ri++) {
    const cells = parsed.rows[ri]!;
    const name = (cells[nameIdx] ?? '').trim();
    if (!name) continue;

    const typeRaw = (cells[colMap.type ?? -1] ?? '').trim();
    if (!typeRaw) continue;

    const parsedType = parseContactType(typeRaw);
    if (parsedType === null) {
      issues.push({
        rowIndex: ri + 2,
        severity: 'error',
        field: 'type',
        message: `Invalid type "${typeRaw}". Use: ${allowed}`,
      });
    }
  }
  return issues;
}

export function validateContactsStructuralIndexed(rows: ParsedContactRowWithIndex[]): CsvRowValidation[] {
  const issues: CsvRowValidation[] = [];
  for (const r of rows) {
    if (!r.name.trim()) {
      issues.push({
        rowIndex: r._sourceRowIndex,
        severity: 'error',
        field: 'name',
        message: 'Name is required',
      });
    }
    if (!VALID_TYPES.has(r.type)) {
      issues.push({
        rowIndex: r._sourceRowIndex,
        severity: 'error',
        field: 'type',
        message: `Invalid contact type "${r.type}"`,
      });
    }
    if (r.opening_balance !== undefined && !Number.isFinite(r.opening_balance)) {
      issues.push({
        rowIndex: r._sourceRowIndex,
        severity: 'error',
        field: 'opening_balance',
        message: 'Opening balance must be a number',
      });
    }
    if (r.type === 'worker' && r.worker_default_rate !== undefined && !Number.isFinite(r.worker_default_rate)) {
      issues.push({
        rowIndex: r._sourceRowIndex,
        severity: 'error',
        field: 'worker_default_rate',
        message: 'Worker default rate must be a number',
      });
    }
  }
  return issues;
}

export function rowErrorsMapForContactPreview(
  rows: ParsedContactRowWithIndex[],
  validations: CsvRowValidation[]
): Map<number, CsvRowValidation[]> {
  const bySourceRow = new Map<number, CsvRowValidation[]>();
  for (const v of validations) {
    const list = bySourceRow.get(v.rowIndex) ?? [];
    list.push(v);
    bySourceRow.set(v.rowIndex, list);
  }
  const map = new Map<number, CsvRowValidation[]>();
  rows.forEach((r, i) => {
    const list = bySourceRow.get(r._sourceRowIndex);
    if (list?.length) map.set(i, list);
  });
  return map;
}

export function contactRowToPreviewRecord(row: ParsedContactRowWithIndex): Record<string, string | number> {
  return {
    name: row.name,
    type: row.invalidTypeRaw ? `${row.invalidTypeRaw} (invalid)` : row.type,
    email: row.email ?? '',
    phone: row.phone || row.mobile || '',
    city: row.city ?? '',
    opening_balance: row.opening_balance !== undefined ? row.opening_balance : '',
  };
}

function rowToContactPayload(
  row: ParsedContactRow,
  companyId: string
): Partial<Contact> & Record<string, unknown> {
  return {
    company_id: companyId,
    type: row.type,
    name: row.name.trim(),
    email: row.email,
    phone: row.phone,
    mobile: row.mobile,
    address: row.address,
    city: row.city,
    state: row.state,
    country: row.country,
    postal_code: row.postal_code,
    notes: row.notes,
    opening_balance: row.opening_balance,
    credit_limit: row.credit_limit,
    payment_terms: row.payment_terms,
    worker_role: row.worker_role,
    worker_default_rate: row.worker_default_rate,
    is_active: true,
  };
}

/** Per-row import — one failure does not abort the batch. Parallel chunks (same APIs). */
export async function commitContactImport(
  rows: ParsedContactRowWithIndex[],
  companyId: string
): Promise<ContactImportSummary> {
  const errors: ContactImportRowError[] = [];
  let created = 0;
  let failed = 0;
  let skipped = 0;

  const ready: ParsedContactRowWithIndex[] = [];
  for (const row of rows) {
    if (!row.name.trim()) {
      skipped++;
      errors.push({
        rowIndex: row._sourceRowIndex,
        contactName: row.name || '(empty)',
        message: 'Name is required',
        type: 'validation',
      });
      continue;
    }
    if (row.invalidTypeRaw) {
      skipped++;
      errors.push({
        rowIndex: row._sourceRowIndex,
        contactName: row.name,
        message: `Invalid type "${row.invalidTypeRaw}"`,
        type: 'validation',
      });
      continue;
    }
    ready.push(row);
  }

  const settled = await runChunkedAllSettled(
    ready,
    DEFAULT_IMPORT_CHUNK_SIZE,
    (row) => contactService.createContact(rowToContactPayload(row, companyId))
  );

  let ri = 0;
  for (const s of settled) {
    const row = ready[ri++]!;
    if (s.status === 'fulfilled') {
      created++;
    } else {
      failed++;
      const msg =
        s.reason instanceof Error ? s.reason.message : String(s.reason ?? 'Unknown error');
      errors.push({
        rowIndex: row._sourceRowIndex,
        contactName: row.name,
        message: msg,
        type: 'failed',
      });
    }
  }

  return { created, skipped, failed, errors };
}

export function parseContactsCsvFile(
  text: string
): CsvWorkbenchResult<{ parsed: ParsedCsv; rows: ParsedContactRowWithIndex[] }> {
  const structured = parseCsvToStructured(text);
  if ('error' in structured) {
    return { ok: false, error: structured.error };
  }
  const rows = rowsFromParsedCsvWithIndices(structured);
  return { ok: true, data: { parsed: structured, rows } };
}

/** Serialize contacts to canonical CSV (round-trip with import template). */
export function contactsToCanonicalCsv(
  contacts: Array<{
    name: string;
    type?: string;
    email?: string | null;
    phone?: string | null;
    mobile?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    postal_code?: string | null;
    notes?: string | null;
    opening_balance?: number | null;
    credit_limit?: number | null;
    payment_terms?: number | null;
    worker_role?: string | null;
    worker_default_rate?: number | null;
  }>
): string {
  const dataRows = contacts.map((c) =>
    CONTACT_CANONICAL_HEADERS.map((h) => {
      const v = (c as Record<string, unknown>)[h];
      if (v === null || v === undefined) return '';
      return String(v);
    })
  );
  return serializeCsvMatrix([[...CONTACT_CANONICAL_HEADERS], ...dataRows]);
}

const contactsProfileEntity: CsvEntityProfile<{ parsed: ParsedCsv; rows: ParsedContactRowWithIndex[] }> = {
  id: 'contacts',
  displayName: 'Contacts',
  canonicalHeaders: [...CONTACT_CANONICAL_HEADERS],
  buildBlankTemplate: buildContactsBlankTemplate,
  parseFile: parseContactsCsvFile,
  isImplemented: true,
};

export { contactsProfileEntity as contactsProfile };
