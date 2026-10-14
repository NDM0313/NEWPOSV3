# Role leaf results (staging clone)

| Contact | Code | Type after flip | Leaf codes | Account IDs (staging) |
|---------|------|-----------------|------------|------------------------|
| DHL local | SUP-ZHD-0007 | courier | `203164` | `58617ac4-2fff-4f2e-b3fa-4960ce2cf13a` |
| KIRAN | SUP-ZHD-0036 | worker | `WA-SUPZHD0036`, `WP-SUPZHD0036` | `cadb56c4-…`, `bf8a8c4e-…` |
| SHAHMIM | SUP-ZHD-0046 | worker | `WA-SUPZHD0046`, `WP-SUPZHD0046` | `2f8637f5-…`, `340928a1-…` |
| DHL PK | SUP-ZHD-0162 | supplier (unchanged) | `2030162` | distinct from DHL local |

Idempotent re-ensure: DHL leaf ID stable.  
No new `AP-SUPZHD0007` for role-era postings.

**`STAGING_ROLE_LEAF_CREATION_PASS`**
