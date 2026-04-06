-- =============================================================================
-- FINAL BASIS STABILIZATION — ADDITIVE READ-ONLY VIEWS (single company)
-- =============================================================================
-- Company scope (edit if you duplicate for another tenant):
--   db1302ec-a8d7-4cff-81ad-3c8d7cb55509
-- Branch: NULL = all branches (matches app when branch not filtered)
-- =============================================================================
-- Safe: CREATE VIEW only. No UPDATE/DELETE. Drop before replace if names clash.
-- =============================================================================

-- Per-contact operational receivables/payables (RPC — same basis as Contacts)
CREATE OR REPLACE VIEW public.v_basis_contact_operational_summary AS
SELECT
  c.id AS contact_id,
  c.name AS contact_name,
  c.type AS contact_type,
  cbs.receivables AS operational_receivable,
  cbs.payables AS operational_payable
FROM public.contacts c
INNER JOIN LATERAL public.get_contact_balances_summary(
  'db1302ec-a8d7-4cff-81ad-3c8d7cb55509'::uuid,
  NULL::uuid
) AS cbs ON cbs.contact_id = c.id
WHERE c.company_id = 'db1302ec-a8d7-4cff-81ad-3c8d7cb55509'::uuid;

COMMENT ON VIEW public.v_basis_contact_operational_summary IS
  'Operational party roll-up via get_contact_balances_summary for fixed company; branch NULL = all.';

-- Party GL signed balances (RPC — reconciliation / variance vs controls)
CREATE OR REPLACE VIEW public.v_basis_party_gl_summary AS
SELECT
  p.contact_id,
  p.gl_ar_receivable,
  p.gl_ap_payable,
  p.gl_worker_payable
FROM public.get_contact_party_gl_balances(
  'db1302ec-a8d7-4cff-81ad-3c8d7cb55509'::uuid,
  NULL::uuid
) AS p;

COMMENT ON VIEW public.v_basis_party_gl_summary IS
  'Party-attributed GL on 1100/2000/2010/1180 per contact — compare to controls via app SQL audit pack.';

-- Aggregated operational by contact type (helper for reporting)
CREATE OR REPLACE VIEW public.v_basis_operational_totals_by_type AS
SELECT
  c.type,
  COALESCE(SUM(v.operational_receivable), 0)::numeric AS sum_receivables,
  COALESCE(SUM(v.operational_payable), 0)::numeric AS sum_payables
FROM public.v_basis_contact_operational_summary v
INNER JOIN public.contacts c ON c.id = v.contact_id
GROUP BY c.type;

COMMENT ON VIEW public.v_basis_operational_totals_by_type IS
  'Sums operational recv/pay by contacts.type for the fixed company.';

-- Optional: expose unmapped AP bucket as view (same RPC as UI trace)
CREATE OR REPLACE VIEW public.v_basis_unmapped_ap_2000 AS
SELECT
  u.reference_type,
  u.net_amount
FROM public.get_control_unmapped_party_gl_buckets(
  'db1302ec-a8d7-4cff-81ad-3c8d7cb55509'::uuid,
  NULL::uuid,
  '2000'
) AS u;

COMMENT ON VIEW public.v_basis_unmapped_ap_2000 IS
  'Residual on AP 2000 by reference_type where party unresolved — not mixed with worker 2010.';
