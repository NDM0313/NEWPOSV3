# Supplier dual CoA forensic audit (REVISED — owner clarification)

**Date:** 2026-09-19 (rev 2)  
**Repo:** NDM0313/NEWPOSV3  
**Mode:** Diagnosis + repair preview + **local** General JE party posting — **no production writes / deploy** in this phase.

## Owner clarification (binding)

1. **KIRAN MUKESH** and **SHAHMIM NAZ** are **workers/artisans** (DB may still say `supplier`). Advances settle against work charges/adjustments. Debit balances are **valid**, not proof of bad entries.
2. **DHL** is a **courier**, historically registered as supplier; deposits settle against parcel charges. Debit balances are **valid**.
3. Original limitation: owner could not conveniently post **General JE to a supplier**. Workarounds created separate named accounts. **Preserve** legitimate JE payments, advances, and adjustments.
4. Do **not** auto-change contact types or move parties to worker/courier controls from this clarification alone.
5. Keep **DHL** and **DHL PK** as separate contacts. Do not merge by name.

## 1. Environment

| Item | Value |
|---|---|
| Local / VPS HEAD (prior audit) | `82ebe4a7` |
| Primary company | DIN COLLECTION `e08a04af-22a8-4869-9b4d-da31fce13158` |
| DB | Supabase MCP — SELECT diagnostics only this phase |
| Backup schema | `backup_coa_merge_20260916` (do not overwrite) |

## 2. Revised diagnosis

### What was wrong vs what was not

| Observation | Prior wording | Revised |
|---|---|---|
| Debit-heavy nets on DHL / KIRAN / SHAHMIM | Implied erroneous | **Valid** advance/deposit vs later charges pattern |
| Dual 210xxx + AP-SUP* same `linked_contact_id` | “Eligible remap” | **Split account routing** — may need consolidation **or** explicit multi-account party attribution; role-verify first for DHL/KIRAN/SHAHMIM |
| JE without PAY-* | Sometimes framed as incomplete | **Legitimate**; do not recreate as PAY |
| IBRAHIM 2 lines on inactive `210026` | Leftover eligible remap | Still **eligible** (stale UUID after Sept 16 unlink) — not a debit-balance “error” |
| DHL PK `2030162` vs DHL `210007` | Blocked | Still **blocked** from any DHL merge — separate contact/role |

### Classes (revised)

| Class | Meaning | Production action this phase |
|---|---|---|
| **A** Already clean (Sept 16) | History on AP; legacy inactive | **No remap** |
| **B** Post-merge leftover on inactive legacy | IBRAHIM 2 JE lines | Remap **line IDs only** after owner OK + new backup |
| **C** Merchandise dual (never merged) | **ID LACE** only among remaining duals | Eligible FAROOQ-style remap after owner OK |
| **R** Role-aware hold | **DHL, KIRAN MUKESH, SHAHMIM NAZ** | **No auto 210→AP remap**; no contact-type change; verify intended GL (AP vs courier 203x vs worker 2010/1180) before any remap |
| **D** Legacy-only 210 (no AP sibling) | Many | Do not bulk remap |
| **E** Courier/AP role split | DHL PK | Blocked from DHL merge; keep separate |

### Architecture (Single Core — verified)

| Flow | Advance / deposit | Charge | Settlement / payment |
|---|---|---|---|
| **Supplier** | GE or opening on party AP leaf (or legacy 210xxx) | Purchase → Cr AP under **2000** | Payment screen → Dr AP (resolvePayable → `AP-SUP*`) |
| **Worker** | Payment / GE → **1180** advance | Stage bill → Cr **2010**; auto-apply Dr 2010 Cr 1180 | Worker payment screen |
| **Courier** | Deposit on courier leaf (**203x**) or linked AP | Parcel / shipment charges | Courier payment screen |
| **General JE** | Two balanced legs; party via **`accounts.linked_contact_id`** on each leg | Same | Remains `reference_type` journal — **not** converted to PAY |

**Party ledger ≠ one GL account.** Unified / supplier AP RPCs today scope **2000** (worker also **1180**). Activity left on **2090/`210xxx`** is still company GL truth but **under-counts** supplier party AP until remapped **or** posted to a linked AP leaf. New General Entry **party assist** prefers canonical `AP-`/`AR-` so Payment-screen and GE share the same party leaf without inventing PAY docs.

**GL vs open docs:** Party AP GL can show advance/deposit debit while unpaid purchases/work/shipments remain operational dues — explain as components, not “error”.

## 3. Sept 16 verification (unchanged facts)

- 33-pair merge **did run**; 916/919 backup lines now on AP; FAROOQ clean.
- IBRAHIM: 2 post-merge lines on inactive `210026`.
- Four never-merged duals remain; **reclassified** above (only ID LACE stays Class C).

## 4. Local implementation this phase (no prod apply)

| Change | Purpose |
|---|---|
| Migration `20260919140000_journal_posting_account_guard…` | Server trigger + `journal_account_verified_remaps` (covers unlinked retired IBRAHIM `210026`) |
| `journalPartyPosting.ts` (+ fixtures) | Role-labeled multi-account JE choices; verified remap; line-level attribution |
| `partyAttributedGlLedgerService.ts` | Attributed history across linked leaves; AP totals stay 2000-only |
| Account Statements panel | Component nets + optional outside-official rows |
| Add Entry / ControlLinkedPartiesSheet | Party assist + guards |
| `repair-package/` | IBRAHIM 2 lines + optional ID LACE — scripts not executed |

**IBRAHIM expected (read-only):** legacy net Dr−Cr 118,275; AP before −4,740,529; after remap −4,622,254. Lines JE-0137 / JE-0138.

## 5. Repair preview (revised — DO NOT APPLY)

See CSV + [`repair-package/`](repair-package/).

| Candidate | Prior | Revised production scope |
|---|---|---|
| IBRAHIM 2 lines | Eligible | **Still eligible** (Class B) |
| ID LACE | Eligible | **Still eligible** (Class C) after owner OK |
| DHL | Eligible remap | **Hold** — role-aware; courier deposit pattern; debit OK |
| KIRAN / SHAHMIM | Eligible remap | **Hold** — worker/artisan pattern; debit OK |
| DHL PK | Blocked | **Blocked** |
| Contact type changes | — | **Out of scope** unless separate owner order |

Mechanism for B/C only (next authorized phase): new backup schema → line `account_id` remap → deactivate+unlink legacy → balance recalc. Never recreate JE as PAY. Never merge DHL↔DHL PK by name. **Apply posting-guard migration before remaps.**

## 6. Focused verification checklist (local)

- [x] Unit/fixtures: active legacy; verified remap for unlinked retired; multi-party line attribution; worker dual requires pick; courier 203x
- [ ] Staging E2E UI: worker advance→charge→settle — **UNVERIFIED**
- [ ] Staging E2E: courier deposit→parcel — **UNVERIFIED**
- [ ] Staging E2E: supplier GE + payment screen — **UNVERIFIED**
- [ ] Staging: server trigger after migration apply — **UNVERIFIED** (migration not applied to prod)

## 7. Roman Urdu decision summary

**Debit balances ghalati nahi** — advances/deposits hain. **Split CoA** asli masla hai (GE pe 210xxx, Payment pe AP).

**Remap ab:** sirf IBRAHIM leftover + (owner OK pe) ID LACE. **DHL / KIRAN / SHAHMIM** pe auto remap **band**.

**Local code:** General Entry party assist (multi-account), attributed GL components, server guard migration (repo mein; prod pe apply nahi). Production repair/deploy **is phase mein nahi**.
