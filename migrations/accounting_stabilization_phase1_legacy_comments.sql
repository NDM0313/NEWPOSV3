-- ============================================================================
-- Accounting Stabilization Phase 1 – Legacy table comments (non-destructive)
-- Marks legacy candidates. Do not drop or truncate.
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'document_sequences') THEN
    EXECUTE 'COMMENT ON TABLE public.document_sequences IS ''LEGACY_CANDIDATE: Prefer erp_document_sequences + generate_document_number for PAY, SL, PUR. DO NOT USE FOR NEW POSTING where ERP engine is available.''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'document_sequences_global') THEN
    EXECUTE 'COMMENT ON TABLE public.document_sequences_global IS ''LEGACY_CANDIDATE: Prefer erp_document_sequences + generate_document_number for PAY, SL. DO NOT USE FOR NEW POSTING for payment refs.''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'chart_accounts') THEN
    EXECUTE 'COMMENT ON TABLE public.chart_accounts IS ''LEGACY_CANDIDATE: Live Chart of Accounts is accounts. Do not use for posting.''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'account_transactions') THEN
    EXECUTE 'COMMENT ON TABLE public.account_transactions IS ''LEGACY_CANDIDATE: Not part of live double-entry. Do not use for new posting.''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'worker_payments') THEN
    EXECUTE 'COMMENT ON TABLE public.worker_payments IS ''LEGACY_CANDIDATE: Verify usage. Worker ledger = worker_ledger_entries. Do not use for new posting.''';
  END IF;
END $$;
