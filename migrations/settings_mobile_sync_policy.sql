-- Allow any authenticated user to upsert mobile_sync_status for their company (Settings app offline/online sync).
-- Admins can still manage all settings; this adds INSERT/UPDATE for key = 'mobile_sync_status' for non-admins.

DROP POLICY IF EXISTS "Users can insert mobile_sync_status" ON public.settings;
CREATE POLICY "Users can insert mobile_sync_status"
  ON public.settings FOR INSERT
  WITH CHECK (
    company_id = (SELECT company_id FROM public.users WHERE id = auth.uid() LIMIT 1)
    AND key = 'mobile_sync_status'
  );

DROP POLICY IF EXISTS "Users can update mobile_sync_status" ON public.settings;
CREATE POLICY "Users can update mobile_sync_status"
  ON public.settings FOR UPDATE
  USING (
    company_id = (SELECT company_id FROM public.users WHERE id = auth.uid() LIMIT 1)
    AND key = 'mobile_sync_status'
  )
  WITH CHECK (
    company_id = (SELECT company_id FROM public.users WHERE id = auth.uid() LIMIT 1)
    AND key = 'mobile_sync_status'
  );
