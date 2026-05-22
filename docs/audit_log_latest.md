# ERP audit log (latest)

**Protocol (immutable):** Every task, fix, or modification MUST end with an update to this file: date, scope, files touched, logic added/removed, and locked areas left unchanged. Append new entries at the **top** (below this protocol block).

**Locked without explicit user approval:**

- Supabase auth bridge (`src/app/context/SupabaseContext.tsx`, session storage shims)
- Native/mobile Supabase URL selection (`erp-mobile-app/src/lib/supabase.ts` — `MOBILE_APK_LOCKED_PATTERN`)
- Counter PIN / counter vault (`erp-mobile-app/src/lib/counterUserVault.ts`, `secureStorage`, switch-user overlays)
- Vite proxy targets and deploy auth pipeline (`deploy/deploy.sh`, `deploy/write-erp-env-from-supabase-docker-env.sh`, Kong/GoTrue)
- GL, sale status, migrations under `migrations/`, Android cleartext / `network_security_config`

---

## 2026-05-22 — Product History PDF sale invoice + party

### Scope

Stock ledger PDF/list now shows sale invoice with type (e.g. Sale · STD-0002) and customer/supplier in Party column by fixing sale/purchase enrichment queries.

### Files touched

| Area | Files |
|------|--------|
| API | `erp-mobile-app/src/api/inventory.ts` — `fetchSaleRefs`/`fetchPurchaseRefs` use denormalized names; studio production refs; `normalizeMovementType` |
| UI | `erp-mobile-app/src/components/inventory/ProductHistoryModal.tsx` — `formatPdfTypeCell`, PDF columns |

### Locked areas unchanged

No migrations or GL changes.

---

## 2026-05-22 — Mobile Accounts dashboard cash In/Out (RCV receipts)

### Scope

Fixed inverted red “Out” on customer receipts (RCV-*) in Accounts → Recent Entries by using `payments.payment_type` (same as Transactions timeline) instead of treating all `reference_type=payment` JEs as supplier payments.

### Files touched

| Area | Files |
|------|--------|
| API | `erp-mobile-app/src/api/accounts.ts` — fetch `payment_type` with payment batch |
| Logic | `erp-mobile-app/src/lib/cashFlowDirection.ts` — classify source + resolve In/Out |
| UI | `AccountsDashboard.tsx`, `JournalEntryDetailPanel.tsx` |

### Logic

- `payment_type === 'received'` → green **In**, badge **Customer receipt** (RCV-*)
- `payment_type === 'paid'` → red **Out**, badge **Supplier payment** / worker (PAY-*, WPY-*)
- RCV/PAY prefix fallback when `payment_type` missing on row

### Locked areas unchanged

No migrations, GL triggers, auth, or deploy changes.

---

## 2026-05-21 — Barcode label UI polish, extended fields, web parity

### Scope

Aligned mobile label sheet and settings checkboxes; added per-label toggles (variation, packing, company, branch); enriched PO/product lines; ported batch barcode printing to web ERP (Products select + bulk, Purchase ⋮ menu and detail drawer).

### Files touched

| Area | Files |
|------|--------|
| Mobile | `BarcodeLabelPrintSheet.tsx`, `barcodeLabelPrint.ts`, `barcodeLabelLines.ts`, `settings.ts`, `SettingsModule.tsx`, `ProductsModule.tsx`, `PurchaseModule.tsx` |
| Web | `barcodeLabelSettingsService.ts`, `barcodeLabelPrint.ts`, `barcodeLabelLines.ts`, `BarcodeLabelPrintDialog.tsx`, `ProductsPage.tsx`, `PurchasesPage.tsx`, `ViewPurchaseDetailsDrawer.tsx` |

### Logic added

- `showVariation`, `showPacking`, `showCompanyName`, `showBranchName` on labels; variation barcode enrichment; packing summary from PO `packing_details`.
- Web uses same `settings.mobile_barcode_label` key; A4 print via browser pop-up.

### Locked (unchanged)

Migrations, GL, auth bridge, mobile Supabase URL.

### Verification

`erp-mobile-app npm run typecheck` — pass.

---

