# Three-company operational monitoring

**Generated:** 2026-07-05T10:59:32.597Z
**Overall:** FAIL
**Credential policy:** per-company preferred; generic fallback=true

## Read-only flag guard

- PASS — only DIN CHINA, DIN BRIDAL, DIN COUTURE have loaders ON

## Profile results

### din-china

- **Result:** PASS
- **Login email:** din@yahoo.com
- **Email source:** profile-default
- **Password source:** per-company
- **Checks:** 19/19 PASS

### din-bridal

- **Result:** FAIL
- **Login email:** ndm313@yahoo.com
- **Email source:** built-in-default
- **Password source:** per-company
- **Checks:** 15/19 PASS

### din-couture

- **Result:** PASS
- **Login email:** zhd@dincouture.pk
- **Email source:** built-in-default
- **Password source:** per-company
- **Checks:** 18/19 PASS


**JSON:** `reports/single-core-ledger/operational-monitoring/three-company-monitoring-2026-07-05T10-48-55-625Z.json`