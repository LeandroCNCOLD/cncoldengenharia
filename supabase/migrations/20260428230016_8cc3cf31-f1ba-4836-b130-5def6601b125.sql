-- Make coil_simulations standalone-capable for Coil Simulator (Verify/Design mode)
ALTER TABLE public.coil_simulations
  ALTER COLUMN component_item_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS equipment_project_id uuid,
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'verify',
  ADD COLUMN IF NOT EXISTS coil_type text,
  ADD COLUMN IF NOT EXISTS label text;

CREATE INDEX IF NOT EXISTS idx_coil_simulations_equipment_project
  ON public.coil_simulations(equipment_project_id);
