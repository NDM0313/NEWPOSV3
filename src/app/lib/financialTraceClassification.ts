/**
 * Financial Trace Center — D1–D7 divergence taxonomy (read-only labels).
 */

import {
  diagnoseUnmappedLine,
  diagnoseUnpostedRow,
  type UnmappedLineDiagnostics,
} from '@/app/lib/arApReconciliationDiagnostics';
import type { UnmappedJournalRow, UnpostedDocumentRow } from '@/app/services/arApReconciliationCenterService';

export type DivergenceCode = 'D1' | 'D2' | 'D3' | 'D4' | 'D5' | 'D6' | 'D7';

export const DIVERGENCE_LABELS: Record<DivergenceCode, string> = {
  D1: 'Basis mix / control scope',
  D2: 'Non-final document',
  D3: 'Metadata whitelist / false positive',
  D4: 'Dual-stream rental',
  D5: 'Void chain / superseded receipt',
  D6: 'Branch scope',
  D7: 'True GL mismatch — deeper trace',
};

export type BasisBadge = 'gl' | 'operational' | 'heuristic' | 'deeper_trace';

export function basisBadgeLabel(b: BasisBadge): string {
  switch (b) {
    case 'gl':
      return 'GL basis';
    case 'operational':
      return 'Operational basis';
    case 'heuristic':
      return 'Metadata / heuristic';
    case 'deeper_trace':
      return 'Needs deeper trace';
    default:
      return b;
  }
}

export function basisBadgeClass(b: BasisBadge): string {
  switch (b) {
    case 'gl':
      return 'bg-blue-500/15 text-blue-200 border-blue-500/40';
    case 'operational':
      return 'bg-cyan-500/15 text-cyan-200 border-cyan-500/40';
    case 'heuristic':
      return 'bg-violet-500/15 text-violet-200 border-violet-500/40';
    case 'deeper_trace':
      return 'bg-red-500/15 text-red-200 border-red-500/40';
    default:
      return 'bg-gray-500/15 text-gray-300 border-gray-600';
  }
}

export function divergenceBadgeClass(code: DivergenceCode): string {
  switch (code) {
    case 'D1':
      return 'bg-slate-500/15 text-slate-200 border-slate-500/40';
    case 'D2':
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40';
    case 'D3':
      return 'bg-violet-500/15 text-violet-200 border-violet-500/40';
    case 'D4':
      return 'bg-amber-500/15 text-amber-200 border-amber-500/40';
    case 'D5':
      return 'bg-orange-500/15 text-orange-200 border-orange-500/40';
    case 'D6':
      return 'bg-indigo-500/15 text-indigo-200 border-indigo-500/40';
    case 'D7':
      return 'bg-red-500/15 text-red-200 border-red-500/40';
    default:
      return 'bg-gray-500/15 text-gray-300 border-gray-600';
  }
}

export function classifyUnpostedDocument(
  row: UnpostedDocumentRow,
  documentStatus?: string | null
): { code: DivergenceCode; basis: BasisBadge; label: string; detail: string } {
  const dx = diagnoseUnpostedRow(row, documentStatus);
  if (dx.isNonFinal) {
    return {
      code: 'D2',
      basis: 'operational',
      label: 'Order-stage sale — not postable until finalized',
      detail: dx.suggestedAction,
    };
  }
  return {
    code: 'D2',
    basis: 'heuristic',
    label: dx.label,
    detail: dx.suggestedAction,
  };
}

export function classifyUnmappedJournal(
  row: UnmappedJournalRow,
  paymentMeta?: { reference_type?: string | null; contact_id?: string | null; reference_number?: string | null },
  arLinkedContactId?: string | null
): { code: DivergenceCode; basis: BasisBadge; label: string; detail: string; diagnostics: UnmappedLineDiagnostics } {
  const diagnostics = diagnoseUnmappedLine(row, paymentMeta, arLinkedContactId);
  if (diagnostics.isLikelyFalsePositive) {
    return {
      code: 'D3',
      basis: 'heuristic',
      label: 'Likely mapped — heuristic false positive',
      detail: diagnostics.falsePositiveReason || diagnostics.suggestedAction,
      diagnostics,
    };
  }
  if (diagnostics.isMetadataReviewOnly) {
    return {
      code: 'D3',
      basis: 'heuristic',
      label: 'Mapped financially — metadata review',
      detail: diagnostics.metadataReviewReason || diagnostics.suggestedAction,
      diagnostics,
    };
  }
  return {
    code: 'D3',
    basis: 'heuristic',
    label: 'Unmapped queue row',
    detail: diagnostics.suggestedAction,
    diagnostics,
  };
}

