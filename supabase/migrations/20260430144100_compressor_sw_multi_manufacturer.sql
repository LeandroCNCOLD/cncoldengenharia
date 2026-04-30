ALTER TABLE public.compressor_models
  ADD COLUMN IF NOT EXISTS series text,
  ADD COLUMN IF NOT EXISTS motor_type text,
  ADD COLUMN IF NOT EXISTS application_range text,
  ADD COLUMN IF NOT EXISTS source_file text;

ALTER TABLE public.compressor_polynomials
  ADD COLUMN IF NOT EXISTS manufacturer text,
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS refrigerant text,
  ADD COLUMN IF NOT EXISTS evap_temp_min numeric,
  ADD COLUMN IF NOT EXISTS evap_temp_max numeric,
  ADD COLUMN IF NOT EXISTS cond_temp_min numeric,
  ADD COLUMN IF NOT EXISTS cond_temp_max numeric,
  ADD COLUMN IF NOT EXISTS source_file text;

CREATE TABLE IF NOT EXISTS public.compressor_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_name text NOT NULL,
  total_files integer NOT NULL DEFAULT 0,
  total_rows integer NOT NULL DEFAULT 0,
  manufacturers_detected jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  errors_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.compressor_import_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.compressor_import_batches(id) ON DELETE CASCADE,
  source_file text NOT NULL,
  detected_manufacturer text,
  detected_type text,
  rows_read integer NOT NULL DEFAULT 0,
  rows_imported integer NOT NULL DEFAULT 0,
  errors_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.compressor_refrigerants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compressor_id uuid REFERENCES public.compressor_models(id) ON DELETE CASCADE,
  manufacturer text,
  model text NOT NULL,
  refrigerant text NOT NULL,
  application_type text,
  raw_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (manufacturer, model, refrigerant)
);

CREATE TABLE IF NOT EXISTS public.compressor_envelopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compressor_id uuid REFERENCES public.compressor_models(id) ON DELETE CASCADE,
  manufacturer text,
  model text NOT NULL,
  refrigerant text,
  evap_temp_min numeric,
  evap_temp_max numeric,
  cond_temp_min numeric,
  cond_temp_max numeric,
  region_type text,
  raw_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (manufacturer, model, refrigerant, region_type)
);

CREATE TABLE IF NOT EXISTS public.compressor_oils (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compressor_id uuid REFERENCES public.compressor_models(id) ON DELETE CASCADE,
  manufacturer text,
  model text NOT NULL,
  oil_type text,
  viscosity text,
  raw_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (manufacturer, model, oil_type, viscosity)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_compressor_polynomials_manufacturer_model_ref_curve
  ON public.compressor_polynomials (
    COALESCE(manufacturer, ''),
    model,
    COALESCE(refrigerant, ''),
    curve_type
  )
  WHERE model IS NOT NULL;

ALTER TABLE public.compressor_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compressor_import_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compressor_refrigerants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compressor_envelopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compressor_oils ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "CIB: auth all" ON public.compressor_import_batches FOR ALL TO authenticated USING (true) WITH CHECK (true);
  CREATE POLICY "CIA: auth all" ON public.compressor_import_audit FOR ALL TO authenticated USING (true) WITH CHECK (true);
  CREATE POLICY "CRF: auth all" ON public.compressor_refrigerants FOR ALL TO authenticated USING (true) WITH CHECK (true);
  CREATE POLICY "CEN: auth all" ON public.compressor_envelopes FOR ALL TO authenticated USING (true) WITH CHECK (true);
  CREATE POLICY "COI: auth all" ON public.compressor_oils FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
