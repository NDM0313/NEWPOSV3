-- Allow custom task type 'extra' in studio_production_stages so "Customize Tasks" custom tasks persist.
-- Safe to run multiple times.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'studio_production_stage_type') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'studio_production_stage_type') AND enumlabel = 'extra') THEN
      ALTER TYPE studio_production_stage_type ADD VALUE 'extra';
    END IF;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'studio_production_stage_type extra: %', SQLERRM;
END $$;
