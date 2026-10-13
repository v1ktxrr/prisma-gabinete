-- Migration SQL for multi-city tasks support
begin;

-- Add municipio_ids column to tasks table
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS municipio_ids uuid[] DEFAULT '{}';

-- Backfill existing municipio_id values into municipio_ids array
UPDATE public.tasks 
SET municipio_ids = ARRAY[municipio_id] 
WHERE municipio_id IS NOT NULL AND (municipio_ids IS NULL OR municipio_ids = '{}');

commit;