## 2026-05-21 — Mobile batch barcode label printing (Products + Purchase)

### Scope

Multi-product barcode label printing on mobile: batch print engine with configurable A4 columns, shared full-screen `BarcodeLabelPrintSheet`, Products selection mode + bulk print, Purchase PO label flow (list ⋮ menu, detail button, post-create prompt), Settings controls for A4 columns and purchase qty default.

### Files touched

| Area | Files |
|------|--------|
| Print core | `erp-mobile-app/src/services/barcodeLabelPrint.ts`, `erp-mobile-app/src/api/settings.ts` |
| Helpers / UI | `erp-mobile-app/src/lib/barcodeLabelLines.ts`, `erp-mobile-app/src/components/products/BarcodeLabelPrintSheet.tsx`, `PrintBarcodeLabelModal.tsx` |
| Modules | `ProductsModule.tsx`, `PurchaseModule.tsx`, `CreatePurchaseFlow.tsx`, `SettingsModule.tsx` |

### Logic added

- `printProductLabelsBatch`, `LabelPrintLine`, flatten per-row `labelCount`; A4 grid uses `a4Columns` / `maxLabelsPerSheet`.
- `aggregatePurchaseItemsForLabels` merges duplicate PO lines; `enrichLinesWithBarcodes` batch-fetches product barcodes.
- Products: select mode + footer bulk print; per-card print opens sheet with one line.
- Purchase: **Print barcode labels** when status is `received` or `final`; post-create “Print labels for new stock?” banner on list.

### Locked (unchanged)

Postgres migrations, GL, auth bridge, mobile Supabase URL, counter PIN vault.

### Verification

`erp-mobile-app npm run typecheck` — pass.

---

## 2026-05-24 — Global offline-first mobile + PTR + swipe-back

### Scope

IndexedDB read-through caches for sales, purchases, expenses, and studio lists; optimistic pending rows for offline sales/purchases; `OfflineBanner` + reconnect auto-sync refresh (`erp-mobile:autosync-complete`); pull-to-refresh on core list modules with tablet scroll root; edge swipe-back via `SwipeBackShell` / `useEdgeSwipeBack`.

### Files touched

| Area | Files |
|------|--------|
| Cache / helpers | `erp-mobile-app/src/lib/offlineData.ts`, `offlineWrite.ts`, `offlinePendingList.ts`, `studioListCache.ts`, `listCache.ts` |
| APIs | `erp-mobile-app/src/api/sales.ts`, `purchases.ts`, `expenses.ts` |
| Shared UI | `PullToRefresh.tsx`, `OfflineBanner.tsx`, `SwipeBackShell.tsx`, `useEdgeSwipeBack.ts`, `MainScrollContext.tsx` |
| Modules | `SalesHome.tsx`, `PurchaseModule.tsx`, `StudioModule.tsx`, `ExpenseModule.tsx`, `ContactsModule.tsx`, `ProductsModule.tsx` |
| App / sync | `App.tsx`, `registerSyncHandlers.ts` |

### Locked (unchanged)

Postgres migrations, GL rules, auth bridge, mobile Supabase URL, counter PIN vault.

### Verification

`erp-mobile-app npm run typecheck` — pass. Manual: airplane mode list browse, offline create sale/purchase, reconnect sync, PTR on lists, edge swipe back on nested views.

---

## 2026-05-24 — Global submit loading guard (mobile studio)

### Scope

Prevent double-tap duplicate stages: `useSubmitLock` in LoadingContext; add/edit stage API wrapped in `withLoading`; StudioStageAssignment and StudioStageSelection disable buttons and show overlay while saving.

### Files touched

| File | Action |
|------|--------|
| `erp-mobile-app/src/contexts/LoadingContext.tsx` | `useSubmitLock` hook |
| `erp-mobile-app/src/components/studio/StudioModule.tsx` | `withLoading` on add/edit `onComplete` |
| `erp-mobile-app/src/components/studio/StudioStageAssignment.tsx` | Async guard + disabled buttons |
| `erp-mobile-app/src/components/studio/StudioStageSelection.tsx` | Save disabled when `busy` |
| `docs/audit_log_latest.md` | This entry |

### Verification

