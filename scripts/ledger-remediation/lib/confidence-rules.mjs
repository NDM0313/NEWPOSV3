/**
 * safe_apply vs manual_review classification for Phase 1.6 remediation rows.
 */

export const FIX_CLASS_MAP = {
  payments_missing_contact_sale_linked: { fix_class: 'payment_contact_backfill', severity: 'strict' },
  payments_wrong_party_attribution: { fix_class: 'payment_party_attribution_repair', severity: 'strict' },
  branch_attribution_risk: { fix_class: 'branch_attribution_review', severity: 'strict' },
  opening_balance_null_branch_je_count: { fix_class: 'opening_balance_branch_review', severity: 'info' },
};

/** @typedef {'high'|'medium'|'low'} Confidence */

/**
 * Payment contact backfill row classification.
 * @param {object} row
 * @param {Set<string>} wrongPartyPaymentIds - payments with wrong-party attribution
 */
export function classifyPaymentContactRow(row, wrongPartyPaymentIds = new Set()) {
  const reasons = [];
  let confidence = /** @type {Confidence} */ ('high');

  if (row.sale_missing) {
    confidence = 'low';
    reasons.push('sale_missing');
  } else if (!row.proposed_contact_id) {
    confidence = 'low';
    reasons.push('sale_customer_id_null');
  } else if (row.sale_voided_or_cancelled) {
    confidence = 'low';
    reasons.push('sale_voided_or_cancelled');
  } else if (row.allocation_customer_conflict) {
    confidence = 'low';
    reasons.push('payment_allocation_customer_conflict');
  } else if (row.contact_id_already_set) {
    confidence = 'low';
    reasons.push('contact_id_already_set');
  } else {
    reasons.push(row.reason || 'sale_customer_id_match');
  }

  const wrongParty = wrongPartyPaymentIds.has(String(row.payment_id));
  if (wrongParty) {
    confidence = 'low';
    reasons.push('payments_wrong_party_attribution');
  }

  const safe_apply =
    confidence === 'high' &&
    !wrongParty &&
    Boolean(row.proposed_contact_id) &&
    !row.allocation_customer_conflict &&
    !row.contact_id_already_set;

  return {
    ...row,
    confidence,
    reason: reasons.join('; '),
    safe_apply,
    manual_review: !safe_apply,
  };
}

/**
 * Branch attribution JE row classification.
 * @param {object} row - enriched JE row with proposed_branch_id, resolution_source, etc.
 */
export function classifyBranchAttributionRow(row) {
  const refType = String(row.reference_type || '').toLowerCase().trim();
  const reasons = [];
  let confidence = /** @type {Confidence} */ (row.resolution_confidence || 'low');

  if (!row.proposed_branch_id) {
    confidence = 'low';
    reasons.push('proposed_branch_unresolved');
  } else if (refType === 'transfer') {
    confidence = 'low';
    reasons.push('transfer_requires_manual_branch');
  } else if (row.branch_ambiguous) {
    confidence = 'low';
    reasons.push('branch_ambiguous');
  } else if (row.inferred_from_company_default_only) {
    confidence = 'medium';
    reasons.push('inferred_from_company_default');
  } else if (row.linked_document_branch_id && row.proposed_branch_id === row.linked_document_branch_id) {
    confidence = 'high';
    reasons.push(row.resolution_source || 'linked_document_branch_match');
  } else if (row.resolution_source) {
    reasons.push(row.resolution_source);
  } else {
    reasons.push('branch_resolution');
  }

  const safe_apply =
    confidence === 'high' &&
    Boolean(row.proposed_branch_id) &&
    !row.branch_ambiguous &&
    refType !== 'transfer' &&
    !row.inferred_from_company_default_only &&
    (row.linked_document_branch_id
      ? row.proposed_branch_id === row.linked_document_branch_id
      : false);

  return {
    ...row,
    confidence,
    reason: reasons.join('; '),
    safe_apply,
    manual_review: !safe_apply,
  };
}

/**
 * Opening balance / AR-AP risk rows are always manual_review (report only).
 */
export function classifyOpeningBalanceRiskRow(row) {
  return {
    ...row,
    confidence: 'low',
    reason: row.reason || 'opening_balance_or_ar_ap_manual_review',
    safe_apply: false,
    manual_review: true,
  };
}

export function summarizeRows(rows, groupKeys = ['company_name', 'issue_type']) {
  const totals = {};
  for (const row of rows) {
    const key = groupKeys.map((k) => row[k] ?? 'n/a').join('|');
    if (!totals[key]) {
      totals[key] = { safe_apply: 0, manual_review: 0, total: 0 };
      for (const k of groupKeys) totals[key][k] = row[k];
    }
    totals[key].total += 1;
    if (row.safe_apply) totals[key].safe_apply += 1;
    else totals[key].manual_review += 1;
  }
  return Object.values(totals);
}
