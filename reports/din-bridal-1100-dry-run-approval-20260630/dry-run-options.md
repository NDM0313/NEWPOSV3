# Dry-run repair options (no apply)

**Recommended:** **Option C** — reclass via `gl_correction` pattern (same as rental 1100 leakage JV-000204..207)

---

## Option A — No repair / accept control balance

| | |
|-|-|
| **When** | Not appropriate — control TB permanently wrong |
| **GL** | 1100 stays **-136,500** |
| **Party ledger** | NAGHMANA / ASIM overstated |
| **Mutation** | No |
| **Recommended** | **No** |

---

## Option B — Party relink only

| | |
|-|-|
| **When** | Contact missing on line — **not this case** (wrong `account_id`, not missing contact) |
| **Mutation** | Yes (metadata only) |
| **Recommended** | **No** |

---

## Option C — Reclass 1100 → party AR (RECOMMENDED)

| | |
|-|-|
| **When** | Sale reversal credits on control 1100; customers identified |
| **Target accounts** | `AR-CUS0056` (Miss NAGHMANA RAJA), `AR-CUS0012` (ASIM) |
| **Expected GL** | Control 1100 → **0**; party AR reduced by cancellation amounts |
| **Dry-run shape** | Per source line: Dr 1100 / Cr AR-CUS* (mirror JV-000204 rental pattern) |
| **Fingerprint** | `developer_repair:gl_correction:sale-reversal-1100-leakage:<line_id>` |
| **Mutation** | Yes — **approval required** |
| **Rollback** | Void correction JVs only |

---

## Option D — Correction/clearing JE (highest risk)

| | |
|-|-|
| **When** | Business confirms amount is entirely wrong/orphan |
| **Risk** | May not fix party ledger; double-count risk |
| **Recommended** | **No** unless Option C rejected |

**Status:** `BLOCKED_PENDING_OPERATOR_APPROVAL`
