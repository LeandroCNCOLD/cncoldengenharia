ALTER TABLE public.coil_calibrations
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS confidence_score numeric NOT NULL DEFAULT 0.6,
  ADD COLUMN IF NOT EXISTS calibration_name text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'coil_calibrations_status_check'
  ) THEN
    ALTER TABLE public.coil_calibrations
      ADD CONSTRAINT coil_calibrations_status_check
      CHECK (status IN ('calibrated', 'needs_review', 'draft'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'coil_calibrations_confidence_check'
  ) THEN
    ALTER TABLE public.coil_calibrations
      ADD CONSTRAINT coil_calibrations_confidence_check
      CHECK (confidence_score >= 0 AND confidence_score <= 1);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_coil_calibrations_component_created
  ON public.coil_calibrations(component_item_id, created_at DESC);