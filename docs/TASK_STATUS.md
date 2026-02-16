# Task Status – ERP & Mobile App

**Last updated:** 2026-02-16  
**Branch:** `before-mobile-replace`

---

## ✅ Completed

### Main ERP (Web / VPS)
- Login & auth via Supabase
- SSH config for VPS (`dincouture-vps`), deploy from PC: `.\scripts\deploy-via-ssh.ps1`
- Nginx fix (removed `proxy_ssl on`), container stable
- Products page guard (no crash when API/data missing)
- Docs: `FIX_FAILED_TO_FETCH.md`, `VPS_SSH.md`, `TASK_MOBILE_AND_PRODUCTION.md`, `ssh-config-dincouture-vps.example`

### Mobile App (`erp-mobile-app/`)
- **Stack:** Vite + React + TypeScript + Tailwind
- **Auth:** Real Supabase login, signOut, session restore on load
- **Branch:** Real branches from API; last branch saved in `localStorage`, restore to Home on refresh
- **Modules wired:** Home, Sales, POS, Contacts, Settings, Products, Purchase, Reports
- **Real API:**
  - **Products:** List + Add product (Supabase `products`)
  - **Contacts:** List + Add + Edit (Supabase `contacts`)
  - **Sales:** Customers from API, products from API, Add New Customer → API
  - **POS:** Products from API
- **Edit Contact** flow (detail → Edit → save → back to detail)
- **Env:** `.env` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (same as main ERP; `.env` not in git)

---

## ⏳ Remaining (for home / later)

### Mobile App
1. **Sales – create sale in DB:** Payment complete pe sale + items Supabase `sales` / `sale_items` mein insert (main app `saleService.createSale` jaisa flow).
2. **POS – checkout to sale:** Complete Checkout pe bhi sale record create karna (optional: same as Sales API).
3. **Purchase module:** Real vendors (contacts type=supplier) + products, save purchase to API agar backend ready ho.
4. **Reports:** Real data (sales summary, purchase, inventory) ya “Coming soon” theek hai abhi.
5. **PWA / Install:** Manifest + service worker for “Add to Home Screen”.
6. **Capacitor (optional):** Android/iOS build – `TASK_MOBILE_AND_PRODUCTION.md` mein steps.

### Main ERP / VPS
- Data migration / backup steps (doc already in `TASK_MOBILE_AND_PRODUCTION.md`)
- Mobile subdomain/SSL agar mobile app alag URL pe host karna ho

### General
- MacBook se clone karke `erp-mobile-app` ke liye `.env` copy karna (same `VITE_SUPABASE_*` values)
- Deploy from Mac: SSH config + `scripts/deploy-via-ssh.sh` ya same PowerShell logic via `ssh dincouture-vps '...'`

---

## Quick ref

| Item | Command / Path |
|------|-----------------|
| Deploy to VPS (from PC) | `.\scripts\deploy-via-ssh.ps1` |
| Mobile app dev | `cd erp-mobile-app && npm run dev` |
| Mobile app build | `cd erp-mobile-app && npm run build` |
| Mobile env | `erp-mobile-app\.env` (copy from main `.env.local` or repo `.env.example`) |
| SSH host | `dincouture-vps` (see `docs/VPS_SSH.md`) |
