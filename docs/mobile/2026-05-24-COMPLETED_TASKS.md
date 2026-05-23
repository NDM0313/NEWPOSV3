# ERP Mobile & contacts — completed tasks

**Date:** 2026-05-24  
**Repo:** NEWPOSV3 (`main`)  
**VPS:** `dincouture-vps` — migrations applied, `deploy/deploy.sh` run after contact/lead RPC changes

---

## 1. Database & VPS (production)

| Item | Status |
|------|--------|
| Migration [`20260528120000_public_contact_registration_company_scope.sql`](../../migrations/20260528120000_public_contact_registration_company_scope.sql) | Applied — `register_public_contact_v2` with `p_company_id`, `p_branch_id`; DROP overload loop fixes `42725 function name is not unique` |
| Migration [`20260529120000_approve_public_contact_lead.sql`](../../migrations/20260529120000_approve_public_contact_lead.sql) | Applied — `approve_public_contact_lead` RPC |
| Web deploy | OK via `ssh dincouture-vps` + `deploy/deploy.sh` |

---

## 2. Public lead registration (company-scoped)

| Area | Files |
|------|--------|
| Web RPC / form | [`src/app/services/publicContactService.ts`](../../src/app/services/publicContactService.ts), [`PublicContactForm.tsx`](../../src/app/components/public/PublicContactForm.tsx) |
| Lead tools (share link) | [`LeadTools.tsx`](../../src/app/components/settings/LeadTools.tsx) |
| Mobile share | [`LeadToolsSection.tsx`](../../erp-mobile-app/src/components/contacts/LeadToolsSection.tsx), [`shareRegistrationLink.ts`](../../erp-mobile-app/src/lib/shareRegistrationLink.ts) |

**Behaviour:** Registration URL includes `company` + `branch`; WhatsApp / Email / Copy from Contacts.

---

## 3. Public lead referral + approve

| Area | Change |
|------|--------|
| Web Contacts | `Ref:` from `?ref=` on pending leads; **Pending lead** badge/filter; **Approve** → `CUS-xxxx` |
| Mobile Contacts | Same referral display + approve in list/detail |
| RPC | `approve_public_contact_lead` |

**Key files:** [`ContactsPage.tsx`](../../src/app/components/contacts/ContactsPage.tsx), [`contactService.ts`](../../src/app/services/contactService.ts), [`ContactsModule.tsx`](../../erp-mobile-app/src/components/contacts/ContactsModule.tsx), [`contacts.ts`](../../erp-mobile-app/src/api/contacts.ts)

**Commits:** `aaede342` (registration + mobile UX), `dc71f969` (referral + approve)

---

## 4. Mobile UX batch (builds 7–9)

| Feature | Notes |
|---------|--------|
| Counter PIN | Background-only re-lock; vault token sync; email login hidden when counter slots exist |
| Products | List thumbnails; tap preview |
| Invoice PDF | Centered company header via [`ReportBrandHeader.tsx`](../../erp-mobile-app/src/components/shared/ReportBrandHeader.tsx) |
| Barcode labels | Sheet layout for printing |
| Sale stock | `ensure_sale_stock_movements` RPC (build 8) |
| Native barcode scan | Add Products on iOS/APK |

---

## 5. Mobile build 9 (1.0.5 / versionCode 9)

| Platform | Artifact (local, not in git) |
|----------|------------------------------|
| Android release | `erp-mobile-app/releases/erp-mobile-1.0.5-build9.apk` |
| iOS (dev export) | `erp-mobile-app/releases/erp-mobile-1.0.5-build9.ipa` |

**Version metadata in repo:** [`android/app/build.gradle`](../../erp-mobile-app/android/app/build.gradle), [`ios/App/App.xcodeproj/project.pbxproj`](../../erp-mobile-app/ios/App/App.xcodeproj/project.pbxproj)

**Install:** Uninstall debug builds 7/8 before release APK (different signing key). See [`APK_UPDATE.md`](../../erp-mobile-app/releases/APK_UPDATE.md).

---

## 6. iOS log fix — `refresh_token_not_found`

**Symptom:** Capacitor log on cold start:

```text
⚡️  [error] - {"code":"refresh_token_not_found", ...}
```

**Cause:** Stale Supabase refresh token in persisted session; GoTrue auto-refresh on launch.

**Fix:**

| File | Role |
|------|------|
| [`authSessionRecovery.ts`](../../erp-mobile-app/src/lib/authSessionRecovery.ts) | Detect stale token; `signOut({ scope: 'local' })`; prune counter vault |
| [`supabase.ts`](../../erp-mobile-app/src/lib/supabase.ts) | Native `console.error` filter; bootstrap recovery; `onAuthStateChange` hook |
| [`auth.ts`](../../erp-mobile-app/src/api/auth.ts) | `getSession` / `refreshSession` handle stale errors → login + PIN hint |

**Not fixed (system noise):** UIKit keyboard AutoLayout, RTIInputSystemClient, sandbox entitlement lines — no app change.

**Next binary:** Rebuild **build 10** after pulling this fix (`APK_UPDATE.md`).

---

## 7. Verification

| Check | Result |
|-------|--------|
| `npm run typecheck` (erp-mobile-app) | Pass |
| Stale token on device | Manual — cold start → login/PIN, no red auth error |
| Lead share `Browser open` | Expected native call — no regression |

---

## 8. Superseded docs

- [`2026-05-21-REMAINING_TASKS.md`](2026-05-21-REMAINING_TASKS.md) — office APK checklist (superseded)
- [`2026-05-21-TODAY_WORK_SUMMARY.md`](2026-05-21-TODAY_WORK_SUMMARY.md) — earlier day summary (barcode, Settings, branch UUID)

---

## 9. Optional follow-up

1. Build **1.0.5 build 10** APK/IPA with auth fix bundled.
2. iOS **Distribution** cert for TestFlight / Ad Hoc (build 9 IPA used Development export).
3. Office test matrix in [`APK_UPDATE.md`](../../erp-mobile-app/releases/APK_UPDATE.md) build 9 section.