`erp-mobile-app npm run typecheck` — pass.

---

## 2026-05-24 — Extra stage delete + mobile Worker Ledger operational source

### Scope

Custom (`extra`) studio tasks can be deleted from order detail when still pending/assigned (before send/receive); API blocks delete after send or if worker ledger is paid. Mobile Worker Ledger report loads `worker_ledger_entries` first (studio jobs visible); GL path extended to match `studio_production_stage` journal refs.

### Files touched

| File | Action |
|------|--------|
| `erp-mobile-app/src/components/studio/StudioDashboard.tsx` | `isExtra`, `dbStageType` on `StudioStage` |
| `erp-mobile-app/src/components/studio/StudioModule.tsx`, `StudioOrderDetail.tsx` | Map + expanded `canDelete` |
| `erp-mobile-app/src/api/studio.ts`, `src/app/services/studioProductionService.ts` | Extra-stage delete rules |
| `erp-mobile-app/src/api/workerOperationalLedger.ts` | **Created** |
| `erp-mobile-app/src/components/accounts/reports/PartyLedgerReport.tsx` | Operational-first worker detail |
| `erp-mobile-app/src/api/workerPartyGlLedger.ts`, `src/app/services/accountingService.ts` | `studio_production_stage` GL match |
| `docs/audit_log_latest.md` | This entry |

### Locked (unchanged)

GL debit/credit posting rules; migrations; auth bridge.

### Verification

`erp-mobile-app npm run typecheck` — pass.

---

## 2026-05-24 — Studio send/receive notes, worker settlement, job detail parity (web + mobile)

### Scope

Send and receive workflow steps capture optional notes (`[Send]:` / `[Receive]:` on `studio_production_stages.notes`). Worker payment uses one settlement dialog (customer charge + worker pay + account) with `pay_now: true` — Pay Later / accrual-only paths removed from order detail. Workers tab job row opens job/stage detail (timeline + amounts) instead of navigating to studio order. Web and mobile kept in sync.

### Files touched

| File | Action |
|------|--------|
| `migrations/20260524120000_studio_send_receive_notes.sql` | **Created** — `customer_charge` column; RPC `p_notes` on send/receive; `rpc_confirm_stage_payment` `p_customer_charge` |
| `src/app/lib/studioWorkflowNotes.ts`, `erp-mobile-app/src/lib/studioWorkflowNotes.ts` | **Created** — parse/format send/receive workflow notes |
| `src/app/services/studioProductionService.ts`, `erp-mobile-app/src/api/studio.ts` | send/receive notes, `getStageJobDetail`, `customer_charge` on confirm |
| `StudioOrderDetail.tsx`, `StudioSaleDetailNew.tsx` | Notes sheets, unified settlement, stage timeline detail |
| `StudioStageTimeline.tsx` (web + mobile), `StudioWorkerJobDetail.tsx` | **Created** — shared timeline UI |
| `WorkerDetailPage.tsx`, `StudioWorkerDetail.tsx`, `StudioModule.tsx` | Job tap → detail; optional open order link |
| `StudioUpdateStatusView.tsx` | Send/receive notes on alternate status path |
| `docs/audit_log_latest.md` | This entry |

### Locked (unchanged)

GL debit/credit rules; sale status enums; auth bridge; mobile Supabase URL; counter PIN vault.

### Verification

`erp-mobile-app npm run typecheck` — pass. **Ops:** apply `migrations/20260524120000_studio_send_receive_notes.sql` on dev DB before testing send/receive notes and `customer_charge`.

---

## 2026-05-23 — Studio custom / extra tasks persist (web + mobile)

### Scope

Custom studio tasks (e.g. "test task") now persist across Save and navigation: display name stored in `studio_production_stages.notes` as `[Task]: {name}`, multiple `extra` rows per production, local step IDs remapped by `stage_order` (not `stage_type`).

### Files touched

