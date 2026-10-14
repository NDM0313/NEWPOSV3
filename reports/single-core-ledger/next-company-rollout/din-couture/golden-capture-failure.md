# DIN COUTURE — Golden capture failure report

**Date:** 2026-06-27  
**Status:** FAIL — rollout blocked

---

## Attempt

```
node scripts/single-core-ledger/run-golden-capture-din-couture.mjs
```

| Step | Result |
|------|--------|
| Login | PASS |
| Party Ledger — select DHARIA | **FAIL** — timeout 30s (`getByText('DHARIA')`) |

---

## Root cause

Production read-only user binding:

- `QA_BROWSER_EMAIL` resolves to **DIN BRIDAL** admin (`597a5292-14c8-4cd8-96bd-c61b5a0d8c92`)
- DHARIA contact belongs to **DIN COUTURE** (`2ab65903-62a3-4bcf-bced-076b681e9b74`)
- DIN BRIDAL session cannot see DIN COUTURE contacts in Party Ledger search

---

## Required remediation

Set local environment for a **DIN COUTURE ERP user** (not DIN CHINA / DIN BRIDAL):

```powershell
$env:QA_BROWSER_EMAIL = "<din-couture-user@email>"
$env:QA_BROWSER_PASSWORD = "<password>"
```

Then re-run golden capture before any flag SQL.

---

## Flags

**No feature flags changed.** DIN CHINA and DIN BRIDAL unchanged.
