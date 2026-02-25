-- Allow authenticated users to upsert mobile_barcode_scanner for their company (Printer & Barcode settings).

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
