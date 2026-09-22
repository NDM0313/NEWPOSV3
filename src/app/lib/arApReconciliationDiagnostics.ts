/**
 * AR/AP Reconciliation Center — queue row diagnostics (read-only heuristics).
 */

import {
  canPostAccountingForPurchaseStatus,
  canPostAccountingForSaleStatus,
  isSaleNonPostedCommercial,
} from '@/app/lib/postingStatusGate';
import type { ManualAdjustmentRow, UnmappedJournalRow, UnpostedDocumentRow } from '@/app/services/arApReconciliationCenterService';

export type ArApRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface UnpostedPostability {
  isPostable: boolean;
  isNonFinal: boolean;
  documentStatus: string | null;
  label: string;
  queueReason: string;
  suggestedAction: string;
  riskLevel: ArApRiskLevel;
}

export interface UnmappedLineDiagnostics {
  isLikelyFalsePositive: boolean;
  falsePositiveReason: string | null;
  /** Financially correct rental/payment row with JE vs payment metadata mismatch (Phase 2.1 — RCV-0008 class B). */
  isMetadataReviewOnly: boolean;
  metadataReviewReason: string | null;
  /** Applied developer_repair gl_correction JE — audit only (JV-000207 class). */
  isAppliedGlCorrectionReview: boolean;
  appliedGlCorrectionReason: string | null;
  queueReason: string;
  suggestedAction: string;
  riskLevel: ArApRiskLevel;
}

/** Applied gl_correction repair JE — whitelist gap before migration or audit queue. */
export function isLikelyAppliedGlCorrectionReview(input: {
  jeReferenceType?: string | null;
  actionFingerprint?: string | null;
}): boolean {
  const jeRef = String(input.jeReferenceType ?? '').toLowerCase().trim();
  if (jeRef !== 'gl_correction') return false;
  const fp = String(input.actionFingerprint ?? '').trim();
  if (fp.startsWith('developer_repair:gl_correction:')) return true;
  return jeRef === 'gl_correction';
}

export function diagnoseUnpostedRow(
  row: UnpostedDocumentRow,
  documentStatus?: string | null
): UnpostedPostability {
  const st = documentStatus != null ? String(documentStatus) : null;
  const queueReason = row.reason || 'No non-void document journal linked to this source.';

  if (row.source_type === 'sale') {
    const nonFinal = st != null ? isSaleNonPostedCommercial(st) : true;
    const postable = st != null ? canPostAccountingForSaleStatus(st) : false;
    if (nonFinal || !postable) {
      return {
        isPostable: false,
        isNonFinal: true,
        documentStatus: st,
        label: 'Non-final / not postable',
        queueReason,
        suggestedAction: 'Finalize the sale before GL revenue/AR posting. No posting required while status is order/draft/quotation.',
        riskLevel: 'low',
      };
    }
    return {
      isPostable: true,
      isNonFinal: false,
      documentStatus: st,
      label: 'Final — missing posting',
      queueReason,
      suggestedAction: 'Run posting dry-run, then apply in Phase 3 after confirmation.',
      riskLevel: 'medium',
    };
  }

  if (row.source_type === 'purchase') {
    const postable = st != null ? canPostAccountingForPurchaseStatus(st) : false;
    const nonFinal = st != null && !postable;
    if (nonFinal) {
      return {
        isPostable: false,
        isNonFinal: true,
        documentStatus: st,
        label: 'Non-final / not postable',
        queueReason,
        suggestedAction: 'Receive/finalize purchase before GL posting.',
        riskLevel: 'low',
      };
    }
    return {
      isPostable: true,
      isNonFinal: false,
      documentStatus: st,
      label: 'Final — missing posting',
      queueReason,
      suggestedAction: 'Run posting dry-run, then apply in Phase 3.',
      riskLevel: 'medium',
    };
  }

  return {
    isPostable: false,
    isNonFinal: false,
    documentStatus: st,
    label: 'Unknown source',
    queueReason,
    suggestedAction: 'Review source document manually.',
    riskLevel: 'medium',
  };
}

/** Heuristic: payment JE with on_account payment + matching AR sub-ledger contact */
export function isLikelyPaymentOnAccountFalsePositive(input: {
  jeReferenceType?: string | null;
  paymentReferenceType?: string | null;
  arLinkedContactId?: string | null;
  paymentContactId?: string | null;
  contactMappingStatus?: string | null;
}): boolean {
  const jeRef = String(input.jeReferenceType ?? '').toLowerCase().trim();
  const payRef = String(input.paymentReferenceType ?? '').toLowerCase().trim();
  if (jeRef !== 'payment') return false;
  if (payRef !== 'on_account') return false;
  const arLc = input.arLinkedContactId ? String(input.arLinkedContactId).trim() : '';
  const payC = input.paymentContactId ? String(input.paymentContactId).trim() : '';
  if (!arLc || !payC || arLc !== payC) return false;
  return true;
}

/** Rental receipt: payment row reference_type=rental but JE header reference_type=payment (whitelist gap). */
export function isLikelyRentalPaymentMetadataReview(input: {
  jeReferenceType?: string | null;
  paymentReferenceType?: string | null;
  arLinkedContactId?: string | null;
  contactMappingStatus?: string | null;
  controlBucket?: string | null;
}): boolean {
  const jeRef = String(input.jeReferenceType ?? '').toLowerCase().trim();
  const payRef = String(input.paymentReferenceType ?? '').toLowerCase().trim();
  const bucket = String(input.controlBucket ?? '').toUpperCase().trim();
  const mapStatus = String(input.contactMappingStatus ?? '').toLowerCase().trim();
  const arLc = input.arLinkedContactId ? String(input.arLinkedContactId).trim() : '';
  if (bucket !== 'AR') return false;
  if (jeRef !== 'payment') return false;
  if (payRef !== 'rental') return false;
  if (mapStatus !== 'unclassified_reference') return false;
  if (!arLc) return false;
  return true;
}

