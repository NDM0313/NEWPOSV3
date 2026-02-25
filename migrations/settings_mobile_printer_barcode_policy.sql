-- Allow authenticated users to upsert mobile_printer and mobile_barcode_scanner for their company.
-- Same pattern as settings_mobile_sync_policy.sql (Settings > Printer & Barcode).

-- mobile_printer
DROP POLICY IF EXISTS "Users can insert mobile_printer" ON public.settings;
CREATE POLICY "Users can insert mobile_printer"
  ON public.settings FOR INSERT
  WITH CHECK (
    company_id = (SELECT company_id FROM public.users WHERE id = auth.uid() LIMIT 1)
    AND key = 'mobile_printer'
  );

DROP POLICY IF EXISTS "Users can update mobile_printer" ON public.settings;
CREATE POLICY "Users can update mobile_printer"
  ON public.settings FOR UPDATE
  USING (
    company_id = (SELECT company_id FROM public.users WHERE id = auth.uid() LIMIT 1)
    AND key = 'mobile_printer'
  )
  WITH CHECK (
    company_id = (SELECT company_id FROM public.users WHERE id = auth.uid() LIMIT 1)
    AND key = 'mobile_printer'
  );

-- mobile_barcode_scanner
DROP POLICY IF EXISTS "Users can insert mobile_barcode_scanner" ON public.settings;
CREATE POLICY "Users can insert mobile_barcode_scanner"
  ON public.settings FOR INSERT
  WITH CHECK (
    company_id = (SELECT company_id FROM public.users WHERE id = auth.uid() LIMIT 1)
    AND key = 'mobile_barcode_scanner'
  );

DROP POLICY IF EXISTS "Users can update mobile_barcode_scanner" ON public.settings;
CREATE POLICY "Users can update mobile_barcode_scanner"
  ON public.settings FOR UPDATE
  USING (
    company_id = (SELECT company_id FROM public.users WHERE id = auth.uid() LIMIT 1)
    AND key = 'mobile_barcode_scanner'
  )
  WITH CHECK (
    company_id = (SELECT company_id FROM public.users WHERE id = auth.uid() LIMIT 1)
    AND key = 'mobile_barcode_scanner'
  );
