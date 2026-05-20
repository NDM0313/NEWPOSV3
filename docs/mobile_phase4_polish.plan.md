# Phase 4 — Mobile polish (`erp-mobile-app`)

**Scope:** Client-only under [`erp-mobile-app/`](../erp-mobile-app/). No [`migrations/`](../migrations/), no Supabase URL/key changes in [`erp-mobile-app/src/lib/supabase.ts`](../erp-mobile-app/src/lib/supabase.ts) ([`MOBILE_APK_LOCKED_PATTERN.md`](infra/MOBILE_APK_LOCKED_PATTERN.md)).

Related roadmaps: [Phase 2 wizard/OAuth](erp_mobile_phase2_wizard_oauth.plan.md), [Phase 3 PIN/offline](mobile_phase3_pin_offline.plan.md).

## Task checklist

| ID | Item | Status |
|----|------|--------|
| `numeric-keypad` | Global + high-traffic numeric inputs (`inputKeyboard`, wizard, sales, purchase, payment) | Implemented in repo |
| `attachments-viewer` | Sales / Purchase / Payment detail attachments section + signed preview | Implemented in repo |
| `rpc-duplicate-sql` | Operator runs SQL in Supabase SQL Editor (see below) | **Manual** |

## Google Auth: "Unsupported provider"

If the browser shows `{"error_code":"validation_failed","msg":"Unsupported provider: provider is not enabled"}` at your ERP domain, enable **Google** under **Supabase Dashboard → Authentication → Providers**. This is configuration, not a mobile code fix.

---

## RPC duplicate: `create_business_transaction`

**Symptom:** `Could not choose the best candidate function` — Postgres has two overloads of `public.create_business_transaction` with overlapping argument types.

**Keep:** The overload that includes **`p_enable_multi_branch`**, **`p_default_warehouse`**, and **`p_logo_url`** (newer).

**Drop:** The older overload that ends at **`p_base_units`** only (22 parameters before those three).

Run in **Supabase → SQL Editor** (review signatures from step 1 first):

```sql
-- 1) Inspect overloads (run first)
SELECT p.oid::regprocedure AS signature
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'create_business_transaction'
ORDER BY 1;

-- 2) Drop the OLDER overload (22 args — no enable_multi_branch / warehouse / logo)
DROP FUNCTION IF EXISTS public.create_business_transaction(
  text, text, text, text, uuid,
  text, date, text, text,
  text, text, text, text, text, jsonb,
  text, text, numeric, text, boolean,
  text, jsonb
);

-- 3) Confirm only one remains
SELECT p.oid::regprocedure AS signature
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'create_business_transaction';
```

If step 2 reports **no matching function**, use step 1’s output to copy the exact `DROP FUNCTION ...` for the shorter signature on your database.

**Do not** ship `keystore.properties` or raw signing secrets in git.
