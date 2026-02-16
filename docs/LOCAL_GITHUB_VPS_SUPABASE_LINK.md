# Local vs GitHub vs VPS — Kaun kahan link hai?

**Short answer:**  
- **Local PC** aur **GitHub** = same code (repo).  
- **Local** dev Supabase **Cloud** (supabase.com) use karta hai.  
- **VPS** wala deploy Supabase **apne VPS par self-hosted** use karta hai.  
- **GitHub** sirf code store karta hai; Supabase link **env / build** se decide hota hai.

---

## 1) Local PC (jo tumhare computer par hai)

- **Code:** Same repo **NEW POSV3** (jo GitHub par bhi hai).
- **Supabase link:** **Supabase Cloud** (supabase.com).
  - File: **`.env.local`**
  - `VITE_SUPABASE_URL=https://wrwljqzckmnmuphwhslt.supabase.co`
  - `VITE_SUPABASE_ANON_KEY=...` (Cloud wala anon key)
- **Matlab:** Local run (`npm run dev`) **Supabase Cloud** se connect hota hai, GitHub se nahi.

---

## 2) GitHub

- **Role:** Sirf **code** ka storage (NEW POSV3 repo).
- **Supabase link:** Koi nahi. GitHub par env/keys commit nahi hoti.
- **Matlab:** GitHub se VPS par `git pull` / `git clone` karte ho; Supabase connection **VPS par env/build** se set hota hai.

---

## 3) VPS (erp.dincouture.pk)

- **Code:** Same repo **NEW POSV3** — GitHub se clone/pull kiya hua.
- **Supabase link:** **Self-hosted Supabase** usi VPS par (Kong, Auth, DB sab VPS par).
  - Build time: `VITE_SUPABASE_URL=https://erp.dincouture.pk` (deploy script set karta hai)
  - Anon key: **`/root/supabase/docker/.env`** wala `ANON_KEY`
- **Matlab:** VPS par jo app chal rahi hai (https://erp.dincouture.pk) **apne VPS wale Supabase** se connect hoti hai, Supabase Cloud se nahi.

---

## Summary table

| Jahan       | Code kahan se     | Supabase link              |
|------------|-------------------|----------------------------|
| **Local PC** | Same repo (NEW POSV3) | **Supabase Cloud** (.env.local) |
| **GitHub**   | Repo host          | **Koi link nahi** (sirf code)  |
| **VPS**      | GitHub se pull     | **Self-hosted Supabase** (VPS par) |

---

## Important

- **Local** aur **VPS** dono **same code** use karte hain (GitHub se), lekin **do alag Supabase**:
  - Local → **supabase.com** (Cloud)
  - VPS → **VPS par Supabase** (Kong 8443, erp.dincouture.pk)
- Data bhi alag: Cloud DB aur VPS DB separate hain (jab tak export/import na karo).
