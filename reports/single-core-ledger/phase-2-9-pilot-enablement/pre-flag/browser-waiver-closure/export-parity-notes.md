# Export parity — browser waiver (not executed)

**Status:** NOT RUN on live ERP  
**Reason:** Ledger V2 preview UI not present in production bundle (`erp.dincouture.pk`).

**Expected when preview build is deployed:**

1. Export PDF/Excel with preview toggle **OFF** — record closing balance.
2. Enable preview toggle ON (compare panel visible).
3. Re-export — totals must match step 1.
4. Preview panel content must not appear in export payload.

**2.8 static inspection:** PASS on feature branch (`buildExportData()` uses legacy `rows` + `summary` only).

**Action:** Ops repeats steps 1–3 after preview deploy; save export files or hash notes here.
