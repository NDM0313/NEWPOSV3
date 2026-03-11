-- ============================================================================
-- RUN THIS FIRST, IN ITS OWN QUERY (Supabase: paste and run, wait for Success).
-- Then run courier_single_identity_backfill.sql in a NEW query.
-- ============================================================================
-- PostgreSQL does not allow using a new enum value in the same transaction.
-- This file is a single statement so it commits; then the backfill can use 'courier'.
-- ============================================================================

ALTER TYPE contact_type ADD VALUE IF NOT EXISTS 'courier';
