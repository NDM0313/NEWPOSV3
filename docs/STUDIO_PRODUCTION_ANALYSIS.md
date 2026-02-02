# Studio Production Pipeline – Analysis & Correction

**Date:** 2026-01-29  
**Objective:** Current system ka flow samajhna, intended workflow se compare karna, aur gaps + fix proposal dena.  
**Rule:** Pehle analysis, phir solution. Implementation se pehle manager decision.

---

## STEP 1 – CURRENT STUDIO SYSTEM ANALYSIS

### A. Frontend Analysis

#### 1. Sale se Studio kaise open hota hai

| Step | Current behavior |
|------|------------------|
| Sale create | User **Sale Form** mein sale create karta hai. **“Studio Sale”** toggle ON karke invoice type **Studio** select karta hai (invoice_no prefix **STD-**). |
| Save | `createSale(saleData)` call hota hai; `is_studio: true` / `isStudioSale` pass hota hai. Sale **sales** table mein save hoti hai (items **sales_items**). |
| Studio open | Sale save ke baad koi auto-navigation **Studio** pe nahi hota. User **sidebar → Studio Production → Dashboard** ya **Studio Sales** khud open karta hai. |
| Link | **Sales** table aur **Studio** module ke beech koi DB-level link nahi: na `sales.sale_id` in studio, na `studio_productions.sale_id`. Sirf UI mein “Studio Sales” list **sales** ko `invoice_no` STD-% se filter karke dikhati hai. |

**Summary:** Sale se studio “open” sirf is tarah hai ke user Studio section mein jata hai aur wahan **studio_orders** + **STD-*** sales merged list dikhti hai. Koi “is sale se open” flow nahi; sale ka data pass hone ka koi formal mechanism nahi.

---

#### 2. Studio job kaise create hoti hai

**Do alag flows hain:**

| Flow | Source | Table / Entity | Kaise create |
|------|--------|----------------|--------------|
| **A. Studio Order** | Standalone | `studio_orders` | Abhi UI se direct “create studio order” flow codebase mein clearly expose nahi (legacy / alternate entry). `studioService.createStudioOrder(order, items)` se order + `studio_order_items` insert. |
| **B. Production Job** | Dashboard / List | `studio_productions` | User **Studio Dashboard** ya **Studio Sales** list se row pe **“Shift to Production”** click karta hai → **Studio Production Add** page open hota hai with `selectedStudioSaleId` (sale/order id). Form mein product, quantity, worker, cost etc. bharta hai → **ProductionContext.createProduction()** → **studioProductionService.createProductionJob()** → `studio_productions` mein insert. |

**Important:**  
- “Shift to Production” se jo production job banti hai, usme **sale_id / studio_order_id** store nahi hota. Sirf UI par “Linked to sale: STD-xxx” dikhaya jata hai; DB mein link column nahi.  
- Production job **product_id, quantity, estimated_cost, actual_cost, assigned_worker_id** le rahi hai; customer / sale reference nahi.

---

#### 3. Status kaise change hota hai

| Entity | Where | How status changes |
|--------|--------|---------------------|
| **Studio Order** | `studio_orders` | `studioService.updateStudioOrder(id, { status })`. Status: `pending \| in_progress \| completed \| cancelled`. Kaun change karta hai: detail/edit screens (e.g. StudioSaleDetailNew agar order load ho). |
| **Studio Production** | `studio_productions` | **StudioProductionDetailPage** → `changeStatus(id, newStatus)` → **studioProductionService.changeProductionStatus(id, newStatus)**. Status: `draft \| in_progress \| completed \| cancelled`. |
| **Job cards** | `job_cards` | `studioService.updateJobCard(id, updates)` – status `pending \| in_progress \| completed`. Worker assignment bhi yahin. |

Koi approval / manager-confirm step nahi; user jahan bhi status change karta hai, wahi final ho jata hai.

---

#### 4. Manager kya decide karta hai

