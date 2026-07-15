# Rule Matrix — Legacy vs Unified Bases

| Rule | Legacy `get_contact_party_gl_balances` | effective_party | official_gl | audit_full_history | Intended AR/AP behavior | Mismatch |
|------|----------------------------------------|-----------------|-------------|--------------------|-------------------------|----------|
| Void JE (`is_void`) | Excluded | Excluded | Excluded (party RPC) | Excluded (party RPC) | Exclude void shells | None |
| `correction_reversal` | Included if not void | **Hidden** | Included | Included | EP: hide paired cancel noise | **Legacy vs EP** (Bridal JE-0213) |
| Voided payment (`voided_at`) | Generally still via JE if JE live | Hide rows tied to voided payment | Include | Include | EP hides void trails | Contributes with JE-0213 |
| Cancelled sale status | Inclusive of GL residual | Hide sale/payment trails for cancelled | Include | Include | EP operational | Contributes with −150 chain |
| `gl_correction` orphan-ar fingerprint | Include | **Hide** | Include | Include | EP ignore orphan repair | **Legacy vs EP** (JV-000203) |
| Document non-final | No special exclude in party GL sum | No extra | No extra | No extra | — | None observed |
| Advance / unlinked payment | Included if AR line exists | Included if basis allows | Same | Same | — | None for delta |
| Imported historical | N/A Bridal | N/A | N/A | N/A | — | Not this fail |
| Null contact / branch | Linked via account `linked_contact_id` / party resolve | Same + strict branch helper | Same | Same | — | Not the 80k/150 drivers |
| Party attribution | Account contact / resolve helpers | `COALESCE(acc_linked, party_resolved)` | Same | Same | Align contacts | Same contact IDs |
| Duplicate Walk-in contacts | Two contacts exist | Same | Same | Same | Split books intentional | Context only; not sole cause |

## Note on official_gl void pairing

Account/TB unified ledgers elsewhere may re-include voided originals when paired with active `correction_reversal`. **`get_unified_contact_party_gl_balances` does not** — it uses `is_void = false` only. That makes OG party balances match legacy and can leave **orphan reversal debits** when the voided credit is dropped.
