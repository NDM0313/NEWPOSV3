/**
 * Branch candidate resolution for transfer (FT-*) journal entries.
 */
import { branchLabel } from './manifest-schema.mjs';

function parseLines(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function liquidityLine(lines) {
  return (lines || []).find((l) => Number(l.debit) > 0 || Number(l.credit) > 0) || null;
}

export function resolveTransferBranchCandidates(row, branchesById = new Map()) {
  const debitLines = parseLines(row.debit_lines);
  const creditLines = parseLines(row.credit_lines);
  const toLine = debitLines.find((l) => Number(l.debit) > 0) || liquidityLine(debitLines);
  const fromLine = creditLines.find((l) => Number(l.credit) > 0) || liquidityLine(creditLines);

  const toAccount = toLine
    ? { id: toLine.account_id, code: toLine.code, name: toLine.name, branch_id: toLine.branch_id }
    : null;
  const fromAccount = fromLine
    ? { id: fromLine.account_id, code: fromLine.code, name: fromLine.name, branch_id: fromLine.branch_id }
    : null;

  const candidates = [];
  const evidence = [];

  const branchIds = new Set(
    [toAccount?.branch_id, fromAccount?.branch_id].filter(Boolean).map(String)
  );

  if (branchIds.size === 1) {
    const bid = [...branchIds][0];
    const b = branchesById.get(bid);
    candidates.push({
      branch_id: bid,
      label: branchLabel(b || { id: bid }),
      reason: `both_accounts_same_branch:${branchLabel(b || { id: bid })}`,
      confidence: 'high',
    });
    evidence.push(`Debit account ${toAccount?.name} and credit account ${fromAccount?.name} share branch_id ${bid}`);
  } else if (branchIds.size > 1) {
    for (const bid of branchIds) {
      const b = branchesById.get(bid);
      candidates.push({
        branch_id: bid,
        label: branchLabel(b || { id: bid }),
        reason: 'cross_branch_transfer_account_branch',
        confidence: 'low',
      });
    }
    evidence.push('Accounts have different branch_id values — cross-branch transfer');
  } else {
    evidence.push('Both liquidity accounts have NULL branch_id (company-wide COA)');
    if (row.description) evidence.push(`Description: ${row.description}`);
  }

  let final_status = 'finance_required';
  let recommended_branch_id = null;
  let recommended_branch_label = '';
  let confidence = 'low';

  if (candidates.length === 1 && candidates[0].confidence === 'high') {
    final_status = 'safe_recommendation';
    recommended_branch_id = candidates[0].branch_id;
    recommended_branch_label = candidates[0].label;
    confidence = 'high';
  } else if (branchIds.size === 0) {
    final_status = 'exception_candidate';
    evidence.push('Company-level bank transfer may intentionally have NULL JE branch_id');
  }

  return {
    from_account: fromAccount ? `${fromAccount.code || ''} ${fromAccount.name || ''}`.trim() : '',
    to_account: toAccount ? `${toAccount.code || ''} ${toAccount.name || ''}`.trim() : '',
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
