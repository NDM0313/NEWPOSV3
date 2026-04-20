-- Default worker payment (Rs) on contact: persisted from Add/Edit Contact, prefills Studio assign modal.
-- Keeps public.workers.rate in sync (same entity as worker contact).

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS worker_default_rate NUMERIC(15,2) DEFAULT 0;

COMMENT ON COLUMN public.contacts.worker_default_rate IS
  'Default expected payment (Rs) for worker; prefill Studio production stage worker cost. Synced to workers.rate.';

-- Copy existing studio worker rates into contacts (one-time)
UPDATE public.contacts c
SET worker_default_rate = COALESCE(w.rate, 0)
FROM public.workers w
WHERE w.id = c.id
  AND (c.type::text = 'worker' OR c.type = 'worker')
  AND COALESCE(w.rate, 0) <> 0
  AND COALESCE(c.worker_default_rate, 0) = 0;

CREATE OR REPLACE FUNCTION public.sync_worker_contact_to_workers()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF (NEW.type::text = 'worker' OR NEW.type = 'worker') THEN
    INSERT INTO public.workers (id, company_id, name, phone, worker_type, rate, is_active, created_at, updated_at)
    VALUES (
      NEW.id,
      NEW.company_id,
      COALESCE(NEW.name, 'Worker'),
      COALESCE(NEW.phone, NEW.mobile),
      COALESCE(NEW.worker_role, 'General'),
      COALESCE(NEW.worker_default_rate, 0),
      COALESCE(NEW.is_active, true),
      COALESCE(NEW.created_at, NOW()),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      phone = EXCLUDED.phone,
      worker_type = EXCLUDED.worker_type,
      rate = COALESCE(NEW.worker_default_rate, 0),
      is_active = EXCLUDED.is_active,
      updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_worker_contact_to_workers ON public.contacts;
CREATE TRIGGER trigger_sync_worker_contact_to_workers
  AFTER INSERT OR UPDATE OF name, phone, mobile, worker_role, worker_default_rate, is_active, type
  ON public.contacts
  FOR EACH ROW
  WHEN ((NEW.type::text = 'worker' OR NEW.type = 'worker'))
  EXECUTE FUNCTION public.sync_worker_contact_to_workers();
