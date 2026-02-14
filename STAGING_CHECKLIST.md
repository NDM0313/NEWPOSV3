# Staging Deployment & Full Workflow Test

**Rule:** Staging complete hone ke baad hi live jana. Abhi direct production deploy mat karo.

---

## 🧠 Before Staging (Mandatory)

- [ ] **.env / .env.local** staging DB ko point kar raha ho — production accidentally connect nahi
- [ ] **Supabase project** correct hai (staging project ya separate keys)
- [ ] **STAGING_DB_COPY** (recommended): Production DB ka clone bana lo, staging pe usi pe real test karo

Yeh sabse common mistake hoti hai — double-check karo.

---

## 🚀 STEP 1 – Deploy to Staging

**Staging environment kaunsa hai?** Batayein — us hisaab se exact deploy steps milenge.

| # | Option | Notes |
|---|--------|--------|
| 1 | VPS (Nginx / PM2 / Node) | Manual deploy, full control |
| 2 | Shared hosting | FTP/cPanel, static + API if any |
| 3 | Vercel / Netlify | Connect repo, build = `npm run build`, output = `dist` |
| 4 | Local server + different DB | Same machine, different Supabase/env |
| 5 | Docker | Dockerfile + compose, dist serve |

- [ ] **dist/** build ko staging server par deploy karo
- [ ] **HTTPS** ensure karo
- [ ] Real DB (copy of production) **ya** safe staging DB use karo

---

## ✅ STEP 2 – Full Real Workflow Test (No Demo Data)

Staging pe yeh **real** test karo (demo data nahi).

### 🔹 Sales

- [ ] 3 real sales entries
- [ ] Partial payment
- [ ] Reverse payment
- [ ] Commission calculation

### 🔹 Purchase

- [ ] Add purchase
- [ ] Add payment
- [ ] Purchase return

### 🔹 Rentals

- [ ] New booking
- [ ] Pickup
- [ ] Return
- [ ] Damage penalty apply

### 🔹 Studio

- [ ] New studio order
- [ ] Stage change
- [ ] Worker assign
- [ ] Cost update

### 🔹 Reports

- [ ] Date range filter
- [ ] Financial year filter
- [ ] Export button

### 🔹 Settings Stress Test

- [ ] Currency change
- [ ] Decimal precision change
- [ ] Date format change
- [ ] Timezone change
- [ ] Check: sab modules update ho rahe hain ya nahi

---

## ⚠ During Staging Check

**Console open rakhna.** Specially watch:

**Priority RPCs:**

- [ ] `get_customer_ledger_rentals` — ledger/rentals tab
- [ ] Commission journal RPC
- [ ] Payment reverse RPC
- [ ] Rental status transitions

**General:**

- [ ] **RPC errors** — koi RPC fail to nahi
- [ ] **Permission denied** — koi forbidden/RLS issue
- [ ] **Currency mismatch** — amount wrong currency ya symbol
- [ ] **NaN display** — koi NaN dikh raha
- [ ] **Status stuck** — rental/studio status update nahi ho raha

---

## 🛑 Very Important

**Staging complete hone ke baad hi live jana.**  
Abhi direct production deploy mat karo.

---

## 🎯 When All Boxes Ticked — Tab Hi Live

Tab hi yeh karo (pehle nahi):

1. **Production DB backup** lo
2. **Migrations** apply karo
3. **Build** deploy karo
4. **Server restart** karo
5. **48 hour monitoring mode** mein jao

---

## Reference

- Release rules: `RELEASE_DISCIPLINE.md`
- QA / Production: `FINAL_QA_PRODUCTION_RELEASE.md`
