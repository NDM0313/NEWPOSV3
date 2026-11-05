# Company opening repair & verification

| Field | Value |
|--------|--------|
| Company UUID | `2ab65903-62a3-4bcf-bced-076b681e9b74` |
| Mode | **verify-only** |
| Generated (UTC) | 2026-06-07T22:25:52.507Z |

## Schema inspection (live sample row keys)

### `contacts`

`address`, `assigned_to`, `branch_id`, `business_name`, `city`, `cnic`, `code`, `company_id`, `contact_person`, `country`, `created_at`, `created_by`, `created_from`, `credit_limit`, `current_balance`, `device_info`, `email`, `group_id`, `id`, `is_active`, `is_default`, `is_system_generated`, `lead_source`, `lead_status`, `mobile`, `name`, `notes`, `ntn`, `opening_balance`, `payment_terms`, `phone`, `postal_code`, `referral_code`, `state`, `supplier_opening_balance`, `system_type`, `tax_number`, `type`, `updated_at`, `worker_default_rate`, `worker_role`

### `journal_entries`

`action_fingerprint`, `attachments`, `branch_id`, `company_id`, `created_at`, `created_by`, `description`, `document_no`, `economic_event_id`, `entry_date`, `entry_no`, `id`, `is_manual`, `is_posted`, `is_void`, `payment_id`, `posted_at`, `reference_id`, `reference_type`, `total_credit`, `total_debit`, `updated_at`, `void_reason`, `voided_at`, `voided_by`

### `journal_entry_lines`

`account_id`, `account_name`, `created_at`, `credit`, `debit`, `description`, `id`, `journal_entry_id`, `sale_charge_id`, `sale_id`, `tailor_contact_id`

### `accounts`

`balance`, `branch_id`, `code`, `company_id`, `contact_id`, `created_at`, `description`, `id`, `is_active`, `is_default_bank`, `is_default_cash`, `is_group`, `linked_contact_id`, `name`, `parent_id`, `subtype`, `type`, `updated_at`


## Company contact overview

**customer:** 56

### Sample contacts (max 200)