export function classifyControlTieOut(input: {
  control1100Net: number | null;
  arCusSubledgerSum: number | null;
  glArNet: number | null;
  operationalDue: number | null;
}): { codes: DivergenceCode[]; warnings: string[] } {
  const warnings: string[] = [];
  const codes: DivergenceCode[] = [];

  const c1100 = input.control1100Net ?? 0;
  const arCus = input.arCusSubledgerSum ?? 0;
  const gap = Math.abs(c1100 - arCus);
  if (gap >= 1) {
    warnings.push(
      `1100 control net (${c1100.toLocaleString()}) ≠ AR-CUS sub-ledger sum (${arCus.toLocaleString()}). Party detail may not roll up to 1100 header.`
    );
    codes.push('D1', 'D7');
  }

  const glAr = input.glArNet;
  const opDue = input.operationalDue;
  if (glAr != null && opDue != null && Math.abs(glAr - opDue) >= 1) {
    warnings.push(
      `GL AR net (${glAr.toLocaleString()}) differs from operational open-document due (${opDue.toLocaleString()}). Compare surfaces with basis labels.`
    );
    if (!codes.includes('D1')) codes.push('D1');
  }

  warnings.push('Queue rows are heuristic only — confirm in Party/Rental trace before any repair.');

  return { codes, warnings };
}

export function classifyRentalPaymentRow(input: {
  voidedAt: string | null;
  reference: string | null;
  hasPaymentsMirror: boolean;
}): DivergenceCode[] {
  const codes: DivergenceCode[] = [];
  if (!input.hasPaymentsMirror) codes.push('D4');
  if (input.voidedAt) codes.push('D5');
  return codes;
}

export interface KnownTraceCase {
  id: string;
  title: string;
  codes: DivergenceCode[];
  tab: 'rental' | 'metadata' | 'non-final' | 'deeper';
  searchHint: string;
  summary: string;
  statusLabel: string;
  /** When set, resolved when create_gl_correction_journal fingerprint exists. */
  glCorrectionDefectId?: string;
}

export const KNOWN_TRACE_CASES: KnownTraceCase[] = [
  {
    id: 'hq-sl-0003-orphan-ar',
    title: 'Walk-in / HQ-SL-0003 orphan AR',
    codes: ['D7'],
    tab: 'deeper',
    searchHint: 'HQ-SL-0003',
    glCorrectionDefectId: 'hq-sl-0003-orphan-ar',
    summary:
      'JE-0160 Dr AR-CUS0000 Rs 150; JE-0161 reversal credited 1100 not AR-CUS0000. Apply additive GL correction (Dr 1100 / Cr AR-CUS0000) via AR/AP Reconciliation Center.',
    statusLabel: 'GL correction available — AR/AP Reconciliation → Hybrid Repair',
  },
  {
    id: 'inayat-ren-0002',
    title: 'Inayat / REN-0002',
    codes: ['D4', 'D5', 'D7'],
    tab: 'rental',
    searchHint: 'REN-0002',
    summary:
      'Rental paid 60k; AR-CUS0058 net −30k; REN-0002-PAY/JE-0011 void; HQ-RCV-0003/0006 active; rental_payments canonical (no payments rows).',
    statusLabel: 'Deeper trace required — no auto repair',
  },
  {
    id: 'saqib-rcv-0008',
    title: 'Saqib / RCV-0008',
    codes: ['D3'],
    tab: 'metadata',
    searchHint: 'RCV-0008',
    summary: 'Payment reference_type=rental; JE reference_type=payment; AR-CUS0060 mapped; metadata review only.',
    statusLabel: 'Mapped financially — metadata review',
  },
  {
    id: 'walkin-rcv-0017-19',
    title: 'Walk-in RCV-0017/18/19',
    codes: ['D3'],
    tab: 'metadata',
    searchHint: 'RCV-0017',
    summary: 'on_account payments on AR-CUS0001 Walk-in; JE payment whitelist gap — false positive.',
    statusLabel: 'Likely mapped — heuristic false positive',
  },
  {
    id: 'order-sl-0005-12',
    title: 'SL-0005 / SL-0006 / SL-0012',
    codes: ['D2'],
    tab: 'non-final',
    searchHint: 'SL-0005',
    summary: 'Order-stage sales in unposted queue; no sale JE until finalized.',
    statusLabel: 'Order-stage sale — not postable until finalized',
  },
  {
    id: 'control-1100-gap',
    title: '1100 vs AR-CUS sub-ledger gap',
    codes: ['D1', 'D7'],
    tab: 'deeper',
    searchHint: '1100',
    summary: 'Control 1100 net ≠ sum(AR-CUS); investigate chart rollup vs party sub-ledgers.',
    statusLabel: 'Needs deeper trace — no repair in Phase 1',
  },
  {
    id: 'inayat-ar-minus-30k',
    title: 'Inayat AR-CUS0058 −30k',
    codes: ['D7'],
    tab: 'deeper',
    searchHint: 'Inayat',
    summary: 'Rental operational due 0 but AR sub-ledger net −30,000 — escalate for manual review.',
    statusLabel: 'Send to AR/AP review queue (status-only)',
  },
];
