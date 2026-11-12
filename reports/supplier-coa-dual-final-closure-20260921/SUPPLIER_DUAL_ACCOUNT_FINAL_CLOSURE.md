# Supplier dual-account cleanup — FINAL CLOSURE

**Date:** 2026-09-21  
**Final verdict:** `SUPPLIER_DUAL_ACCOUNT_CLEANUP_FINAL_CLOSED`  
**Held-audit status:** `HELD_SUPPLIER_AUDIT_CLOSED`  
**Production mutations this phase:** **NONE**

---

## 1. Repository state

| Field | Value |
|-------|--------|
| Pre-held-audit `main` | `bb3d3ec4523a631d5882db8bbc377bf4f1948541` |
| Held-audit branch | `feat/held-supplier-coa-final-audit` @ `798207e6a62f9507057fb9af1fac30441a13c9c7` |
| Held-audit merge | `ccf8bf504a7bd43ab46a39fc5bc9ea868b774dcc` |
| Updated `main` (post held merge) | `ccf8bf504a7bd43ab46a39fc5bc9ea868b774dcc` |
| Held merge safety | `HELD_AUDIT_MERGE_SAFE` (4 report files only under `reports/supplier-coa-held-final-audit-20260921/`) |
| Last intentional ERP app deploy (Party-JE alignment) | `f7118c6b930d413415a95cd749f2b1bcbdacb68b` |
| Docs-only commits after that deploy | alignment evidence, ID LACE audit, held audit — **no ERP redeploy this phase** |

### Graphify

- Stash `graphify-out-of-scope-ui-phase` — **present, untouched** (not popped / not committed)

---

## 2. Completed repair / audit scopes

| Scope | Status |
|-------|--------|
| Sept 16 multi-pair historical merge | History on AP; Class A parties clean |
| Party-JE guards + attributed ledger | Merged + deployed (`f7118c6b`); migration bookkeeping SKIPs |
| Ibrahim Class B | `PARTY_JE_IBRAHIM_FINAL_CLOSED` — 2 lines on `AP-SUPZHD0026`; backup `ibrahim_v1_20260919143935` |
| ID LACE Class C | `ID_LACE_FINAL_NO_REPAIR_REQUIRED` + `ID_LACE_AUDIT_CLOSED` |
| DHL / KIRAN / SHAHMIM held audit | `HELD_SUPPLIER_AUDIT_COMPLETE` → **`HELD_SUPPLIER_AUDIT_CLOSED`** (merged docs) |

---

## 3. Final party matrix

| Party | Contact | Legacy | Canonical | Legacy live lines | Canon lines | Repair needed | Final status |
| ----- | ------- | ------ | --------- | ----------------: | ----------: | ------------- | ------------ |
| FAROOQ BNRS EMB | `SUP-ZHD-0177` | `210177` | `AP-SUPZHD0177` | **0** | 28 | No | `HISTORICAL_CLEAN` |
| ALEEM BNRS | `SUP-ZHD-0096` | `210096` | `AP-SUPZHD0096` | **0** | 186 | No | `HISTORICAL_CLEAN` |
| FAHAD LACE | `SUP-ZHD-0022` | `210022` | `AP-SUPZHD0022` | **0** | 66 | No | `HISTORICAL_CLEAN` |
| IBRAHIM BNRS | `SUP-ZHD-0026` | `210026` | `AP-SUPZHD0026` | **0** | 273 | Done | `REPAIRED_AND_CLOSED` |
| ID LACE | `SUP-ZHD-0027` | `210027` | `AP-SUPZHD0027` | **0** | 89 | No (already on AP) | `NO_REPAIR_REQUIRED` |
| DHL | `SUP-ZHD-0007` | `210007` | `AP-SUPZHD0007` | **0** | 48 | No dual remap | `LEGIT_SPECIAL_ACCOUNTING_MODEL` |
| KIRAN MUKESH | `SUP-ZHD-0036` | `210036` | `AP-SUPZHD0036` | **0** | 68 | No dual remap | `LEGIT_SPECIAL_ACCOUNTING_MODEL` |
| SHAHMIM NAZ | `SUP-ZHD-0046` | `210046` | `AP-SUPZHD0046` | **0** | 86 | No dual remap | `LEGIT_SPECIAL_ACCOUNTING_MODEL` |