- **Current system:** Koi dedicated “Manager role” ya “Manager approval” step nahi.  
- Department-wise view **StudioDashboardNew** mein hai (Ready for Production, Dyeing, Handwork, Stitching, Completed) lekin ye sirf filter/display hai; koi “manager assigns to dyer/stitching” ya “manager approves stage” flow nahi.  
- **Studio Production** jobs directly user add/update/status change karta hai; koi separate manager screen/action nahi.

---

#### 5. Kaun kaun se fields frontend se control ho rahe hain

| Area | Fields (summary) |
|------|-------------------|
| **Sale Form (Studio)** | Customer, date, items, totals, payment, notes, **isStudioSale** flag, invoice_no (STD-). |
| **Studio Production Add** | production_date, product_id, quantity, unit, estimated_cost, actual_cost, assigned_worker_id, notes, instructions, start_date, expected_date. **Sale link** sirf UI text; DB mein nahi. |
| **Studio Production Detail** | Same fields editable; status change (draft → in_progress → completed / cancelled). |
| **Studio Order (if used)** | order_no, customer_id, total_cost, advance_paid, balance_due, delivery_date, status; items in studio_order_items. |
| **Job cards** | task_type, assigned_worker_id, status, payment_amount, is_paid, start_date, end_date. |

---

#### 6. Kaun se actions directly final ho rahe hain (jo nahi hone chahiye)

| Action | Current | Issue |
|--------|--------|--------|
| **Production status → Completed** | `changeProductionStatus(id, 'completed')` call hote hi **stock_movements** mein PRODUCTION_IN insert + product `current_stock` update ho jata hai. | Inventory turant update; koi “sale finalize” ya “customer bill confirm” check nahi. |
| **Sale create (Studio)** | Save hote hi sale final; payment record + accounting (recordSalePayment / journal) chala sakta hai. | Agar sale abhi “draft” / “production pending” honi chahiye to bhi final treat ho sakti hai. |
| **Worker cost** | `job_cards.payment_amount`, `is_paid` – UI/DB update. | Inka **customer bill** mein add hona aur **worker ledger** alag maintain hona intended hai; abhi customer billing / worker ledger integration nahi. |
| **Production job create** | Koi “link to sale” DB mein save nahi; completion par sirf inventory update. | Sale finalize / customer consolidate bill / worker payment track – in sab se production link nahi. |

---

### B. Backend Analysis

#### 1. APIs ka flow (kab kya call hota hai)

| API / Service | Kab call | Kya karta hai |
|----------------|----------|----------------|
| **saleService.createSale** | Sale Form → Save (new sale) | sales + sales_items insert; SalesContext phir payments + accounting.recordSalePayment. |
| **saleService.getStudioSales** | Studio list / dashboard | sales where invoice_no ILIKE 'STD-%'. |
| **studioService.getAllStudioOrders** | Studio list / dashboard | studio_orders + customer, items. |
| **studioService.getStudioOrder(id)** | Studio sale/order detail | Single studio_order + job_cards, workers. |
| **studioService.createStudioOrder** | (Agar studio order create UI ho) | studio_orders + studio_order_items insert. |
| **studioService.getJobCards, createJobCard, updateJobCard** | Order detail / job card UI | job_cards CRUD. |
| **studioProductionService.getProductions** | Production list | studio_productions list. |
| **studioProductionService.createProductionJob** | Production Add → Submit | studio_productions insert; studio_production_logs audit. |
| **studioProductionService.changeProductionStatus(id, 'completed')** | Production Detail → Complete | status update + **stock_movements** PRODUCTION_IN + product.current_stock increment. |
| **saleService.recordPayment** | Sale create/update (payment) | payments insert (reference_type='sale', reference_id=saleId). |
| **accounting.recordSalePayment** | SalesContext after recordPayment | Journal entry (ya DB trigger) – customer payment side. |

#### 2. Status change kis function se

- **Studio order:** `studioService.updateStudioOrder(id, { status })`.  
- **Studio production:** `studioProductionService.changeProductionStatus(id, newStatus)`.  
- **Job card:** `studioService.updateJobCard(id, { status, ... })`.

