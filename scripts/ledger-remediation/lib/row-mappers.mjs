/**
 * Map raw payment gap SQL row to confidence-rules input shape.
 */
export function mapPaymentRowForClassification(r) {
  const status = String(r.sale_status ?? '').toLowerCase();
  return {
    ...r,
    sale_missing: !r.sale_id,
    sale_voided_or_cancelled: Boolean(r.sale_cancelled_at) || status === 'cancelled' || status === 'void',
    allocation_customer_conflict: Boolean(r.allocation_customer_conflict ?? r.allocation_conflict),
    contact_id_already_set: r.old_contact_id != null,
    reason: 'sale_customer_id_match',
  };
}

/**
 * Map branch risk SQL row + resolution to confidence-rules input shape.
 */
export function mapBranchRowForClassification(r, resolution) {
  const refType = String(r.reference_type ?? '').toLowerCase().trim();
  const linked = resolution.linked_document_branch_id ?? null;
  const proposed = resolution.proposed_branch_id ?? null;
  let resolutionSource = null;
  let resolutionConfidence = 'low';

  if (refType === 'transfer') {
    resolutionSource = 'transfer_requires_manual_branch';
  } else if (linked && proposed && String(linked) === String(proposed)) {
    resolutionSource =
      refType === 'manual_receipt' ? 'manual_receipt_linked_payment_branch' : 'linked_document_branch_match';
    resolutionConfidence = refType === 'expense' ? 'medium' : 'high';
  } else if (resolution.inferred_from_company_default_only) {
    resolutionSource = 'inferred_from_company_default';
    resolutionConfidence = 'medium';
  }

  return {
    ...r,
    ...resolution,
    linked_document_branch_id: linked,
    proposed_branch_id: proposed,
    inferred_from_company_default_only: Boolean(resolution.inferred_from_company_default_only),
    branch_ambiguous: refType === 'manual_receipt' && !linked,
    resolution_source: resolutionSource,
    resolution_confidence: resolutionConfidence,
  };
}

export function resolveBranchProposal(row, soleBranchId) {
  const refType = String(row.reference_type ?? '').toLowerCase().trim();
  let linked = null;
  if (refType === 'sale') linked = row.sale_branch_id;
  else if (refType === 'purchase') linked = row.purchase_branch_id;
  else if (refType === 'rental') linked = row.rental_branch_id;
  else if (refType === 'expense') linked = row.expense_branch_id;
  else if (['payment', 'payment_adjustment', 'manual_payment', 'manual_receipt'].includes(refType)) {
    linked = row.payment_branch_id;
  }

  let proposed = linked ?? null;
  let inferred_from_company_default_only = false;
  if (!proposed && refType === 'manual_receipt' && soleBranchId) {
    proposed = soleBranchId;
    inferred_from_company_default_only = true;
  }

  return {
    linked_document_branch_id: linked,
    proposed_branch_id: proposed,
    inferred_from_company_default_only,
  };
}

export async function fetchSoleBranchMap(client) {
  const { rows } = await client.query(
    `SELECT company_id, MIN(id::text)::uuid AS sole_branch_id
     FROM branches WHERE COALESCE(is_active, true) = true
     GROUP BY company_id HAVING COUNT(*) = 1`
  );
  return new Map(rows.map((r) => [String(r.company_id), r.sole_branch_id]));
}

export async function fetchWrongPartyPayments(client, cid) {
  const { rows } = await client.query(
    `SELECT p.id AS payment_id FROM payments p
     INNER JOIN sales s ON s.id = p.reference_id AND s.company_id = p.company_id
     WHERE LOWER(TRIM(COALESCE(p.reference_type, ''))) = 'sale'
       AND p.contact_id IS NOT NULL AND p.contact_id IS DISTINCT FROM s.customer_id
       AND p.voided_at IS NULL AND ($1::uuid IS NULL OR p.company_id = $1::uuid)`,
    [cid]
  );
  return new Set(rows.map((r) => String(r.payment_id)));
}
