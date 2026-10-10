# ID LACE — resolution of 5 ambiguous payable rows (READ-ONLY)

**Date:** 2026-09-21  
**Branch:** `feat/id-lace-class-c-audit`  
**Starting SHA:** `fc0809896d290d9ae18d7731a0a5f833e27f88bb`  
**Prior discovery:** [`ID_LACE_CLASS_C_DISCOVERY.md`](ID_LACE_CLASS_C_DISCOVERY.md)  
**Final ID LACE verdict:** `ID_LACE_FINAL_NO_REPAIR_REQUIRED`  
**Production mutations:** **NONE**

---

## 1. Exact five rows (evidence table)

| # | line_id | entry_no | date | debit | credit | account | account name | linked contact | reference_type | reference_id → contact |
|---|---------|----------|------|------:|-------:|---------|--------------|----------------|----------------|------------------------|
| 1 | `ebc613ec-2546-420a-8237-c806a6a14991` | JE-4096 | 2025-03-11 | 32000.00 | 0.00 | `210123` | HS LACE | `SUP-ZHD-0123` HS LACE | `opening_balance_contact_ap` | `e7df1340-…` = HS LACE |
| 2 | `7f290622-4801-4e15-8076-5e780449bc36` | JE-4061 | 2025-05-06 | 0.00 | 28200.00 | `210139` | SR BUTTON SLM | `SUP-ZHD-0139` SR BUTTON SLM | `transfer` | (none) |
| 3 | `70f774ba-2cae-48f6-895b-7b694c6353d3` | JE-4062 | 2025-05-06 | 0.00 | 43464.00 | `AP-SUPZHD0140` | Payable — GALAXY LACE | `SUP-ZHD-0140` GALAXY LACE | `transfer` | (none) |
| 4 | `1f631925-c230-42aa-8276-a53a0a19c36c` | JE-4077 | 2025-05-06 | 28000.00 | 0.00 | `210139` | SR BUTTON SLM | `SUP-ZHD-0139` SR BUTTON SLM | `opening_balance_contact_ap` | `af8e5f20-…` = SR BUTTON |
| 5 | `2ec9633d-5124-43db-8b12-84f5fd71ed24` | JE-4078 | 2025-05-06 | 43000.00 | 0.00 | `AP-SUPZHD0140` | Payable — GALAXY LACE | `SUP-ZHD-0140` GALAXY LACE | `opening_balance_contact_ap` | `f974b0e6-…` = GALAXY LACE |

Full descriptions (abbreviated in table above) are multi-party bank-slip / “paid from ID LACE” narrations — see §3–4.

All five parent JEs balance (imbalance **0.00**).

---

## 2. Full JE reconstruction

### JE-4096 (row 1) — balanced 32000/32000

| Leg | account | debit | credit | linked party |
|-----|---------|------:|-------:|--------------|
| Payable | `210123` HS LACE | 32000.00 | 0.00 | SUP-ZHD-0123 HS LACE |
| Bank | `190001` NDM MZ | 0.00 | 32000.00 | — |

Narration: `… STAN (753203) / ID LACE 188K+32K HS LACE`  
`reference_id` = HS LACE contact (not ID LACE).

### JE-4061 (row 2) — balanced 28200/28200

| Leg | account | debit | credit | linked party |
|-----|---------|------:|-------:|--------------|
| AR/shop | `110076` SHOP A8 ZHD | 28200.00 | 0.00 | CUS-ZHD-0076 |
| Payable | `210139` SR BUTTON SLM | 0.00 | 28200.00 | SUP-ZHD-0139 |

Header/narration: `BILL 17 PAID FROM ID LACE`  
Economic meaning: bill/charge to **SR BUTTON**; “FROM ID LACE” is funding/source wording, not AP ownership.

### JE-4062 (row 3) — balanced 43464/43464

| Leg | account | debit | credit | linked party |
|-----|---------|------:|-------:|--------------|
| AR/shop | `110076` SHOP A8 ZHD | 43464.00 | 0.00 | CUS-ZHD-0076 |
| Payable | `AP-SUPZHD0140` GALAXY LACE | 0.00 | 43464.00 | SUP-ZHD-0140 |

