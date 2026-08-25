# Phase 2.13 — Party Ledger loader risk register

| ID | Risk | Mitigation | Rollback |
|----|------|------------|----------|
| R1 | Unified closing differs from legacy golden | Baseline capture + compare before loader ON | L1 loader OFF |
| R2 | Preview invert loads wrong compare side | Unit tests + QA attr checks | N/A (preview only) |
| R3 | LV2/AS/TB regress while enabling PL | Cross-screen QA in every checkpoint | L1 + investigate |
| R4 | Wrong company gets PL flags | SQL scoped to DIN CHINA UUID only | Disable wrong row |
| R5 | Roznamcha/CashBank accidentally enabled | SQL allow-list; postverify query | L2 screen OFF |
| R6 | Bundle deploy without loader code | VPS bundle grep in deploy script | Redeploy |
| R7 | PWA cache serves old bundle | QA clears SW + caches on login | Hard refresh / CACHEBUST |
| R8 | MR JALIL basis differs effective vs unified | Document delta; golden from legacy capture | L1 if material |

## Blast radius

- **Data:** None — read-only presentation swap
- **Flags:** Two new keys for one company
- **Users:** DIN CHINA admin/developer preview tools only for compare toggle
