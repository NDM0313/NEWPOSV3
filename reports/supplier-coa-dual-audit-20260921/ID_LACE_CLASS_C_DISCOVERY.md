# ID LACE — Class-C discovery (READ-ONLY)

**Date:** 2026-09-21  
**Final ID LACE verdict:** `ID_LACE_CLASS_C_NOT_READY`  
**Party-JE / Ibrahim closure:** `PARTY_JE_IBRAHIM_FINAL_CLOSED`  
**Production mutations this phase:** **NONE**

---

## 1. Repository / deploy state

| Field | Value |
|-------|--------|
| Starting / current `main` | `5e00877a85ace3258660de591657c07b675b66b8` |
| Merge commit (feature) | `f7118c6b930d413415a95cd749f2b1bcbdacb68b` |
| Deployed application SHA | `f7118c6b930d413415a95cd749f2b1bcbdacb68b` |
| Docs-only commits after deploy | `57d6d475`, `5e00877a` (evidence markdown only) |
| Feature branch residual vs `main` | `origin/main...origin/feat/party-je-guards-attributed-ledger` = **3 ahead / 0 behind** → `MERGED_COMPLETE` |
| Graphify stash | `stash@{0}: graphify-out-of-scope-ui-phase` — **untouched** |

### Expected SHA distinction

- **`f7118c6b`** — merge commit that introduced JE guards + attributed ledger into `main`; this is what production ERP was built/redeployed as (`VITE_BUILD_COMMIT=f7118c6b`).
- **Deployed SHA = `f7118c6b`** — application containers align to the merge, not to later docs tips.
- **`57d6d475` / `5e00877a`** — docs-only commits on `main` after deploy; **do not require redeploy**.
- **Current `main` `5e00877a`** — tip including alignment evidence; still contains merge ancestry.

Compared to [`../supplier-coa-dual-audit-20260919/MERGE_DEPLOY_ALIGNMENT_20260921.md`](../supplier-coa-dual-audit-20260919/MERGE_DEPLOY_ALIGNMENT_20260921.md): RO invariants still match.

---

## 2. Party-JE / Ibrahim final closure (READ-ONLY)

| Check | Result |
|-------|--------|
| `schema_migrations` row for `20260919140000_journal_posting_account_guard_and_verified_remaps.sql` | **1** |
| `resolve_journal_posting_account_id` + public core + remaps table | **present** |
| `trg_guard_journal_entry_line_account` enabled | **true** |
| Ibrahim lines on `AP-SUPZHD0026` | JE-0137 Dr 19000; JE-0138 Dr 99275 — **unchanged** |
| JE-0137 / JE-0138 (Ibrahim JE IDs) balanced | **0.00** (per prior reconcile; Ibrahim lines intact) |
| Backup `run_id` | `ibrahim_v1_20260919143935` — **intact** |
| `id_lace_status` in Ibrahim meta | `NOT_IMPLEMENTED` |
| Held fingerprint | `2e2a9c788c0a7e7575ab10b3857b5b7b` — **unchanged** |
| Company GL imbalance | `0.00` |

**Status:** `PARTY_JE_IBRAHIM_FINAL_CLOSED`

No product redeploy was performed for this closure evidence.

---

## 3. Feature branch retirement

`feat/party-je-guards-attributed-ledger` has **no commits** not already reachable from `main`.

**Branch status:** `MERGED_COMPLETE`  
Remote branch not force-deleted (no deletion approval requested). Future accounting work uses a **new** branch from current `main` (this report: `feat/id-lace-class-c-audit`).

---

## 4. ID LACE identity (live)

| Field | Value |
|-------|--------|
| Company | `e08a04af-22a8-4869-9b4d-da31fce13158` |
| Contact ID | `d681fcf5-938f-4841-8a99-b83d59eb9375` |
| Contact code | `SUP-ZHD-0027` |
| Name | ID LACE |
| Type | `supplier` (active) |
| Canonical AP leaf | `AP-SUPZHD0027` `30bbe521-5773-4985-8be1-0d336c56a6a3` under **2000**, linked to contact |
| Legacy account | `210027` `e11d244a-b96e-4128-8ca3-2bae5a4f813c` under **2090**, **inactive**, **unlinked**, **0 JE lines** |
| Verified remap | `210027` → `AP-SUPZHD0027` (source `backup_coa_merge_20260919.merge_pairs`, expected contact ID LACE) |
| Purchases | **0** |
| Payments (contact) | **2** — `PAY-6722` / `PAY-6725` (2026-09-07 / 2026-09-14), PKR 100,000 each, liquidity `190176`; AP decrease posted on `AP-SUPZHD0027` |
| Activity window on AP leaf | 2023-10-17 → 2026-09-14 — **89** non-void lines |

