# Release Discipline Mode — v1.0.0+

**Effective from:** v1.0.0 release  
**Status:** Production-Grade v1 Candidate

---

## 🔒 RULE 1 — No Direct Changes in Production

Every change must:

1. **Be committed** (tracked in version control)
2. **Version bumped** (patch: 1.0.1, minor: 1.1.0, major: 2.0.0)
3. **Built again** (`npm run build`)
4. **Deployed cleanly** (no hotfixes directly on live)

---

## 🚀 Staged Rollout Plan

### STAGE 1 – Internal Staging

- Deploy build to **staging server**.
- **Test checklist:**
  - [ ] 3 Sales transactions
  - [ ] 1 Purchase cycle
  - [ ] 1 Rental full lifecycle (book → pickup → return)
  - [ ] 1 Studio full pipeline
  - [ ] 1 Payment reversal
  - [ ] 1 Commission calculation
  - [ ] 1 Report export
  - [ ] Currency change test
  - [ ] Decimal precision test
  - [ ] Date format test
  - [ ] No console errors

### STAGE 2 – Live Deployment (Controlled)

**Before going live:**

- [ ] Full DB backup
- [ ] Apply migrations
- [ ] Deploy build
- [ ] Restart environment cleanly
- [ ] Monitor logs 24–48 hrs

**Monitor for:**

- RPC failures
- Permission errors
- Currency display issues
- Rental status transitions
- Ledger inconsistencies

### STAGE 3 – Android Internal Testing

When ready:

```bash
npm install @capacitor/core @capacitor/cli
npx cap init "Modern ERP POS" "com.yourapp.erp" --web-dir dist
npm run build
npx cap add android
npx cap copy
npx cap open android
```

- Build internal APK.
- Install on 2–3 devices.
- **Test:** Numeric keypad, Date picker, Printing, Rental flow, Studio pipeline.

---

## 🛑 First 72 Hours Rule (After Go-Live)

For the **first 3 days** after going live:

- **Do NOT** introduce new features
- **Only** fix bugs if **critical**
- Monitor logs **daily**
- Track user behavior

---

## 🎯 Mode Shift

From **Developer Mode** → **System Owner Mode**: prioritize stability, monitoring, and controlled changes.

---

## 🔮 Next-Level Stability (After ~1 Week Stable)

Optional improvements when live usage is stable:

- Performance audit
- Bundle size reduction
- Table virtualization
- Activity logging
- Automated backup system
- Error monitoring (e.g. Sentry-style)
- Auto-version tagging pipeline

---

## Reference

- **Version:** `package.json` → `1.0.0`
- **Build:** `npm run build` → `dist/`
- **QA / Production notes:** `FINAL_QA_PRODUCTION_RELEASE.md`
