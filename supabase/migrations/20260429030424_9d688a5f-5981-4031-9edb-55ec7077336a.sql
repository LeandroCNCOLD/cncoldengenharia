-- Add model signature & versioning fields to coil_calibrations
ALTER TABLE public.coil_calibrations
  ADD COLUMN IF NOT EXISTS engine_name TEXT NOT NULL DEFAULT 'physical_simple',
  ADD COLUMN IF NOT EXISTS engine_version TEXT NOT NULL DEFAULT 'v1',
  ADD COLUMN IF NOT EXISTS correlation_set_version TEXT NOT NULL DEFAULT 'v1',
  ADD COLUMN IF NOT EXISTS model_signature TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_coil_calibrations_active
  ON public.coil_calibrations (component_item_id, is_active, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_coil_calibrations_signature
  ON public.coil_calibrations (component_item_id, model_signature, is_active);

-- Allow UPDATE for marking calibrations as inactive (currently no UPDATE policy)
DROP POLICY IF EXISTS "CC: auth update" ON public.coil_calibrations;
CREATE POLICY "CC: auth update"
ON public.coil_calibrations
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
