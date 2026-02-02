-- Add is_studio to sales so Studio-type sales from Sale Form show on Studio Sales page
-- Run this in Supabase SQL Editor.

ALTER TABLE sales
ADD COLUMN IF NOT EXISTS is_studio boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN sales.is_studio IS 'True when sale was created as Studio type in Sale Form; shown on Studio Sales list';
