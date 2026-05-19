# Phase 2 — Supabase Dashboard verification runbook

**Scope:** Dashboard only (no repo migrations). Aligns with [`erp_mobile_phase2_wizard_oauth.plan.md`](erp_mobile_phase2_wizard_oauth.plan.md).

Complete each row in the Supabase project that backs `erp-mobile-app`, then record sign-off at the bottom.

## 1. Email provider

- [ ] **Authentication → Providers → Email** is enabled.
- [ ] **Confirm email** matches product intent (required if you want OTP / verification before `create_business_transaction`).
- [ ] Confirmed whether project sends **6-digit OTP** vs **magic link** (must match app UX in [`CreateBusinessWizardScreen`](../erp-mobile-app/src/components/auth/CreateBusinessWizardScreen.tsx)).
- [ ] **Site URL** matches post-redirect app origin (e.g. prod `https://erp.dincouture.pk/m/` or dev `http://localhost:5173/`).

## 2. URL configuration

- [ ] **Redirect URLs** include dev: `http://localhost:5173/**`, `http://127.0.0.1:5173/**`, and any LAN origins you use.
- [ ] **Redirect URLs** include prod/PWA: `https://erp.dincouture.pk/**` (and `/m/` if applicable).
- [ ] **Capacitor / WebView:** `capacitor://localhost`, `http://localhost`, and custom app deep-link schemes used for OAuth return.

## 3. Google provider

- [ ] **Authentication → Providers → Google** enabled.
- [ ] **Web client ID** and **Client secret** from Google Cloud (OAuth 2.0 Web client) pasted in Supabase.
- [ ] Google Cloud **Authorized redirect URIs** include Supabase’s callback URL (copy from Supabase Google provider screen).

## 4. RLS / RPC sanity

- [ ] Authenticated new user can invoke **`create_business_transaction`** (same expectations as web [`businessService`](../src/app/services/businessService.ts)).

## 5. CORS / Kong

- [ ] Mobile WebView origins allowed per [`MOBILE_APK_LOCKED_PATTERN.md`](infra/MOBILE_APK_LOCKED_PATTERN.md) (no ad-hoc URL/key changes in the app).

## Sign-off

| Date       | Verified by | Project ref / notes |
|------------|-------------|---------------------|
| *(fill)*  |             |                     |

When done, you may add a short note under **Implementation status** in [`erp_mobile_phase2_wizard_oauth.plan.md`](erp_mobile_phase2_wizard_oauth.plan.md) with the verification date (optional).
