# ERP Mobile App (Din Collection)

**Alag folder** – main ERP project (NEW POSV3) ke sath **mix nahi**. Ye app mobile (Android/iOS) ke liye design follow karta hai; design reference **mobile-design** (Figma export) folder se hai.

## Structure

- **erp-mobile-app/** – yahi mobile app (Vite + React + TypeScript + Tailwind).
- **mobile-design/** – Figma se export; reference only. Is folder se copy karke erp-mobile-app mein step-by-step implement karo.
- **Main project (src/)** – desktop ERP; is app se import mat karo.

## Run

```bash
cd erp-mobile-app
npm install
npm run dev
```

Browser open hoga `http://localhost:5174`

## Login / same database as web app

Mobile app aur **web app dono ko ek hi database** use karna hai (same users, same login). Iske liye:

1. **erp-mobile-app/.env** mein ye dono set karo (web app jaisa):
   - `VITE_SUPABASE_URL` – web jaisa (production: `https://supabase.dincouture.pk`, local: jis URL se web chal raha hai)
   - `VITE_SUPABASE_ANON_KEY` – **bilkul wahi** anon key jo main project ke `.env.production` ya `.env.local` mein hai (Kong anon key)

2. Agar abhi mobile par **Supabase Cloud** (wrwljqzckmnmuphwhslt.supabase.co) use ho raha tha to wahan users alag hain; web par jo user hai woh self-hosted (supabase.dincouture.pk) par hai. Same user/password se login ke liye mobile ko bhi **same URL + same anon key** do. (port 5174 taake main project 5173 par conflict na ho).

## Flow

1. **Login** → Demo Login ya email/password (mock).
2. **Branch selection** → Select branch.
3. **Home** → Dashboard + module grid. Bottom nav: Home, Sales, POS, Contacts, More (module drawer).
4. **Modules implemented:**
   - **Sales** – Home → New Sale → Select Customer → Add Products → Summary → Payment → Confirmation.
   - **POS** – Product grid, cart drawer, checkout (tax 16%).
   - **Contacts** – List, search, filter (all/customer/supplier/worker), stats, Add Contact, view detail.
   - **Settings** – User info, app version, Logout.
   - **Rest** (Purchase, Rental, Studio, Accounts, Expense, Products, Inventory, Reports) → Placeholder "Coming soon".

## Step-by-step modules

Har module ke liye:

1. **mobile-design/src/components/** mein dekhna (e.g. `sales/SalesModule.tsx`, `pos/POSModule.tsx`).
2. Usi flow/UI ko **erp-mobile-app/src/components/** mein nayi file banao (ya subfolder e.g. `modules/SalesModule.tsx`).
3. **App.tsx** mein us screen par real component render karo (abhi `PlaceholderModule` hai).
4. API baad mein connect karo (same backend/ERP API use karna hai).

## Build

```bash
npm run build
```

Output: `dist/`. PWA ya Capacitor ke liye same steps jo **docs/TASK_MOBILE_AND_PRODUCTION.md** mein hain.
