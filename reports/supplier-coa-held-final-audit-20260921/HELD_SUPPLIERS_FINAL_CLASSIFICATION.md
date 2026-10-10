# Held suppliers — final classification (READ-ONLY)

**Date:** 2026-09-21  
**Branch:** `feat/held-supplier-coa-final-audit`  
**Base main (post ID LACE merge):** `bb3d3ec4523a631d5882db8bbc377bf4f1948541`  
**Company:** `e08a04af-22a8-4869-9b4d-da31fce13158`  
**Aggregate status:** `HELD_SUPPLIER_AUDIT_COMPLETE`  
**Production mutations:** **NONE**

## Scope closures preserved

| Scope | Status | Evidence |
|-------|--------|----------|
| Ibrahim | `PARTY_JE_IBRAHIM_FINAL_CLOSED` | Lines on `AP-SUPZHD0026`; `run_id=ibrahim_v1_20260919143935` |
| ID LACE | `ID_LACE_FINAL_NO_REPAIR_REQUIRED` | legacy `210027`=0; AP=89 |
| Held fingerprint | unchanged | `2e2a9c788c0a7e7575ab10b3857b5b7b` |
| Company GL imbalance | **0.00** | posted non-void |
| FAROOQ / ALEEM / FAHAD | not altered | out of this phase |

## Master table

| Party | Canonical acct | Legacy acct(s) | Canonical lines | Suspect outside-canonical | Eligible remap | Ambiguous | Final status |
| ----- | -------------- | -------------- | --------------: | ------------------------: | -------------: | --------: | ------------ |
| DHL | `AP-SUPZHD0007` | `210007` (0 lines) | 48 | 0 (legacy empty) | **0** | **0** | `LEGIT_SPECIAL_ACCOUNTING_MODEL` |
| KIRAN MUKESH | `AP-SUPZHD0036` | `210036` (0 lines) | 68 | 0 | **0** | **0** | `LEGIT_SPECIAL_ACCOUNTING_MODEL` |
| SHAHMIM NAZ | `AP-SUPZHD0046` | `210046` (0 lines) | 86 | 0 | **0** | **0** | `LEGIT_SPECIAL_ACCOUNTING_MODEL` |

**Important:** “Eligible remap” here means **legacy→canonical AP/AR line moves** (same Class B/C dual-account sense). All three parties already have history on the AP leaf and **empty** legacy accounts. They remain **held** from automatic AP consolidation because their **economic role** is not merchandise-supplier AP (courier deposits / worker advances), not because dual GL leaves still need FAROOQ-style remaps.

Detail: [`DHL_READONLY_AUDIT.md`](DHL_READONLY_AUDIT.md) · [`KIRAN_READONLY_AUDIT.md`](KIRAN_READONLY_AUDIT.md) · [`SHAHMIM_READONLY_AUDIT.md`](SHAHMIM_READONLY_AUDIT.md)

---

## Individual verdicts

### DHL — `LEGIT_SPECIAL_ACCOUNTING_MODEL`

| Field | Value |
|-------|--------|
| Contact | `6ce5bed0-bd0a-495d-8841-19f90be6188c` · `SUP-ZHD-0007` · **DHL** · type `supplier` · active |
| Not | **DHL PK** (`SUP-ZHD-0162`) — separate contact with `2030162` courier leaf |
| Canonical | `AP-SUPZHD0007` under **2000** · net Dr−Cr **4,700,000** · 48 lines |
| Legacy | `210007` inactive unlinked · **0** lines · verified remap → AP |
| Purchases | **0** |
| Payments | 1 (`PAY-6729` 2026-09-15 on AP leaf) |
| Eligible AP remap | **0** · simulated `TOTAL_GL_EFFECT=0` (no-op) |
| Current posting | Payments + JE resolve to **AP leaf** (narration may still say 210007) → historical wording ≠ dual GL |

Why special: deposit/advance-heavy pattern under merchandise AP; true courier control is **2030** (used by DHL PK, not this DHL). Auto AP dual-repair would be wrong; role→203x migration is a **separate** owner-approved design (not dual-account remap).

### KIRAN MUKESH — `LEGIT_SPECIAL_ACCOUNTING_MODEL`

| Field | Value |
|-------|--------|
| Contact | `797ca8bb-5491-4827-8d6e-c7971d20a022` · `SUP-ZHD-0036` · type `supplier` · active |
| Canonical | `AP-SUPZHD0036` · net **2,250,000** · 68 lines |
| Legacy | `210036` · **0** lines · remap present |
| Purchases | **0** |
| Payments | 1 (`PAY-6720` 2026-09-07 on AP) |
| Pattern | OB/journal **debits** (advances) + transfer **credits** (`CLOSING` bills) — worker-like on supplier AP |
| Eligible AP remap | **0** |

Worker targets **1180 / 2010** are a future role package, not legacy→AP repair.

### SHAHMIM NAZ — `LEGIT_SPECIAL_ACCOUNTING_MODEL`

| Field | Value |
|-------|--------|
| Contact | `f902a1f8-cc8a-4508-8c47-beb1850da1ed` · `SUP-ZHD-0046` · type `supplier` · active |
| Canonical | `AP-SUPZHD0046` · net **5,000,000** · 86 lines |
| Legacy | `210046` · **0** lines · remap present |
| Purchases | **0** |
| Payments | 1 (`PAY-6719` 2026-09-06 on AP) |
| Pattern | Same worker-like advance / closing-bill structure as KIRAN |
| Eligible AP remap | **0** |

---

## Dual-account inventory summary (all three)

| Bucket | DHL | KIRAN | SHAHMIM |
|--------|----:|------:|--------:|
| A Canonical AP leaf | 48 | 68 | 86 |
| B Legacy payable | 0 | 0 | 0 |
| C Manual JE outside canonical payable | 0* | 0* | 0* |
| D Informational off-leaf name mention (bank/AR) | present | present | present |
| E Other-party contamination needing ownership fix | 0 | 0 | 0 |
| F Intentional non-AP ops (none dedicated yet) | — | — | — |

\*Counterparty bank/AR legs exist on JEs; they are not misfiled party payables.

Line classifications for AP history: **`CANONICAL_ALREADY_CORRECT`** (as current CoA leaf).  
Off-leaf bank/AR: **`LEGIT_NON_AP_OPERATIONAL`**.  
Legacy: empty → no `ELIGIBLE_ACCOUNT_REMAP_CANDIDATE`.  
Stale “(2100xx)” in JE text while posted to AP: **`COSMETIC_ONLY`**.

---

## Current vs historical

| Party | Historical dual 210↔AP? | Current posting path |
|-------|-------------------------|----------------------|
| All three | Resolved for lines (legacy empty; remaps live) | Payment + GE land on **AP-SUP*** leaf |
| Issue type | **Not** `CURRENT_POSTING_PATH_ISSUE` for AP leaf | Optional future: contact-type / 203x / 1180–2010 role model |

---

## Repair design

**None prepared for execution.** No party is `REPAIR_CANDIDATE_READY_FOR_DESIGN` for dual-account remaps (eligible count = 0).

Prior role-consolidation *previews* (courier/worker) remain design references only and require separate explicit owner approval — out of scope to draft apply SQL here.

---

## Explicit statements

- production mutations: **NONE**
- repair SQL executed: **NO**
- Ibrahim touched: **NO**
- ID LACE touched: **NO**
- historical narration edited: **NO**
- Graphify stash touched: **NO**
- deploy: **NO**
- held-audit branch merged: **NO**
