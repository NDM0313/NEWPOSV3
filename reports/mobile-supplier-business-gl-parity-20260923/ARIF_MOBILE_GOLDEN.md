# ARIF Mobile Golden

**Company:** DIN COLLECTION `e08a04af-22a8-4869-9b4d-da31fce13158`  
**Contact:** ARIF LHR `SUP-ZHD-0017` / `21e1ac76-b911-44a1-87dd-6283969efa4c`  
**Legacy account:** `210017` (linked_contact_id = ARIF)

## Expected (matches web closeout)

| Metric | Value |
|--------|------:|
| Business net (Cr − Dr) | **39,937** |
| Official AP | **0** |
| Period / full-history lines on Business legs | **24** |
| Source account | **210017** |

## Verification this phase

| Check | Result |
|-------|--------|
| RO SQL on `210017` non-void lines | Cr−Dr = **39937.00**, line count **24** |
| Pure unit tests (filter / split / totals / role exclusion) | PASS |
| Device / interactive mobile UI | **NOT performed** (owner rule) |

## Other goldens (RO)

| Case | Result |
|------|--------|
| ALAM BNRS (`SUP-ZHD-0149`) | Official AP leaf `AP-SUPZHD0149` net = **1,105,100** = Business (clean AP) |
| ZERO-history ABC `SUP-ZHD-0011` | Business = 0 (no attributed legs) |
| Worker / courier | Excluded from Business GL map |
