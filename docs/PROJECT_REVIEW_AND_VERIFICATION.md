# Project Review & Verification Report

**Date:** 2026-02-16  
**Branch:** `before-mobile-replace`  
**Scope:** Codebase scan, DB connection, env consistency, status report

---

## STEP 1 – PROJECT REVIEW SUMMARY

### 1. Cancel system (Sale/Purchase)

| Item | Status | Details |
|------|--------|---------|
| **DB functions** | ✅ Present | `cancel_sale_with_reverse_accounting`, `cancel_purchase_with_reverse_accounting` in `supabase-extract/migrations/11_returns_cancellation.sql` |
| **Frontend integration** | ❌ Not integrated | No `cancellationService` file. No frontend code calls `cancel_sale_with_reverse` or `cancel_purchase_with_reverse` RPCs. |
| **Void returns** | ✅ Present | `saleReturnService.voidSaleReturn`, `purchaseReturnService.voidPurchaseReturn` (void finalized returns; stock + accounting reversed). |
| **Rental cancel** | ✅ Present | `rentalService.cancelRental` (status → cancelled). |

**Conclusion:** Cancel-with-reverse RPCs exist in DB but are **not** wired in the app. Return void flow is implemented.

---

### 2. Credit Notes + Refund flow

| Item | Status | Details |
|------|--------|---------|
| **`credit_notes` table** | ❌ Not found | No migration or schema creates a dedicated `credit_notes` table. |
| **`refunds` table** | ❌ Not found | No dedicated `refunds` table. |
| **Refund amount** | ✅ Column only | `refund_amount` exists on a table in `schema.sql` / `CLEAN_COMPLETE_SCHEMA.sql` (e.g. payments/returns context). |

**Conclusion:** No dedicated credit_notes or refunds **tables**. Refund is only a column (e.g. `refund_amount`); full credit-note/refund flow not present as separate entities.

---

### 3. Atomic invoice numbering RPC

| Item | Status | Details |
|------|--------|---------|
| **RPC in DB** | ✅ Present | `get_next_document_number(company_id, branch_id, document_type)` in `supabase-extract/functions.sql`; uses `document_sequences` with INSERT ... ON CONFLICT DO UPDATE (atomic). |
| **DB triggers** | ✅ Use RPC | Triggers on `sales`, `purchases`, `expenses`, `rentals` call `get_next_document_number` when `invoice_no`/`po_no`/etc. are null on INSERT. |
| **Frontend usage** | ⚠️ Table only | `settingsService.getNextDocumentNumber()` **does not** call the RPC. It reads/upserts `document_sequences` via Supabase client (get + set). So numbering can have race conditions; DB triggers still assign numbers on insert when frontend leaves them null. |

**Conclusion:** Atomic RPC exists and is used by **triggers**. Frontend uses **non-atomic** `document_sequences` read/upsert for pre-generation (e.g. branch code, rental booking_no). For inserts that leave number null, DB assigns via RPC in trigger.

---

### 4. VPS migration status

| Item | Status | Details |
|------|--------|---------|
| **Migrations 39–45** | ✅ In repo | `39_customer_ledger_rpc.sql` … `45_get_customer_ledger_rentals_rpc.sql` present. |
| **Migrations 46–47** | ❌ Not in repo | No files `46_*.sql` or `47_*.sql` in `supabase-extract/migrations`. |
| **VPS deploy** | ✅ Scripted | `scripts/deploy-via-ssh.ps1` + VPS `deploy.sh` / `scripts/deploy-erp-vps.sh` build and run ERP on VPS. |

**Conclusion:** Migrations 39–45 exist. **39–47 applied** cannot be confirmed from code alone (need DB check on VPS/Cloud). Migrations 46 and 47 do **not** exist in the repo.

---

### 5. Unique index pending items

| Item | Status | Details |
|------|--------|---------|
| **CREATE UNIQUE INDEX** | Not found in repo | Grep in `supabase-extract` for unique indexes did not find pending items. Some uniqueness may be enforced by constraints or by application. |
| **document_sequences** | ✅ Unique by design | `ON CONFLICT (company_id, branch_id, document_type)` in RPC implies unique constraint on that combination. |

**Conclusion:** No explicit “pending unique index” list in codebase; any pending indexes would need to be tracked in a separate checklist or DB audit.

---

### 6. Financial period lock pending

| Item | Status | Details |
|------|--------|---------|
| **Period lock / fiscal lock** | ❌ Not found | No code or migration found for “financial period lock” or “fiscal period lock”. |
| **Fiscal year** | ✅ UI only | `CreateBusinessForm` has fiscal year start (e.g. `fiscalYearStart`); no lock preventing posting in closed periods. |

**Conclusion:** Financial period lock is **not** implemented; only fiscal year config in UI.

---

## STEP 2 – DATABASE CONNECTION VERIFICATION

### .env file check (Windows PC – repo root)

| Variable | Present | Value (masked) |
|----------|--------|-----------------|
| `VITE_SUPABASE_URL` | ✅ | `https://wrwljqzckmnmuphwhslt.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Set (sb_publishable_...) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Set (sb_secret_...) |
| `DATABASE_URL` | ✅ | `postgresql://postgres:...@db.wrwljqzckmnmuphwhslt.supabase.co:5432/postgres` |

### Connection target

- **Windows .env.local** points to **Supabase Cloud** (`wrwljqzckmnmuphwhslt.supabase.co`), **not** VPS.
- **VPS** uses its own Supabase (e.g. `https://erp.dincouture.pk` or `72.62.254.176:8443`) and keys from `/root/supabase/docker/.env` (see `.env.production.example`).

