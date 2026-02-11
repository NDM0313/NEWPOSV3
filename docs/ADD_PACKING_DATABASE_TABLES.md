# Add Packing – Database Tables (Kahan data save hota hai)

## 1. Stock movements (ledger – box/piece change per movement)

| Table             | Columns        | Type         | Description |
|-------------------|----------------|-------------|-------------|
| **stock_movements** | `box_change`   | DECIMAL(15,2) | Net boxes is movement se (purchase +, sale -). **Ab app integer save karega.** |
| **stock_movements** | `piece_change` | DECIMAL(15,2) | Net pieces is movement se. **Ab app integer save karega.** |

- Migration: `supabase-extract/migrations/30_stock_movements_box_piece_columns.sql`
- Yehi table Inventory Ledger / Full Stock Ledger view me use hoti hai.

---

## 2. Purchase packing (original entry)

| Table            | Column           | Type  | Description |
|------------------|------------------|-------|-------------|
| **purchase_items** | `packing_details` | JSONB | `{ boxes: [{ box_no, pieces: [meters...] }], loose_pieces: [], total_boxes, total_pieces, total_meters }` |

- Schema: `02_clean_erp_schema.sql` / `add_packing_columns.sql`

---

## 3. Sale packing (original entry)

| Table          | Column           | Type  | Description |
|----------------|------------------|-------|-------------|
| **sales_items** / **sale_items** | `packing_details` | JSONB | Same structure: boxes, loose_pieces, total_boxes, total_pieces, total_meters |

---

## 4. Sale return packing

| Table                | Column                   | Type  | Description |
|----------------------|--------------------------|-------|-------------|
| **sale_return_items** | `packing_details`        | JSONB | Original sale wala structure (reference) |
| **sale_return_items** | `return_packing_details` | JSONB | `{ returned_pieces, returned_boxes, returned_pieces_count, returned_total_meters }` |

- Migrations: `33_add_packing_to_sale_return_items.sql`, `34_add_return_packing_details.sql`

---

## 5. Purchase return packing

| Table                     | Column                   | Type  | Description |
|---------------------------|--------------------------|-------|-------------|
| **purchase_return_items** | `packing_details`        | JSONB | Original purchase packing (reference) |
| **purchase_return_items** | `return_packing_details` | JSONB | Piece-level return selection (returned_boxes, returned_pieces_count, etc.) |
| **purchase_return_items** | `packing_type`, `packing_quantity`, `packing_unit` | VARCHAR/DECIMAL | Preserved from original item |

- Migrations: `32_add_packing_to_purchase_return_items.sql`, `34_add_return_packing_details.sql`, `35_purchase_return_items_packing_columns.sql`

---

## Summary

- **Ledger (box/piece numbers jo movement me dikhte hain):** Sirf **stock_movements** table – `box_change`, `piece_change`. In dono ko app ab **integer** save aur display karega (kabi decimal nahi).
- **Packing structure (boxes, pieces, meters):** **purchase_items**, **sales_items** / **sale_items**, **sale_return_items**, **purchase_return_items** – in sab me `packing_details` / `return_packing_details` JSONB me save hota hai.
