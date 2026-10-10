# DIN CHINA Legacy Import — Apply Execution Plan

Generated for company `30bd8592-3384-4f34-899a-f3907e336485` (DIN CHINA).

## 1. Current partial import state

| Layer | State |
|-------|--------|
| Gateway | May be unstable (502 on company preflight) — **health check required** |
| Branch DIN CHINA `92f4184e-ee9b-4b6c-8e76-10ee1d166f55` | Exists → dry-run **reuse** |
| Payment accounts (6) | Exist → **6 reuse** |
| Legacy contacts | 21+ → **22 reuse** |
| Products (legacy marker) | **0** → dry-run plans **15 create** |
| Sales | **0/34** |
| Sale items | **0/63** |
| Sale payments | **0/70** |
| Purchase PO2025/0003 | **0** |
| Expenses EP2025/0001–0004 | **0/4** |
| Account 4000 Revenue | Does not exist |
| Resume safe | **true** (infrastructure only partial) |

## 2. Gateway risk

- Kong/PostgREST may return **502 Bad Gateway** under burst reads.
- Mitigations: `checkDinChinaGatewayHealth.js` (3 rounds, 3 min wait), `supabaseReadRetry.js`, `dinChinaImportStateCache.js` (batch dup checks), `canRunApply()` gate, no write retry on RPCs.

## 3. Pre-apply checks

- Env: `migration-tools/.env.migration` or root `.env.local` with `VITE_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (**never commit**).
- CSVs at repo root: `legacy_din_china_*.csv`
- Company UUID: `30bd8592-3384-4f34-899a-f3907e336485`
- Run gateway health → pre-apply audit gate → dry-run (all must pass before apply).

## 4. Dry-run pass criteria

- `pass: true`, `blockingErrors: []`, `liveImportApplied: false`
- `company.name === "DIN CHINA"`, `companyLookupStatus === "ok"`
- Branch **reuse**; accounts **6 reuse / 0 create**; contacts **22 reuse / 0 create**
- Products **15 create**; sales **34**; sale items **63**; sale payments **70**
- Purchases **1**; purchase items **17**; purchase payments **4**; expenses **4**
- Revenue **4100** Sales Revenue; AR **1100**; `paymentAccountsValid: true`
- `saleJournalStrategy: createSaleJournalEntry`

## 5. Apply command (once only)

```bash
node migration-tools/importDinChinaLegacy.js --company-id 30bd8592-3384-4f34-899a-f3907e336485 --apply
```

## 6. Post-apply verification

Run `auditDinChinaPostApply.js` — validates counts/totals vs `EXPECTED_TOTALS`, Dr 1100 / Cr 4100, no 4000/4050 posting, excluded data not imported.

Outputs: `din_china_post_apply_audit.json`, `din_china_post_apply_audit.md`, `legacy_din_china_import_final_report.md`.

## 7. Rollback / stop rules

| Condition | Action |
|-----------|--------|
| Gateway health unstable | **STOP** — no apply |
| Pre-audit: sales in 1..33 or payments in 1..69 or partial purchase/expenses | **STOP** before apply |
| Dry-run `pass !== true` | **STOP** |
| Apply fails or `applyResult.pass === false` | **Do not re-run apply** — run partial audit, report, stop |
| Already fully imported (34/34 etc.) | Skip apply, report complete |

**Excluded by design (never import):** account_transactions, fund transfers, opening balances, manual GL, branch id 1 / DIN COLLECTION, sell_return CN2025/0001, unlinked advance payments.

## 8. Deploy / commit rules

**Commit only after successful apply + post-apply audit:**

- `migration-tools/output/*.md`, `*.json` (no secrets)
- `migration-tools/*.js`, `migration-tools/lib/*.js`

**Never commit:** `.env.local`, `.env.migration`, `downloads/`, `erp-flutter-app/releases/`, keys, binaries.

Message: `chore(migration): finalize DIN CHINA legacy import`

**Deploy:** Migration-only changes → **no frontend deploy**. No unrelated SQL migrations.

## 9. COA cleanup (post-import metadata only)

**Applied:** 2026-06-14 — `repairDinChinaPostImport.js --apply-coa-cleanup`

**Scope:** Six imported payment accounts only. Updates `name`, `code`, `parent_id`, `type` (metadata). No balance, JE amount, payment/expense amount, or account ID changes.

**Parents created (groups):**

| Code | Name | Role |
|------|------|------|
| 1201 | USD TT Agent Clearing | tt_agent_clearing |
| 1203 | Carrier Shipment Agent | agent_clearing |

**Account renames / codes:**

| Old code | New code | Old name | New name | Parent |
|----------|----------|----------|----------|--------|
| DC0115 | 1051 | DIN CHINA Cash | China Cash | 1050 Cash & Cash Equivalents |
| DC0106 | 1061 | MCB | MCB | 1060 Bank Accounts |
| DC0108 | 1062 | DIN FHD MZ | FHD MZ | 1060 Bank Accounts |
| DC0159 | 1063 | DIN NDM MZ | NDM MZ | 1060 Bank Accounts |
| DC0133 | 1202 | WALI DIN T/T | WALI T/T | 1201 USD TT Agent Clearing |
| DC0157 | 1204 | YAQOOB | YAQOOB | 1203 Carrier Shipment Agent |

**Commands:**

```bash
# Preview (must pass before apply)
node migration-tools/repairDinChinaPostImport.js --company-id 30bd8592-3384-4f34-899a-f3907e336485

# Apply
node migration-tools/repairDinChinaPostImport.js --company-id 30bd8592-3384-4f34-899a-f3907e336485 --apply-coa-cleanup
```

**Outputs:** `din_china_coa_cleanup_preview.md/json`, `din_china_coa_cleanup_final_report.md`

**Verification:** All DC codes removed company-wide; balances and payment/expense link counts unchanged; no account 4000; no 4050 posting lines.

**Deploy:** Migration-tools + reports only → **no VPS/frontend deploy**.

## 10. Stock movement repair (post-import document backfill)

**Applied:** 2026-06-14 — `repairDinChinaPostImport.js --apply-stock-repair`

**Scope:** Backfill `stock_movements` for legacy final sales (OUT) and received purchase (IN). No opening balance stock. No JE/payment changes.

**Root cause:** Import used `track_stock: false` on products; purchase header inserted as `received` before line items (trigger idempotency blocked remaining IN lines).

**Results:**

| Metric | Count |
|--------|-------|
| Sale movement lines inserted | 63 |
| Purchase movement lines inserted | 16 (+ 1 existing) |
| Sales with movements | 34/34 |
| Purchase lines covered | 17/17 |
| Products `track_stock` → true | 16 |

**Commands:**

```bash
node migration-tools/repairDinChinaPostImport.js --company-id 30bd8592-3384-4f34-899a-f3907e336485 --preview-stock-repair
node migration-tools/repairDinChinaPostImport.js --company-id 30bd8592-3384-4f34-899a-f3907e336485 --apply-stock-repair
```

**Outputs:** `din_china_stock_repair_preview.md/json`, `din_china_stock_repair_final_report.md`

**Future import fix:** [`dinChinaApply.js`](../../migration-tools/lib/dinChinaApply.js) — `track_stock: true`; purchase `ordered` → items → `received`.

**Deploy:** Migration-tools only → **no VPS/frontend deploy**.