**Note:** Contact code `SUP-0013` is **not** an ID LACE contact in live data (0 rows). Held-scope queries that OR-include `SUP-0013` historically mixed unrelated codes; current linked-contact detail for held names shows only DHL / ID LACE / KIRAN / SHAHMIM AP leaves.

---

## 5. Why it was Class C (historical) vs live truth

**Historical Class-C meaning (audit 2026-09-19):** merchandise supplier with a **never-merged dual** — legacy `210027` + AP leaf, eligible for FAROOQ-style line remap after owner OK (separate from Ibrahim Class B leftovers).

**Live 2026-09-21 truth:**

- Legacy `210027` has **zero** open JE lines.
- **All 89** party AP history lines already sit on `AP-SUPZHD0027`.
- Verified remap already redirects any residual posts targeting `210027`.
- Dual-account JE count (same JE with both codes): **0**.
- Newer payments already use the AP leaf.

Therefore the **Class-C line-remap problem no longer exists as an executable candidate set**. Remaining work, if any, is meta/assert/reporting — not Ibrahim-style account_id moves.

---

## 6. Line buckets and eligibility

Source CSV: [`ID_LACE_AP_LEAF_LINES.csv`](ID_LACE_AP_LEAF_LINES.csv) (89 lines).

### Remap candidates (legacy → AP)

| Metric | Count |
|--------|------:|
| Lines currently on `210027` | **0** |
| Exact-line remap candidates | **0** |
| **ELIGIBLE** | **0** |
| **NOT_ELIGIBLE** (already on AP leaf) | **89** |
| **AMBIGUOUS** (other-party payables narrating “ID LACE”) | **5** |
| Informational counterparty legs (bank/cash/AR mentioning ID LACE) | **55** name-mention off-leaf (not remap candidates) |

### Bucket definitions

| Bucket | Meaning | Live result |
|--------|---------|-------------|
| **A** Official AP postings | Lines on `AP-SUPZHD0027` | **89** — already correct; **NOT_ELIGIBLE** to “move” |
| **B** Legacy / outside-AP supplier payable | Lines on `210027` | **0** |
| **C** Informational / non-party | Counterparty legs (e.g. `110076` AR, `190001`/`190176` bank, `180002` cash) that mention ID LACE in narrative | **NOT_ELIGIBLE** — not supplier payable attribution errors |
| **D** Ambiguous | Narratives mentioning ID LACE but posted to **other** supplier payables (`210139`, `AP-SUPZHD0140`, `210123`) | **AMBIGUOUS** — stop; do not treat as ID LACE AP |

### Eligibility gates (applied to potential remaps)

For each candidate: same company, same real party, source is supplier payable, target is ID LACE AP leaf, economic meaning unchanged, amounts unchanged, no duplicate settlement, no other-party contamination, no closed-period policy conflict.

- Legacy lines: **none** → no row can be marked ELIGIBLE.
- Official AP lines: already on target → **NOT_ELIGIBLE**.
- Other-supplier payables with ID LACE text → **AMBIGUOUS** (contamination risk).

No AMBIGUOUS row was promoted to ELIGIBLE by assumption.

---

## 7. Chronological dual-exposure timeline

| Period | Observation |
|--------|-------------|
| 2023-10 → 2026-06 | Transfer + opening_balance_contact_ap activity accumulates on **`AP-SUPZHD0027` only** (legacy empty) |
| 2026-07 → 2026-09 | Manual **journal** posts: narrative still says `210027`, but **posted account is already `AP-SUPZHD0027`** (4 lines narrating 210027 while sitting on AP) — consistent with verified remap / prior consolidation |
| 2026-09-07 / 09-14 | **Payment** docs `PAY-6722` / `PAY-6725` decrease AP on leaf — correct modern path |
| Dual JE (210027 + AP same entry) | **Never** in live set |