| File | Action |
|------|--------|
| `src/app/lib/studioExtraStageNotes.ts` | **Created** — format/parse/merge helpers |
| `erp-mobile-app/src/lib/studioExtraStageNotes.ts` | **Created** — same convention |
| `src/app/services/studioProductionService.ts` | `notes` on create/replace; `getStagesByProductionId` orders by `stage_order` |
| `src/app/components/studio/StudioSaleDetailNew.tsx` | Multi-extra apply, order remap, display parse, `persistAllStagesToBackend` create missing rows |
| `erp-mobile-app/src/api/studio.ts` | `StudioPipelineStageInput`; `addStudioStagesBatch` inserts `extra` + notes |
| `erp-mobile-app/src/components/studio/StudioStageSelection.tsx` | Ordered pipeline save (presets + custom extras) |
| `erp-mobile-app/src/components/studio/StudioModule.tsx` | Display name from notes; wired structured batch save |
| `docs/audit_log_latest.md` | This entry |

### Locked (unchanged)

No migrations; GL, sale status, auth bridge, counter PIN vault.

### Verification

`erp-mobile-app npm run typecheck` — pass. Manual: web add custom task → Customize Save → header Save → leave/return; mobile Assign Stages with custom task → leave/return.

---

## 2026-05-23 — Studio mobile Workers tab + web assign FK fix

### Scope

Mobile Studio header: **Orders | Workers** tabs; worker list with active/pending/completed counts; tap → detail with current/recent jobs (open order). Web/mobile assign: ensure `workers` row exists before FK insert (`assigned_worker_id → workers.id`).

### Files touched

| File | Action |
|------|--------|
| `src/app/services/studioProductionService.ts` | `ensureWorkerRowForAssign`, call in `assignWorkerToStage` |
| `src/app/components/studio/StudioSaleDetailNew.tsx` | `studioService.getAllWorkers` for assign dropdown |
| `migrations/20260523120000_rpc_assign_ensure_worker_row.sql` | **Created** — RPC upserts worker from contact before assign |
| `erp-mobile-app/src/api/studio.ts` | ensure on assign; `getWorkersWithStats`, `getWorkerDetail` |
| `erp-mobile-app/src/components/studio/StudioWorkersList.tsx` | **Created** |
| `erp-mobile-app/src/components/studio/StudioWorkerDetail.tsx` | **Created** |
| `erp-mobile-app/src/components/studio/StudioModule.tsx` | Orders / Workers tabs + routing |
| `docs/audit_log_latest.md` | This entry |

### Locked (unchanged)

GL, sale status, auth bridge, counter PIN vault.

### Ops

Apply `migrations/20260523120000_rpc_assign_ensure_worker_row.sql` on dev DB. If legacy workers still missing, re-run `workers_sync_from_contacts.sql` step 2 INSERT once.

---

## 2026-05-22 — Studio web parity + Send/Receive optional dates

### Scope

Web ERP: **Bill Generated** / **Tasks Complete** list badges, post-bill pipeline lock on detail, Send/Receive date pickers (default today). Mobile: date sheet before Send/Receive wired to RPC `p_sent_date` / `p_received_date`. Additive migration only.

### Files touched

| File | Action |
|------|--------|
| `migrations/20260522180000_studio_send_receive_optional_dates.sql` | **Created** — optional `p_sent_date` / `p_received_date` on send/receive RPCs |
| `src/app/lib/studioOrderDisplay.ts` | **Created** — list badges, structural lock, date parse helpers |
| `src/app/components/studio/StudioSalesListNew.tsx` | Badges via `getStudioListBadge`, Bill Generated filter |
| `src/app/components/studio/StudioSaleDetailNew.tsx` | Structural lock banner, Send modal, Receive date, `sendToWorker` |
| `src/app/services/studioProductionService.ts` | `sendToWorker`, `receiveStage` dates, bill guards |
| `erp-mobile-app/src/lib/studioWorkflowDates.ts` | **Created** — shared date → noon UTC |
| `erp-mobile-app/src/api/studio.ts` | RPC date args (already present) |
| `erp-mobile-app/src/components/studio/StudioOrderDetail.tsx` | Date confirm sheet |
| `erp-mobile-app/src/components/studio/StudioModule.tsx` | Pass dates to API |
| `erp-mobile-app/src/components/studio/StudioUpdateStatusView.tsx` | Send/Receive date fields |
| `docs/audit_log_latest.md` | This entry |

