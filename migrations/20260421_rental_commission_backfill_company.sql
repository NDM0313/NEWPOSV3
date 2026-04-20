-- ============================================================================
-- Backfill rental commission (DIN Couture / single-company repair)
-- ============================================================================
-- Run AFTER: 20260420_rental_commission_support.sql (columns exist).
--
-- What it does:
--   For company 375fa03b-8e1e-46d3-9cfe-1cc20c02b473, any rental that already
--   has salesman_id but commission_amount is still 0 (or percent missing),
--   recalculates commission from the same rules as the app:
--     - Eligible base: rental_charges if > 0, else (total_amount - security_deposit), else total_amount
--     - Percent: users.rental_commission_percent, else users.default_commission_percent, else 10
--     - commission_status = 'pending' when amount > 0 (matches rentalService.createBooking)
--
-- What it does NOT do:
--   Rows with salesman_id NULL (pre–FK-fix bookings) — cannot infer salesman.
--   Use the OPTIONAL block at the bottom with explicit booking_no + user id if needed.
-- ============================================================================

-- Preview (optional — run in SQL editor before UPDATE)
-- SELECT r.id, r.booking_no, r.status, r.salesman_id,
--        r.rental_charges, r.security_deposit, r.total_amount,
--        r.commission_percent, r.commission_amount, r.commission_eligible_amount,
--        u.full_name,
--        COALESCE(u.rental_commission_percent, u.default_commission_percent, 10) AS pct_used
-- FROM rentals r
-- LEFT JOIN users u ON u.id = r.salesman_id
-- WHERE r.company_id = '375fa03b-8e1e-46d3-9cfe-1cc20c02b473'::uuid
-- ORDER BY r.created_at DESC
-- LIMIT 50;

UPDATE rentals AS r
SET
  commission_percent = COALESCE(u.rental_commission_percent, u.default_commission_percent, 10)::numeric(5, 2),
  commission_eligible_amount = GREATEST(
    0::numeric,
    COALESCE(
      NULLIF(r.rental_charges, 0),
      NULLIF(r.total_amount - COALESCE(r.security_deposit, 0), 0),
      r.total_amount,
      0
    )
  )::numeric(12, 2),
  commission_amount = ROUND(
    (
      GREATEST(
        0::numeric,
        COALESCE(
          NULLIF(r.rental_charges, 0),
          NULLIF(r.total_amount - COALESCE(r.security_deposit, 0), 0),
          r.total_amount,
          0
        )
      )
      * (COALESCE(u.rental_commission_percent, u.default_commission_percent, 10)::numeric / 100.0)
    )::numeric,
    2
  )::numeric(12, 2),
  commission_status = CASE
    WHEN ROUND(
      (
        GREATEST(
          0::numeric,
          COALESCE(
            NULLIF(r.rental_charges, 0),
            NULLIF(r.total_amount - COALESCE(r.security_deposit, 0), 0),
            r.total_amount,
            0
          )
        )
        * (COALESCE(u.rental_commission_percent, u.default_commission_percent, 10)::numeric / 100.0)
      )::numeric,
      2
    ) > 0 THEN 'pending'
    ELSE NULL
  END,
  updated_at = NOW()
FROM users AS u
WHERE u.id = r.salesman_id
  AND r.company_id = '375fa03b-8e1e-46d3-9cfe-1cc20c02b473'::uuid
  AND r.salesman_id IS NOT NULL
  AND COALESCE(r.status::text, '') <> 'cancelled'
  AND (
    COALESCE(r.commission_amount, 0) = 0
    OR r.commission_percent IS NULL
  );

-- -----------------------------------------------------------------------------
-- OPTIONAL: bookings created before salesman_id was persisted (salesman_id NULL).
-- Replace booking numbers and Arslan's user UUID from your environment.
-- -----------------------------------------------------------------------------
-- UPDATE rentals
-- SET
--   salesman_id = 'a14dcab8-01e0-4ab5-b684-cf494db7a800'::uuid,
--   commission_percent = COALESCE(
--     (SELECT rental_commission_percent FROM users WHERE id = 'a14dcab8-01e0-4ab5-b684-cf494db7a800'::uuid),
--     (SELECT default_commission_percent FROM users WHERE id = 'a14dcab8-01e0-4ab5-b684-cf494db7a800'::uuid),
--     10
--   )::numeric(5, 2),
--   commission_eligible_amount = GREATEST(0, COALESCE(NULLIF(rental_charges, 0), total_amount - COALESCE(security_deposit, 0), total_amount, 0))::numeric(12, 2),
--   commission_amount = ROUND(
--     GREATEST(0, COALESCE(NULLIF(rental_charges, 0), total_amount - COALESCE(security_deposit, 0), total_amount, 0))
--     * (COALESCE(
--         (SELECT rental_commission_percent FROM users WHERE id = 'a14dcab8-01e0-4ab5-b684-cf494db7a800'::uuid),
--         (SELECT default_commission_percent FROM users WHERE id = 'a14dcab8-01e0-4ab5-b684-cf494db7a800'::uuid),
--         10
--       )::numeric / 100.0),
--     2
--   )::numeric(12, 2),
--   commission_status = 'pending',
--   updated_at = NOW()
-- WHERE company_id = '375fa03b-8e1e-46d3-9cfe-1cc20c02b473'::uuid
--   AND salesman_id IS NULL
--   AND booking_no IN ('REN-0015', 'REN-0016', 'REN-0017');
