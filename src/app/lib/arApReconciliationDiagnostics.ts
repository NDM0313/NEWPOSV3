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
  queueReason: string;
  suggestedAction: string;
  riskLevel: ArApRiskLevel;
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

export function diagnoseUnmappedLine(
  row: UnmappedJournalRow,
  paymentMeta?: { reference_type?: string | null; contact_id?: string | null; reference_number?: string | null },
  arLinkedContactId?: string | null
): UnmappedLineDiagnostics {
  const queueReason = row.reason || row.contact_mapping_status || 'Unmapped AR/AP line (heuristic).';
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
      queueReason,
      suggestedAction: 'Mark manual reviewed or hide after Phase 3 whitelist fix. Do not relink unless business confirms wrong customer.',
      riskLevel: 'low',
    };
  }

  if (row.contact_mapping_status === 'missing_reference') {
    return {
      isLikelyFalsePositive: false,
      falsePositiveReason: null,
      queueReason,
      suggestedAction: 'Identify source document or void/repost with audit trail.',
      riskLevel: 'critical',
    };
  }

  if (row.control_bucket === 'AP' && row.ap_sub_bucket === 'worker') {
    return {
      isLikelyFalsePositive: false,
      falsePositiveReason: null,
      queueReason,
      suggestedAction: 'Relink worker contact (Phase 3) or mark ready to relink.',
      riskLevel: 'high',
    };
  }

  return {
    isLikelyFalsePositive: false,
    falsePositiveReason: null,
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
