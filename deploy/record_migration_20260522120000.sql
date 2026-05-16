INSERT INTO schema_migrations (name)
VALUES ('20260522120000_create_sale_document_header_enum_casts.sql')
ON CONFLICT (name) DO NOTHING;