### Locked (unchanged)

GL finalize RPCs, sale status enums, auth bridge, counter PIN vault, table/column drops.

### Verify

- `erp-mobile-app`: `npm run typecheck` — pass
- Apply `migrations/20260522180000_studio_send_receive_optional_dates.sql` on dev DB before RPC date tests

---

## 2026-05-22 — Studio bill generated status + post-bill edit lock

### Scope

Mobile Studio dashboard shows **Bill Generated** vs **Tasks Complete**; order detail locks pipeline/design after invoice line linked; API guards on stage mutations.

### Files touched

| File | Action |
|------|--------|
| `erp-mobile-app/src/api/studio.ts` | `sale.status` in fetch; `assertProductionPipelineUnlockedForStage` on stage RPCs |
| `erp-mobile-app/src/lib/studioOrderDisplay.ts` | **Created** — badge + stage label helpers |
| `erp-mobile-app/src/components/studio/StudioModule.tsx` | `saleStatus`; `currentStage` Bill Generated / Ready for Invoice |
| `erp-mobile-app/src/components/studio/StudioDashboard.tsx` | Badges + Bill Generated filter chip |
| `erp-mobile-app/src/components/studio/StudioOrderDetail.tsx` | Lock banner, pipeline lock, View/update invoice |
| `docs/audit_log_latest.md` | This entry |

### Locked (unchanged)

Migrations, GL finalize RPCs, auth bridge, counter PIN vault.

---

## 2026-05-22 — SalesHome Studio / POS / Regular filter

### Scope

Mobile Sales list header: **All | Studio | POS | Regular** chips filter recent invoices client-side (web SalesPage parity). List fetch cap 100, display cap 50; stats unchanged (note when filtered).

### Files touched

| File | Action |
|------|--------|
| `erp-mobile-app/src/lib/saleTypeClassification.ts` | **Created** — `isStudioSaleRow`, `isLikelyPosSaleRow`, `matchesSaleListTypeFilter` |
| `erp-mobile-app/src/components/sales/SalesHome.tsx` | Filter chips, `useMemo` filtered list, type badges, empty states |
| `docs/audit_log_latest.md` | This entry |

### Locked (unchanged)

Migrations, GL, `getAllSales` query, auth bridge, counter PIN vault.

---

## 2026-05-21 — Mobile branch fallback (zero `user_branches`)

### Scope

Restricted users with no `user_branches` rows fall back to company default branch (Main Branch by name, else first branch) and auto-route to home instead of "No branch assigned."

### Files touched

| File | Action |
|------|--------|
| `docs/phase7_branch_fallback_fix.md` | Audit + completion notes |
| `erp-mobile-app/src/lib/branchResolution.ts` | **Created** — shared resolver helpers |
| `erp-mobile-app/src/components/BranchSelection.tsx` | `effectiveBranchIds`; removed zero-assignment error when default exists |
| `erp-mobile-app/src/App.tsx` | Three bootstrap/login paths use effective ids |
| `erp-mobile-app/src/context/PermissionContext.tsx` | `pickCompanyDefaultBranch` fallback for `hasBranchAccess` |
| `docs/audit_log_latest.md` | This entry |

### Locked (unchanged)

Auth bridge, counter PIN vault, migrations, GL, `getUserBranchIds` query.

Detail: [`phase7_branch_fallback_fix.md`](phase7_branch_fallback_fix.md).

---

## 2026-05-21 — Mobile branch selection fix

### Scope

Restricted mobile users only see `user_branches` assignments; zero assignments show error only; single assignment auto-routes to home.

### Files touched

| File | Action |
|------|--------|
| `docs/phase7_branch_selection_fix.md` | **Created** — audit + test matrix |
| `erp-mobile-app/src/api/permissions.ts` | `canPickAllCompanyBranches()` |
| `erp-mobile-app/src/components/BranchSelection.tsx` | Filter, hide list, auto-bypass |
| `erp-mobile-app/src/App.tsx` | Saved-branch restore guards (3 paths) |

### Locked (unchanged)

Auth bridge, counter PIN vault, migrations, GL.

Detail: [`phase7_branch_selection_fix.md`](phase7_branch_selection_fix.md).

