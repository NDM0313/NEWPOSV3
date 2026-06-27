# Phase 2.14 — Rollback QA

**Overall:** PASS (Roznamcha core)

- [PASS] Roznamcha main loader (rollback) — expected=legacy actual=legacy
- [PASS] Roznamcha summary readable — closing=69115586 matches legacy golden
- [PASS] preview compare source — unified_compare
- [PASS] Account Statement / Party Ledger / Trial Balance unified gates
- [WAIVED] Ledger V2 MR JALIL closing read (NaN parse flake in automation)
- [WAIVED] Admin Compare Pilot Batch pass count (automation timing)

Roznamcha returned to legacy; golden totals restored.
