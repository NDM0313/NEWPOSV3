# Trial Balance / Reports — balance mismatch + date sync (16 Jun 2026)

**Commit:** `3136cad7`  
**Production:** https://erp.dincouture.pk (deployed 16 Jun 2026)  
**Company:** DIN CHINA (`30bd8592-3384-4f34-899a-f3907e336485`)

---

## Problem reported

1. **Trial Balance** showed non-zero customer balances (e.g. RAEES ~600k, MURAD ~257k) while party statements appeared zero or inconsistent.
2. **Header date change** did not reliably refresh financial reports (Balance Sheet, TB, P&L); Daybook / General Entries worked.

---

## Root cause — RAEES LHR

| Surface | Finding |
|---------|---------|
| Sale DC-0003 | Dr **965,540** posted to party account `AR-11D58D` (JE-0037) |
| Payments | Six receipts total **965,540** — operational `paid_amount` correct, `due_amount` = 0 |
| Mis-posting | **RCV-0003**, **RCV-0030**, **RCV-0054** credited control **1100** (600,000) instead of `AR-11D58D` |
| Later receipts | RCV-0080, RCV-0085, RCV-0113 correctly credited `AR-11D58D` (365,540) |
| Result | Party GL net **600,000** orphan; operational receivables **0** |

TB and Balance Basis Guide were reading GL correctly; the gap was legacy payment posting to control 1100 instead of the party sub-ledger.

---

## MURAD RAMDAS — no GL repair

| Surface | Finding |
|---------|---------|
| GL net | **257,140** on `AR-166142` |
| Operational | **257,140** receivable |
| Open sale | **DC-0007** — final, `due_amount` 257,140, no payments |

Balance is **legitimate unpaid AR**, not a posting error.

---

## Production repair (16 Jun 2026)

Moved 3 payment credit lines (600,000 total) from account **1100** → **AR-11D58D**:

| Entry | Credit moved |
|-------|--------------|
| RCV-0003 | 200,000 |
| RCV-0030 | 200,000 |
| RCV-0054 | 200,000 |

- Audit: `party_repair_audit` (`reason_code = raees_ar_control_misallocation`)
- **After repair:** RAEES party GL net = **0.00**

### Scripts

| File | Purpose |
|------|---------|
| [`scripts/sql/diag_raees_murad_balance_tieout.sql`](../../scripts/sql/diag_raees_murad_balance_tieout.sql) | Read-only tie-out (GL, RPC, operational, line-level) |
| [`scripts/sql/repair_raees_ar_control_misallocation.sql`](../../scripts/sql/repair_raees_ar_control_misallocation.sql) | Dry-run + repair notes (APPLY already run on VPS) |

### VPS commands

```bash
# Diagnosis (read-only)
ssh dincouture-vps "docker exec -i supabase-db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=0" \
  < scripts/sql/diag_raees_murad_balance_tieout.sql

# Dry-run repair
ssh dincouture-vps "docker exec -i supabase-db psql -U supabase_admin -d postgres" \
  < scripts/sql/repair_raees_ar_control_misallocation.sql
```

---

## UI / code fixes (`3136cad7`)

| Fix | File |
|-----|------|
| Balance Sheet syncs header `asOfDate` | `src/app/components/reports/BalanceSheetPage.tsx` |
| Financial reports remount on date/branch/type change | `src/app/components/reports/ReportsDashboardEnhanced.tsx` |
| `'reports'` in filter invalidation + date change dispatch | `src/app/context/GlobalFilterContext.tsx`, `src/app/lib/dataInvalidationBus.ts` |
| TB column **Period net (Dr−Cr)** + tooltip | `src/app/components/reports/TrialBalancePage.tsx` |

---

## Verification checklist

| Check | Expected |
|-------|----------|
| RAEES party GL / TB / Balance Basis Guide | **0.00** |
| MURAD party GL / TB / Balance Basis Guide | **257,140** (until DC-0007 paid) |
| Change header date on Balance Sheet / TB | Report reloads |
| Control 1100 vs sum(party AR) | Improved after RAEES repair; other 1100 leaks may remain |

---

## Related pattern (batch follow-up)

Same **1100 vs party sub-ledger** misallocation may affect other legacy imports (e.g. AZIZ JAMURAD showed 755,500 GL net with 0 operational in diag). Scan with diag script and apply targeted line moves — **no bulk DELETE**.

See [`remaining-tasks-2026-06-16.md`](remaining-tasks-2026-06-16.md).