---

## 2026-05-21 — Phase 7 telemetry audit + dev Realtime WSS

### Scope

Document `127.0.0.1:7640` ingest noise and lock working salesman user pipeline; direct Realtime to `wss://supabase.dincouture.pk` in Vite dev.

### Files touched

| File | Action |
|------|--------|
| `docs/phase7_telemetry_audit_log.md` | **Created** — permanent telemetry / users pipeline audit |
| `src/lib/supabase.ts` | `attachDirectRealtimeInLocalDev()` — WSS to configured host; REST stays on `/supabase` proxy |
| `docs/audit_log_latest.md` | This entry |

### Locked (unchanged)

Migrations, GL, accounting lines, `userService` logic, `SupabaseContext` bridge, debug ingest fetch bodies (documented only).

Detail: [`phase7_telemetry_audit_log.md`](phase7_telemetry_audit_log.md).

---

## 2026-05-21 — Login anon key fix (local + VPS + UX)

### Scope

Fix `Invalid authentication credentials` on mobile LoginScreen by replacing demo/stale anon JWTs, syncing canonical keys from VPS, and mapping the error in `signIn()`.

### Files touched

| File | Action |
|------|--------|
| `erp-mobile-app/src/api/auth.ts` | Map `Invalid authentication credentials` to operator-friendly API key mismatch message |
| `erp-mobile-app/.env` | Replaced demo JWT with VPS canonical anon (`iss: supabase`, len **169**); `VITE_SUPABASE_URL=https://supabase.dincouture.pk` |
| `erp-mobile-app/.env.production` | Synced from VPS (`VITE_SUPABASE_URL=https://erp.dincouture.pk`, same anon) |
| `.env.local` (repo root) | Anon aligned to VPS canonical (backup `.env.local.bak.*` created) |
| `docs/audit_log_latest.md` | This entry |

**Gitignored backups:** `erp-mobile-app/.env.bak.*`

### VPS commands

| Step | Result |
|------|--------|
| `git pull` | Already up to date |
| `deploy/write-erp-env-from-supabase-docker-env.sh` | Wrote `.env.production` + `erp-mobile-app/.env.production` (anon len **169**, `iss: supabase`) |
| `scripts/vps-audit-auth-bridge.sh` | `erp_anon_length=169` = `kong_anon_length=169`; `public_erp_http=200`; `local_3001_http=200` |
| `deploy/deploy.sh` | **Failed** at LoginScreen guard: missing string `auto-fills and signs in` in `erp-mobile-app/src/components/LoginScreen.tsx` on VPS tree. JWT/env fix steps inside deploy **did run** before exit; **Docker ERP image not rebuilt**. |

**Live `/m/` bundle:** Still previous build until deploy guard passes (push/pull latest mobile login source, then re-run `bash deploy/deploy.sh` on VPS).

### Local verification

| Check | Result |
|-------|--------|
| `erp-mobile-app/.env` demo signature | **No** (`iss: supabase`) |
| Auth probe `POST /auth/v1/token` (wrong password) | **400** `Invalid login credentials` (was **401** with demo key) |
| Vite dev | Auto-restarted after `.env` change |

### Logic added

`signIn()` in `auth.ts`: friendly message when Kong rejects anon JWT (does not change key selection).

### Features locked (unchanged)

`supabase.ts` URL/native rules, auth bridge, counter vault, migrations, Android cleartext, deploy script order.

---

## 2026-05-21 — LoginScreen credentials diagnosis (read-only)

### Scope

Investigate `Invalid authentication credentials` on [`erp-mobile-app/src/components/LoginScreen.tsx`](../erp-mobile-app/src/components/LoginScreen.tsx) email/password form (localhost + live). No auth bridge rewrite; no selection UI changes.

### Files touched (this task)

| File | Action |
|------|--------|
| `docs/audit_log_latest.md` | **Created** — this file |

### Files explicitly NOT touched

`erp-mobile-app/src/lib/supabase.ts`, `erp-mobile-app/src/api/auth.ts`, `SupabaseContext.tsx`, `counterUserVault.ts`, deploy scripts, migrations, Android manifest.

