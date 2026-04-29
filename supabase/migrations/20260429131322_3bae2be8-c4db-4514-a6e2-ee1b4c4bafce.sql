-- =========================
-- ENUMS
-- =========================
DO $$ BEGIN
  CREATE TYPE public.technical_entity_type AS ENUM (
    'compressor','fan','expansion_valve','solenoid_valve','hot_gas_valve',
    'condenser_coil','evaporator_coil','refrigerant','fluid',
    'controller','sensor','accessory','unknown'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.technical_record_status AS ENUM (
    'raw_imported','mapped','needs_review','validated','approved','rejected','unmapped'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.technical_batch_status AS ENUM (
    'pending','processing','mapped','partially_validated','completed','failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================
-- BATCHES
-- =========================
CREATE TABLE IF NOT EXISTS public.technical_import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name TEXT NOT NULL,
  source_type TEXT,
  manufacturer TEXT,
  file_name TEXT,
  status public.technical_batch_status NOT NULL DEFAULT 'pending',
  total_files INTEGER NOT NULL DEFAULT 0,
  total_rows INTEGER NOT NULL DEFAULT 0,
  mapped_rows INTEGER NOT NULL DEFAULT 0,
  validated_rows INTEGER NOT NULL DEFAULT 0,
  approved_rows INTEGER NOT NULL DEFAULT 0,
  errors_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tib_source ON public.technical_import_batches (source_name);
CREATE INDEX IF NOT EXISTS idx_tib_status ON public.technical_import_batches (status);

ALTER TABLE public.technical_import_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "TIB: auth select" ON public.technical_import_batches
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "TIB: auth insert" ON public.technical_import_batches
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "TIB: auth update" ON public.technical_import_batches
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "TIB: admin delete" ON public.technical_import_batches
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER tib_touch_updated_at
  BEFORE UPDATE ON public.technical_import_batches
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================
-- RAW RECORDS
-- =========================
CREATE TABLE IF NOT EXISTS public.technical_raw_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.technical_import_batches(id) ON DELETE CASCADE,
  source_file TEXT,
  source_table TEXT,
  row_index INTEGER,
  detected_entity_type public.technical_entity_type NOT NULL DEFAULT 'unknown',
  detected_manufacturer TEXT,
  raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status public.technical_record_status NOT NULL DEFAULT 'raw_imported',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trr_batch ON public.technical_raw_records (batch_id);
CREATE INDEX IF NOT EXISTS idx_trr_entity ON public.technical_raw_records (detected_entity_type);
CREATE INDEX IF NOT EXISTS idx_trr_status ON public.technical_raw_records (status);

ALTER TABLE public.technical_raw_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "TRR: auth select" ON public.technical_raw_records
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "TRR: auth insert" ON public.technical_raw_records
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "TRR: auth update" ON public.technical_raw_records
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "TRR: admin delete" ON public.technical_raw_records
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- =========================
-- MAPPED RECORDS
-- =========================
CREATE TABLE IF NOT EXISTS public.technical_mapped_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.technical_import_batches(id) ON DELETE CASCADE,
  raw_record_id UUID REFERENCES public.technical_raw_records(id) ON DELETE SET NULL,
  entity_type public.technical_entity_type NOT NULL,
  manufacturer TEXT,
  model TEXT,
  code TEXT,
  normalized_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence_score NUMERIC NOT NULL DEFAULT 0.5,
  mapping_status public.technical_record_status NOT NULL DEFAULT 'mapped',
  validation_errors_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  mapper_name TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  approved_component_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tmr_batch ON public.technical_mapped_records (batch_id);
CREATE INDEX IF NOT EXISTS idx_tmr_entity ON public.technical_mapped_records (entity_type);
CREATE INDEX IF NOT EXISTS idx_tmr_status ON public.technical_mapped_records (mapping_status);
CREATE INDEX IF NOT EXISTS idx_tmr_mfr_model ON public.technical_mapped_records (manufacturer, model);

ALTER TABLE public.technical_mapped_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "TMR: auth select" ON public.technical_mapped_records
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "TMR: auth insert" ON public.technical_mapped_records
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "TMR: auth update" ON public.technical_mapped_records
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "TMR: admin delete" ON public.technical_mapped_records
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER tmr_touch_updated_at
  BEFORE UPDATE ON public.technical_mapped_records
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================
-- COMPONENTS (Universal Library)
-- =========================
CREATE TABLE IF NOT EXISTS public.technical_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type public.technical_entity_type NOT NULL,
  manufacturer TEXT,
  model TEXT,
  code TEXT,
  family TEXT,
  application TEXT,
  compatible_refrigerants_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  status public.technical_record_status NOT NULL DEFAULT 'approved',
  source_batch_id UUID REFERENCES public.technical_import_batches(id) ON DELETE SET NULL,
  source_raw_id UUID REFERENCES public.technical_raw_records(id) ON DELETE SET NULL,
  source_mapped_id UUID REFERENCES public.technical_mapped_records(id) ON DELETE SET NULL,
  normalized_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tc_entity ON public.technical_components (entity_type);
CREATE INDEX IF NOT EXISTS idx_tc_status ON public.technical_components (status);
CREATE INDEX IF NOT EXISTS idx_tc_mfr_model ON public.technical_components (manufacturer, model);

ALTER TABLE public.technical_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "TC: auth select" ON public.technical_components
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "TC: auth insert" ON public.technical_components
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "TC: auth update" ON public.technical_components
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "TC: admin delete" ON public.technical_components
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER tc_touch_updated_at
  BEFORE UPDATE ON public.technical_components
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================
-- GRANDFATHER: approval_status nas tabelas finais
-- =========================
ALTER TABLE public.compressor_models
  ADD COLUMN IF NOT EXISTS approval_status public.technical_record_status NOT NULL DEFAULT 'approved';
ALTER TABLE public.fan_models
  ADD COLUMN IF NOT EXISTS approval_status public.technical_record_status NOT NULL DEFAULT 'approved';
ALTER TABLE public.unilab_geometries
  ADD COLUMN IF NOT EXISTS approval_status public.technical_record_status NOT NULL DEFAULT 'approved';
ALTER TABLE public.unilab_geometries_factors
  ADD COLUMN IF NOT EXISTS approval_status public.technical_record_status NOT NULL DEFAULT 'approved';
ALTER TABLE public.coil_fluids
  ADD COLUMN IF NOT EXISTS approval_status public.technical_record_status NOT NULL DEFAULT 'approved';
ALTER TABLE public.refrigerants
  ADD COLUMN IF NOT EXISTS approval_status public.technical_record_status NOT NULL DEFAULT 'approved';
ALTER TABLE public.evaporator_coil_models
  ADD COLUMN IF NOT EXISTS approval_status public.technical_record_status NOT NULL DEFAULT 'approved';
ALTER TABLE public.condenser_coil_models
  ADD COLUMN IF NOT EXISTS approval_status public.technical_record_status NOT NULL DEFAULT 'approved';

CREATE INDEX IF NOT EXISTS idx_cmod_approval ON public.compressor_models (approval_status);
CREATE INDEX IF NOT EXISTS idx_fm_approval ON public.fan_models (approval_status);
CREATE INDEX IF NOT EXISTS idx_ug_approval ON public.unilab_geometries (approval_status);
CREATE INDEX IF NOT EXISTS idx_ugf_approval ON public.unilab_geometries_factors (approval_status);
CREATE INDEX IF NOT EXISTS idx_cfl_approval ON public.coil_fluids (approval_status);
CREATE INDEX IF NOT EXISTS idx_ref_approval ON public.refrigerants (approval_status);
CREATE INDEX IF NOT EXISTS idx_ecm_approval ON public.evaporator_coil_models (approval_status);
CREATE INDEX IF NOT EXISTS idx_ccm_approval ON public.condenser_coil_models (approval_status);