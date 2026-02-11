-- ============================================================================
-- STUDIO SALE → CUSTOMER LEDGER DIAGNOSTIC
-- Run in Supabase SQL Editor (as the same user you use in the app)
-- Replace placeholders with real UUIDs/invoice numbers from your DB
-- ============================================================================

-- ---------------------------------------------------------------------------
-- STEP 0 — STD-0003 + customer + company (sab ek saath; ledger ke liye ye customer open karo)
-- ---------------------------------------------------------------------------
SELECT s.id AS sale_id, s.invoice_no, s.company_id, s.customer_id, s.status, s.total, s.paid_amount,
       c.name AS customer_name, c.type AS contact_type
FROM sales s
LEFT JOIN contacts c ON c.id = s.customer_id
WHERE s.invoice_no = 'STD-0003'
LIMIT 1;

-- Is result ka company_id + customer_id use karke Step 5b run karo (uncomment karke paste).
-- App mein: Ledger isi customer (customer_name) ke liye kholo — Contacts se wahi select karo.

-- ---------------------------------------------------------------------------
-- STEP 1 — Studio sale row (sales table; column is invoice_no not sale_number)
-- ---------------------------------------------------------------------------
SELECT id, company_id, customer_id, branch_id, invoice_no, invoice_date, status, type, total, paid_amount, due_amount
FROM sales
WHERE invoice_no LIKE 'STD%' OR invoice_no LIKE 'ST-%'
ORDER BY invoice_date DESC
LIMIT 20;

-- Confirm: customer_id NOT NULL, status = 'final', company_id expected

-- ---------------------------------------------------------------------------
-- STEP 2 — Customer UUID match (replace with customer_id from Step 1)
-- ---------------------------------------------------------------------------
-- SELECT id, name, type, company_id
-- FROM contacts
-- WHERE id = 'CUSTOMER_UUID_FROM_STEP_1';

-- Confirm: Same UUID, type in ('customer','both')

-- ---------------------------------------------------------------------------
-- STEP 3 — Sale status (replace with sale id from Step 1)
-- ---------------------------------------------------------------------------
-- SELECT id, invoice_no, status, type FROM sales WHERE id = 'SALE_ID_FROM_STEP_1';

-- Confirm: status = 'final'. If draft/order → ledger mein nahi aayega (RPC returns all; UI may filter)

-- ---------------------------------------------------------------------------
-- STEP 4 — Payment linkage (replace with sale id from Step 1)
-- ---------------------------------------------------------------------------
SELECT p.id, p.reference_type, p.reference_id, p.amount, p.payment_date, p.company_id
FROM payments p
WHERE p.reference_type = 'sale'
  AND p.reference_id IN (SELECT id FROM sales WHERE invoice_no LIKE 'STD%' OR invoice_no LIKE 'ST-%')
ORDER BY p.payment_date DESC
LIMIT 20;

-- Confirm: reference_type = 'sale', reference_id = sale UUID

-- ---------------------------------------------------------------------------
-- STEP 5 — RPC manual call (replace company_id and customer_id from Step 1)
-- ---------------------------------------------------------------------------
-- SELECT * FROM get_customer_ledger_sales(
--   'COMPANY_UUID'::uuid,
--   'CUSTOMER_UUID'::uuid,
--   NULL::date,
--   NULL::date
-- );

-- If 0 rows: company_id/customer_id mismatch OR get_user_company_id() <> company_id

-- ---------------------------------------------------------------------------
-- STEP 5b — RPC jaisi result BINA auth (SQL Editor mein auth.uid() = NULL hota hai)
-- Step 1 result se ek row ka company_id, customer_id copy karke neeche chalao
-- Agar isse rows aayein = data sahi hai; ledger app mein wahi company_id/customer_id use kare
-- ---------------------------------------------------------------------------
-- SELECT id, invoice_no, invoice_date, total, paid_amount, due_amount, payment_status
-- FROM sales s
-- WHERE s.company_id = 'PASTE_COMPANY_ID_FROM_STEP1'::uuid
--   AND s.customer_id = 'PASTE_CUSTOMER_ID_FROM_STEP1'::uuid
-- ORDER BY s.invoice_date DESC;

-- ---------------------------------------------------------------------------
-- STEP 6 — get_user_company_id() (SQL Editor = no JWT → dono NULL normal hai)
-- ---------------------------------------------------------------------------
SELECT auth.uid() AS current_user_id, get_user_company_id() AS my_company_id;

-- SQL Editor mein auth.uid() / my_company_id NULL = expected (koi user login nahi).
-- App mein jab user login hota hai tab JWT se auth.uid() set hota hai.
-- Migration 40: get_user_company_id() NULL ho to RPC p_company_id use karta hai, isliye app se ledger kaam karna chahiye.
-- Agar app mein bhi ledger empty: Step 1 se STD-0003 ka customer_id lo, ledger usi customer par kholo (Contacts se wohi customer select karo).

-- ---------------------------------------------------------------------------
-- STEP 7 — Compare company: sale vs user
-- ---------------------------------------------------------------------------
-- SELECT s.id, s.invoice_no, s.company_id AS sale_company_id,
--        get_user_company_id() AS user_company_id,
--        (s.company_id = get_user_company_id()) AS company_match
-- FROM sales s
-- WHERE s.invoice_no LIKE 'STD%'
-- LIMIT 5;
