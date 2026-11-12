/**
 * Branch resolution for Phase 1.6 remediation dry-run / inventory.
 */
import { classifyBranchAttributionRow } from './confidence-rules.mjs';

export async function resolveBranchForJe(client, row) {
  const refType = String(row.reference_type || '').toLowerCase().trim();
  const refId = row.reference_id;
  const companyId = row.company_id;
  let linked_document_branch_id = null;
  let proposed_branch_id = null;
  let resolution_source = null;
  let resolution_confidence = 'low';
  let branch_ambiguous = false;
  let inferred_from_company_default_only = false;

  const q1 = async (sql, params) => {
    const { rows } = await client.query(sql, params);
    return rows[0] ?? null;
  };

  if (refType === 'sale' && refId) {
    const s = await q1(`SELECT branch_id FROM sales WHERE id = $1 AND company_id = $2`, [refId, companyId]);
    linked_document_branch_id = s?.branch_id ?? null;
    proposed_branch_id = linked_document_branch_id;
    if (proposed_branch_id) {
      resolution_confidence = 'high';
      resolution_source = 'sale_branch_id';
    }
  } else if (refType === 'purchase' && refId) {
    const p = await q1(`SELECT branch_id FROM purchases WHERE id = $1 AND company_id = $2`, [refId, companyId]);
    linked_document_branch_id = p?.branch_id ?? null;
    proposed_branch_id = linked_document_branch_id;
    if (proposed_branch_id) {
      resolution_confidence = 'high';
      resolution_source = 'purchase_branch_id';
    }
  } else if (refType === 'rental' && refId) {
    const r = await q1(`SELECT branch_id FROM rentals WHERE id = $1 AND company_id = $2`, [refId, companyId]);
    linked_document_branch_id = r?.branch_id ?? null;
    proposed_branch_id = linked_document_branch_id;
    if (proposed_branch_id) {
      resolution_confidence = 'high';
      resolution_source = 'rental_branch_id';
    }
  } else if (refType === 'expense' && refId) {
    const e = await q1(`SELECT branch_id FROM expenses WHERE id = $1 AND company_id = $2`, [refId, companyId]);
    linked_document_branch_id = e?.branch_id ?? null;
    proposed_branch_id = linked_document_branch_id;
    if (proposed_branch_id) {
      resolution_confidence = 'medium';
      resolution_source = 'expense_branch_id';
    }
  } else if (['payment', 'payment_adjustment', 'manual_payment'].includes(refType)) {
    const payId = row.payment_id || refId;
    if (payId) {
      const pay = await q1(
        `SELECT branch_id, reference_type, reference_id FROM payments WHERE id = $1 AND company_id = $2`,
        [payId, companyId]
      );
      proposed_branch_id = pay?.branch_id ?? null;
      if (proposed_branch_id) {
        resolution_confidence = 'high';
        resolution_source = 'payment_branch_id';
        linked_document_branch_id = proposed_branch_id;
      } else if (pay?.reference_id) {
        const rt = String(pay.reference_type || '').toLowerCase();
        if (rt === 'sale') {
          const s = await q1(`SELECT branch_id FROM sales WHERE id = $1`, [pay.reference_id]);
          linked_document_branch_id = s?.branch_id ?? null;
        } else if (rt === 'purchase') {
          const p = await q1(`SELECT branch_id FROM purchases WHERE id = $1`, [pay.reference_id]);
          linked_document_branch_id = p?.branch_id ?? null;
        } else if (rt === 'rental') {
          const r = await q1(`SELECT branch_id FROM rentals WHERE id = $1`, [pay.reference_id]);
          linked_document_branch_id = r?.branch_id ?? null;
        }
        proposed_branch_id = linked_document_branch_id;
        if (proposed_branch_id) {
          resolution_confidence = 'high';
          resolution_source = `payment_ref_${rt}_branch`;
        }
      }
    }
  } else if (refType === 'manual_receipt' && refId) {
    const pays = await client.query(
      `SELECT branch_id FROM payments
       WHERE company_id = $1 AND reference_type = 'manual_receipt' AND reference_id = $2 AND voided_at IS NULL`,
      [companyId, refId]
    );
    const branches = [...new Set((pays.rows || []).map((p) => p.branch_id).filter(Boolean))];
    if (branches.length === 1) {
      proposed_branch_id = branches[0];
      linked_document_branch_id = proposed_branch_id;
      resolution_confidence = 'medium';
      resolution_source = 'manual_receipt_linked_payment_branch';
    } else if (branches.length > 1) {
      branch_ambiguous = true;
    }
  } else if (refType === 'transfer') {
    resolution_confidence = 'low';
    resolution_source = 'transfer_manual_review';
  }

  return classifyBranchAttributionRow({
    issue_type: 'branch_attribution_risk',
    journal_entry_id: row.journal_entry_id,
    entry_no: row.entry_no,
    entry_date: row.entry_date,
    reference_type: row.reference_type,
    reference_id: row.reference_id,
    current_je_branch_id: row.current_je_branch_id ?? row.branch_id,
    company_id: row.company_id,
    company_name: row.company_name,
    description: row.description,
    linked_document_branch_id,
    proposed_branch_id,
    resolution_source,
    resolution_confidence,
    branch_ambiguous,
    inferred_from_company_default_only,
  });
}

export async function runBranchAttributionDryRun(client, companyId = null) {
  const { readSqlFile } = await import('./pg-remediation-client.mjs');
  const sql = readSqlFile('inventory-branch-attribution-risk.sql');
  const { rows } = await client.query(sql, [companyId]);
  const out = [];
  for (const r of rows) {
    out.push(await resolveBranchForJe(client, r));
  }
  return out;
}
