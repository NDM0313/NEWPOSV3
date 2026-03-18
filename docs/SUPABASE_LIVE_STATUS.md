# supabase.dincouture.pk – Live Status & Data Access

**Aapka data isi backend par hai.** Server se check (19 Mar 2026) – sab **live** hai.

---

## Server side (VPS) – confirmed

| Check | Result |
|-------|--------|
| Kong | Up (healthy) |
| Auth (GoTrue) | Up (healthy), `/auth/v1/health` → 200 (with apikey) |
| Rest (PostgREST) | Up, `/rest/v1/` → 200 (with apikey) |
| DB | Up (healthy), `companies` table mein rows hain |
| Root URL | `https://supabase.dincouture.pk/` → 200 + JSON message |

**Matlab:** Auth, Rest aur database sab chal rahe hain; data yahi par hai.

---

## Data kaise use karein (live)

1. **ERP (sales, products, accounts, etc.):**  
   Browser mein **https://erp.dincouture.pk** open karein → Login → yahi Supabase backend use hota hai (auth + rest).  
   Agar ERP login ke baad data dikh raha hai, to **supabase.dincouture.pk live hai** aur ERP usi se connected hai.

2. **Database / tables dekhne ke liye (Studio):**  
   **https://studio.dincouture.pk** (alag host). Wahan se tables, auth users, etc. dekh sakte hain.  
   Agar **502** aaye to: `bash deploy/ensure-studio-traefik-network.sh` (VPS) – **docs/STUDIO_502_AND_ERP_AUTOLOGOUT_RUNBOOK.md**.

3. **Direct API test (apikey chahiye):**  
   - Health:  
     `curl -sI -H "apikey: YOUR_ANON_KEY" https://supabase.dincouture.pk/auth/v1/health`  
     → 200 aana chahiye.  
   - Anon key: VPS par `/root/supabase/docker/.env` ya `/root/NEWPOSV3/.env.production` mein `ANON_KEY` / `VITE_SUPABASE_ANON_KEY`.

---

## Agar “kam nahi kar raha” lagay

- **Browser se sirf `https://supabase.dincouture.pk` open kiya:**  
  Wahan sirf ek JSON message aata hai (API info). Ye normal hai. **Data use karne ke liye ERP use karein:** https://erp.dincouture.pk.

- **ERP pe data nahi aa raha / login fail:**  
  1. ERP ka URL sahi ho: **https://erp.dincouture.pk**  
  2. VPS par diagnostic:  
     `ssh dincouture-vps "cd /root/NEWPOSV3 && bash deploy/diagnose-auth-full.sh"`  
     Output mein auth 200 aur token OK hona chahiye.  
  3. Agar 502 aaye to: `docs/LOGIN_502_RESULT.md` follow karein.

- **Office/ghar se site open hi nahi ho rahi:**  
  - **DNS:** `supabase.dincouture.pk` ka A record VPS IP (72.62.254.176) ko point kare.  
  - **Port:** 443 (HTTPS) open ho (Traefik/VPS firewall).

---

## Summary

| URL | Kaam |
|-----|------|
| https://supabase.dincouture.pk | API root – JSON message (data yahi backend par hai) |
| https://erp.dincouture.pk | ERP app – login karke data use karein (yahi “live” use case hai) |
| https://studio.dincouture.pk | Studio – DB/tables dekhne ke liye |

**Data live hai** – ERP use karte waqt agar sab load ho raha hai to backend theek kaam kar raha hai.
