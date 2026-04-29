-- Calibração auditável: campos explícitos para referência (datasheet) e resultados antes/depois,
-- além de fator dedicado para coeficiente de troca térmica (independente de capacidade).
ALTER TABLE public.coil_calibrations
  ADD COLUMN IF NOT EXISTS heat_transfer_factor numeric NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS reference_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS result_before_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS result_after_json jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Índice para acelerar busca da calibração ativa por componente.
CREATE INDEX IF NOT EXISTS idx_coil_calibrations_active
  ON public.coil_calibrations (component_item_id, is_active, created_at DESC);

-- Índice para checagem rápida de assinatura de modelo.
CREATE INDEX IF NOT EXISTS idx_coil_calibrations_signature
  ON public.coil_calibrations (component_item_id, model_signature);