export function diagnoseUnmappedLine(
  row: UnmappedJournalRow,
  paymentMeta?: { reference_type?: string | null; contact_id?: string | null; reference_number?: string | null },
  arLinkedContactId?: string | null,
  journalMeta?: { action_fingerprint?: string | null; entry_no?: string | null }
): UnmappedLineDiagnostics {
  const queueReason = row.reason || row.contact_mapping_status || 'Unmapped AR/AP line (heuristic).';

  const appliedGlCorrection = isLikelyAppliedGlCorrectionReview({
    jeReferenceType: row.reference_type,
    actionFingerprint: journalMeta?.action_fingerprint,
  });
  if (appliedGlCorrection) {
    const entryNo = journalMeta?.entry_no ? String(journalMeta.entry_no) : 'correction JE';
    return {
      isLikelyFalsePositive: false,
      falsePositiveReason: null,
      isMetadataReviewOnly: false,
      metadataReviewReason: null,
      isAppliedGlCorrectionReview: true,
      appliedGlCorrectionReason: `${entryNo} fixed a prior GL issue — no action needed. Source JE unchanged.`,
      queueReason,
      suggestedAction: 'Audit only. Mark reviewed if still visible after whitelist migration.',
      riskLevel: 'low',
    };
  }

  const fp = isLikelyPaymentOnAccountFalsePositive({
    jeReferenceType: row.reference_type,
    paymentReferenceType: paymentMeta?.reference_type,
    arLinkedContactId,
    paymentContactId: paymentMeta?.contact_id,
    contactMappingStatus: row.contact_mapping_status,
  });

  if (fp) {
    return {
      isLikelyFalsePositive: true,
      falsePositiveReason:
        'Likely mapped — heuristic false positive: JE reference_type is payment, payment row is on_account, and AR sub-ledger linked_contact_id matches payment contact.',
      isMetadataReviewOnly: false,
      metadataReviewReason: null,
      isAppliedGlCorrectionReview: false,
      appliedGlCorrectionReason: null,
      queueReason,
      suggestedAction: 'Mark manual reviewed or hide after Phase 3 whitelist fix. Do not relink unless business confirms wrong customer.',
      riskLevel: 'low',
    };
  }

  const metadataReview = isLikelyRentalPaymentMetadataReview({
    jeReferenceType: row.reference_type,
    paymentReferenceType: paymentMeta?.reference_type,
    arLinkedContactId,
    contactMappingStatus: row.contact_mapping_status,
    controlBucket: row.control_bucket,
  });

  if (metadataReview) {
    return {
      isLikelyFalsePositive: false,
      falsePositiveReason: null,
      isMetadataReviewOnly: true,
      metadataReviewReason:
        'Ledger balance correct. JE header says payment but payment row says rental — metadata only. Mark reviewed.',
      isAppliedGlCorrectionReview: false,
      appliedGlCorrectionReason: null,
      queueReason,
      suggestedAction:
        'Metadata review only. Ledger and party sub-ledger appear correct; no relink or reverse/repost needed.',
      riskLevel: 'low',
    };
  }

  if (row.contact_mapping_status === 'missing_reference') {
    return {
      isLikelyFalsePositive: false,
      falsePositiveReason: null,
      isMetadataReviewOnly: false,
      metadataReviewReason: null,
      isAppliedGlCorrectionReview: false,
      appliedGlCorrectionReason: null,
      queueReason,
      suggestedAction: 'Identify source document or void/repost with audit trail.',
      riskLevel: 'critical',
    };
  }

  if (row.control_bucket === 'AP' && row.ap_sub_bucket === 'worker') {
    return {
      isLikelyFalsePositive: false,
      falsePositiveReason: null,
      isMetadataReviewOnly: false,
      metadataReviewReason: null,
      isAppliedGlCorrectionReview: false,
      appliedGlCorrectionReason: null,
      queueReason,
      suggestedAction: 'Relink worker contact (Phase 3) or mark ready to relink.',
      riskLevel: 'high',
    };
  }

  return {
    isLikelyFalsePositive: false,
    falsePositiveReason: null,
    isMetadataReviewOnly: false,
    metadataReviewReason: null,
    isAppliedGlCorrectionReview: false,
    appliedGlCorrectionReason: null,
    queueReason,
    suggestedAction: 'Review payment vs party; relink or reverse/repost in Phase 3.',
    riskLevel: 'medium',
  };
}

export function riskBadgeClass(level: ArApRiskLevel): string {
  switch (level) {
    case 'low':
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40';
    case 'medium':
      return 'bg-amber-500/15 text-amber-200 border-amber-500/40';
    case 'high':
      return 'bg-orange-500/15 text-orange-200 border-orange-500/40';
    case 'critical':
      return 'bg-red-500/15 text-red-200 border-red-500/40';
    default:
      return 'bg-gray-500/15 text-gray-300 border-gray-600';
  }
}

export function manualRowRisk(row: ManualAdjustmentRow): ArApRiskLevel {
  if (Math.abs(Number(row.suspense_net_dr_minus_cr) || 0) > 0.01) return 'high';
  return 'medium';
}
