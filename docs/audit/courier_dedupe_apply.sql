-- Courier dedupe: one canonical row per (company_id, normalized name). Company-scoped.
-- 1) Preview: duplicate groups (run first)
-- 2) Apply: repoint courier_shipments + sale_shipments to canonical; mark duplicates inactive.
-- Company: eb71d817-b87e-4195-964b-7b5321b480f5

-- ========== PREVIEW (run in Supabase SQL Editor) ==========
/*
WITH dup AS (
  SELECT company_id, LOWER(TRIM(COALESCE(name,''))) AS norm_name,
         array_agg(id ORDER BY (contact_id IS NOT NULL) DESC, created_at ASC) AS id_list,
         COUNT(*) AS cnt
  FROM couriers
  WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  GROUP BY company_id, LOWER(TRIM(COALESCE(name,'')))
  HAVING COUNT(*) > 1
)
SELECT c.id, c.name, c.contact_id, c.account_id, c.is_active,
       (SELECT id_list[1] FROM dup d WHERE d.company_id = c.company_id AND d.norm_name = LOWER(TRIM(COALESCE(c.name,'')))) AS canonical_id,
       (SELECT cnt FROM dup d WHERE d.company_id = c.company_id AND d.norm_name = LOWER(TRIM(COALESCE(c.name,'')))) AS group_cnt
FROM couriers c
WHERE c.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND EXISTS (SELECT 1 FROM dup d WHERE d.company_id = c.company_id AND d.norm_name = LOWER(TRIM(COALESCE(c.name,'')))
    AND c.id != d.id_list[1]);
*/

-- ========== APPLY (idempotent: only repoint and mark inactive) ==========
DO $$
DECLARE
  v_company_id UUID := 'eb71d817-b87e-4195-964b-7b5321b480f5';
  r RECORD;
  v_canonical_id UUID;
  v_duplicate_ids UUID[];
BEGIN
  FOR r IN
    SELECT company_id, LOWER(TRIM(COALESCE(name,''))) AS norm_name,
           (array_agg(id ORDER BY (contact_id IS NOT NULL) DESC, created_at ASC))[1] AS canonical_id,
           array_agg(id) AS all_ids
    FROM couriers
    WHERE company_id = v_company_id
    GROUP BY company_id, LOWER(TRIM(COALESCE(name,'')))
    HAVING COUNT(*) > 1
  LOOP
    v_canonical_id := r.canonical_id;
    v_duplicate_ids := array_remove(r.all_ids, r.canonical_id);

    UPDATE courier_shipments SET courier_id = v_canonical_id WHERE courier_id = ANY(v_duplicate_ids);
    UPDATE sale_shipments   SET courier_id = v_canonical_id WHERE courier_id = ANY(v_duplicate_ids);
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sale_shipments' AND column_name = 'courier_master_id') THEN
      UPDATE sale_shipments SET courier_master_id = v_canonical_id WHERE courier_master_id = ANY(v_duplicate_ids);
    END IF;

    UPDATE couriers SET is_active = false WHERE id = ANY(v_duplicate_ids);
  END LOOP;
END $$;
