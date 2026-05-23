-- Fix mobile printer/barcode/label settings RLS for salesmen (auth_user_id link).
-- Replaces users.id = auth.uid() with get_user_company_id() on INSERT/UPDATE.

-- mobile_printer
DROP POLICY IF EXISTS "Users can insert mobile_printer" ON public.settings;
CREATE POLICY "Users can insert mobile_printer"
  ON public.settings FOR INSERT
  WITH CHECK (
    company_id = get_user_company_id()
    AND key = 'mobile_printer'
  );

DROP POLICY IF EXISTS "Users can update mobile_printer" ON public.settings;
CREATE POLICY "Users can update mobile_printer"
  ON public.settings FOR UPDATE
  USING (
    company_id = get_user_company_id()
    AND key = 'mobile_printer'
  )
  WITH CHECK (
    company_id = get_user_company_id()
    AND key = 'mobile_printer'
  );

-- mobile_barcode_scanner
DROP POLICY IF EXISTS "Users can insert mobile_barcode_scanner" ON public.settings;
CREATE POLICY "Users can insert mobile_barcode_scanner"
  ON public.settings FOR INSERT
  WITH CHECK (
    company_id = get_user_company_id()
    AND key = 'mobile_barcode_scanner'
  );

DROP POLICY IF EXISTS "Users can update mobile_barcode_scanner" ON public.settings;
CREATE POLICY "Users can update mobile_barcode_scanner"
  ON public.settings FOR UPDATE
  USING (
    company_id = get_user_company_id()
    AND key = 'mobile_barcode_scanner'
  )
  WITH CHECK (
    company_id = get_user_company_id()
    AND key = 'mobile_barcode_scanner'
  );

-- mobile_barcode_label
DROP POLICY IF EXISTS "Users can insert mobile_barcode_label" ON public.settings;
CREATE POLICY "Users can insert mobile_barcode_label"
  ON public.settings FOR INSERT
  WITH CHECK (
    company_id = get_user_company_id()
    AND key = 'mobile_barcode_label'
  );

DROP POLICY IF EXISTS "Users can update mobile_barcode_label" ON public.settings;
CREATE POLICY "Users can update mobile_barcode_label"
  ON public.settings FOR UPDATE
  USING (
    company_id = get_user_company_id()
    AND key = 'mobile_barcode_label'
  )
  WITH CHECK (
    company_id = get_user_company_id()
    AND key = 'mobile_barcode_label'
  );
