# Staff visibility — browser waiver (not executed)

**Status:** NOT RUN — no staff/manager authenticated session in ops browser check.

**Expected:** `staff` / `manager` roles see **zero** preview toggles on Ledger V2 and all five preview screens.

**Supporting evidence (non-browser):**

- 15 access unit tests PASS (`npm run test:unified-ledger` 112/112)
- Gates: `canAccessAccountingDeveloperCenter` OR `canAccessDeveloperIntegrityLab`

**Action:** Ops logs in as DIN CHINA staff user after preview deploy; screenshot Ledger V2 + one other screen confirming no toggle.
