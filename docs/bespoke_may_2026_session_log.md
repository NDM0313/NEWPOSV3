# Bespoke / customization — May 2026 session log

**Roman Urdu summary (pehle parho)**  
**English technical detail (neeche)**

**Main guide:** [`bespoke_customization_and_convert_to_final.md`](bespoke_customization_and_convert_to_final.md)

---

## Roman Urdu — aaj kya kiya aur ab kya karna hai

### Stock ledger (parent + fabric)

- **Custom Order — Bridal** (SKU `CUSTOM-*`): WO complete ke baad **order qty OUT** (e.g. -1) is parent product ledger par — migration `20260602140000`.
- **Fabric** (Design 3005 / Shamooz Silk): **meter qty OUT** (e.g. -5) alag fabric product ledger par — pehle jaisa.
- Agar fabric ledger par bhi kuch nahi: **Branch = All**, **Variation = All**, ledger band karke dubara kholo; WO complete ke baad refresh (app `saleSaved` event se ledger reload karti hai).

### Settings ON / OFF

| Toggle | Matlab |
|--------|--------|
| **ON** (`Enable customization`) | Customize button, fabric child lines, Work Orders menu, View Sale WO panel, invoice instruction bullets — sab bespoke UI |
| **OFF** | Purana system UI — bespoke surfaces chupi; DB data delete nahi hota |

Path: **Settings → Business → Enable customization**

### SL-0007 repair (production)

Fabric line ka `bespoke_parent_item_id` NULL tha — is liye stock post nahi hui thi. Repair script chal chuki hai; movement fabric product par hai.

---

## 1. Database (VPS `supabase-db`, user `supabase_admin`)

| Item | File | Status |
|------|------|--------|
| Defer stock to WO complete + fabric OUT in RPC | [`migrations/20260602120000_bespoke_defer_stock_to_work_order_complete.sql`](../migrations/20260602120000_bespoke_defer_stock_to_work_order_complete.sql) | Applied via apply scripts on VPS |
| Parent CUSTOM line on WO complete | [`migrations/20260602140000`](../migrations/20260602140000_bespoke_wo_parent_stock_movement.sql) then **+IN sign** [`20260602150000`](../migrations/20260602150000_bespoke_wo_parent_stock_in_sign.sql) | Apply on VPS; repair flips legacy OUT rows |
| WO FK ON DELETE SET NULL + relink RPCs | [`migrations/20260602130000_bespoke_work_orders_parent_fk_set_null.sql`](../migrations/20260602130000_bespoke_work_orders_parent_fk_set_null.sql) | Applied |
| SL-0007 data + stock repair | [`scripts/repair_sl0007_wo_stock_direct.sql`](../scripts/repair_sl0007_wo_stock_direct.sql) | Links fabric child; INSERT fabric OUT for BWO-0002 |

**Verify fabric movement:**

```sql
SELECT product_id, quantity, reference_type, reference_id, notes
FROM stock_movements
WHERE reference_id = 'bf4c47af-0e73-470c-b837-9579f31e73f1'::uuid;
```

---

## 2. App changes (web `src/`)

See main guide and git history for: `bespokeFabricStockService`, `bespokeWorkOrderService`, `SalesContext`, `ViewBespokeWorkOrderDrawer`, `FullStockLedgerView`, `useBespokeEnabled`, Sidebar/App/ViewSale/invoice gates.

---

## 3. ON vs OFF matrix

| Surface | ON | OFF |
|---------|----|-----|
| Sidebar Work Orders | Visible | Hidden |
| View Sale WO panel | Visible | Hidden |
| Customize on line | Visible | Hidden |
| Invoice bespoke bullets | Visible | Hidden |

---

## 4. Work Orders Edit — dates, status, cancel stock

- [`BespokeWorkOrderForm.tsx`](../src/app/components/bespoke/BespokeWorkOrderForm.tsx): **Pending** / **In progress** / **Completed**, job created/completed dates, **Cancel stock post** (offsetting movements).
- [`migrations/20260602160000_bespoke_wo_edit_cancel_stock.sql`](../migrations/20260602160000_bespoke_wo_edit_cancel_stock.sql): `cancel_bespoke_work_order_stock`, `reopen_bespoke_work_order`, extended `update_bespoke_work_order`.
- Completed → Pending/In progress: reverses stock + voids production JE (`is_void`).

## 5. Work Orders page — Complete job = stock (purchase Received jaisa)

- [`BespokeWorkOrdersPage.tsx`](../src/app/components/bespoke/BespokeWorkOrdersPage.tsx): **In progress** → **Complete job** (GL + fabric + parent stock); **Stock** column Posted/Missing; **Post stock** on completed rows with missing movements.
- [`getWorkOrderStockPostStatus`](../src/app/services/bespokeFabricStockService.ts): separate fabric vs parent posted checks.

## 6. Manual test checklist

- [ ] Settings OFF → no Work Orders nav; bespoke view shows disabled message
- [ ] Settings ON → bespoke UI returns
- [ ] Work Orders → in progress → **Complete job** → stock Posted badge
- [ ] Completed row Missing → **Post stock** → Posted
- [ ] SL-0007: **Design 3005** ledger **-5** (fabric OUT); **CUSTOM-BRIDAL** ledger **+1** (parent IN)
- [ ] BWO-0003 CUSTOM ledger shows **+1** and badge **Bespoke order** (not −1 / Bespoke fabric)
- [ ] Edit BWO → **Cancel stock post** → reversal rows; Completed → In progress → JE voided
- [ ] Sale edit → no `supabase is not defined`

---

**Last updated:** May 2026
