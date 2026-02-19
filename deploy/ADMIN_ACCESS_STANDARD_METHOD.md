# Standard Method: Admin Full Data Access (Web + Mobile)

Yeh document define karta hai ke **admin** ka **sara data** dono platforms par (Web ERP + Mobile) **proper working** ke sath kaise access ho.

---

## 1. Architecture (Single source of truth)

| Layer | Standard |
|--------|----------|
| **Backend** | Sirf **ek** Supabase: `https://supabase.dincouture.pk` |
| **Auth** | Same `users` table: `company_id`, `role` (admin/manager/staff/viewer) |
| **Anon key** | Same Kong JWT dono apps mein (Web + Mobile) |
| **Data** | Sales, Purchases, Rentals, Contacts, Products, etc. – sab **isī backend** se |

Admin (e.g. ndm313@yahoo.com) **ek hi login** se Web par bhi aur Mobile par bhi **same company + same data** dekhega, jab dono apps **same URL + same anon key** use karein.

---

## 2. Config checklist (Dono apps ke liye)

### 2.1 Web ERP (project root)

- **.env.local** (local dev) / **.env.production** (production build):
  ```
  VITE_SUPABASE_URL=https://supabase.dincouture.pk
  VITE_SUPABASE_ANON_KEY=<Kong anon JWT – Supabase stack .env se same>
  ```
- Production deploy ke baad **rebuild** zaroor karein taake ye values bundle mein hon.

### 2.2 Mobile app (erp-mobile-app)

- **Auto-sync (recommended):** Root se ek hi jagah config karo; mobile env auto copy ho:
  ```bash
  npm run sync:mobile-env
  ```
  Ye script **root** ke `.env.local` / `.env.production` / `.env` se `VITE_SUPABASE_URL` aur `VITE_SUPABASE_ANON_KEY` **erp-mobile-app/.env** mein copy karta hai – dono apps same backend use karte hain.
- **Mobile dev:** Env sync ke baad mobile chalao:
  ```bash
  npm run mobile:dev
  ```
  (Ye pehle `sync:mobile-env` run karta hai, phir `erp-mobile-app` mein `npm run dev`.)
- **Manual:** Agar chaho to `erp-mobile-app/.env` mein bhi wahi URL + anon key daal sakte ho; `.env` change ke baad mobile dev server **restart** karein.

### 2.3 Supabase / Kong (VPS)

- **Redirect URLs** (Auth config):  
  `https://erp.dincouture.pk`, `http://localhost:5173`, `http://localhost:5174`,  
  agar mobile app Capacitor/Ionic use kare to: `capacitor://localhost`, `ionic://localhost`.
- **CORS**: Kong in origins allow kare: `https://erp.dincouture.pk`, `http://localhost:5174`.
- **SITE_URL**: Auth ke liye jahan login redirect ho (e.g. `https://erp.dincouture.pk`).

---

## 3. Admin access rules (Code level)

### 3.1 Web ERP

- **users** table: `role = 'admin'` (or `'Admin'`) → **branchId = 'all'** set hota hai.
- APIs (e.g. `getAllPurchases(companyId, branchId)`):  
  `branchId === 'all'` → **undefined** pass hota hai → **sari branches** ka data aata hai.
- Admin ko **koi extra config** nahi chahiye; login ke baad automatically **full company data** (all branches) dikhta hai.

### 3.2 Mobile app

- Login ke baad **users** se `company_id` aur `role` aata hai.
- **companyId** se Contacts, Products, Sales, etc. **company-wide** load hote hain (APIs company_id filter karti hain).
- Agar aap chahein ke mobile par bhi admin **sari branches** ka data dekhe (jaise Web par), to BranchSelection mein **“All branches”** option add karke branchId ko `null` ya `'all'` pass kiya ja sakta hai; abhi mobile **ek branch select** karta hai, lekin data zyada tar **company_id** se hi aata hai.

---

## 4. Deploy / run order (Proper working ke liye)

1. **Backend ready**: Supabase (Kong) chal raha ho, DNS + SSL + Redirect URLs + CORS set hon.
2. **Web**:  
   - `.env.production` mein `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` set.  
   - `docker compose ... up -d --build` (ya aapka deploy step).  
   - Admin login → Sales, Purchases, Rentals, etc. sab load honi chahiye (PGRST200 fix wala bundle deploy ho).
3. **Mobile**:  
   - `erp-mobile-app/.env` same URL + same anon key.  
   - `npm run dev` (restart after .env change).  
   - Same admin login → same company data dikhna chahiye; agar 403 aaye to Redirect URLs + CORS check karein.

---

## 5. Quick verification

| Check | Expected |
|-------|----------|
| Web login (admin) | Sales / Purchases / Rentals load; console mein PGRST200 nahi |
| Mobile login (same admin) | Same company; Sales / Contacts / Products load; 403 nahi |
| Same invoice / order | Web aur Mobile dono par same record dikhni chahiye (same backend) |

---

## 6. Summary

- **Standard method**: **Ek backend** (supabase.dincouture.pk), **same anon key** Web + Mobile, **same users table** (admin = full access on web; mobile bhi same company data).
- **Admin sara data access**: Config sahi ho (env + Redirect URLs + CORS) + Web redeploy (current code) + Mobile same env + restart.
- Is method se admin dono platforms par **proper working** ke sath pura data access kar sakta hai.
