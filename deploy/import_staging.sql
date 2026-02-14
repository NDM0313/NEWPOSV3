-- Staging import – run against Supabase/staging DB
-- Do NOT run against production. Create staging schema first.

CREATE SCHEMA IF NOT EXISTS staging;

-- Staging: contacts (customers + suppliers merged)
CREATE TABLE IF NOT EXISTS staging.contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  old_id BIGINT,
  company_id UUID NOT NULL,
  type VARCHAR(20) NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  mobile VARCHAR(50),
  address TEXT,
  opening_balance DECIMAL(15,2) DEFAULT 0,
  current_balance DECIMAL(15,2) DEFAULT 0,
  notes TEXT,
  validated BOOLEAN DEFAULT false
);

-- Staging: products
CREATE TABLE IF NOT EXISTS staging.products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  old_id BIGINT,
  company_id UUID NOT NULL,
  category_id UUID,
  name VARCHAR(255) NOT NULL,
  sku VARCHAR(100),
  barcode VARCHAR(100),
  cost_price DECIMAL(15,2) DEFAULT 0,
  retail_price DECIMAL(15,2) DEFAULT 0,
  current_stock DECIMAL(15,2) DEFAULT 0,
  validated BOOLEAN DEFAULT false
);

-- ID mapping for FK resolution
CREATE TABLE IF NOT EXISTS staging.id_mapping (
  old_table VARCHAR(50) NOT NULL,
  old_id BIGINT NOT NULL,
  new_uuid UUID NOT NULL,
  PRIMARY KEY (old_table, old_id)
);

-- COPY placeholders (run after CSV export)
-- \copy staging.contacts FROM 'contacts.csv' CSV HEADER
-- \copy staging.products FROM 'products.csv' CSV HEADER

-- Example: promote validated contacts to public
-- INSERT INTO public.contacts (id, company_id, type, name, email, phone, opening_balance, current_balance, created_at, updated_at)
-- SELECT id, company_id, type::contact_type, name, email, phone, opening_balance, current_balance, NOW(), NOW()
-- FROM staging.contacts WHERE validated = true;
