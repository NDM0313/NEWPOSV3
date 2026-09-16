# Party payable CoA — DIN COLLECTION note

**Canonical party payable:** `AP-{slug}` child under control **`2000` Accounts Payable** (`linked_contact_id` set). Created by `_ensure_ap_subaccount_for_contact` / payment + purchase RPCs.

**Legacy pattern:** numeric leaves under **`2090` Trade & Other Payables** (e.g. `210177`) often share the same `linked_contact_id`. General JE / transfer historically posted here; Payments post to `AP-SUP*`.

**FAROOQ (2026-09-16):** Merged `210177` → `AP-SUPZHD0177` (JE line remap + deactivate legacy). UI pickers prefer canonical `AP-*`/`AR-*` when a same-contact sibling exists ([`preferCanonicalPartySubledgerAccounts.ts`](../src/app/lib/preferCanonicalPartySubledgerAccounts.ts)).

**Follow-up (needs separate owner approve):** company-wide remap of remaining `210xxx` + `AP-SUP*` pairs — do not bulk-merge without flash.