| id | type | name | opening_balance | supplier_opening_balance |
|----|------|------|-----------------|-------------------------|
| 33f56084-610f-4645-b786-fbec312e840e | customer | Walk-in Customer | 0 | 0 |
| e7a9c45e-98e8-4ef9-bbcc-2129b4ab0971 | customer | AWAN | 822855 | 0 |
| 16b77e1a-fdea-47a4-962e-f73b8059c650 | customer | TEETLYAN WHOLESALE | 1189200 | 0 |
| b7a16ce8-5951-4af0-a862-082e1e559314 | customer | HUMAIRA | 227050 | 0 |
| 54c70e92-a234-40d6-9fd2-2fc6faf21d4d | customer | CUST 3522 | 77000 | 0 |
| fd3d0e8a-6950-47b4-9af5-bc754bb625d0 | customer | SABA 3778 | 29000 | 0 |
| 377a7dea-cc25-43c4-b1c6-de391e842f9c | customer | jyoti baljinder | 374000 | 0 |
| 7e33d180-8f67-43a5-8c75-4646165d3920 | customer | SYDA FATIMA | 104000 | 0 |
| 483e454e-4199-4d02-8911-46d771c2d79f | customer | SHIRIN US | 203000 | 0 |
| 0b1552be-f16c-4a44-8640-cf863e8e7dd7 | customer | CUST 2088 | 26500 | 0 |
| b4cb1781-aa3f-4d8e-aa90-06b12e70eee3 | customer | SHUMAIL AUS | 839000 | 0 |
| f7582c02-6bd2-4eb1-a53d-1f60968be34f | customer | SHEGUFTA | 434000 | 0 |
| b21176db-dd31-43a9-bce7-b0cdcb9d08cf | customer | ITRAT FATIMA | 90000 | 0 |
| a6a1ec1c-84e7-4e48-89ec-922b08b9028f | customer | NAZIA AWAN | 205500 | 0 |
| a3c12821-fb19-442f-9286-859303217a09 | customer | SAIROZ CANADA | 870000 | 0 |
| c12632ba-977d-480d-a8f7-8ad3b96f306a | customer | FOZIA 3110 | 657000 | 0 |
| d1765909-efd3-46bf-a735-3eba1baefdde | customer | RUBINA WHITE | 219000 | 0 |
| 04831980-546b-4ff2-bc9d-2e75a43eb51c | customer | DHARIA | 4488088 | 0 |
| 2e4ccde3-c66b-4150-bd40-25585b5da13b | customer | KULJEET SIDHU | 606000 | 0 |
| 48031f55-ba81-4d43-b758-2ed4f0a371b9 | customer | NASEEM NORWAY | 139700 | 0 |
| 6959cf13-af28-4aba-b083-348079877fad | customer | BALJINDER | 1600000 | 0 |
| e39b03eb-b90f-40c8-938c-f67e7e14a19e | customer | SHIMYL 3026 | 108500 | 0 |
| 584f411a-dac9-4df4-86c2-13a5a6dc33e1 | customer | TAHINA OSLO | 129000 | 0 |
| 1170d21f-05a7-4fa8-abe3-0863ca60ff41 | customer | juhi | 901000 | 0 |
| fad7e02c-53e5-4e44-ac37-67a034cb632e | customer | SHAGILLA | 31000 | 0 |
| 8887b2ea-d684-48da-8a4c-d8c40b72c6e3 | customer | CUST 3061 | 22620 | 0 |
| 2a7ffcf0-817b-4d57-b7ca-16de74578704 | customer | AMARJEET | 227000 | 0 |
| 6e7fb49e-9585-4d74-a86a-a1d338c58ebb | customer | attar | 54000 | 0 |
| 81d01ce9-c1cc-43e5-8e5e-072a906b6701 | customer | CUST 3453 | 274900 | 0 |
| a0d87fd2-2040-4a7e-ba0a-298d02329f6f | customer | LUBNA HAMID | 293000 | 0 |
| 83cd80a9-196d-4b82-8983-be21e2f62888 | customer | IRFAN MIANWALI | 67000 | 0 |
| 80472140-2c1b-47ae-9c2d-8e61a6594840 | customer | prabjhot | 100000 | 0 |
| db62bc5c-3454-4c26-85fb-06c0f76c0b8e | customer | RAMMI | 154266 | 0 |
| d35a37f9-7029-4550-b899-b7156e39b940 | customer | 1850 VANI WHOLESALE | 1384000 | 0 |
| 90b53388-d38d-4267-a0a5-8ab9c723b6c2 | customer | ABDULL RAFAY | 25000 | 0 |
| c69d71db-e3ac-45b1-9c0d-2899b177b17a | customer | TINA | 157000 | 0 |
| 33eb275b-bc89-4539-a5b9-18d051b4fc62 | customer | CUST 3120 | 45000 | 0 |
| a8468043-7ff5-4420-abb8-ad5c80e57b74 | customer | HOLLAND | 60000 | 0 |
| 2471104f-9bbe-4ccc-80c9-07749f1a90fd | customer | sadia kaftan | 61000 | 0 |
| 135dfc70-2282-45bc-a5eb-b37c332b9ef9 | customer | CUST 2079 | 126749 | 0 |
| 865ec37b-eaeb-4fc0-96da-a1c41c725318 | customer | SHEEBA INR | 116000 | 0 |
| 2a693065-2e80-4e12-bad0-c031b3995183 | customer | FOZIA AUS | 77700 | 0 |
| edf71e30-fc54-4b03-843e-8d59cf27d1dc | customer | ARSHAD | 1639530 | 0 |
| 0729dfad-8109-4e54-972e-403b7c9facd2 | customer | SEEMA US | 124500 | 0 |
| d70ce7df-1475-4d54-bfbe-4e771032764e | customer | MISS MANSOR | 450000 | 0 |
| 9e23792d-343d-4404-85db-b4c090405a8f | customer | NA BLACK | 23000 | 0 |
| f627dabe-6577-473a-aaa0-feb0d7c4f1a3 | customer | ARSHI INR | 622000 | 0 |
| 6d79e660-f47c-4bb4-83aa-468c9afc3102 | customer | BUSHRA H.PAINT | 100000 | 0 |
| ae1d912b-971c-49d4-84e0-a474459a46dc | customer | FOZIA 4565 | 48000 | 0 |
| 1078999f-37d4-47ad-b828-1ca02163a596 | customer | HIJAB | 850000 | 0 |
| 14db701f-b36a-4dc0-b254-cb66ffd5da07 | customer | CUST 2007 | 410200 | 0 |
| 9abd688f-ac57-4d5e-a016-e6cfb988c0dc | customer | GREEN UK | 20000 | 0 |
| c0ca644a-88d8-4364-a1d4-359a824f56ee | customer | abida qatar | 110000 | 0 |
| 13caf6d6-be2b-4b0d-91d9-5e62de1a34ba | customer | JASBIR | 158165 | 0 |
| 4c6aa88f-3159-4c0e-9ab1-35446b42b419 | customer | MARIAM 966 | 31000 | 0 |
| 03ae422e-0470-45c3-aa34-bed486d4873b | customer | HARPEET 3117 | 482000 | 0 |


## Pre-repair detection

**Supplier-only normalize candidates** (opening_balance > 0, supplier_opening_balance ~ 0): **0**

**both-type manual review** (opening_balance > 0, supplier_opening ~ 0 — AP not auto-moved): **0**


## Control accounts (before)

| Code | Debit | Credit | Net (Dr−Cr) |
|------|-------|--------|---------------|
| 1100 | 0 | 0 | 0 |
| 2000 | 0 | 0 | 0 |
| 2010 | 0 | 0 | 0 |
| 3000 | 0 | 22684023 | -22684023 |

**opening_balance_contact_ap** (active): **0**
**opening_balance_contact_ar** (active): **55**
**opening_balance_contact_worker** (active): **0**

**Duplicate AP opening JEs:** none


## Repair

_Skipped (--verify-only)._

Operational purchase-due / payables tab is **not** validated here (purchase-based only); empty payables for pure openings is **expected**.


## Control accounts (after — unchanged if dry-run / verify-only)

| Code | Debit | Credit | Net (Dr−Cr) |
|------|-------|--------|---------------|
| 1100 | 0 | 0 | 0 |
| 2000 | 0 | 0 | 0 |
| 2010 | 0 | 0 | 0 |
| 3000 | 0 | 22684023 | -22684023 |

**opening_balance_contact_ap** (active): **0**
**Supplier normalize candidates remaining:** **0**
**both-type review remaining:** **0**


## Interpretation

- **Customer / worker:** not modified by repair logic; AR/worker JE counts listed for sanity.
- **Supplier AP opening:** Dr **3000** (equity) / Cr **2000** (AP) for positive payables.
- **P&L:** opening postings use balance-sheet accounts only.

### Extra checks

| Check | Result |
|--------|--------|
| AP 2000 shows activity (credit or net Dr−Cr ≠ 0) | FAIL |
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

