# 08 — Testing and QA Checklist

Use this checklist for Flutter builds. Compare against **Capacitor app** on same user/branch where possible. Production writes require explicit approval ([`GIT_WORKFLOW_RULES.txt`](../../GIT_WORKFLOW_RULES.txt), system lockdown rules).

## Environment setup

- [ ] Supabase URL on native: `https://erp.dincouture.pk` (not device localhost)
- [ ] Anon key matches root `.env.production` / Kong key (length ~176 chars)
- [ ] Test user: salesman (restricted) + admin + manager accounts
- [ ] Multi-branch company + single-branch company scenarios
- [ ] Device: Sunmi V2 Pro + generic Android 10+

## Auth / session

- [ ] Email/password login succeeds
- [ ] Invalid credentials show clear error
- [ ] Session restore after app kill (cold start)
- [ ] Session restore after background (warm start)
- [ ] Logout clears local permissions cache and branch selection
- [ ] Inactive user (`users.is_active = false`) forced sign-out
- [ ] Google OAuth (if implemented in Flutter) via deep link `com.dincouture.erp://oauth/callback`
- [ ] Create business wizard creates company via `create_business_transaction` (staging only)

## Branch load

- [ ] `get_effective_user_branch` returns expected branch for salesman
- [ ] Admin sees all branches in picker
- [ ] Salesman with one branch skips picker or auto-selects
- [ ] Multi-branch salesman must pick branch before home
- [ ] Branch change clears stale list caches
- [ ] `hasBranchAccess` blocks wrong-branch document create

## Permissions

- [ ] `FEATURE_MOBILE_PERMISSION_V2` equivalent always on in Flutter
- [ ] Salesman without `sales.view` cannot open Sales module
- [ ] Module toggles: POS hidden when `pos` disabled in `modules_config`
- [ ] Rental/studio/accounts hidden when company toggles off
- [ ] Admin sees module config banner when modules disabled
- [ ] `view_own` salesman sees only own sales in list
- [ ] Manager with `view_branch` sees branch sales
- [ ] Walk-in customer available for sale create (salesman)
- [ ] Salesman cannot open customer ledger if `canViewCustomerLedger` false
- [ ] Payment account picker respects `user_account_access`

## Products

- [ ] Product list loads for branch/company
- [ ] Search by name/SKU/barcode
- [ ] Add product (if permitted)
- [ ] Edit product variations
- [ ] Negative stock blocked when `get_company_negative_stock_allowed` false
- [ ] Product images load (signed URLs)

## Contacts

- [ ] List filter: all / customer / supplier / worker
- [ ] Add contact
- [ ] Edit contact
- [ ] Salesman sees own customers + system walk-in only
- [ ] Party balances match web (`get_contact_party_gl_balances`)
- [ ] Approve public lead (`approve_public_contact_lead`) — staging

## Sale draft / final

- [ ] Create draft sale — **no** stock_movements, **no** sale JE
- [ ] Create quotation/order — no stock/GL until final
- [ ] Finalize sale:
  - [ ] `sales.status = final`
  - [ ] `ensure_sale_stock_movements` success
  - [ ] `record_sale_with_accounting` success
  - [ ] Invoice number assigned (SL- prefix)
- [ ] Final sale with payment: RCV- reference on payment
- [ ] Sale return: `finalize_sale_return` updates stock and totals
- [ ] Void sale: `cancel_sale_full_void` — stock reversed, JE voided
- [ ] Studio sale: production record created; GL timing per studio rules
- [ ] `recalc_sale_payment_totals` matches paid/due on screen

## Payment

- [ ] Sale-linked payment via `record_payment_with_accounting`
- [ ] Manual receipt (`manual_receipt`) with FIFO allocation to sales
- [ ] On-account payment narration
- [ ] Outgoing supplier payment PAY- prefix
- [ ] Duplicate payment attempt blocked (same amount rapid double-tap)
- [ ] Void payment reverses JE (web parity — staging)

## Rental

- [ ] Create booking `create_rental_booking`
- [ ] Rental payment recorded
- [ ] Return flow updates rental status
- [ ] Devaluation journal `record_rental_expense_devaluation_journal` when configured

## Purchase

- [ ] Create purchase draft
- [ ] Finalize: `record_purchase_with_accounting`
- [ ] PUR- document number
- [ ] Void: `cancel_purchase_full_void`
- [ ] Supplier payment on purchase

## Expense

- [ ] `create_expense_document` → EXP- number
- [ ] `record_expense_with_accounting` posts JE
- [ ] Expense list scoped by branch

## Inventory

- [ ] Stock levels match web for branch
- [ ] Adjustment creates `stock_movements`
- [ ] Transfer between branches (if UI exposed)

## Ledger / accounting

- [ ] Customer AR GL ledger matches web sample contact
- [ ] Supplier AP GL ledger matches web
- [ ] Manual journal entry (admin/manager)
- [ ] Funds transfer
- [ ] Roznamcha report loads

## Reports

- [ ] Dashboard metrics (`get_dashboard_metrics`)
- [ ] Financial dashboard (`get_financial_dashboard_metrics`)
- [ ] At least one GL report (trial balance or P&L) matches web export

## Printer

- [ ] Sunmi thermal receipt after sale
- [ ] Bluetooth printer with configured MAC
- [ ] PDF invoice preview
- [ ] Auto-print setting respected
- [ ] `log_print` RPC fires (optional audit)

## Barcode

- [ ] Scan product barcode in POS → correct item in cart
- [ ] Scan unknown barcode → error message
- [ ] Print barcode label from product screen

## Offline queue

- [ ] Offline: create sale → queued PENDING
- [ ] Online: sync → SYNCED + `server_id`
- [ ] Sync error → ERROR status + message in banner
- [ ] Manual sync tap processes queue
- [ ] Offline product/contact lists serve from cache
- [ ] Draft offline sale does **not** change stock on server until sync
- [ ] Stale SYNCING rows recovered on app restart

## Duplicate prevention

- [ ] Double-submit sale button does not create duplicate finals
- [ ] Queue replay does not duplicate payments (idempotency key in Flutter)
- [ ] Same offline sale synced twice → one server sale

## Production safety gates

- [ ] No migration applied to production for Flutter v1
- [ ] No Kong/nginx URL changes without doc update
- [ ] Staging or read-only smoke before prod APK rollout
- [ ] DB backup taken before any server-side change
- [ ] Capacitor APK remains available as rollback
- [ ] Side-by-side: same sale total on Capacitor vs Flutter (staging)

## RPC success criteria quick reference

| Action | Verify on server |
|--------|------------------|
| Sale final | `stock_movements` for sale_id; `journal_entries` for sale; invoice_no set |
| Payment | `payments.reference_number`; JE balanced; sale paid_amount updated |
| Purchase final | PUR number; AP JE |
| Expense | EXP number; expense JE |
| Rental booking | `rentals` row; expected status |
