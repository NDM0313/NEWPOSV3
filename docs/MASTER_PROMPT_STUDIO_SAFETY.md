# MASTER PROMPT — TEST-BASED IMPLEMENTATION (Studio & Inventory)

**Final flow the AI must follow:**

| Step | Action |
|------|--------|
| **STEP 0** | Git checkpoint + DB backup |
| **STEP 1** | Studio system analysis |
| **STEP 2** | Inventory movement audit |
| **STEP 3** | Test inventory fix |
| **STEP 4** | Production architecture review |
| **STEP 5** | WIP inventory design |
| **STEP 6** | Kanban board design |
| **STEP 7** | Test implementation |
| **STEP 8** | Test report |
| **STEP 9** | Wait for approval |

---

## IMPORTANT SAFETY RULE

**Do NOT apply any changes directly to production.**

All changes must first be implemented and tested in a **TEST** environment.

The project uses:

- React + TypeScript (Vite)
- Supabase (PostgreSQL)
- Node backend
- GitHub repository
- VPS deployment

Before implementing anything, create a safe checkpoint and work in a test branch.

---

## STEP 0 — GIT CHECKPOINT + DATABASE BACKUP

Create a **safe checkpoint** (code + database) before starting any changes.

### 1. Git checkpoint

1. Create a new branch:

   ```bash
   git checkout -b studio-architecture-test
   ```

2. Create a tag:

   ```bash
   git tag STUDIO_ARCHITECTURE_PRE_TEST
   ```

3. Push to GitHub.

This ensures **code rollback** is possible.

### 2. Database backup

Take a DB dump so you can restore if a migration goes wrong:

```bash
mkdir -p backups
supabase db dump --file backups/pre_studio_test.sql
```

(Or use your project’s Supabase/Postgres dump command and save to `backups/pre_studio_test.sql`.)

**Result:** Code rollback (Git) + **database restore** (backup file) = enterprise-level safe workflow.

---

## STEP 1 — SYSTEM ARCHITECTURE ANALYSIS

Analyze the current Studio Production system.

**Check the following database tables:**

- `studio_productions`
- `studio_production_stages`
- `sales`
- `sale_items` / `sales_items`
- `products`
- `stock_movements`

**Identify relationships between:**

- `studio_productions.sale_id`
- `studio_production_stages.production_id`
- `sale_items.sale_id` / `sales_items.sale_id`
- `stock_movements.reference_id`

**Create a full report describing the current workflow:**

```
Studio Sale → Production → Generate Invoice → Final Sale → Stock Movement
```

**Detect issues such as:**

- Missing stock movements
- Incorrect invoice triggers
- Incorrect product auto generation
- Inventory not updating
- Missing WIP inventory layer

**Output a report:**

`docs/STUDIO_SYSTEM_ANALYSIS.md`

---

## STEP 2 — INVENTORY MOVEMENT AUDIT

Analyze why stock movements are not triggered when a sale is finalized.

**Expected behavior:**

When `sale.status = 'final'`, the system must create `stock_movements` records for each sale item.

**Check:**

- Sale finalization logic
- Inventory service
- `stock_movements` table
- `sale_items` / `sales_items` relationship

Fix logic if missing.

**BUT DO NOT APPLY TO PRODUCTION.**

Create a test implementation first.

**Output report:**

`docs/STOCK_MOVEMENT_AUDIT.md`

---

## STEP 3 — IMPLEMENT TEST FIX FOR INVENTORY

Create a **test** implementation for stock movement logic.

**Logic:**

When a sale becomes **FINAL**:

For each `sale_item`:

- Insert into `stock_movements`:
  - `product_id`
  - `quantity_change` = negative (or `quantity` = -qty)
  - `reference_type` = `'sale'`
  - `reference_id` = `sale_id`

Test using test data.

**Do NOT modify existing production records.**

Create migration script:

`migrations/fix_sale_stock_movements_test.sql` (or under a test/ subfolder)

---

## STEP 4 — STUDIO PRODUCTION ARCHITECTURE REVIEW

Review current studio production behavior.

**Expected flow:**

```
Studio Sale created
  → Production created
  → Tasks configured
  → Production stages completed
  → Product generated
  → Invoice generated
  → Sale finalized
  → Inventory updated
```

**Ensure:**

- **Customize Tasks → Save**  
  ONLY updates:  
  `studio_production_stages`  
  and does **NOT** create:  
  product, invoice, or stock movements.

**Output documentation:**

`docs/STUDIO_PRODUCTION_ARCHITECTURE.md`

---

## STEP 5 — IMPLEMENT WIP INVENTORY LAYER (TEST ONLY)

Introduce a Work-In-Progress inventory layer.

**Inventory stages:**

- Raw Material
- WIP
- Finished Goods

**Example:**

- Fabric issued to production:  
  Raw Material **-3** → WIP **+3**
- When production completes:  
  WIP **-3** → Finished Product **+1**

Create schema design proposal.

**Do not apply to production yet.**

**Create design file:**

`docs/WIP_INVENTORY_DESIGN.md`

---

## STEP 6 — DESIGN KANBAN PRODUCTION BOARD

Create a production workflow board.

**Stages:**

- Cutting
- Stitching
- Embroidery
- Finishing
- Ready

Orders move across stages (e.g. STD-0030, STD-0032, STD-0040).

Update stage field in: `studio_production_stages`.

Design UI structure for: **React + Tailwind**.

**Create document:**

`docs/KANBAN_PRODUCTION_BOARD.md`

---

## STEP 7 — CREATE TEST IMPLEMENTATION

Create safe test implementations for:

1. Inventory fix  
2. WIP inventory  
3. Kanban board backend structure  

All changes must be:

- **feature flagged**, or  
- **test-only**

**Do NOT break existing system.**

---

## STEP 8 — TESTING REPORT

After implementing test changes, generate a full test report:

`docs/STUDIO_SYSTEM_TEST_REPORT.md`

**Include:**

- Inventory test results
- Production workflow test
- Stock movement validation
- Data integrity checks

---

## STEP 9 — WAIT FOR APPROVAL

**Do NOT deploy to production.**

Wait for **manual approval** before applying changes.

After approval:

- Prepare production migration scripts.

---

## FINAL OUTPUT REQUIRED

The AI must produce:

| Document | Path |
|----------|------|
| System analysis | `docs/STUDIO_SYSTEM_ANALYSIS.md` |
| Stock movement audit | `docs/STOCK_MOVEMENT_AUDIT.md` |
| Studio architecture | `docs/STUDIO_PRODUCTION_ARCHITECTURE.md` |
| WIP inventory design | `docs/WIP_INVENTORY_DESIGN.md` |
| Kanban board design | `docs/KANBAN_PRODUCTION_BOARD.md` |
| Test report | `docs/STUDIO_SYSTEM_TEST_REPORT.md` |

Plus test migration scripts (no production apply without approval).

---

## RULES

1. **Never** change production database without explicit approval.
2. All work must first run in **TEST** mode.
3. Flow: **Analyze → Build → Test → Report → Wait for approval → Then production.**
4. **Direct apply to production is not allowed.**
