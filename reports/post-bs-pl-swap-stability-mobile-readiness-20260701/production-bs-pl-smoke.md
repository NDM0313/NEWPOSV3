# Production BS/P&L smoke verification

**Source:** Post-flag Phase 3D golden capture exports (production, flags ON)  
**Result:** PASS — 6/6 screens zero-diff

## DIN CHINA

| Screen | Main loader | Golden | Pass |
|--------|-------------|--------|------|
| Balance Sheet | unified | Assets **89,754,087.52** | yes |
| P&L | unified | Net **8,465,730.87** | yes |

## DIN BRIDAL

| Screen | Main loader | Golden | Pass |
|--------|-------------|--------|------|
| Balance Sheet | unified | Assets **13,521,792** | yes |
| P&L | unified | Net **119,992** | yes |

## DIN COUTURE

| Screen | Main loader | Golden | Pass |
|--------|-------------|--------|------|
| Balance Sheet | unified | Assets **22,667,273** | yes |
| P&L | unified | Net **-16,750** | yes |

## Safety

- No console / dynamic import errors in capture run
- Preview/compare panel remains preview-only (`legacy_shadow`)
- Legacy fallback: `disable-bs-pl-loader-flags.sql`
- No GL or data mutations