**Remaining eligible legacy→AP candidates (scoped parties):** **0**  
**Remaining unresolved dual-account candidates (scoped parties):** **0**  
**Post-closure regression (new live legacy lines):** **NONE** (`POST_CLOSURE_REGRESSION_DETECTED` not raised)

---

## 4. Legacy→AP leftover verification (READ-ONLY 2026-09-21)

| Legacy | Active | Linked | Live lines | Verified remap |
|--------|--------|--------|----------:|----------------|
| `210026` Ibrahim | inactive | no | 0 | → `AP-SUPZHD0026` |
| `210027` ID LACE | inactive | no | 0 | → `AP-SUPZHD0027` |
| `210007` DHL | inactive | no | 0 | → `AP-SUPZHD0007` |
| `210036` KIRAN | inactive | no | 0 | → `AP-SUPZHD0036` |
| `210046` SHAHMIM | inactive | no | 0 | → `AP-SUPZHD0046` |
| `210022` FAHAD | inactive | no | 0 | → `AP-SUPZHD0022` |
| `210096` ALEEM | inactive | no | 0 | → `AP-SUPZHD0096` |
| `210177` FAROOQ | inactive | no | 0 | (Sept16 clean; AP leaf active) |

Ibrahim repair lines still on `AP-SUPZHD0026`. ID LACE AP=89 / legacy=0. Held fingerprint unchanged: `2e2a9c788c0a7e7575ab10b3857b5b7b`.

---

## 5. Controls preventing recurrence

| Control | Status | Evidence |
|---------|--------|----------|
| DB trigger `trg_guard_journal_entry_line_account` | enabled | live catalog RO |
| `resolve_journal_posting_account_id` + public core | present | live catalog RO |
| `journal_account_verified_remaps` | present | remaps for scoped 210→AP pairs |
| Migration bookkeeping | 1 row | `20260919140000_…sql` (deploy SKIP) |
| Client JE guard | in `main` since Party-JE merge | `journalPartyPosting.ts`, `AddEntryV2` `assertPureJournalAccounts`, `mapJournalAccountGuardError` |
| Automated gate | PASS | CI run [35605301628](https://github.com/NDM0313/NEWPOSV3/actions/runs/35605301628) on `75f70304`; Cases A–G / unit / client guards previously PASS |
| Current payment path | canonical AP leaf | DHL/KIRAN/SHAHMIM/ID LACE recent `PAY-*` post to `AP-SUP*` |

No new migration added for closure.

---

## 6. Deferred — NOT dual-account remaps

Documented as `DEFERRED_ROLE_MODEL_DECISION` (no mutation):

| Topic | Note |
|-------|------|
| **DHL** local | Deposit/advance economics on supplier AP; ≠ **DHL PK** (`2030162`). Future courier/deposit model is architectural. |
| **KIRAN** | Worker-like advances/closings on supplier AP; future `1180` / `2010` package needs separate owner approval. |
| **SHAHMIM** | Same worker-model deferral as KIRAN. |
| Cosmetic narration | JE text may still say `(2100xx)` while GL uses AP — `COSMETIC_ONLY`; do not bundle with account remaps. |

These are **not** unfinished 210→AP cleanup.

---

## 7. Accounting invariants

| Invariant | Value |
|-----------|------:|
| Company GL imbalance (posted non-void) | **0.00** |
| New dual-write to scoped legacy 210xxx | **0** |
| Unresolved account-remap candidates (scope) | **0** |

---

## 8. Explicit production mutation statement

- production mutations this phase: **NONE**
- repair SQL executed: **NO**
- migration executed: **NO**
- Ibrahim touched: **NO**
- ID LACE touched: **NO**
- DHL/KIRAN/SHAHMIM accounting moved: **NO**
- historical narration edited: **NO**
- Graphify stash touched: **NO**
- ERP deploy: **NO**

---

## 9. Final project verdict

`SUPPLIER_DUAL_ACCOUNT_CLEANUP_FINAL_CLOSED`

Meaning:

- Historical dual-account repair work for the known scope is complete.
- Known 210→AP leftovers are resolved (Ibrahim) or proven unnecessary (ID LACE / Class A / held parties with empty legacy).
- Special role/account architecture questions remain deferred.
- **No further supplier account remap phase should be opened without new evidence.**
