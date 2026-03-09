# Kanban Production Board — Design

**Plan:** MASTER_PROMPT_STUDIO_SAFETY.md — STEP 6  
**Branch:** studio-architecture-test  

---

## 1. Purpose

A **production workflow board** where studio orders (e.g. STD-0030, STD-0032, STD-0040) move across stages. Designed for **React + Tailwind** and aligned with existing **studio_production_stages** and **studio_productions** tables.

---

## 2. Board Stages (Columns)

| Column   | Meaning              | Maps to DB / logic |
|----------|----------------------|---------------------|
| **Cutting**   | First step (fabric cut) | stage_type `dyer` or new `cutting`; or first stage by stage_order |
| **Stitching** | Sewing                | stage_type `stitching` |
| **Embroidery**| Embroidery            | stage_type `embroidery` |
| **Finishing** | Finishing / QC        | stage_type `finishing` or `quality_check` |
| **Ready**     | Production complete   | All stages completed; no current_stage_id (or virtual column) |

**Note:** Existing enum `studio_production_stage_type` includes: dyer, stitching, handwork, embroidery, finishing, quality_check. “Cutting” can be represented by adding enum value `cutting` (test migration) or by treating “dyer” (or first stage) as the first column. “Ready” is derived when `current_stage_id` is NULL and all stages have status `completed`.

---

## 3. Data Model (Existing + Optional)

- **studio_productions:** id, production_no, sale_id, status, **current_stage_id** (FK → studio_production_stages), expected_date, …
- **studio_production_stages:** id, production_id, **stage_type**, **stage_order**, status (pending | assigned | in_progress | completed), assigned_worker_id, cost, completed_at, …

**Kanban placement:**

- A production appears in **one** column: the stage corresponding to its **current_stage_id** (the active stage), or “Ready” if there is no current stage (all done).
- If **current_stage_id** is NULL and not all stages are completed, treat as first incomplete stage by stage_order.

**Moving a card:**

- **Option A:** Update **studio_productions.current_stage_id** to the target stage’s id (same production). Only valid if target is next in sequence or “Ready.”
- **Option B:** Complete current stage (rpc_complete_stage) to advance; “move to Ready” = complete last stage so current_stage_id becomes NULL.

---

## 4. UI Structure (React + Tailwind)

### 4.1 Layout

- **Container:** Full-width or constrained max-width; horizontal scroll on small screens.
- **Columns:** One flex (or grid) row; each column is a vertical lane with a header and a droppable area for cards.

### 4.2 Column Component

- **Header:** Stage name (Cutting, Stitching, Embroidery, Finishing, Ready) + optional count badge.
- **Body:** Scrollable list of **cards** (production orders). Use a drop target (e.g. react-dnd, dnd-kit, or native drag-and-drop) so cards can be moved between columns.
- **Styling:** Tailwind: e.g. `bg-slate-100 dark:bg-slate-800`, `rounded-lg`, `min-w-[200px]`, `shadow`.

### 4.3 Card Component

- **Content:** production_no (e.g. STD-0030), optional sale/invoice ref, customer name, expected date.
- **Optional:** Worker name (for current stage), status chip, “Complete” or “Move” actions.
- **Drag:** Card is draggable; payload = { productionId, currentStageId }.

### 4.4 Data Loading

- **Query:** Load productions for the board: e.g. `studio_productions` with `company_id` / `branch_id` filter, with `current_stage_id` and nested `studio_production_stages` (id, stage_type, stage_order, status, assigned_worker_id). Optionally join sales for invoice_no / customer.
- **Grouping:** Group by “current stage” for display:  
  - For each stage_type (or display label), list productions where current_stage_id points to a stage of that type.  
  - “Ready”: productions where current_stage_id IS NULL and status = 'completed' (or all stages completed).

### 4.5 Move / Complete API

- **Move to next stage:** Call existing `rpc_complete_stage(stage_id)` to complete current stage and advance (or set current_stage_id to next stage id if no RPC).
- **Move to Ready:** Complete the last stage so production’s current_stage_id becomes NULL.
- **Move to another column (out of order):** If allowed by business rules, PATCH studio_productions set current_stage_id = target_stage_id (with validation that production has that stage).

### 4.6 Example Markup (Tailwind)

```tsx
<div className="flex gap-4 overflow-x-auto pb-4">
  {['Cutting', 'Stitching', 'Embroidery', 'Finishing', 'Ready'].map((stage) => (
    <div
      key={stage}
      className="flex-shrink-0 w-72 bg-slate-100 dark:bg-slate-800 rounded-lg shadow p-3 flex flex-col"
    >
      <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">
        {stage}
        <span className="ml-2 text-slate-500">({getCount(stage)})</span>
      </h3>
      <div
        className="flex-1 overflow-y-auto space-y-2 min-h-[200px]"
        onDragOver={...}
        onDrop={...}
      >
        {getCardsForStage(stage).map((prod) => (
          <ProductionCard
            key={prod.id}
            production={prod}
            onComplete={...}
            onDragStart={...}
          />
        ))}
      </div>
    </div>
  ))}
</div>
```

---

## 5. Stage Field in studio_production_stages

- **stage_type:** Already exists; use for column mapping (cutting/dyer, stitching, embroidery, finishing, quality_check).
- **stage_order:** Already exists; defines sequence (1 = Cutting, 2 = Stitching, …).
- **status:** pending | assigned | in_progress | completed — used to show progress and allow “Complete” action.

No new **production** schema change required for the board; optional **test** migration to add `cutting` to `studio_production_stage_type` if the first column must be named “Cutting” and not “Dyer.”

---

## 6. Summary

| Item | Description |
|------|-------------|
| Columns | Cutting, Stitching, Embroidery, Finishing, Ready |
| Cards | Studio productions (production_no, sale, customer, expected date) |
| Data | studio_productions + studio_production_stages; current_stage_id drives column |
| Move | Complete stage (RPC) or update current_stage_id (test-only if out-of-order moves allowed) |
| UI | React + Tailwind; draggable cards; droppable columns |

---

*End of STEP 6 — Kanban Production Board Design.*