### Prior session (uncommitted in workspace)

| File | Change |
|------|--------|
| `erp-mobile-app/index.html` | `color-scheme` meta + solid `#111827` backgrounds (Force Dark / OnePlus) |
| `erp-mobile-app/package.json` | `cap:sync:ios:prod` script |
| `erp-mobile-app/ios/README_BUILD.md` | Step A (Windows) / Step B (Mac) |
| `erp-mobile-app/ios/App/App/Base.lproj/LaunchScreen.storyboard` | `#111827` launch background |
| `docs/phase7_studio_barcodes_images.plan.md` | Build 5 device matrix + Pixel logcat |

### Diagnosis (evidence)

| Env file | Present | `VITE_SUPABASE_URL` | Anon JWT length | `iss` (payload) | Demo tutorial sig? |
|----------|---------|---------------------|-----------------|-----------------|---------------------|
| `.env.production` (repo root) | No | — | — | — | — |
| `.env.local` (repo root) | Yes | `https://supabase.dincouture.pk` | **169** | `supabase` | No |
| `erp-mobile-app/.env` (Vite **dev**) | Yes | `https://supabase.dincouture.pk` | **176** | **`supabase-demo`** | **Yes** |
| `erp-mobile-app/.env.production` | Yes | `https://erp.dincouture.pk` | **176** | **`supabase-demo`** | **Yes** |

**Proxy probe** (dev server `http://127.0.0.1:5174`, `POST /auth/v1/token?grant_type=password` with probe credentials):

| Key source | HTTP status | Error message |
|------------|-------------|---------------|
| `erp-mobile-app/.env` (active for `npm run dev`) | **401** | **`Invalid authentication credentials`** ← matches UI |
| Root `.env.local` anon (reference) | **400** | `Invalid login credentials` ← Kong accepts anon; wrong password only |

**Conclusion:** Localhost login failure is caused by the **public Supabase tutorial anon JWT** in `erp-mobile-app/.env`, not by LoginScreen logic or counter selection. Live/production mobile builds using `erp-mobile-app/.env.production` with the same demo key will hit the same class of failure until the anon is synced from VPS `ANON_KEY` (see [`docs/infra/AUTH_FIX_HISTORY_LOG.md`](infra/AUTH_FIX_HISTORY_LOG.md)).

Root `.env.local` anon (169 chars) is **accepted by Kong** for auth but may still be a **stale** line vs canonical **176**-char `ANON_KEY` on the VPS; prefer VPS `write-erp-env` for the canonical value.

### Operator fix (no code change required for localhost)

1. Copy **`VITE_SUPABASE_ANON_KEY`** from repo root **`.env.local`** (or from VPS after `bash deploy/write-erp-env-from-supabase-docker-env.sh`) into **`erp-mobile-app/.env`**, replacing the demo key.
2. Ensure `VITE_SUPABASE_URL=https://supabase.dincouture.pk` in that file (per [`.env.example`](../erp-mobile-app/.env.example)).
3. Restart `npm run dev` in `erp-mobile-app`.
4. Retry login; expect **`Invalid email or password`** for wrong password, not `Invalid authentication credentials`.

**Live / APK:** Sync `erp-mobile-app/.env.production` from VPS `ANON_KEY` via locked deploy writer, then `npm run cap:sync:android:prod` / redeploy web — **requires explicit user approval** for VPS deploy.

### Optional follow-up (needs user approval)

- Map `Invalid authentication credentials` in `erp-mobile-app/src/api/auth.ts` `signIn()` to operator-friendly text (UX only; does not fix wrong key).
- VPS: `bash scripts/vps-audit-auth-bridge.sh` then env sync if `erp_anon_length` ≠ `kong_anon_length`.

### Features locked this task

Auth bridge, counter PIN, native URL lockdown, GL/migrations — unchanged.

---

## 2026-05-21 — Mobile Build 5 prep (prior)

### Scope

Force Dark HTML fix, iOS Capacitor sync prep, Pixel 6 logcat documentation.

### Files touched

See table in “Prior session (uncommitted)” above.

### Features locked

Auth URL logic, GL, Android cleartext — not modified.