**Conclusion:** A historical line remap would **not** consolidate a live dual-account problem; it would be a no-op or a rewrite of already-correct AP attributions.

---

## 8. Accounting impact simulation (ELIGIBLE only)

| Metric | Value |
|--------|------:|
| ELIGIBLE lines moved | **0** |
| Legacy net removed | **0.00** |
| AP leaf net added | **0.00** |
| **TOTAL_GL_EFFECT** | **0.00** |
| Trial Balance effect | none |
| Party / supplier balance effect | none |

Invariant `TOTAL_GL_EFFECT = 0` holds as a **no-op**.  
This is **not** a green light for production repair — it confirms there is nothing safe/necessary to remap.

**Not classified** as `ID_LACE_REPAIR_NOT_SAFE` (no unsafe monetary redesign proposed). Classified instead as **no eligible repair**.

---

## 9. Reporting consequences (READ-ONLY)

| Surface | Current state | If a future ELIGIBLE remap existed |
|---------|---------------|-------------------------------------|
| Official GL / Account Ledger on `AP-SUPZHD0027` | Full 89-line history; net Dr−Cr **356,697.00** | Unchanged (already on leaf) |
| Account Ledger on `210027` | Empty | Remains empty |
| Party Ledger / attributed supplier AP (2000 subtree) | Includes linked leaf | Already correct for contact |
| Trial Balance | Company imbalance **0.00** | Must stay 0 |
| Narratives still saying `(210027)` | Cosmetic/historical wording on ~4 JE descriptions | Reporting-only; **not** a line remap |

No reporting code was changed in this phase.

---

## 10. Comparison to Ibrahim Class-B pattern

| Capability | Ibrahim (done) | ID LACE (this discovery) |
|------------|----------------|---------------------------|
| Immutable backup schema | `backup_coa_limited_ibrahim_v1` | Would need **new** `backup_coa_id_lace_class_c_v1` (never reuse Ibrahim) |
| Exact-line manifest | 2 line IDs | **Empty** — no line IDs |
| Apply / rollback / drift / idempotency | Proven | Pattern reusable **if** future ELIGIBLE set appears |
| Run ID | `ibrahim_v1_20260919143935` | Must be distinct `id_lace_v1_*` — **N/A now** |

**Do not copy** Ibrahim IDs, accounts, or run IDs.  
**Do not execute** any ID LACE repair against production in this phase.

Draft design (not executable on prod): [`repair-package-design/README.md`](repair-package-design/README.md).

---

## 11. Held-scope proof (untouched)

| Party | Touched? | Evidence |
|-------|----------|----------|
| Ibrahim | **NO** | Lines still on `AP-SUPZHD0026`; backup run_id unchanged |
| DHL | **NO** | `AP-SUPZHD0007` 48 lines; fingerprint unchanged |
| KIRAN | **NO** | `AP-SUPZHD0036` 68 lines |
| SHAHMIM | **NO** | `AP-SUPZHD0046` 86 lines |
| ID LACE | **NO mutation** | Discovery only |

Held fingerprint: `2e2a9c788c0a7e7575ab10b3857b5b7b` (matches merge/deploy evidence).

---

## 12. Production mutation statement

- JE guard migration rerun: **NO**
- Ibrahim backup/apply/rollback: **NO**
- ID LACE repair: **NO**
- DHL / KIRAN / SHAHMIM: **NO**
- Corrective JEs / transfers: **NO**
- Graphify stash: **NO**
- Access mode: **READ-ONLY**

---

## 13. Final verdict

`ID_LACE_CLASS_C_NOT_READY`

**Reason:** Zero ELIGIBLE remappable lines. Live CoA already has supplier history on `AP-SUPZHD0027` with empty inactive legacy `210027` and an active verified remap. Class-C “never-merged dual needing FAROOQ-style remap” is **not** an executable production repair candidate under current evidence.

This verdict is **permission to consider** only a separate future phase (e.g. optional meta-assert package or narrative cleanup) after explicit owner approval. It is **not** permission to execute production repair.

Optional future owner decisions (out of scope here):

1. Meta-only assert package documenting “no lines to move” + remap present.
2. Human review of **AMBIGUOUS** other-supplier narrations (HS LACE / SR BUTTON / GALAXY etc.) — separate parties.
3. Cosmetic description cleanup (still not account remaps).
