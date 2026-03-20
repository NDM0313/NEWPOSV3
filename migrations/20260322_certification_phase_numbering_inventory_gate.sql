-- ============================================================================
-- Certification phase: numbering prefixes (SDR/SQT/SOR, PDR/POR) + default inventory_settings
-- ============================================================================
-- Run in Supabase SQL editor (owner) so get_next_document_number_global is replaced.
-- ============================================================================

-- 1) Global numbering: explicit prefixes for new sale/purchase series (ELSE already matched unknown types)
DO $$
BEGIN
  EXECUTE $exec$
    CREATE OR REPLACE FUNCTION public.get_next_document_number_global(
      p_company_id UUID,
      p_type TEXT
    )
    RETURNS TEXT
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $body$
    DECLARE
      v_next BIGINT;
      v_prefix TEXT;
    BEGIN
      v_prefix := CASE UPPER(TRIM(p_type))
        WHEN 'SL' THEN 'SL-'
        WHEN 'PS' THEN 'PS-'
        WHEN 'DRAFT' THEN 'DRAFT-'
        WHEN 'QT' THEN 'QT-'
        WHEN 'SO' THEN 'SO-'
        WHEN 'SDR' THEN 'SDR-'
        WHEN 'SQT' THEN 'SQT-'
        WHEN 'SOR' THEN 'SOR-'
        WHEN 'CUS' THEN 'CUS-'
        WHEN 'PUR' THEN 'PUR-'
        WHEN 'PDR' THEN 'PDR-'
        WHEN 'POR' THEN 'POR-'
        WHEN 'PAY' THEN 'PAY-'
        WHEN 'RNT' THEN 'RNT-'
        WHEN 'STD' THEN 'STD-'
        ELSE UPPER(TRIM(p_type)) || '-'
      END;

      UPDATE public.document_sequences_global
      SET current_number = current_number + 1,
          updated_at = NOW()
      WHERE company_id = p_company_id
        AND document_type = UPPER(TRIM(p_type))
      RETURNING current_number INTO v_next;

      IF v_next IS NULL THEN
        INSERT INTO public.document_sequences_global (company_id, document_type, current_number)
        VALUES (p_company_id, UPPER(TRIM(p_type)), 1)
        RETURNING current_number INTO v_next;
      END IF;

      RETURN v_prefix || LPAD(v_next::TEXT, 4, '0');
    END;
    $body$;
  $exec$;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping get_next_document_number_global replace (not owner).';
END $$;

COMMENT ON FUNCTION public.get_next_document_number_global(UUID, TEXT) IS
  'Global doc numbers: SL, SDR/SQT/SOR, PDR/POR/PUR, PS, STD, etc.';

-- 2) Default inventory policy: explicit negativeStockAllowed=false when missing (app no longer assumes allow-negative when row missing)
INSERT INTO public.settings (company_id, key, value, category, description)
SELECT c.id,
       'inventory_settings',
       '{"negativeStockAllowed": false}'::jsonb,
       'inventory',
       'Default inventory policy (certification: deterministic negative-stock default)'
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.settings s
  WHERE s.company_id = c.id AND s.key = 'inventory_settings'
);
