# Production Deploy Checklist

**Target:** erp.dincouture.pk (web ERP). Mobile: separate build/distribute.

---

## Auto-apply (local prep)

Run once before pushing / deploying:

- **Web:** `npm run deploy:prepare` — runs migrations (allow-fail) + `vite build`; leaves `dist/` ready.  
- **Windows:** `.\scripts\prepare-deploy.ps1` (optional: `-Mobile` to also build mobile).  
- **Mobile only:** `npm run deploy:prepare:mobile` — sync env + build erp-mobile-app.

---

## Web (erp.dincouture.pk)

1. **Build:** `npm run build` — must pass (or use `npm run deploy:prepare` to migrate + build).  
2. **Migrations:** Run on production DB (e.g. `npm run migrate` with prod DATABASE_URL).  
3. **Deploy:** Copy `dist/` to server or use CI/CD; point nginx/server to build.  
4. **Env:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (or equivalent) for frontend.  
5. **Smoke test:** Login → Sales → create sale → Payment → Invoice. Purchases, inventory, one report.

---

## Mobile (Capacitor)

1. **Env:** Same API/Supabase as web (sync-mobile-env or .env in erp-mobile-app).  
2. **Build:** `cd erp-mobile-app && npm run build` then `npx cap sync`.  
3. **Android:** Open Android Studio, build signed APK/AAB; install on Sunmi/Android or publish.  
4. **iOS:** Open Xcode, build; install on device or submit to App Store.  
5. **Test on device:** Barcode, POS, one sale end-to-end.

---

## Post-Deploy Verification

| Area | Check |
|------|--------|
| **Real sales** | Create sale from web and mobile; payment; invoice number. |
| **Real purchases** | Create purchase; payment; ledger. |
| **Inventory** | Stock update after sale/purchase; view in inventory. |
| **Login / branch** | Correct company and branch; no RLS errors. |

---

## VPS / SSH

Per project rules: use SSH config host **dincouture-vps** (see `.cursor/rules/vps-ssh.mdc`). Do not use raw IP.

**Web deploy (example):**

```bash
ssh dincouture-vps "cd /root/NEWPOSV3 && git pull && npm install && npm run build"
```

Then restart the app container or serve `dist/` (e.g. via existing `deploy/deploy.sh` on VPS).

**Full deploy script (on VPS):**

```bash
ssh dincouture-vps "cd /root/NEWPOSV3 && git pull && bash deploy/deploy.sh"
```

---

## Mobile build (Capacitor)

```bash
cd erp-mobile-app
npm run build
npx cap sync
```

Then open Android Studio or Xcode and build signed APK/AAB or IPA.

---

## Post-deploy testing

| Check | Action |
|-------|--------|
| Create sale | Web + mobile; payment; invoice number. |
| Create purchase | Payment; ledger. |
| Inventory | Stock update after sale/purchase. |
| Barcode scan | Mobile POS. |
| Mobile POS | Scan → Cart → Payment → Invoice. |
| Sync | Offline queue → go online → verify sync. |

---

## ERP monitoring (recommended)

To track production bugs and errors:

- **Sentry** — Error tracking, release health.
- **LogRocket** — Session replay, console logs, network.

Add one of these post-deploy so future issues can be traced.