#### 3. Cost kahan calculate ho rahi hai

| Cost | Where stored | Where used |
|------|--------------|------------|
| **Customer sale total** | sales.total, sales.paid_amount, sales.due_amount | Customer invoice; payments + journal (customer ledger). |
| **Studio order** | studio_orders.total_cost, advance_paid, balance_due | Standalone order; **sales** table se link nahi. |
| **Production job** | studio_productions.estimated_cost, actual_cost | Production detail; **sale total** mein add nahi; **worker ledger** mein bhi nahi. |
| **Worker / job card** | job_cards.payment_amount, is_paid | Job card UI; **WorkerLedger** abhi **SAMPLE_WORKERS** (mock) use karta hai – real worker ledger / accounting integration nahi. |

**Summary:**  
- Customer cost = sales table + payments + accounting (sale payment).  
- Worker cost = sirf job_cards / studio_orders; customer bill mein add nahi, alag worker ledger/accounting nahi.  
- Production actual_cost = sirf production record; na sale se link, na worker payment se.

#### 4. Kis point par data “final” ho jata hai

- **Sale:** Create/update ke time hi sale final (draft/final status UI se); payment + journal bana sakte hain.  
- **Production:** Status “completed” hote hi inventory final (stock_movements + current_stock).  
- **Studio order:** Update hote hi status/cost final.  
- Koi “production complete → then sale finalize” ya “manager approve → then inventory” flow nahi.

---

### C. Database Analysis

#### Tables in use

| Table | Purpose |
|-------|---------|
| **sales** | All sales; studio sales = invoice_no STD-* (optional is_studio column). Customer billing source. |
| **sales_items** | Sale line items. |
| **payments** | reference_type='sale', reference_id=sale_id – customer payments. |
| **journal_entries / journal_entry_lines** | Accounting; sale payment etc. |
| **studio_orders** | Standalone studio orders (customer_id, total_cost, advance_paid, balance_due). **Not** linked to sales. |
| **studio_order_items** | Items per studio order. |
| **job_cards** | studio_order_id, task_type, assigned_worker_id, payment_amount, is_paid, status. Worker cost per task. |
| **workers** | Worker master (company_id, name, rate, current_balance, etc.). |
| **studio_productions** | Production jobs: product_id, quantity, estimated_cost, actual_cost, assigned_worker_id, status. **No sale_id / studio_order_id.** |
| **studio_production_logs** | Audit for production create/update/status. |
| **stock_movements** | reference_type='studio_production', reference_id=production_id on PRODUCTION_IN when production completed. |
| **products** | current_stock updated on production complete. |

#### Kahan kya save ho raha hai

| Data | Table(s) |
|------|----------|
| **Customer cost (sale)** | sales (total, paid, due), payments, journal_entries. |
| **Customer cost (studio order only)** | studio_orders.total_cost, advance_paid, balance_due – **not** in sales / payments / journal. |
| **Worker / dyer / stitching cost** | job_cards.payment_amount, is_paid; workers.current_balance (if updated). **Not** in customer invoice; **no** separate worker ledger in accounting. |
| **Production cost** | studio_productions.estimated_cost, actual_cost – **not** rolled into sale total; **not** in worker ledger. |

#### Alag ledger maintain ho raha hai ya nahi

- **Customer ledger:** Haan – sales + payments + journal (customer-wise) se.  
- **Worker ledger:** Nahi – WorkerLedger UI mock data use karta hai; job_cards / workers se real ledger ya accounting integration nahi.  
- **Studio order as “customer bill”:** studio_orders apna cost rakhta hai lekin payments/journal se link nahi; isliye studio-order-only customer ka proper ledger nahi.

---

## STEP 2 – INTENDED (ORIGINAL) WORKFLOW – REFERENCE

(Jo aapne diya hai, short repeat.)