Header/narration: `BILL 37 PAID FORM ID LACE`  
Economic meaning: bill to **GALAXY LACE** (canonical AP leaf; verified remap `210140`→`AP-SUPZHD0140` exists).

### JE-4077 (row 4) — balanced 28000/28000

| Leg | account | debit | credit | linked party |
|-----|---------|------:|-------:|--------------|
| Payable | `210139` SR BUTTON SLM | 28000.00 | 0.00 | SUP-ZHD-0139 |
| Bank | `190001` NDM MZ | 0.00 | 28000.00 | — |

Narration: `… STAN (682964) / ID LACE 150K+28K SR BUTTON 43K GALAXY LACE`  
`reference_id` = SR BUTTON contact.

### JE-4078 (row 5) — balanced 43000/43000

| Leg | account | debit | credit | linked party |
|-----|---------|------:|-------:|--------------|
| Payable | `AP-SUPZHD0140` GALAXY LACE | 43000.00 | 0.00 | SUP-ZHD-0140 |
| Bank | `190001` NDM MZ | 0.00 | 43000.00 | — |

Same shared narration as JE-4077; `reference_id` = GALAXY LACE contact.

---

## 3. Supplier identity (do not merge “LACE” names)

| Account | Active | Parent | Linked contact | Type | Notes |
|---------|--------|--------|----------------|------|-------|
| `210123` | yes | 2090 legacy payable | HS LACE `SUP-ZHD-0123` | supplier | Distinct party |
| `210139` | yes | 2090 legacy payable | SR BUTTON SLM `SUP-ZHD-0139` | supplier | Distinct party |
| `AP-SUPZHD0140` | yes | 2000 AP | GALAXY LACE `SUP-ZHD-0140` | supplier (contact inactive flag) | Remap from `210140` |
| `AP-SUPZHD0027` | yes | 2000 AP | ID LACE `SUP-ZHD-0027` | supplier | Separate party |
| `210027` | **no** | 2090 | unlinked | — | 0 lines |

Narration pattern meaning:

| Pattern | Interpretation |
|---------|----------------|
| `188K+32K HS LACE` / `150K+28K SR BUTTON 43K GALAXY` | **A** — one bank payment allocated among multiple real suppliers |
| `BILL … PAID FROM ID LACE` | **B/C** — other supplier’s bill; ID LACE named as informational funding/source |
| Same word “LACE” | **Not** grounds to merge HS / GALAXY / ID LACE |

No evidence for **D** (genuine wrong supplier-account attribution).

---

## 4. External reference tracing

### Bank slip `753203` (2025-03-05 / 2025-03-11)

| Entry | Payable debit | Party |
|-------|--------------:|-------|
| JE-3945 | 150000.00 | ID LACE `AP-SUPZHD0027` |
| JE-3963 | 188000.00 | ID LACE `AP-SUPZHD0027` |
| JE-4096 | 32000.00 | **HS LACE** `210123` |
| **Bank `190001` credit total** | **370000.00** | matches 150+188+32 |

Narration on JE-3963/4096 explicitly allocates **188K to ID LACE + 32K to HS LACE**. Row 1 is the HS LACE slice — already posted to HS LACE, not missing from ID LACE.

Same-day HS LACE **JE-4097** credits `210123` 32000 (`BILL`) — clears the 32K against HS LACE’s own bill. Moving row 1 to ID LACE would orphan that clear.

### Bank slip `682964` (2025-05-06)

| Entry | Payable debit | Party |
|-------|--------------:|-------|
| JE-4076 | 150000.00 | ID LACE |
| JE-4077 | 28000.00 | **SR BUTTON** |
| JE-4078 | 43000.00 | **GALAXY LACE** |
| **Bank `190001` credit** | **221000.00** | = 150+28+43 |

Exact arithmetic match to multi-supplier allocation written in the shared narration. ID LACE already has its 150K on `AP-SUPZHD0027` (JE-4076). Rows 4–5 are the other suppliers’ slices.

### Bills JE-4061 / JE-4062

No bank reference; shop `110076` debit vs supplier payable credit. Reciprocal May activity:

