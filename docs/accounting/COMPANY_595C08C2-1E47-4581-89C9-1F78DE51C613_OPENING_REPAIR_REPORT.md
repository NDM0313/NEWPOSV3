# Company opening repair & verification

| Field | Value |
|--------|--------|
| Company UUID | `595c08c2-1e47-4581-89c9-1f78de51c613` |
| Mode | **verify-only** |
| Generated (UTC) | 2026-04-07T11:23:27.620Z |

## Schema inspection (live sample row keys)

### `contacts`

`address`, `assigned_to`, `branch_id`, `business_name`, `city`, `cnic`, `code`, `company_id`, `contact_person`, `country`, `created_at`, `created_by`, `created_from`, `credit_limit`, `current_balance`, `device_info`, `email`, `group_id`, `id`, `is_active`, `is_default`, `is_system_generated`, `lead_source`, `lead_status`, `mobile`, `name`, `notes`, `ntn`, `opening_balance`, `payment_terms`, `phone`, `postal_code`, `referral_code`, `state`, `supplier_opening_balance`, `system_type`, `tax_number`, `type`, `updated_at`, `worker_role`

### `journal_entries`

`action_fingerprint`, `attachments`, `branch_id`, `company_id`, `created_at`, `created_by`, `description`, `entry_date`, `entry_no`, `id`, `is_manual`, `is_posted`, `is_void`, `payment_id`, `posted_at`, `reference_id`, `reference_type`, `total_credit`, `total_debit`, `updated_at`, `void_reason`, `voided_at`, `voided_by`

### `journal_entry_lines`

`account_id`, `account_name`, `created_at`, `credit`, `debit`, `description`, `id`, `journal_entry_id`

### `accounts`

`balance`, `branch_id`, `code`, `company_id`, `contact_id`, `created_at`, `description`, `id`, `is_active`, `is_default_bank`, `is_default_cash`, `is_group`, `linked_contact_id`, `name`, `parent_id`, `subtype`, `type`, `updated_at`


## Company contact overview

**customer:** 3
**supplier:** 2
**worker:** 1

### Sample contacts (max 200)

| id | type | name | opening_balance | supplier_opening_balance |
|----|------|------|-----------------|-------------------------|
| eea21856-8fef-4501-9906-93d3e3a94a7c | supplier | DIN COUTURE | 0 | 100000 |
| fa0bd605-852d-4a84-bbe2-0b8d563a5c16 | customer | Walk-in Customer | 0 | 0 |
| 580e0f30-6f06-46ca-83f6-24bd75ec1f23 | customer | Ali | 50000 | 0 |
| 5d085ee8-d3b8-4f64-bf32-9f40dd934d0b | worker | Saqib | 15000 | 0 |
| 2e78da1f-dabf-4622-aa2c-276f8f69d992 | customer | Salar | 75000 | 0 |
| 2f672748-7e03-47b5-8610-f93d407743cc | supplier | DIN COLLECTION | 0 | 25000 |


## Pre-repair detection

**Supplier-only normalize candidates** (opening_balance > 0, supplier_opening_balance ~ 0): **0**

**both-type manual review** (opening_balance > 0, supplier_opening ~ 0 — AP not auto-moved): **0**


## Control accounts (before)

| Code | Debit | Credit | Net (Dr−Cr) |
|------|-------|--------|---------------|
| 1100 | 125000 | 0 | 125000 |
| 2000 | 0 | 125000 | -125000 |
| 2010 | 0 | 15000 | -15000 |
| 3000 | 140000 | 125000 | 15000 |

**opening_balance_contact_ap** (active): **2**
**opening_balance_contact_ar** (active): **2**
**opening_balance_contact_worker** (active): **1**

**Duplicate AP opening JEs:** none


## Repair

_Skipped (--verify-only)._

Operational purchase-due / payables tab is **not** validated here (purchase-based only); empty payables for pure openings is **expected**.


## Control accounts (after — unchanged if dry-run / verify-only)

| Code | Debit | Credit | Net (Dr−Cr) |
|------|-------|--------|---------------|
| 1100 | 125000 | 0 | 125000 |
| 2000 | 0 | 125000 | -125000 |
| 2010 | 0 | 15000 | -15000 |
| 3000 | 140000 | 125000 | 15000 |

**opening_balance_contact_ap** (active): **2**
**Supplier normalize candidates remaining:** **0**
**both-type review remaining:** **0**


## Interpretation

- **Customer / worker:** not modified by repair logic; AR/worker JE counts listed for sanity.
- **Supplier AP opening:** Dr **3000** (equity) / Cr **2000** (AP) for positive payables.
- **P&L:** opening postings use balance-sheet accounts only.

### Extra checks

| Check | Result |
|--------|--------|
| AP 2000 shows activity (credit or net Dr−Cr ≠ 0) | PASS |
| Duplicate active AP opening per contact | PASS |
| Supplier-only normalize candidates remaining | PASS |


## PASS / FAIL checklist

| Check | Result |
|--------|--------|
| Customer opening path unchanged by this run | (see analysis) |
| Supplier opening repaired / planned | (see repair section) |
| Worker opening path unchanged by this run | (see analysis) |
| AP 2000 present in control snapshot after apply | (see controls) |
| No duplicate active `opening_balance_contact_ap` per contact | (see journals) |
| Basis map preserved (GL vs operational not conflated) | PASS — script does not touch purchase-due RPCs |
| P&L not driven by supplier opening (2000/3000 only) | PASS — by posting design |