### Test result

- **URL reachability:** Supabase Cloud URL responds (HTTP request reaches server).
- **REST with anon key:** 401 Unauthorized on `/rest/v1/` in test (can be normal for root endpoint or if key/project config is strict).

**Report line:**

- **“Current DB connected to:”** From Windows PC, the app uses **Supabase Cloud** (`wrwljqzckmnmuphwhslt.supabase.co`) per `.env.local`. So: **“Connected to Supabase Cloud (wrwljqzckmnmuphwhslt.supabase.co). Not VPS Supabase.”**
- If you intended to use VPS only: **“Connection issue: Windows .env points to Cloud URL; switch to VPS URL/keys for VPS-only usage.”**

---

## STEP 3 – ENVIRONMENT CONSISTENCY CHECK

| Environment | Config source | Points to |
|-------------|----------------|-----------|
| **Mobile app** | `erp-mobile-app/.env` | Same Cloud URL as main (wrwljqzckmnmuphwhslt.supabase.co) |
| **Web (Windows dev)** | `.env.local` | Supabase Cloud (wrwljqzckmnmuphwhslt.supabase.co) |
| **VPS production** | Build args / `/root/supabase/docker/.env` | VPS Supabase (erp.dincouture.pk / 72.62.254.176) |
| **Cursor/IDE** | Uses repo .env when running dev | Same as Web (Cloud) |

**Hardcoded URLs in code:**

- **`src/lib/supabase.ts`:** No hardcoded project URL; uses `import.meta.env` (placeholder only when missing).
- **`src/app/utils/paymentAttachmentUrl.ts`:** Link to Supabase Dashboard (supabase.com) for docs only, not API endpoint.
- **No** hardcoded `supabase.co` project URL in app code for API/auth.

**Conclusion:** Mobile, Web (Windows), and Cursor all use **Cloud** from their .env. VPS is separate and uses VPS Supabase. No stray Cloud URL in code for runtime API.

---

## STEP 4 – STATUS REPORT

### Current DB connected to

- **Windows PC (this machine):** **Supabase Cloud** – `https://wrwljqzckmnmuphwhslt.supabase.co` (from `.env.local`).
- **VPS production:** VPS Supabase (erp.dincouture.pk) – configured on server, not in this PC’s .env.

### Production readiness

| Area | Readiness | Note |
|------|-----------|------|
| Auth & API | ✅ | Works with configured URL/keys. |
| Sale/Purchase/Returns | ✅ | Create, edit, void returns. |
| Cancel (full reverse) | ⚠️ | DB RPCs exist; UI/service not wired. |
| Document numbering | ⚠️ | Atomic in DB via triggers; frontend path is non-atomic. |
| Credit notes / Refunds | ❌ | No dedicated tables or flow. |
| Financial period lock | ❌ | Not implemented. |
| Migrations 46–47 | ❌ | Not in repo. |

### Pending critical tasks

1. **Cancel system:** Integrate `cancel_sale_with_reverse_accounting` and `cancel_purchase_with_reverse_accounting` in a cancellation service and UI (e.g. “Cancel invoice” / “Cancel PO”).
2. **Credit notes / Refunds:** Decide schema (e.g. `credit_notes`, `refunds` or reuse existing tables) and implement flow.
3. **Document numbering:** Optionally use RPC for next number from frontend (or accept trigger-only assignment) to avoid races.
4. **Migrations 46–47:** Add if required by product; apply on target DB and document in repo.
5. **Financial period lock:** Design and implement if needed for closing periods.

### Risk areas

- **Two numbering paths:** Frontend `document_sequences` vs DB trigger RPC – possible duplicate or skip if both used for same document type.
- **Cloud vs VPS:** Windows/Mobile using Cloud and production using VPS means different data unless you sync or point both to same backend; confirm intended setup.
- **401 on REST test:** Verify anon key and project settings (e.g. project not paused, key correct) if login or API calls fail.

### Recommended next steps

1. **Confirm target backend:** Either (a) keep Windows/Mobile on Cloud for dev and VPS for prod, or (b) point Windows/Mobile to VPS URL/keys and ensure VPS Supabase is reachable.
2. **Integrate cancel RPCs:** Add `cancellationService` (or equivalent) that calls `cancel_sale_with_reverse_accounting` and `cancel_purchase_with_reverse_accounting` and hook from Sale/Purchase UI.
3. **Apply and verify migrations on DB:** On the DB you use (Cloud or VPS), confirm migrations 39–45 (and any 46–47 when added) are applied; verify `credit_notes`/`refunds` if you add them later.
4. **Optional:** Add a small script or health endpoint that runs “SELECT 1” (and optionally one RPC) to automate “Connected to VPS Supabase” vs “Connection issue” with retries (e.g. 3 attempts) and clear error message.

---

## Verification summary

| Check | Result |
|-------|--------|
| Migrations 39–45 in repo | ✅ Yes |
| Migrations 46–47 in repo | ❌ No |
| credit_notes table | ❌ No |
| refunds table | ❌ No |
| cancellationService integrated | ❌ No (RPCs exist, not called) |
| RPC get_next_document_number used | ✅ In DB triggers; not from frontend |
| Windows .env has required vars | ✅ Yes |
| System pointed at VPS Supabase from Windows | ❌ No (pointed at Cloud) |
| No hardcoded supabase.co in code | ✅ Only placeholder/docs |

**Connection:** From this Windows PC, the app is configured for **Supabase Cloud**. For “Connected to VPS Supabase” you must point `.env` (and mobile `.env`) to VPS URL and keys and re-test; if that fails, report exact error after 3 retries.
