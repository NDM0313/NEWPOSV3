# ERP Final Stabilization Prompt

Use this prompt in Cursor AI.

```text
Perform FINAL ERP STABILIZATION for this project based on the completed database audit, architecture audit, and safe cleanup plan.

Goal:
Stabilize the ERP for production by fixing reporting alignment, verifying payment indexes, reducing dashboard query load, documenting legacy structures, and preserving the canonical accounting architecture.

Critical rules:
- Safety first
- Prefer minimal, targeted changes
- Do not drop tables
- Do not rename tables
- Do not remove legacy structures unless fully proven unused
- Before changing anything, inspect current code and schema carefully
- Create/update documentation for every change
- If any migration is needed, make it idempotent (IF NOT EXISTS / safe guards)
- Preserve compatibility with web + mobile

Project truths already established:
1. Canonical sale line table = sales_items
2. Legacy/fallback sale line table = sale_items
3. Canonical accounting = accounts + journal_entries + journal_entry_lines
4. chart_accounts is legacy for posting
5. ledger_master / ledger_entries are subsidiary ledgers, not duplicates
6. Canonical document numbering = erp_document_sequences
7. Legacy numbering fallback = document_sequences
8. Canonical studio path = studio_productions + studio_production_stages
9. Studio v2/v3 tables are optional/versioned (feature-flag dependent), not removable now
10. Dashboard is slow because it uses multiple queries / fallbacks instead of one consolidated RPC

Work in phases:

PHASE 1 — Reporting Service Alignment
Objective:
Make reporting consistent with the canonical sale line table.

Tasks:
1. Inspect accountingReportsService and related reporting code.
2. Change all sale line item reads to:
   - use sales_items first
   - fallback to sale_items only where needed
3. Do not break historical compatibility.
4. Keep the implementation safe for deployments where one table may still be used.
5. Add short comments in code where fallback behavior exists.

Deliverables:
- updated reporting service code
- docs/ERP_REPORTING_ALIGNMENT.md

PHASE 2 — Payments Index Verification and Safe Migration
Objective:
Ensure payments table has only the required indexes and avoid duplicate-index errors.

Tasks:
1. Inspect actual payments table columns and current pg_indexes state.
2. Verify existence of:
   - company_id index
   - company_id + payment_date
   - company_id + created_at
   - reference_type + reference_id
3. Create only missing indexes.
4. Use safe SQL:
   CREATE INDEX IF NOT EXISTS ...
5. If an equivalent index already exists under a different name, document it and do not create a duplicate.
6. Generate one migration file only if truly needed.

Deliverables:
- migrations/<safe_payments_index_migration>.sql (only if needed)
- docs/ERP_PAYMENTS_INDEX_AUDIT.md

PHASE 3 — Dashboard RPC Consolidation
Objective:
Reduce dashboard load to 1 RPC (+ optional lightweight alerts call).

Tasks:
1. Inspect current Dashboard.tsx, dashboardService, financialDashboardService, businessAlertsService, productService.getLowStockProducts.
2. Design and implement a consolidated RPC:
   get_dashboard_metrics(
     p_company_id UUID,
     p_branch_id UUID DEFAULT NULL,
     p_start_date DATE DEFAULT NULL,
     p_end_date DATE DEFAULT NULL
   )
3. RPC should return JSON including:
   - financial metrics
   - sales_by_category
   - low_stock_items
   - optionally alerts
4. Update frontend to use the new RPC.
5. Keep graceful fallback only if absolutely necessary.
6. Keep response payload compact.
7. Ensure company/branch scoping is correct.
8. Document query reduction before/after.

Deliverables:
- migration for get_dashboard_metrics RPC
- dashboard frontend update
- docs/ERP_DASHBOARD_RPC_IMPLEMENTATION.md

PHASE 4 — Legacy Structure Documentation
Objective:
Document legacy structures clearly so future AI/code work avoids confusion.

Tasks:
1. Add documentation comments / notes for:
   - sale_items (legacy)
   - chart_accounts (legacy for posting)
   - document_sequences (legacy fallback)
2. Prefer database COMMENT ON TABLE statements only if safe and practical.
3. If DB comments are not practical in this phase, document clearly in markdown.
4. Do not remove ledger_master / ledger_entries.
5. Do not remove studio v2/v3 tables.

Deliverables:
- docs/ERP_LEGACY_STRUCTURE_NOTES.md
- optional safe SQL comments migration

PHASE 5 — Accounting Guardrail Verification
Objective:
Confirm all accounting posting still uses canonical journal tables.

Tasks:
1. Re-check:
   - sales posting
   - purchases posting
   - payments posting
   - expenses posting
   - refunds / returns
   - shipment posting
   - stock adjustments
2. Confirm nothing new writes to chart_accounts / account_transactions.
3. Confirm reporting still reads accounts + journal_entries + journal_entry_lines.
4. Document any exceptions.

Deliverables:
- docs/ERP_ACCOUNTING_GUARDRAIL_CHECK.md

PHASE 6 — Final Output
Create/update the following files:

- docs/ERP_REPORTING_ALIGNMENT.md
- docs/ERP_PAYMENTS_INDEX_AUDIT.md
- docs/ERP_DASHBOARD_RPC_IMPLEMENTATION.md
- docs/ERP_LEGACY_STRUCTURE_NOTES.md
- docs/ERP_ACCOUNTING_GUARDRAIL_CHECK.md
- docs/ERP_FINAL_STABILIZATION_REPORT.md

Final report must include:
1. What was changed
2. What was verified
3. What remains intentionally untouched
4. Any migration files created
5. Any rollback notes
6. Performance impact summary
7. Remaining optional future work

Important:
- Make real changes where safe and necessary
- Keep changes minimal and production-safe
- Do not perform destructive cleanup
- Do not guess: inspect code/schema before changing
- Preserve compatibility with web, mobile, and existing data
```
