# WIP Inventory Layer — Design Proposal (TEST Only)

**Plan:** MASTER_PROMPT_STUDIO_SAFETY.md — STEP 5  
**Branch:** studio-architecture-test  
**Status:** Design only. **Do not apply to production.**

---

## 1. Goal

Introduce a **Work-In-Progress** inventory layer so that:

- **Raw material** (e.g. fabric) is decremented when issued to production.
- **WIP** reflects material committed to active productions.
- **Finished goods** increase when production completes (before or at sale final).

This design is a **proposal** for future implementation; no production schema or data changes in this phase.

---

## 2. Inventory Stages

| Stage | Meaning | Typical source |
|-------|---------|-----------------|
| **Raw Material** | Purchased / received stock not yet committed to production | stock_movements (PURCHASE, etc.) for raw products |
| **WIP** | Material issued to a production (studio_productions) | New movement type: RAW_TO_WIP (or WIP_ISSUE) |
| **Finished Goods** | Completed product ready for sale | New movement type: WIP_TO_FG (or PRODUCTION_COMPLETE) |

---

## 3. Example Flow (Per Master Prompt)

- **Fabric issued to production:**  
  Raw Material **-3** → WIP **+3**  
  (e.g. 3 units of fabric product_id X moved into production_id Y)

- **When production completes:**  
  WIP **-3** → Finished Product **+1**  
  (e.g. 3 units consumed from WIP, 1 unit of finished product_id Z created)

---

## 4. Schema Design Options

### Option A: Extend `stock_movements` Only

- Add movement types (if CHECK allows or is altered):
  - **RAW_TO_WIP** — negative qty on raw product (branch/location), positive “WIP” tracked by reference_type = 'studio_production', reference_id = production_id.  
  - Problem: current schema has one product_id per row; WIP “bucket” is per production, not per product. So we need either:
  - **WIP_ISSUE**: one row per (product_id, production_id): quantity negative for raw product (reduces “raw” balance), and a way to hold WIP balance (e.g. same table with movement_type = 'WIP' and reference_id = production_id, or a separate wip_balance table).
- **WIP_TO_FG**: when production completes, insert movement type **PRODUCTION** (or **WIP_TO_FG**) for the **finished** product (positive), and optionally **WIP_RETURN** or **WIP_CONSUME** for the raw product (negative) to reduce WIP.

- **Reference:** reference_type = 'studio_production', reference_id = studio_productions.id for all WIP-related rows.

### Option B: Separate WIP Table + stock_movements

- **wip_balance** (or **production_consumption**):
  - company_id, branch_id, production_id (FK studio_productions), product_id (raw material), quantity (positive = issued to WIP), unit_cost, created_at.
- **Issue to production:**
  - INSERT into wip_balance (production_id, product_id, quantity, …).
  - INSERT into stock_movements (raw product, quantity negative, movement_type = 'WIP_ISSUE', reference_type = 'studio_production', reference_id = production_id).
- **Production complete:**
  - INSERT into stock_movements (finished product, quantity positive, movement_type = 'PRODUCTION', reference_type = 'studio_production', reference_id = production_id).
  - Optionally: mark wip_balance rows as “consumed” or delete; no separate OUT from WIP in stock_movements if WIP is only in wip_balance.

- **Stock derivation:**
  - **Raw / finished stock:** SUM(quantity) from stock_movements per product (existing logic).
  - **WIP:** SUM(quantity) from wip_balance per product (or per production then by product).

### Option C: Location-Based (Raw / WIP / FG Locations)

- Add **location_id** or **inventory_stage** to stock_movements (or to a balance table).
- Movements between stages: TRANSFER from location Raw → WIP, then WIP → FG.
- Requires location master (e.g. “Raw”, “WIP”, “FG”) and consistent use in all movements.

---

## 5. Recommended Direction (For Future Implementation)

- **Short term (test only):** Use **Option A** with minimal changes:
  - **WIP_ISSUE:** stock_movements with movement_type = 'WIP_ISSUE', quantity negative for raw product, reference_type = 'studio_production', reference_id = production_id. (Existing “raw” stock = SUM(quantity) where movement_type <> 'WIP_ISSUE' or derive “available raw” by subtracting issued.)
  - **PRODUCTION** (or **WIP_TO_FG):** stock_movements for finished product, quantity positive, reference_type = 'studio_production', reference_id = production_id (already used for studio backfill in app).
- **Medium term:** Introduce **wip_balance** (Option B) for clear WIP reporting per production and per raw product, and keep stock_movements for all IN/OUT so ledger stays consistent.

---

## 6. Integration with Studio Production

- **When:** “Issue to production” (new action or when production starts): create WIP_ISSUE movements for raw products (e.g. studio_productions.product_id) and optionally link to studio_production_stages.
- **When:** “Production complete” (all stages done or explicit “Complete production”): create PRODUCTION movement for finished product (generated_product_id); optionally consume WIP (WIP_RETURN / reduce wip_balance).
- **BOM:** If one production consumes multiple raw products, one WIP_ISSUE (or wip_balance row) per (production_id, product_id, quantity).

---

## 7. What Not to Do in This Phase

- Do **not** alter production `stock_movements` CHECK or add new tables to production.
- Do **not** change existing sale-final or app-side stock logic.
- Implement only in **test** with feature flag or test-only migrations when approved.

---

*End of STEP 5 — WIP Inventory Design.*
