\set ON_ERROR_STOP on
BEGIN;

-- Scoped cleanup: khan5955+1@gmail.com test signup only
-- auth_user_id / company_id from investigation 2026-06-30

DELETE FROM public.user_branches WHERE user_id = 'a5ed7b79-0e25-4a1b-8c48-69113fec6ade';

UPDATE public.contacts SET is_default = false WHERE company_id = '845154ff-7c30-41b5-b69a-f1cd15c163a4';
DELETE FROM public.contacts WHERE company_id = '845154ff-7c30-41b5-b69a-f1cd15c163a4';

DELETE FROM public.products WHERE company_id = '845154ff-7c30-41b5-b69a-f1cd15c163a4';
DELETE FROM public.product_categories WHERE company_id = '845154ff-7c30-41b5-b69a-f1cd15c163a4';
DELETE FROM public.units WHERE company_id = '845154ff-7c30-41b5-b69a-f1cd15c163a4';
DELETE FROM public.document_sequences WHERE company_id = '845154ff-7c30-41b5-b69a-f1cd15c163a4';
DELETE FROM public.document_sequences_global WHERE company_id = '845154ff-7c30-41b5-b69a-f1cd15c163a4';
DELETE FROM public.erp_document_sequences WHERE company_id = '845154ff-7c30-41b5-b69a-f1cd15c163a4';
DELETE FROM public.modules_config WHERE company_id = '845154ff-7c30-41b5-b69a-f1cd15c163a4';
DELETE FROM public.settings WHERE company_id = '845154ff-7c30-41b5-b69a-f1cd15c163a4';
DELETE FROM public.business_settings WHERE company_id = '845154ff-7c30-41b5-b69a-f1cd15c163a4';
DELETE FROM public.roles WHERE company_id = '845154ff-7c30-41b5-b69a-f1cd15c163a4';
DELETE FROM public.accounts WHERE company_id = '845154ff-7c30-41b5-b69a-f1cd15c163a4';
DELETE FROM public.branches WHERE company_id = '845154ff-7c30-41b5-b69a-f1cd15c163a4';
DELETE FROM public.users WHERE id = 'a5ed7b79-0e25-4a1b-8c48-69113fec6ade' OR auth_user_id = 'a5ed7b79-0e25-4a1b-8c48-69113fec6ade';
DELETE FROM public.companies WHERE id = '845154ff-7c30-41b5-b69a-f1cd15c163a4';
DELETE FROM auth.identities WHERE user_id = 'a5ed7b79-0e25-4a1b-8c48-69113fec6ade';
DELETE FROM auth.users WHERE id = 'a5ed7b79-0e25-4a1b-8c48-69113fec6ade';

COMMIT;
