-- Assign branch_id on opening/adjustment stock_movements by product category/combo rules.
-- Shirts → Stitch and Style branch; combo/bundle products → default/Main branch.
-- Does not rewrite sale/purchase/production movements.
-- Safe to re-run: only updates rows that still need reassignment.

DO $$
DECLARE
  r RECORD;
  v_main_id uuid;
  v_stitch_id uuid;
  v_shirts_mov int;
  v_bundle_mov int;
  v_shirts_pb int;
  v_bundle_pb int;
BEGIN
  FOR r IN
    SELECT DISTINCT b.company_id AS cid
    FROM public.branches b
    WHERE b.company_id IS NOT NULL
  LOOP
    v_main_id := NULL;
    v_stitch_id := NULL;

    SELECT br.id INTO v_main_id
    FROM public.branches br
    WHERE br.company_id = r.cid
      AND (
        br.code ILIKE 'HQ'
        OR br.name ILIKE '%main%branch%'
        OR br.name = 'Main Branch'
      )
    ORDER BY CASE WHEN br.code ILIKE 'HQ' THEN 0 ELSE 1 END, br.name
    LIMIT 1;

    SELECT br.id INTO v_stitch_id
    FROM public.branches br
    WHERE br.company_id = r.cid
      AND br.name ILIKE '%stitch%'
    ORDER BY br.name
    LIMIT 1;

    IF v_stitch_id IS NOT NULL THEN
      UPDATE public.stock_movements sm
      SET branch_id = v_stitch_id
      FROM public.products p
      LEFT JOIN public.product_categories pc ON pc.id = p.category_id
      WHERE sm.company_id = r.cid
        AND sm.product_id = p.id
        AND p.company_id = r.cid
        AND LOWER(TRIM(COALESCE(pc.name, ''))) = 'shirts'
        AND (
          LOWER(TRIM(COALESCE(sm.reference_type::text, ''))) = 'opening_balance'
          OR LOWER(TRIM(COALESCE(sm.movement_type::text, ''))) IN ('adjustment', 'adjust')
        )
        AND (sm.branch_id IS NULL OR sm.branch_id IS DISTINCT FROM v_stitch_id);
      GET DIAGNOSTICS v_shirts_mov = ROW_COUNT;
    ELSE
      v_shirts_mov := 0;
    END IF;

    IF v_main_id IS NOT NULL THEN
      UPDATE public.stock_movements sm
      SET branch_id = v_main_id
      FROM public.products p
      LEFT JOIN public.product_categories pc ON pc.id = p.category_id
      WHERE sm.company_id = r.cid
        AND sm.product_id = p.id
        AND p.company_id = r.cid
        AND (
          COALESCE(p.is_combo_product, false) = true
          OR (
            LOWER(TRIM(COALESCE(pc.name, ''))) = 'bridal'
            AND COALESCE(p.is_combo_product, false) = true
          )
        )
        AND (
          LOWER(TRIM(COALESCE(sm.reference_type::text, ''))) = 'opening_balance'
          OR LOWER(TRIM(COALESCE(sm.movement_type::text, ''))) IN ('adjustment', 'adjust')
        )
        AND (sm.branch_id IS NULL OR sm.branch_id IS DISTINCT FROM v_main_id);
      GET DIAGNOSTICS v_bundle_mov = ROW_COUNT;
    ELSE
      v_bundle_mov := 0;
    END IF;

    IF to_regclass('public.product_branches') IS NOT NULL THEN
      IF v_stitch_id IS NOT NULL THEN
        DELETE FROM public.product_branches pb
        USING public.products p
        LEFT JOIN public.product_categories pc ON pc.id = p.category_id
        WHERE pb.company_id = r.cid
          AND pb.product_id = p.id
          AND p.company_id = r.cid
          AND LOWER(TRIM(COALESCE(pc.name, ''))) = 'shirts';

        INSERT INTO public.product_branches (company_id, product_id, branch_id)
        SELECT r.cid, p.id, v_stitch_id
        FROM public.products p
        LEFT JOIN public.product_categories pc ON pc.id = p.category_id
        WHERE p.company_id = r.cid
          AND LOWER(TRIM(COALESCE(pc.name, ''))) = 'shirts'
        ON CONFLICT (product_id, branch_id) DO NOTHING;
        GET DIAGNOSTICS v_shirts_pb = ROW_COUNT;
      END IF;

      IF v_main_id IS NOT NULL THEN
        DELETE FROM public.product_branches pb
        USING public.products p
        WHERE pb.company_id = r.cid
          AND pb.product_id = p.id
          AND p.company_id = r.cid
          AND COALESCE(p.is_combo_product, false) = true;

        INSERT INTO public.product_branches (company_id, product_id, branch_id)
        SELECT r.cid, p.id, v_main_id
        FROM public.products p
        WHERE p.company_id = r.cid
          AND COALESCE(p.is_combo_product, false) = true
        ON CONFLICT (product_id, branch_id) DO NOTHING;
        GET DIAGNOSTICS v_bundle_pb = ROW_COUNT;
      END IF;
    END IF;

    RAISE NOTICE 'company %: main=% stitch=% shirts_mov=% bundle_mov=%',
      r.cid, v_main_id, v_stitch_id, v_shirts_mov, v_bundle_mov;
  END LOOP;
END $$;
