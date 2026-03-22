/**
 * Repair candidate buckets derived from runPartyBalanceTieOut — ready-to-fix rows, not a dashboard.
 */

import type { PartyBalanceTieOutResult, PartyKind, TieOutMismatchCause } from '@/app/services/partyBalanceTieOutService';

export type PartyTieOutRepairBucket =
  | 'missing_payment_contact_id'
  | 'wrong_document_payment_contact'
  | 'payment_without_je'
  | 'control_line_party_unresolved'
  | 'worker_lifecycle_rule_failure'
  | 'residual_after_attribution'
  | 'operational_vs_gl_slice';

export interface PartyTieOutRepairCandidate {
  bucket: PartyTieOutRepairBucket;
  severity: 'info' | 'warn' | 'error';
  message: string;
  relatedIds?: string[];
  /** Action hint for repair workflow */
  readyToFixHint?: string;
  sourceCode?: string;
}

export interface PartyTieOutRepairPlan {
  partyType: PartyKind;
  partyId: string;
  partyName: string | null;
  asOfDate: string;
  candidates: PartyTieOutRepairCandidate[];
  byBucket: Record<PartyTieOutRepairBucket, PartyTieOutRepairCandidate[]>;
}

const BUCKETS: PartyTieOutRepairBucket[] = [
  'missing_payment_contact_id',
  'wrong_document_payment_contact',
  'payment_without_je',
  'control_line_party_unresolved',
  'worker_lifecycle_rule_failure',
  'residual_after_attribution',
  'operational_vs_gl_slice',
];

function hintForCode(code: string): string | undefined {
  switch (code) {
    case 'PAYMENT_MISSING_CONTACT':
    case 'SALE_PAYMENT_NO_CONTACT':
    case 'PURCHASE_PAYMENT_NO_CONTACT':
      return 'Set payments.contact_id to the correct party before re-running tie-out.';
    case 'SALE_PAYMENT_CONTACT_NOT_CUSTOMER':
    case 'PURCHASE_PAYMENT_CONTACT_NOT_SUPPLIER':
      return 'Align payment contact with document customer/supplier or fix reference_id link.';
    case 'PAYMENT_WITHOUT_JE':
      return 'Post or backfill journal_entries.payment_id for this payment if GL should reflect it.';
    case 'CONTROL_LINE_PARTY_UNRESOLVED':
      return 'Set reference_type/reference_id, manual_* contact id, or payment.contact_id so AR/AP/WP/WA lines attribute to a party.';
    case 'WORKER_LIFECYCLE_PATTERN':
      return 'Correct journal lines to match pre-bill (1180/cash), bill (5000/2010), settlement (2010/1180), or post-bill (2010/cash).';
    case 'EXTENDED_RESOLVER_VS_RPC_SLICE':
      return 'After migration 20260334, if this persists: widen JE collection or check branch/as-of filters vs live data.';
    case 'OPERATIONAL_VS_GL_PARTY_SLICE':
      return 'Reconcile operational documents (sales/purchases/worker ledger) with posted GL or timing differences.';
    case 'RPC_PARTY_GL_FAILED':
      return 'Ensure get_contact_party_gl_balances exists and RLS allows read; re-run migrations.';
    default:
      return undefined;
  }
}

function mapCauseToBucket(c: TieOutMismatchCause): PartyTieOutRepairBucket | null {
  switch (c.code) {
    case 'PAYMENT_MISSING_CONTACT':
    case 'SALE_PAYMENT_NO_CONTACT':
    case 'PURCHASE_PAYMENT_NO_CONTACT':
      return 'missing_payment_contact_id';
    case 'SALE_PAYMENT_CONTACT_NOT_CUSTOMER':
    case 'PURCHASE_PAYMENT_CONTACT_NOT_SUPPLIER':
      return 'wrong_document_payment_contact';
    case 'PAYMENT_WITHOUT_JE':
      return 'payment_without_je';
    case 'CONTROL_LINE_PARTY_UNRESOLVED':
      return 'control_line_party_unresolved';
    case 'WORKER_LIFECYCLE_PATTERN':
      return 'worker_lifecycle_rule_failure';
    case 'EXTENDED_RESOLVER_VS_RPC_SLICE':
    case 'RPC_PARTY_GL_FAILED':
      return 'residual_after_attribution';
    case 'OPERATIONAL_VS_GL_PARTY_SLICE':
      return 'operational_vs_gl_slice';
    default:
      return null;
  }
}

function severityOrder(s: 'info' | 'warn' | 'error'): number {
  if (s === 'error') return 2;
  if (s === 'warn') return 1;
  return 0;
}

/**
 * Build structured repair candidates from a completed tie-out result.
 */
export function buildPartyTieOutRepairPlan(result: PartyBalanceTieOutResult): PartyTieOutRepairPlan {
  const candidates: PartyTieOutRepairCandidate[] = [];

  for (const c of result.diagnostics.mismatchCauses) {
    const bucket = mapCauseToBucket(c);
    if (!bucket) continue;
    candidates.push({
      bucket,
      severity: c.severity,
      message: c.message,
      relatedIds: c.relatedIds,
      readyToFixHint: hintForCode(c.code),
      sourceCode: c.code,
    });
  }

  const rv = result.residual.unmappedPartyOnControl.value;
  if (rv != null && Math.abs(rv) > 0.01) {
    const exists = candidates.some(
      (x) => x.bucket === 'residual_after_attribution' && x.sourceCode === 'RESIDUAL_SLICE'
    );
    if (!exists) {
      candidates.push({
        bucket: 'residual_after_attribution',
        severity: 'warn',
        message: `Non-zero residual after party attribution: ${rv} (${result.residual.unmappedPartyOnControl.source})`,
        readyToFixHint:
          'Expand JE collection, fix orphan control lines, or align branch/as-of with reporting period.',
        sourceCode: 'RESIDUAL_SLICE',
      });
    }
  }

  candidates.sort((a, b) => severityOrder(b.severity) - severityOrder(a.severity));

  const byBucket = Object.fromEntries(BUCKETS.map((k) => [k, [] as PartyTieOutRepairCandidate[]])) as Record<
    PartyTieOutRepairBucket,
    PartyTieOutRepairCandidate[]
  >;
  for (const c of candidates) {
    byBucket[c.bucket].push(c);
  }

  return {
    partyType: result.party.type,
    partyId: result.party.id,
    partyName: result.party.name,
    asOfDate: result.party.asOfDate,
    candidates,
    byBucket,
  };
}
