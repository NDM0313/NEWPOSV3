/**
 * Payment-first trace layout (Phase C5) — pure composition over Transaction Trace data.
 */
import type { TransactionTraceResult } from '@/app/services/accountingDeveloperCenterService';

export interface PaymentTraceSection {
  id: string;
  title: string;
  rows: { label: string; value: string }[];
}

export interface PaymentTraceView {
  query: string;
  primaryPaymentId: string | null;
  primaryPaymentRef: string | null;
  sections: PaymentTraceSection[];
  reportVisibilitySummary: string;
}

export function buildPaymentTraceView(trace: TransactionTraceResult, query: string): PaymentTraceView {
  const primary =
    trace.payments.find((p) =>
      [p.reference_number, p.id].some((v) => v && String(v).toLowerCase().includes(query.trim().toLowerCase()))
    ) ?? trace.payments[0] ?? null;

  const sections: PaymentTraceSection[] = [];

  if (primary) {
    sections.push({
      id: 'payment',
      title: 'Payment (primary)',
      rows: [
        { label: 'ID', value: primary.id },
        { label: 'Reference', value: primary.reference_number || '—' },
        { label: 'Type', value: primary.reference_type || '—' },
        { label: 'Amount', value: String(primary.amount ?? '—') },
        { label: 'Date', value: primary.payment_date?.slice(0, 10) || '—' },
        { label: 'Contact', value: primary.contact_id || '—' },
        { label: 'Branch', value: primary.branch_id || '—' },
        { label: 'Voided', value: primary.voided_at ? 'yes' : 'no' },
        { label: 'Linked JE', value: primary.journal_entry_id || '—' },
      ],
    });
  }

  if (trace.rentalPayments.length) {
    sections.push({
      id: 'rental_payments',
      title: 'Rental payments',
      rows: trace.rentalPayments.flatMap((rp, i) => [
        { label: `[${i + 1}] ref`, value: rp.reference_number || '—' },
        { label: `[${i + 1}] rental_id`, value: rp.rental_id || '—' },
        { label: `[${i + 1}] amount`, value: String(rp.amount ?? '—') },
        { label: `[${i + 1}] JE`, value: rp.journal_entry_id || '—' },
      ]),
    });
  }

  if (trace.journals.length) {
    sections.push({
      id: 'journals',
      title: 'Journal entries',
      rows: trace.journals.flatMap((j, i) => [
        { label: `[${i + 1}] entry_no`, value: j.entry_no || '—' },
        { label: `[${i + 1}] ref_type`, value: j.reference_type || '—' },
        { label: `[${i + 1}] void`, value: j.is_void ? 'yes' : 'no' },
        { label: `[${i + 1}] payment_id`, value: j.payment_id || '—' },
      ]),
    });
  }

  if (trace.entities.length) {
    sections.push({
      id: 'entities',
      title: 'Linked documents',
      rows: trace.entities.map((e) => ({
        label: e.kind,
        value: `${e.label}${e.status ? ` (${e.status})` : ''}`,
      })),
    });
  }

  if (trace.branchChain.length) {
    sections.push({
      id: 'branch',
      title: 'Branch chain',
      rows: trace.branchChain.map((b) => ({ label: b.layer, value: b.label })),
    });
  }

  const vis = trace.reportVisibility;
  const rozIncluded = vis.filter((v) => v.roznamcha.normal.included).length;
  const stmtIncluded = vis.filter((v) => v.accountStatement.normal.included).length;
  const reportVisibilitySummary = vis.length
    ? `Roznamcha: ${rozIncluded}/${vis.length} · Statement: ${stmtIncluded}/${vis.length}`
    : 'No visibility rows';

  return {
    query: query.trim(),
    primaryPaymentId: primary?.id ?? null,
    primaryPaymentRef: primary?.reference_number ?? null,
    sections,
    reportVisibilitySummary,
  };
}
