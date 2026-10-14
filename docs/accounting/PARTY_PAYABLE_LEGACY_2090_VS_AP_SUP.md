# Party payable CoA — DIN COLLECTION note

**Canonical party payable:** `AP-{slug}` child under control **`2000` Accounts Payable** (`linked_contact_id` set). Created by `_ensure_ap_subaccount_for_contact` / payment + purchase RPCs.

**Legacy pattern:** numeric leaves under **`2090` Trade & Other Payables** (e.g. `210177`) often shared the same `linked_contact_id`. General JE / transfer historically posted here; Payments post to `AP-SUP*`.

## Merges (2026-09-16)

1. **FAROOQ:** `210177` → `AP-SUPZHD0177` (first pair).
2. **Company-wide suppliers:** 33 legacy+`AP-SUP*` pairs under DIN COLLECTION — JE lines remapped to `AP-SUP*`, legacy deactivated + `linked_contact_id` cleared.
   - Flash: [`DIN_COLLECTION_SUPPLIER_COA_MERGE_FLASH_20260916.md`](DIN_COLLECTION_SUPPLIER_COA_MERGE_FLASH_20260916.md)
   - DB backup schema: `backup_coa_merge_20260916` (accounts / journal_entry_lines / journal_entries / merge_pairs)

**UI:** Pickers + CoA hierarchy hide inactive leaves; [`preferCanonicalPartySubledgerAccounts.ts`](../../src/app/lib/preferCanonicalPartySubledgerAccounts.ts) prefers `AP-*`/`AR-*` when a same-contact sibling exists.

**Out of scope still:** other companies; customer AR legacy duplicates.
