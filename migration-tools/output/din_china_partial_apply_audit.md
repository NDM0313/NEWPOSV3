# DIN CHINA Partial Apply Audit

Generated: 2026-06-14T19:51:19.019Z
Company: 30bd8592-3384-4f34-899a-f3907e336485

## Apply failure
- Failed during: **sales_duplicate_check** (legacy txn 11)
- Error: Bad Gateway after read retries
- Stages completed: **branch**, **6 payment accounts**, **21 contacts** (legacy markers)
- Stages not completed: **sales** (0/34), **sale items**, **sale payments**, **purchase**, **expenses**
- Products with legacy marker: **0** (product upserts may not have persisted or notes column absent)

## Branch
- Expected id: 92f4184e-ee9b-4b6c-8e76-10ee1d166f55
- Found by id: DIN CHINA (BL0002)

## Payment accounts
- DIN CHINA Cash: yes (DC0115)
- MCB: yes (DC0106)
- DIN FHD MZ: yes (DC0108)
- DIN NDM MZ: yes (DC0159)
- WALI DIN T/T: yes (DC0133)
- YAQOOB: yes (DC0157)

## Contacts / products
- Contacts with legacy marker: 21
- Products with legacy marker: 0
- Variations: 0

## Sales
- Imported: 34 / 34
- Total: 28343979 | Paid: 0 | Due: 28343979
- By status: {"final":34}
- Missing legacy txn ids: none
- Partial (missing items): none

## Sale items
- Count: 63 / 63

## Sale journals
- Document JEs: 34
- Dr1100/Cr4100 pairs: 0
- Used 4050: false
- Used 4000: false

## Sale payments
- Count: 70 / 70
- Total: 8416540 (expected 8416540)

## Purchase / expenses
- Purchase PO2025/0003: yes status=received
- Purchase items: 17
- Purchase payments: 4
- Expenses: 4/4

## Resume
- Safe to resume: true
- Manual cleanup needed: false
- Infrastructure partial: branch + payment accounts + contacts exist; operational documents not imported.
- Resume apply should reuse existing branch/accounts/contacts via upsert and batch-loaded import cache.