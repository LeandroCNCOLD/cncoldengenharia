-- Adiciona colunas faltantes ao modelo do aletado evaporador
ALTER TABLE public.evaporator_coil_models
  ADD COLUMN IF NOT EXISTS face_velocity_ms numeric,
  ADD COLUMN IF NOT EXISTS air_pressure_drop_pa numeric,
  ADD COLUMN IF NOT EXISTS refrigerant_pressure_drop_kpa numeric,
  ADD COLUMN IF NOT EXISTS superheat_k numeric,
  ADD COLUMN IF NOT EXISTS subcooling_k numeric,
  ADD COLUMN IF NOT EXISTS fin_material text,
  ADD COLUMN IF NOT EXISTS tube_material text,
  ADD COLUMN IF NOT EXISTS nominal_air_mass_flow_kgh numeric,
  ADD COLUMN IF NOT EXISTS nominal_delta_t_k numeric,
  ADD COLUMN IF NOT EXISTS confidence_score numeric,
  ADD COLUMN IF NOT EXISTS missing_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS manual_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Adiciona status 'needs_review' ao enum component_status (se ainda não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'needs_review'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'component_status')
  ) THEN
    ALTER TYPE public.component_status ADD VALUE 'needs_review';
  END IF;
END $$;