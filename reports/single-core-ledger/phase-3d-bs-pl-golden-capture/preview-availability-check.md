# Preview availability check — Phase 3D

**Status:** PASS — preview UI available on production  
**Production URL:** https://erp.dincouture.pk  
**Checked:** 2026-06-29T10:50:03.438Z  
**Method:** Playwright browser capture (admin/developer accounts per company)

---

## Per-company results

| Company | User (label only) | BS loads | P&L loads | Toggle visible | Toggle default OFF | Preview panel | Labels |
|---------|-------------------|----------|-----------|----------------|-------------------|---------------|--------|
| DIN CHINA | din@yahoo.com | YES | YES | YES | YES | YES | PREVIEW_ONLY, NEEDS_FINANCE_GOLDEN |
| DIN BRIDAL | ndm313@yahoo.com | YES | YES | YES | YES | YES | PREVIEW_ONLY, NEEDS_FINANCE_GOLDEN |
| DIN COUTURE | zhd@dincouture.pk | YES | YES | YES | YES | YES | PREVIEW_ONLY, NEEDS_FINANCE_GOLDEN |

---

## Verification checklist

- [x] Balance Sheet page loads for all three companies
- [x] Profit & Loss page loads for all three companies
- [x] Preview toggle visible to allowed role (admin/developer)
- [x] Preview toggle default **OFF** before operator enables
- [x] Legacy/default report visible before preview enabled
- [x] Compare panel loads after enabling preview
- [x] Labels show preview-only / finance golden pending / not official

---

## Notes

- Preview basis used for capture: **official_gl**
- Branch scope: **All branches** (production global filter wide range)
- Legacy BS/P&L main loaders unchanged — no loader swap performed
- Capture proceeded — no failure report required
