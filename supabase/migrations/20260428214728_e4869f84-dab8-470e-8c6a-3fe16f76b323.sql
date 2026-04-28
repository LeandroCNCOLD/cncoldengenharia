ALTER TABLE public.technical_file_extractions
  ALTER COLUMN product_id DROP NOT NULL;

ALTER TABLE public.technical_file_extractions
  ADD COLUMN IF NOT EXISTS equipment_id uuid,
  ADD COLUMN IF NOT EXISTS raw_text text,
  ADD COLUMN IF NOT EXISTS structured_data jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_tfe_equipment_id ON public.technical_file_extractions(equipment_id);
CREATE INDEX IF NOT EXISTS idx_tfe_file_id ON public.technical_file_extractions(file_id);