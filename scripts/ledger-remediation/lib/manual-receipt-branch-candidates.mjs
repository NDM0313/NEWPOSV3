/**
 * Branch candidate resolution for manual_receipt journal entries.
 */
import { branchLabel } from './manifest-schema.mjs';

export async function resolveManualReceiptBranchCandidates(client, row, branchesById = new Map()) {
  const companyId = row.company_id;
  const contactId = row.reference_id;
  const evidence = [];
  const candidates = [];

  if (row.payment_branch_id) {
    const bid = String(row.payment_branch_id);
    const b = branchesById.get(bid);
    candidates.push({
      branch_id: bid,
      label: branchLabel(b || { id: bid }),
      reason: 'linked_payment_branch_id',
      confidence: 'high',
    });
    evidence.push(`Linked payment ${row.linked_payment_id} branch_id=${bid}`);
  }

  if (contactId && candidates.length === 0) {
    const { rows: pays } = await client.query(
      `SELECT id, branch_id, reference_number, payment_date
       FROM payments
       WHERE company_id = $1
         AND reference_type = 'manual_receipt'
         AND reference_id = $2
         AND voided_at IS NULL
       ORDER BY payment_date DESC NULLS LAST`,
      [companyId, contactId]
    );
    const branches = [...new Set(pays.map((p) => p.branch_id).filter(Boolean).map(String))];
    if (branches.length === 1) {
      const bid = branches[0];
      const b = branchesById.get(bid);
      candidates.push({
        branch_id: bid,
        label: branchLabel(b || { id: bid }),
        reason: 'manual_receipt_payments_single_branch',
        confidence: 'medium',
      });
      evidence.push(`Found ${pays.length} manual_receipt payment(s) with single branch ${bid}`);
    } else if (branches.length > 1) {
      evidence.push(`Multiple payment branches: ${branches.join(', ')}`);
      for (const bid of branches) {
        const b = branchesById.get(bid);
        candidates.push({
          branch_id: bid,
          label: branchLabel(b || { id: bid }),
          reason: 'manual_receipt_payments_ambiguous',
          confidence: 'low',
        });
      }
    } else if (pays.length) {
      const { rows: allocs } = await client.query(
        `SELECT DISTINCT pa.branch_id
         FROM payment_allocations pa
         WHERE pa.payment_id = ANY($1::uuid[]) AND pa.branch_id IS NOT NULL`,
        [pays.map((p) => p.id)]
      );
      const allocBranches = [...new Set(allocs.map((a) => String(a.branch_id)))];
      if (allocBranches.length === 1) {
        const bid = allocBranches[0];
        const b = branchesById.get(bid);
        candidates.push({
          branch_id: bid,
          label: branchLabel(b || { id: bid }),
          reason: 'payment_allocation_branch_id',
          confidence: 'medium',
        });
        evidence.push(`Payment allocation branch ${bid}`);
      }
    }
  }

  const debitLines = Array.isArray(row.debit_lines)
    ? row.debit_lines
    : row.debit_lines
      ? JSON.parse(row.debit_lines)
      : [];
  const receiptAccount = debitLines.find((l) => Number(l.debit) > 0);
  if (receiptAccount?.branch_id && !candidates.some((c) => c.branch_id === String(receiptAccount.branch_id))) {
    const bid = String(receiptAccount.branch_id);
    const b = branchesById.get(bid);
    candidates.push({
      branch_id: bid,
      label: branchLabel(b || { id: bid }),
      reason: 'receipt_liquidity_account_branch_id',
      confidence: 'medium',
    });
    evidence.push(`Receipt debit account ${receiptAccount.name} branch_id=${bid}`);
  }

  let final_status = 'finance_required';
  let recommended_branch_id = null;
  let recommended_branch_label = '';
  let confidence = 'low';

  const high = candidates.find((c) => c.confidence === 'high');
  const medium = candidates.filter((c) => c.confidence === 'medium');
  if (high) {
    final_status = 'safe_recommendation';
    recommended_branch_id = high.branch_id;
    recommended_branch_label = high.label;
    confidence = 'high';
  } else if (medium.length === 1) {
    final_status = 'safe_recommendation';
    recommended_branch_id = medium[0].branch_id;
    recommended_branch_label = medium[0].label;
    confidence = 'medium';
  } else if (candidates.length === 0) {
    final_status = 'finance_required';
    evidence.push('No deterministic branch from payment or account');
  }

  return {
    from_account: '',
    to_account: receiptAccount ? `${receiptAccount.code || ''} ${receiptAccount.name || ''}`.trim() : '',
    candidate_branch_1: candidates[0]?.branch_id || '',
    candidate_branch_1_reason: candidates[0]?.reason || '',
    candidate_branch_2: candidates[1]?.branch_id || '',
    candidate_branch_2_reason: candidates[1]?.reason || '',
    recommended_branch_id,
    recommended_branch_label,
    confidence,
    final_status,
    approval_required: final_status !== 'safe_recommendation',
    possible_branch_candidates: candidates,
    evidence,
  };
}