- SR BUTTON: JE-4061 Cr 28200 (bill) + JE-4077 Dr 28000 (settlement)
- GALAXY: JE-4062 Cr 43464 (bill) + JE-4078 Dr 43000 (settlement) — **only two lines** on that AP leaf

Moving either credit to ID LACE would invent ID LACE liability and erase the only bill legs for those suppliers.

---

## 5. Per-row classification

| # | line_id | Classification | Evidence reason | Cosmetic note |
|---|---------|----------------|-----------------|---------------|
| 1 | `ebc613ec-…` | **LEGIT_OTHER_SUPPLIER** | HS LACE contact/account; 32K slice of slip 753203; ID LACE already booked 338K on same slip family | Shared slip text → `COSMETIC_ONLY` |
| 2 | `7f290622-…` | **LEGIT_OTHER_SUPPLIER** | SR BUTTON payable credit bill vs shop AR; ID LACE only in “PAID FROM” wording | `COSMETIC_ONLY` funding phrase |
| 3 | `70f774ba-…` | **LEGIT_OTHER_SUPPLIER** | GALAXY LACE canonical AP bill; remap-backed leaf | `COSMETIC_ONLY` funding phrase |
| 4 | `1f631925-…` | **LEGIT_OTHER_SUPPLIER** | SR BUTTON contact reference; 28K of slip 682964; ID LACE 150K already separate JE | Shared slip text → `COSMETIC_ONLY` |
| 5 | `2ec9633d-…` | **LEGIT_OTHER_SUPPLIER** | GALAXY contact reference; 43K of slip 682964 | Shared slip text → `COSMETIC_ONLY` |

### Counts

| Classification | Count |
|----------------|------:|
| `LEGIT_OTHER_SUPPLIER` | **5** |
| `NARRATIVE_MIX_ONLY` (primary) | **0** |
| `GENUINE_MISATTRIBUTION` | **0** |
| `UNRESOLVED` | **0** |
| `COSMETIC_ONLY` (secondary, narration) | **5** |

Primary ownership class is `LEGIT_OTHER_SUPPLIER` for all five. Narrative issues are recorded separately as cosmetic — **not** combined with account remediation.

---

## 6. Reciprocal contamination if moved to ID LACE (analysis only)

| If moved… | Impact |
|-----------|--------|
| Row 1 → ID LACE | Removes HS LACE’s 32K payment; breaks JE-4097 bill clear; **duplicates** economic amount already explained beside ID LACE’s 188K |
| Row 2 → ID LACE | Creates fake ID LACE AP credit; deletes SR BUTTON’s bill |
| Row 3 → ID LACE | Deletes GALAXY’s only bill leg; invents ID LACE liability |
| Row 4 → ID LACE | Removes SR BUTTON settlement; ID LACE already has 150K on same slip |
| Row 5 → ID LACE | Removes GALAXY settlement; duplicates vs ID LACE’s own 150K slice |

**Do not move.** No remediation package required.

---

## 7. Recalculated ID LACE status

| Metric | Value |
|--------|------:|
| Legacy `210027` lines | **0** |
| Outside-AP ID LACE payable lines (genuine) | **0** |
| Official `AP-SUPZHD0027` lines | **89** |
| Genuine misattributions | **0** |
| Unresolved ID-LACE ownership rows | **0** |
| AP leaf net (Dr−Cr) | **356697.00** |
| Company GL imbalance | **0.00** |

Prior Class-C “ambiguous 5” are **not** ID LACE ownership defects.

---

## 8. Narrative cleanup

All five descriptions may warrant future `COSMETIC_ONLY` wording cleanup (split slip labels / “paid from” phrases).  
**Not performed** in this phase. Must never be bundled with account moves.

---

## 9. Final verdict

`ID_LACE_FINAL_NO_REPAIR_REQUIRED`

Future repair for Class-C line remap or these five rows: **not required**.  
Branch remains docs/audit evidence; merge only if explicitly approved. **No deploy.**

### Explicit statements

- production mutations: **NONE**
- ID LACE line moves: **NONE**
- Ibrahim touched: **NO**
- DHL/KIRAN/SHAHMIM touched: **NO**
- historical narration edited: **NO**
- Graphify stash touched: **NO**
- deploy: **NO**
- merge: **NO**
