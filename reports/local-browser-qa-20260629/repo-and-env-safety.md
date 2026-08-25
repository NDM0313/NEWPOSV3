# Repo and environment safety — Local Browser QA

**Run:** LOCAL BROWSER QA — PARTY LEDGER DISCOUNT + CREATE BUSINESS OTP  
**Generated:** 2026-06-29

---

## Git state

| Item | Value |
|------|--------|
| Branch | `main` |
| HEAD | `22b7089e` |
| origin/main | `22b7089e` (in sync) |
| Staged | None |
| Uncommitted (excluded) | `graphify-out/`, `downloads/`, `erp-flutter-app/releases/` |

---

## Tests / build (pre-QA)

| Command | Result |
|---------|--------|
| `npm run test:unified-ledger` | **298/298 PASS** |
| `npm run test:unit` | **122/122 PASS** |
| `npm run build` | **PASS** |

---

## Environment target (masked)

| Variable | Value |
|----------|--------|
| `VITE_SUPABASE_URL` (baked) | `https://supabase.dincouture.pk` |
| Resolved at dev runtime | `http://localhost:5173/supabase` (Vite proxy → production Kong) |
| Realtime (dev direct) | `wss://supabase.dincouture.pk/realtime/v1` |
| `VITE_SUPABASE_ANON_KEY` | Present — `iss=supabase`, role `anon` (masked; not demo JWT) |
| Migrations on dev start | **Skipped** — no `DATABASE_URL` in `.env.local` |

---

## Classification

**PRODUCTION / LIVE**

Local `npm run dev` proxies all REST/auth to **production** Supabase on VPS (`supabase.dincouture.pk`). This is the same database used by `erp.dincouture.pk`.

**Posting safety rule for this QA run:** Party Ledger Discount **JE posting is BLOCKED** — no production GL mutation without explicit operator approval.

---

## Constraints confirmed

- No VPS deploy / SSH for fixes
- No migrations, flags, or Cash Flow loader swap
- No credentials committed