1. **Simple sale** create (Regular ya **Studio Sale** flag/type).  
2. **Studio Sale** ho to sale se **Studio Production** open, sale ka data pass.  
3. **Studio Manager:** decide kare – dyer / stitching / handwork; multiple stages.  
4. **Cost:** Har worker ki cost **customer ke bill** mein add, lekin customer ko **ek consolidated amount** dikhe.  
5. **Worker ledger:** Har worker ka **alag** ledger; worker payments alag track.  
6. **Payment:** Customer payment ≠ Worker payment; customer ledger aur worker ledger **separate**.  
7. **Completion:** Jab production complete → sale finalize → inventory update → sab ledgers update.

---

## STEP 3 – GAP ANALYSIS

| # | Current behavior | Expected behavior | Impact |
|---|-------------------|-------------------|--------|
| 1 | Sale se Studio open hone par sale ka data **pass** nahi hota; sirf list mein STD- sales dikhti hain. | Sale se Studio open ho, sale data (id, items, customer) pass ho. | Sale ↔ production link nahi; manager ko context nahi. |
| 2 | **studio_productions** mein **sale_id** (ya studio_order_id) column nahi. | Production job hamesha ek sale (ya studio order) se linked ho. | Production complete hone par sale update / finalize nahi ho sakta; reporting galat. |
| 3 | Production **completed** hote hi **inventory** turant update (stock_movements + current_stock). | Inventory tab update ho jab **sale finalize** ho / workflow complete ho. | Jaldi finalize; sale/manager approval se pehle stock badh jata hai. |
| 4 | **Worker cost** (job_cards / production) customer bill mein **add nahi** hoti. | Har worker cost customer bill mein add; customer ko single consolidated amount dikhe. | Customer under-billed; cost tracking galat. |
| 5 | **Worker ledger** nahi – WorkerLedger mock data. | Har worker ka alag ledger; worker payments alag track. | Worker payment / balance track nahi; accounting mismatch. |
| 6 | **Customer payment** (sale) aur **worker payment** same pool / same flow treat ho sakte hain (conceptually). | Customer payment ≠ Worker payment; dono alag track. | Risk: customer payment ko worker payment samajhna ya mix. |
| 7 | **Studio order** (studio_orders) aur **Sale** (sales) parallel – dono alag; merge sirf UI mein. | Ek source of truth: Studio Sale = sale; production usi se link. | Duplication; studio_order customer cost ledger/journal se link nahi. |
| 8 | Production job create / status change **direct final** – koi manager approval step nahi. | Manager decide kare stages (dyer / stitching / handwork); approval ya at least “decided by manager” flow. | Control kam; workflow align nahi. |
| 9 | **Completion** par sirf inventory update; sale status / finalize / ledger update nahi. | Completion par sale finalize + inventory + customer + worker ledgers update. | Sale “open” reh sakti hai; ledgers incomplete. |
| 10 | Production **actual_cost** / job_cards **payment_amount** kahi bhi customer total mein **roll-up** nahi. | Worker costs roll up into sale total; customer ko consolidated bill. | Customer billing incomplete; margin/profit wrong. |

---

## STEP 4 – CONVERSION / FIX PROPOSAL

### Option A – Workflow ko aapke process ke mutabiq convert (existing structure reuse, minimal change)

**Ideas:**

1. **Sale – Studio link**  
   - **sales** already source of truth for studio (STD-*).  
   - **studio_productions** mein optional **sale_id** (FK to sales) add karein.  
   - “Shift to Production” se job create karte waqt `selectedStudioSaleId` ko DB mein `sale_id` save karein.  
   - Production list/detail par sale link dikhayein; completion par isi sale ko update kar sakein.

2. **Manager / stages**  
   - Existing **studio_productions** (single worker) ya **job_cards** (multiple tasks per order) ko “stages” ki tarah use karein.  
   - Manager UI: sale open → “Send to Dyer / Stitching / Handwork” – backend mein job_card ya production record with stage type.  
   - Status change ab bhi UI se, lekin “completed” tab maane jab sab stages done (ya policy clear ho).

3. **Cost – customer bill**  
   - **Sale total** = sale items + (optionally) “studio charges” line ya backend sum of linked production/job_cards costs.  
   - Ya to sale create waqt sirf item total; production/job_cards complete hone par **sale update** (extra line / total) so that customer ko consolidated amount dikhe.  
   - Calculation: sale.subtotal + sum(worker costs for this sale) = total; payments against sale = customer payment.

