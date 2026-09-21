# Role-model decision — DHL / KIRAN / SHAHMIM (design only)

**Date:** 2026-09-21  
**Branch:** `feat/worker-courier-accounting-model-audit`  
**Base main:** `7678aa5623d46cd8d80b74f81e1a2b3c3e8331ef` (`SUPPLIER_DUAL_ACCOUNT_CLOSURE_EVIDENCE_MERGED`)  
**Dual-account cleanup:** remains `SUPPLIER_DUAL_ACCOUNT_CLEANUP_FINAL_CLOSED` — **not reopened**  
**Aggregate verdict:** `ROLE_MODEL_DESIGN_READY_FOR_OWNER_DECISION`  
**Production mutations:** **NONE**

Detail: [`DHL_ROLE_MODEL.md`](DHL_ROLE_MODEL.md) · [`KIRAN_ROLE_MODEL.md`](KIRAN_ROLE_MODEL.md) · [`SHAHMIM_ROLE_MODEL.md`](SHAHMIM_ROLE_MODEL.md) · [`ERP_SUPPORT_MATRIX.md`](ERP_SUPPORT_MATRIX.md)

---

## Answers to owner questions

| Question | Recommendation |
|----------|----------------|
| Should **DHL local** stay on merchandise AP? | **No long-term** — 0 purchases; deposit/advance pattern. Prefer **prospective courier 203x** (aligned with DHL PK), **not** because the name is “DHL”, but because economics match courier/deposit liability already used for DHL PK. Keep AP historical under Strategy A unless owner later approves reclass. |
| Should **KIRAN** use worker advance/payable? | **Yes** — heuristic: 58 advance-like debits / 10 closing-bill credits; 0 purchases. Target **1180-family + 2010/WP-*** prospectively. |
| Should **SHAHMIM** use worker advance/payable? | **Yes** — 83 advance-like debits / 2 closing credits (+1 ambiguous OB credit). Same dual-leaf worker model. |
| Is **prospective-only** safer? | **Yes** — Strategy A recommended for first cutover. |
| Is **historical reclassification** necessary? | **Not for dual-account closure** (already closed). Optional later (Strategy B) only after prospective routing works; presentation risk (liability↔asset) is material even when JE totals still balance. |
| ERP changes before cutover? | See MVP in §11 / support matrix — **contact role + leaf ensure + payment/JE routing + WA leaf gap + reporting filters** are required for correctness. |

### Decision matrix

| Party | Classification | Preferred target (if approved) |
|-------|----------------|--------------------------------|
| DHL `SUP-ZHD-0007` | `PROSPECTIVE_ROLE_MODEL_RECOMMENDED` | Courier **203x** under 2030 (+ `couriers` row); ≠ DHL PK |
| KIRAN `SUP-ZHD-0036` | `PROSPECTIVE_ROLE_MODEL_RECOMMENDED` | Worker **1180** advances + **2010/WP-*** payables |
| SHAHMIM `SUP-ZHD-0046` | `PROSPECTIVE_ROLE_MODEL_RECOMMENDED` | Same worker dual-leaf model |

None are `KEEP_CURRENT_AP_MODEL` as the long-term design target. Current AP remains a **valid historical container** until cutover.

---

## Current architecture (live company)

| Control | Nature | Children (this company) | Direct lines |
|---------|--------|-------------------------|-------------:|
| 2000 AP | posting parent for `AP-*` | 39 leaves | 0 |
| 2030 Courier | control | **1** (`2030162` DHL PK) | 0 |
| 1180 Worker Advance | **used as posting control** | **0** WA leaves | 0 |
| 2010 Worker Payable | control | **0** WP leaves | 0 |
| 1080 | group | contains 1180 | 0 |

Company-wide: `worker` contacts **0**, `courier` contacts **0**, `couriers` master rows **0**, `WA-*` **0**, `WP-*` **0**.  
DHL PK already posts primarily to **203x** while contact type remains `supplier` — proves leaf family can diverge from type, but **payment/report routing still keys off type + screen**.

---

## Migration strategy comparison

| | Strategy A — Prospective | Strategy B — Historical reclass |
|--|--------------------------|----------------------------------|
| Complexity | Medium (product + cutover date) | High (line allowlists, backups, drift) |
| Auditability | Strong (clean break) | Needs immutable backup per party |
| Closed-period risk | Low | High |
| Payment linkage | New path only | Must prove no orphan settlements |
| Reporting continuity | Dual history until attributed views | Continuous if attributed correctly |
| Rollback | Redeploy app / stop using new leaves | Line restore (Ibrahim-class) |
| **Recommendation** | **Adopt first** | Optional Phase F after A–E |

Simulated historical bucket nets (heuristic only — **not** an apply allowlist):

| Party | ADVANCE-like Dr | PAYABLE/SETTLE Cr | Net on AP | Ambiguous |
|-------|----------------:|------------------:|----------:|----------:|
| DHL | 14,625,000 (46) | 9,925,000 (2) | 4,700,000 | 0 |
| KIRAN | 12,626,000 (58) | 10,376,000 (10) | 2,250,000 | 0 |
| SHAHMIM | 19,436,500 (83) | 14,092,500 (2) | 5,000,000 | 1 (OB Cr 344k) |

If Strategy B moved ADVANCE-like **Dr** from liability AP → asset 1180: company `Σ(Dr−Cr)` stays **0**, but **assets ↑** and **AP liabilities ↓** — statement presentation changes. That is why B needs a separate owner gate.

---

## Contact model recommendation

1. Prefer explicit `contacts.type` = `courier` / `worker` for correct payment spine and reports (enum already exists).  
2. Do **not** change types in this phase.  
3. A contact **can** safely have multiple `linked_contact_id` leaves (JE assist already blocks silent pick when >1).  
4. Worker needs **both** advance asset and payable liability leaves.  
5. Courier RPC today sets `accounts.contact_id`; party attribution uses `linked_contact_id` — **both must be set** for discoverability (`PARTIAL` today).

---

## Phased roadmap (future; no execution)

| Phase | Content |
|-------|---------|
| **A** | Domain: type flip design, leaf ensure (incl. **WA-***), courier `linked_contact_id` parity |
| **B** | UI/payment/JE routing for worker & courier; JE assist includes courier type |
| **C** | Reporting: remove workers from supplier tab; courier unified ledger; attributed components |
| **D** | Isolated PG + client tests |
| **E** | Prospective cutover date + runbooks |
| **F** | Optional historical reclass packages (per party, Ibrahim-pattern) — **separate approval** |

---

## Explicit statements

- production mutations: **NONE**
- journal lines moved: **NONE**
- new GL accounts created in production: **NONE**
- contact types changed: **NO**
- migration executed: **NO**
- deploy: **NO**
- dual-account cleanup reopened: **NO**
- Graphify stash touched: **NO**
