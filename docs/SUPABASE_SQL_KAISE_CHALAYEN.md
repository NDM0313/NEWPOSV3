# Supabase par SQL kaise chalayen

**supabase.dincouture.pk** pe browser mein sirf API message dikhta hai – wahan **login / SQL Editor nahi hota**. SQL chalane ke liye do tareeke hain.

---

## 1. Supabase Studio se (browser – SQL Editor)

SQL Editor aur tables dekhne ke liye **Studio** use karein. Ye **supabase.dincouture.pk se alag URL** hai.

### Step 1: Studio open karein

Browser mein ye URL open karein:

**https://studio.dincouture.pk**

- Agar ye page load ho jaye to Studio UI dikhega (sidebar: Table Editor, SQL Editor, Auth, etc.).
- Agar **load nahi ho** ya "site can’t be reached" aaye to **DNS** check karein: `studio.dincouture.pk` ka **A record** VPS IP (**72.62.254.176**) ki taraf hona chahiye (Hostinger/DNS panel mein).

### Step 2: Project / API connect (agar Studio pooche)

Self-hosted Studio kabhi **project URL** aur **anon key** maangta hai:

- **API URL (Project URL):** `https://supabase.dincouture.pk`
- **Anon key:** VPS par file `/root/supabase/docker/.env` ya `/root/NEWPOSV3/.env.production` mein `ANON_KEY` / `VITE_SUPABASE_ANON_KEY` – wahi key yahan paste karein.

(Ye "login" ERP wala email/password nahi hai – ye sirf Studio ko API se connect karvata hai.)

### Step 3: SQL chalana

- Left sidebar se **SQL Editor** pe jao.
- New query likho ya paste karo → **Run** dabao.
- Result neeche dikhega.

---

## 2. VPS se direct (bina Studio / bina browser login)

Agar **studio.dincouture.pk** open hi nahi ho raha (DNS nahi hai ya Studio down hai) to SQL **VPS par terminal se** chala sakte hain. Iske liye kisi browser "login" ki zaroorat nahi.

### SSH se VPS par

```bash
ssh dincouture-vps
```

### Option A: Ek hi SQL command

```bash
docker exec supabase-db psql -U postgres -d postgres -c "SELECT count(*) FROM auth.users;"
```

`"..."` ke andar apna SQL likh sakte hain (ek statement).

### Option B: Zyada SQL / file se

```bash
# SQL file bana ke (ya apne machine se scp karke) VPS par chalao
docker exec -i supabase-db psql -U postgres -d postgres < /root/NEWPOSV3/path/to/your-query.sql
```

Ya interactive session:

```bash
docker exec -it supabase-db psql -U postgres -d postgres
```

Phir `postgres=#` prompt pe SQL likh kar Enter maren; `\q` se exit.

---

## Short summary

| Kya chahiye        | Kahan / kaise |
|--------------------|---------------|
| Browser se SQL     | **https://studio.dincouture.pk** → SQL Editor (supabase.dincouture.pk pe nahi). |
| Studio "login"     | ERP login nahi – agar Studio pooche to API URL = `https://supabase.dincouture.pk` + anon key. |
| Bina Studio        | VPS: `docker exec supabase-db psql -U postgres -d postgres -c "SELECT ..."` ya `psql` interactive. |

**supabase.dincouture.pk** = sirf API (auth/rest). SQL chalane ke liye **Studio (studio.dincouture.pk)** ya **VPS se psql** use karein.
