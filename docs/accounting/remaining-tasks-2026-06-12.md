# Remaining tasks — 12–13 Jun 2026

Work applied: **rental AR sub-ledger fail-closed**, **Hybrid Repair / gl_correction**, **AR/AP Reconciliation UX** (variance breakdown, queue 2d, unmapped whitelist), **Control 1100 effective ledger visibility**, plus **2026-06-13 bundle** (Duplicate Product, rental bill ref parity, Customers & Suppliers report, accounting diagnostics hub).

**Sync status (13 Jun):** Local + VPS at `main` `1d8c216f`. VPS migrations through `20260623120000` recorded; `deploy/vps-build-erp-only.sh` rebuild + `erp-frontend` healthy.

**Self-service void:** Admin/Owner can remove stale payment reversals from live GL — see [`transaction-cancel-guide.md`](transaction-cancel-guide.md) (Journal hygiene → **Remove from live GL**).

---

## Verify on production (user)

- [ ] Hard refresh `https://erp.dincouture.pk` (Ctrl+Shift+R / clear cache).
- [ ] **Account Ledger → General Ledger → 1100 → Effective**: JE-0001–0004 and JV-000204–207 pairs hidden; sale reversals + manual receipt still visible.
- [ ] **Customer Statement / Receivable — Inayat**: party rental + correction activity visible (Inayat ~10,000 AR).
- [ ] **AR/AP Reconciliation Center**: variance breakdown (Patras/Mahvish links), queue 2d, Hybrid Repair copy, RCV-0008 not in unmapped heuristic.

---

## Control 1100 — follow-up (not rental repair)

Effective view hides **repaired rental leakage pairs only**. Control 1100 net on DIN BRIDAL is **-136,500** (journal lines, non-void) from non-rental lines:

| Entry | Type | Amount direction | Notes |
|-------|------|------------------|-------|
| JE-0155 / JE-0157 | sale_reversal | Cr ~136,500 | Posted on control 1100 — review if should live on party sub-ledgers |
| JV-000203 | gl_correction (HQ-SL orphan) | Dr 150 | Different fingerprint; intentionally still visible on 1100 |

**Options (pick one per item):**

- [ ] Apply additional Hybrid Repair / gl_correction if defects exist in queue.
- [ ] Extend visibility contract (only if business agrees these are “noise” on control).
- [ ] Reclass / manual journal to move activity to correct AR-CUS* accounts (accounting decision).

---

## Optional engineering (Phase 2)

- [ ] **Server RPC** `get_control_ar_gl_ledger` if client-side 1100 pairing is slow on large ledgers (plan Phase 2 — not needed yet).
- [x] Default **Include adjustments = off** when account 1100 is selected (minor UX polish) — `AccountLedgerReportPage.tsx` (2026-06-13).

---

## Mobile / Flutter

- [ ] End-to-end test: new rental booking posts to **AR-CUS*** (not 1100) on mobile + web after `20260618120000` fail-closed migration.
- [ ] Rebuild and ship mobile APK if rental write path changes need field verification (`erp-flutter-app`, `erp-mobile-app`).

---

## Diagnostics (repeat checks)

```bash
# On VPS
ssh dincouture-vps 'docker exec -i supabase-db psql -U postgres -d postgres' \
  < scripts/sql/diag_rental_1100_leakage.sql

ssh dincouture-vps 'docker exec -i supabase-db psql -U postgres -d postgres' \
  < scripts/sql/diag_ar_ap_variance.sql
```

Expected: **eligible rental leaks = 0**, **corrected = 4**, Inayat party AR ~10,000, Haseeb N38 ~0.

**Last run (2026-06-13, after `git pull` + VPS deploy):** eligible **0**, corrected **4** / Rs 210,000; control 1100 net **-136,500**; Inayat **10,000**, Haseeb N38 **0**; RCV-0008 `is_unmapped_heuristic = f`; variance RPC `ok`, residual bucket **0**, Patras/Mahvish order-advance links present.

---

## 2026-06-13 release — manual QA (see `docs/RELEASE_NOTES_2026-06-13.md`)

- [ ] Web: Duplicate product → one new row only
- [ ] Web: Rental booking with bill ref → list Bill # → pickup preserves bill ref
- [ ] Mobile: SalesHome All + Rental tabs; rental payment Ref lines
- [ ] Reports → Sales loads data (no 400); lifecycle filters correct
- [ ] Reports → **Customers & Suppliers** loads with Due (GL) + Advance (GL) columns
- [ ] Accounting hub: AR/AP diagnostics tabs, Balance Basis Guide, Trial Balance journal search

---

## Out of scope (unchanged policy)

- Voiding or rewriting original wrong 1100 JEs (additive repair only).
- Changing `create_gl_correction_journal` double-entry rules.
- Making ~2.5M Hybrid Repair COA diagnostic row zero (structural).