4. **Worker ledger**  
   - **workers** + **job_cards** (payment_amount, is_paid) ko source maan ke:  
     - Either **accounting** mein worker-wise liability/expense accounts + journal entries (worker payment),  
     - Ya kam se kam **WorkerLedger** UI ko real data se (job_cards + workers) drive karein, taake worker balance/payment track ho.  
   - Customer ledger = existing (sales + payments + journal).  
   - Worker ledger = alag (worker-wise ledger from job_cards + payments to workers).

5. **Completion – order of operations**  
   - Production “completed” par pehle:  
     - Worker costs sale se link karke sale total update (if not already).  
     - Phir inventory (stock_movements + current_stock) – same as abhi.  
     - Sale status “final” / “completed” (policy ke hisaab se).  
     - Customer ledger already sale/payment se; worker payment entries (agar add karein) alag.

6. **Blind update na ho**  
   - Production completion par:  
     - Sale link check karein (sale_id).  
     - Sale total update optional/configurable (e.g. “add worker cost to sale”).  
     - Inventory update existing jaisa lekin sale “finalized” ya “production_complete” flag se control kar sakte hain.  
   - Worker payment kabhi bhi customer payment table (payments with reference_type='sale') mein na daalein; alag reference_type (e.g. 'worker' / 'job_card') ya alag table.

**Summary Option A:**  
- Existing **sales**, **studio_productions**, **job_cards**, **workers** reuse.  
- **sale_id** in studio_productions; completion par sale update + inventory; worker cost roll-up option; worker ledger real data (aur agar chaho to accounting) se.  
- Minimal new tables; logic align karke “sale → studio → production → complete → sale finalize + ledgers” flow banaya ja sakta hai.

---

### Option B – Agar better approach ho

**Alternative:**  
- **Single “studio job” entity** jo sale_id, stages (dyer / stitching / handwork), per-stage worker + cost rakhe, aur completion par:  
  - Sale total update (fabric + all stage costs),  
  - Inventory (per product/stage policy),  
  - Customer ledger (sale payment),  
  - Worker ledgers (per-worker payment entries),  
  ek transaction jaisa treat kiya jaye (logically).

**Pros:**  
- Clear one-to-one: one sale → one studio job → multiple stages; cost aur payment flow clear.  

**Cons:**  
- Existing **studio_orders** + **studio_productions** + **job_cards** ko migrate/merge ya deprecate karna padega; schema + UI dono change.  
- Option A se zyada effort.

**Recommendation:**  
- **Option A** se start karein: sale_id in studio_productions, completion par sale + inventory + (optional) cost roll-up, worker ledger real data.  
- Agar baad mein ek “studio job” model chahiye to Option B ko phase 2 mein consider kar sakte hain.

---

## Summary – “Abhi Studio Production system is tarah kaam kar raha hai”

1. **Do parallel entry points:** (a) **Sales** (Sale Form, is_studio / STD-*) and (b) **studio_orders** (standalone). Dono UI mein merge dikhte hain; DB mein link nahi.  
2. **Production jobs** (**studio_productions**) sale se **link nahi** (no sale_id); “Shift to Production” sirf prefill, link save nahi.  
3. **Status** sab UI se direct final – koi manager approval nahi.  
4. **Customer cost** = sales + payments + journal (sale payment). **Worker cost** = job_cards only; customer bill mein add nahi; **worker ledger** mock.  
5. **Completion** par sirf **inventory** update hota hai; sale finalize / customer total update / worker ledger update nahi.  
6. **Customer payment** aur **worker payment** alag track nahi; worker side pe proper ledger/accounting nahi.

Is analysis ke baad implementation start karne se pehle **manager decision** lena hai: Option A (minimal, sale_id + cost + worker ledger alignment) ya Option B (single studio job model), phir usi ke mutabiq implementation plan bana kar coding start karein.
