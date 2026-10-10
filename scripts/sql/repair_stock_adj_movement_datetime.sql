-- Repair last stock adjustment movements + linked JEs to user-selected datetime.
-- Target: 6 Jul 2026, 6:26 PM Pakistan (UTC+5).

DO $$
DECLARE
  v_ts timestamptz := '2026-07-06T18:26:00+05:00';
  v_entry_date date := '2026-07-06';
  r RECORD;
BEGIN
  FOR r IN
    SELECT sm.id AS movement_id, je.id AS je_id
    FROM stock_movements sm
    LEFT JOIN journal_entries je
      ON je.reference_type = 'stock_adjustment'
     AND je.reference_id = sm.id
     AND COALESCE(je.is_void, false) = false
    WHERE sm.movement_type = 'adjustment'
      AND COALESCE(sm.reference_type, '') NOT IN ('opening_balance')
      AND (
        je.entry_no IN ('JE-0232', 'JE-0233')
        OR sm.id IN (
          SELECT sm2.id
          FROM stock_movements sm2
          WHERE sm2.movement_type = 'adjustment'
            AND COALESCE(sm2.reference_type, '') NOT IN ('opening_balance')
          ORDER BY sm2.created_at DESC
          LIMIT 2
        )
      )
  LOOP
    UPDATE stock_movements
    SET created_at = v_ts
    WHERE id = r.movement_id;

    IF r.je_id IS NOT NULL THEN
      UPDATE journal_entries
      SET entry_date = v_entry_date
      WHERE id = r.je_id;
    END IF;

    RAISE NOTICE 'Repaired movement % JE %', r.movement_id, r.je_id;
  END LOOP;
END $$;

SELECT sm.id,
       sm.created_at,
       sm.quantity,
       je.entry_no,
       je.entry_date
FROM stock_movements sm
LEFT JOIN journal_entries je
  ON je.reference_type = 'stock_adjustment'
 AND je.reference_id = sm.id
 AND COALESCE(je.is_void, false) = false
WHERE sm.movement_type = 'adjustment'
  AND COALESCE(sm.reference_type, '') NOT IN ('opening_balance')
ORDER BY sm.created_at DESC
LIMIT 5;
