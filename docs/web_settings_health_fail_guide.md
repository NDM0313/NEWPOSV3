# Web Settings — System Health FAIL Guide (Roman Urdu)

**Date:** 2026-05-25  
**Scope:** Settings → System & Data → System Health (`erp_health_dashboard` view)

## FAIL ka general matlab

- **OK** — check pass; koi action nahi.
- **FAIL** — data ya permission inconsistency; neeche us component ki guide follow karein.
- **SKIP** — migration/column missing; dev/admin se migration apply karwaein (data problem nahi).
- **OVERALL** — koi bhi component FAIL ho to overall bhi FAIL.

UI mein har FAIL/SKIP row par **Fix guide** expand karein — steps + diagnostic SQL copy.

---

## 1. Walk-in Integrity

**FAIL:** Company ke liye 1 se zyada `walking_customer` contact.

**Kya karein:**
1. Diagnostic SQL se affected companies dekhein.
2. `migrations/walkin_consolidation_single_per_company.sql` apply karein.
3. Health Refresh.

```sql
SELECT company_id, COUNT(*) AS walkin_count
FROM public.contacts
WHERE system_type = 'walking_customer'
GROUP BY company_id
HAVING COUNT(*) > 1;
```

---

## 2. Orphan Users

**FAIL:** `public.users.auth_user_id` NULL — Auth se link nahi.

**Kya karein:**
1. Settings → Users → invite / link.
2. Ya Auth user UUID manually UPDATE.

```sql
SELECT id, email, full_name, company_id, role
FROM public.users
WHERE auth_user_id IS NULL;
```

---

## 3. Orphan Sales

**FAIL:** Sale ka `customer_id` contacts mein nahi.

**Kya karein:**
1. List orphans.
2. Walk-in par reassign (pehle SELECT verify).

```sql
SELECT s.id, s.invoice_number, s.customer_id, s.company_id
FROM public.sales s
WHERE s.customer_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.contacts c WHERE c.id = s.customer_id);
```

---

## 4. Negative Stock

**FAIL:** `inventory_balance.quantity < 0`.

**Kya karein:**
1. `npm run inventory-health`
2. Stock movements trace + adjustment.
3. Settings → Inventory → Negative Stock Allowed review.

```sql
SELECT ib.*, pv.sku, p.name AS product_name
FROM public.inventory_balance ib
LEFT JOIN public.product_variations pv ON pv.id = ib.variation_id
LEFT JOIN public.products p ON p.id = ib.product_id
WHERE ib.quantity < 0;
```

---

## 5. Document Sequence Validity

**FAIL:** `document_sequences_global.current_number < 0`.

**Kya karein:**
1. Bad rows identify.
2. Counter ko last issued number par set karein (≥ 0).
3. Settings → Numbering — Maintenance.

```sql
SELECT company_id, document_type, current_number, updated_at
FROM public.document_sequences_global
WHERE current_number < 0;
```

---

## 6. Sales created_by integrity

**FAIL:** `sales.created_by` auth.users mein nahi.

**Kya karein:**
1. Affected sales list.
2. Valid auth user par reassign.
3. User delete ki jagah disable prefer karein.

```sql
SELECT s.id, s.invoice_number, s.created_by, s.company_id
FROM public.sales s
WHERE s.created_by IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = s.created_by);
```

---

## 7. Payments received_by integrity

**FAIL:** `payments.received_by` auth.users mein nahi.

**Kya karein:** Same pattern — valid auth UUID assign.

```sql
SELECT p.id, p.receipt_number, p.received_by, p.company_id, p.amount
FROM public.payments p
WHERE p.received_by IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.received_by);
```

---

## 8. Permission Engine Integrity

**FAIL:** Roles seed incomplete, sales visibility missing, users bina role, ya company bina owner.

**Kya karein:**
1. `erp_permission_engine_v1.sql` applied verify.
2. Settings → Roles & Permissions — sales visibility har role par.
3. Users ko role assign; har company par kam az kam ek **owner**.

```sql
SELECT id, email, company_id FROM public.users
WHERE role IS NULL OR TRIM(COALESCE(role::text, '')) = '';
```

---

## Dashboard direct query (admin session)

```sql
SELECT component, status, details
FROM public.erp_health_dashboard
ORDER BY component;
```

## Safety

- Diagnostic SQL sirf **SELECT** se shuru karein.
- UPDATE/DELETE se pehle backup.
- Ek check fix karke **Refresh** — phir agli FAIL row.

## Related code

- UI guidance: [`src/app/lib/healthCheckGuidance.ts`](../src/app/lib/healthCheckGuidance.ts)
- Panel: [`SettingsPageNew.tsx`](../src/app/components/settings/SettingsPageNew.tsx) — `SystemHealthPanel`
- Service: [`healthService.ts`](../src/app/services/healthService.ts)
- DB: [`create_erp_health_dashboard_view.sql`](../migrations/create_erp_health_dashboard_view.sql)
