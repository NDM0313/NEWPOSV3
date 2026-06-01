# Bespoke / customization — mobile rollout checklist

**Baseline lock:** [`ERP_DISPLAY_LOCKED.md`](ERP_DISPLAY_LOCKED.md) Section E (web canonical stock rules).

Do **not** ship mobile bespoke or sale-status changes until **Phase 1** migration is applied on production and web regression passes.

---

## Phase 1 — Database (VPS)

```bash
ssh dincouture-vps "cd /root/NEWPOSV3 && git pull origin main && bash deploy/deploy.sh"
```

Or SQL Editor: [`migrations/20260602160000_ensure_sale_stock_bespoke_parity.sql`](../migrations/20260602160000_ensure_sale_stock_bespoke_parity.sql)

Also apply if missing: [`migrations/20260601150000_company_logos_storage_bucket.sql`](../migrations/20260601150000_company_logos_storage_bucket.sql)

### Web regression (one bespoke sale, 2 custom dresses)

1. Create sale as **order** (customization ON) → **zero** `stock_movements` with `reference_type=sale` and `movement_type=sale`.
2. Create **2 work orders** (one per parent line) → complete both → fabric **OUT** + parent **IN** per WO (`reference_type=bespoke_work_order`).
3. **Finalize** sale → eligible lines only get sale **OUT**; stock report matches ledger.

---

## Phase 2 — Mobile sale statuses (build 34+)

| Status | Stock on save | Payment on save |
|--------|---------------|-----------------|
| draft / quotation / order | No | Optional / deferred |
| final | Yes (RPC) | Yes |

Verify: Sales → Summary → pick **Order** → Save without payment → list shows order number → Finalize later.

---

## Phase 3 — Mobile bespoke (build 34+)

| Step | Screen |
|------|--------|
| Settings | `enable_bespoke_orders` from `business_settings` |
| Sale order | Save as order; open sale → Work orders |
| Complete WO | `complete_bespoke_work_order` RPC only |
| Finalize | Sale → Final |

---

## Rollback

- Revert mobile APK to build 33.
- DB migrations are additive; do not drop policies without review.
