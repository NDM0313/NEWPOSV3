# MacBook Setup & Remaining Tasks – Analysis

**Date:** 2026-02-16  
**Branch:** `before-mobile-replace`  
**Status:** ✅ Code synced, .env created, analysis complete

---

## ✅ COMPLETED (MacBook par)

### 1. Code Sync & Environment
- [x] `git checkout before-mobile-replace`
- [x] `git pull origin before-mobile-replace`
- [x] `erp-mobile-app/.env` created with:
  - `VITE_SUPABASE_URL=https://wrwljqzckmnmuphwhslt.supabase.co`
  - `VITE_SUPABASE_ANON_KEY=sb_publishable_25HWVdeBmLXUEtPLT5BRYw_I1wYVDsu`

**Note:** Ye `.env` Supabase Cloud URL use karta hai. VPS ke liye `https://72.62.254.176` ya `https://supabase.dincouture.pk` use karein.

### 2. SSH Config
- [x] `docs/VPS_SSH.md` – `ssh dincouture-vps` ready
- [x] `.cursor/rules/vps-ssh.mdc` – Cursor rule use karti hai

### 3. Branch
- [x] Abhi `before-mobile-replace` par ho – 53+ nayi files (erp-mobile-app, docs)

---

## ⏳ REMAINING TASKS (Priority Order)

### 1. Sales – Create Sale in DB (HIGHEST)

**Issue:** Mobile app mein Payment complete hone pe sale **DB mein save nahi hota**. Sirf UI "Sale Complete!" dikhata hai.

**Location:** `erp-mobile-app/src/components/sales/`
- `PaymentDialog.tsx` → `onComplete()` → `SaleConfirmation.tsx` (no API call)
- `SaleConfirmation.tsx` – sirf display, koi insert nahi

**Fix:** `saleService.createSale()` jaisa flow add karna – main ERP `saleService` se API call karke `sales` + `sale_items` + `payments` insert karna.

**Effort:** 2–3 hours

---

### 2. POS – Checkout to Sale (HIGH)

**Issue:** POS complete checkout pe bhi sale record create nahi hota.

**Location:** `erp-mobile-app/src/components/pos/POSModule.tsx`

**Fix:** Checkout pe same `createSale` API use karna (walk-in customer optional).

**Effort:** 1–2 hours

---

### 3. Purchase API (MEDIUM)

**Issue:** Purchase module real vendors + products se save nahi karta.

**Location:** `erp-mobile-app/src/components/purchase/PurchaseModule.tsx`

**Fix:** Contacts (type=supplier) + products, purchase save API.

**Effort:** 2–3 hours

---

### 4. Reports – Real Data (MEDIUM)

**Issue:** Reports module real data ya "Coming soon" placeholder.

**Fix:** Sales summary, purchase, inventory – real API ya placeholder.

**Effort:** 1–2 hours

---

### 5. PWA / Install (LOW)

**Issue:** `erp-mobile-app` mein **manifest.json nahi**, **service worker nahi**.

**Current:** `manifest`, `sw.js`, `vite-plugin-pwa` – koi bhi nahi.

**Fix:** `vite-plugin-pwa` add karke manifest + sw generate karna.

**Effort:** 30 min

---

### 6. Capacitor (Optional)

**Issue:** Android/iOS native build – Capacitor not installed.

**Fix:** `docs/TASK_MOBILE_AND_PRODUCTION.md` Phase 4 follow karo.

**Effort:** 1–2 hours

---

### 7. Database / Schema Sync (Phase 4)

**Issue:** Products/sales schema mismatch – Phase 4 mein aaya tha.

**Fix:** ProductsPage guard + fixes already in branch. Dubara test karna.

---

## 🎯 SABSE PEHLE KYA FIX KAREIN?

**#1 – Sales – Create Sale in DB**

Yeh sabse pehle karna chahiye kyunke:
1. Sales flow complete nahi – user sale karta hai lekin DB mein save nahi hota
2. POS bhi isi API par depend karega
3. Reports real data ke liye sales chahiye

**Steps:**
1. Main ERP `saleService.createSale` / `createSaleWithItems` dekhna
2. `erp-mobile-app/src/api/sales.ts` create karna (Supabase insert)
3. `PaymentDialog` → `onComplete` pe API call karna (before `SaleConfirmation`)
4. `sale_items`, `payments` bhi insert

---

## Quick Commands

```bash
# Mobile app dev
cd erp-mobile-app && npm install && npm run dev

# Deploy from Mac (VPS)
ssh dincouture-vps "cd /root/NEWPOSV3 && git pull origin before-mobile-replace && bash scripts/deploy-erp-vps.sh"
```

---

## Files Reference

| File | Purpose |
|------|---------|
| `docs/TASK_STATUS.md` | Task list |
| `docs/VPS_SSH.md` | SSH config |
| `docs/TASK_MOBILE_AND_PRODUCTION.md` | PWA, Capacitor, data migration |
| `erp-mobile-app/.env` | Supabase URL + key (gitignore) |
