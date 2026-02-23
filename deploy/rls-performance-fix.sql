DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'account_transactions') THEN
    DROP POLICY IF EXISTS "Allow authenticated read access" ON public.account_transactions;
    CREATE POLICY "Allow authenticated read access" ON public.account_transactions
      FOR SELECT USING ((SELECT auth.role()) = 'authenticated');
    DROP POLICY IF EXISTS "Allow authenticated insert access" ON public.account_transactions;
    CREATE POLICY "Allow authenticated insert access" ON public.account_transactions
      FOR INSERT WITH CHECK ((SELECT auth.role()) = 'authenticated');
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
