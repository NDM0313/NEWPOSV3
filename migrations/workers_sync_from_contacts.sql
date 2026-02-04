-- ============================================================================
-- WORKERS = CONTACT WORKERS (EK HI ENTITY)
-- ============================================================================
-- Contact (type=worker) aur Studio worker alag nahi – same person, same ID.
-- This migration: (1) creates workers table if missing, (2) syncs from contacts
-- so every worker contact has a row in workers with the SAME id (FK satisfied).
-- Run once in Supabase SQL Editor. Re-run is safe (upsert by id).
-- ============================================================================

-- 1. Create workers table if not exists (required by studio_production_stages.assigned_worker_id)
-- If table already exists from another migration, this is a no-op; step 2 sync still runs.
CREATE TABLE IF NOT EXISTS workers (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  cnic VARCHAR(50),
  address TEXT,
  worker_type VARCHAR(50),
  payment_type VARCHAR(50),
  rate DECIMAL(15,2) DEFAULT 0,
  current_balance DECIMAL(15,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workers_company ON workers(company_id);
CREATE INDEX IF NOT EXISTS idx_workers_active ON workers(company_id, is_active) WHERE is_active = true;

COMMENT ON TABLE workers IS 'Studio workers. Same entity as contacts (type=worker); id = contact id so one person = one id.';

-- 2. Sync: insert/update workers from contacts where type = worker (contact id = worker id)
-- So contact worker aur studio worker ek hi – alag alag nahi.
INSERT INTO workers (
  id,
  company_id,
  name,
  phone,
  worker_type,
  is_active,
  created_at,
  updated_at
)
SELECT
  c.id,
  c.company_id,
  COALESCE(c.name, 'Worker')::VARCHAR(255),
  COALESCE(c.phone, c.mobile)::VARCHAR(50),
  COALESCE(c.worker_role, 'General')::VARCHAR(50),
  COALESCE(c.is_active, true),
  COALESCE(c.created_at, NOW()),
  COALESCE(c.updated_at, NOW())
FROM contacts c
WHERE (c.type::text = 'worker' OR c.type = 'worker')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  worker_type = EXCLUDED.worker_type,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- 3. Trigger: worker contact insert/update → upsert workers (same id)
CREATE OR REPLACE FUNCTION sync_worker_contact_to_workers()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.type::text = 'worker' OR NEW.type = 'worker') THEN
    INSERT INTO workers (id, company_id, name, phone, worker_type, is_active, created_at, updated_at)
    VALUES (
      NEW.id,
      NEW.company_id,
      COALESCE(NEW.name, 'Worker'),
      COALESCE(NEW.phone, NEW.mobile),
      COALESCE(NEW.worker_role, 'General'),
      COALESCE(NEW.is_active, true),
      COALESCE(NEW.created_at, NOW()),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      phone = EXCLUDED.phone,
      worker_type = EXCLUDED.worker_type,
      is_active = EXCLUDED.is_active,
      updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_worker_contact_to_workers ON contacts;
CREATE TRIGGER trigger_sync_worker_contact_to_workers
  AFTER INSERT OR UPDATE OF name, phone, mobile, worker_role, is_active, type ON contacts
  FOR EACH ROW
  WHEN ((NEW.type::text = 'worker' OR NEW.type = 'worker'))
  EXECUTE PROCEDURE sync_worker_contact_to_workers();

-- 4. Trigger: worker contact delete → delete from workers (same id)
CREATE OR REPLACE FUNCTION delete_worker_on_contact_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.type::text = 'worker' OR OLD.type = 'worker') THEN
    DELETE FROM workers WHERE id = OLD.id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_delete_worker_on_contact_delete ON contacts;
CREATE TRIGGER trigger_delete_worker_on_contact_delete
  AFTER DELETE ON contacts
  FOR EACH ROW
  EXECUTE PROCEDURE delete_worker_on_contact_delete();
