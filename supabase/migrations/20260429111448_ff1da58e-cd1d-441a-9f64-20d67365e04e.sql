
-- Estender compressor_models com metadados VAPCYC
ALTER TABLE public.compressor_models
  ADD COLUMN IF NOT EXISTS application_type text,
  ADD COLUMN IF NOT EXISTS units_system text,
  ADD COLUMN IF NOT EXISTS motor_efficiency numeric DEFAULT 1,
  ADD COLUMN IF NOT EXISTS massflow_correction numeric DEFAULT 1,
  ADD COLUMN IF NOT EXISTS power_correction numeric DEFAULT 1,
  ADD COLUMN IF NOT EXISTS temp_evap_min_c numeric,
  ADD COLUMN IF NOT EXISTS temp_evap_max_c numeric,
  ADD COLUMN IF NOT EXISTS temp_cond_min_c numeric,
  ADD COLUMN IF NOT EXISTS temp_cond_max_c numeric,
  ADD COLUMN IF NOT EXISTS model_standard text,
  ADD COLUMN IF NOT EXISTS voltage_v numeric,
  ADD COLUMN IF NOT EXISTS frequency_hz numeric,
  ADD COLUMN IF NOT EXISTS rpm numeric,
  ADD COLUMN IF NOT EXISTS phase integer,
  ADD COLUMN IF NOT EXISTS subcooling_k numeric,
  ADD COLUMN IF NOT EXISTS superheat_k numeric,
  ADD COLUMN IF NOT EXISTS source_db text,
  ADD COLUMN IF NOT EXISTS source_table_key text,
  ADD COLUMN IF NOT EXISTS vapcyc_batch_id uuid;

-- Index para lookup por modelo + refrigerante (engine usa)
CREATE INDEX IF NOT EXISTS idx_compressor_models_model_ref
  ON public.compressor_models (model, refrigerant);
CREATE INDEX IF NOT EXISTS idx_compressor_models_source_key
  ON public.compressor_models (source_table_key);

-- Index para joins polinômio→modelo
CREATE INDEX IF NOT EXISTS idx_compressor_polynomials_compressor_id
  ON public.compressor_polynomials (compressor_id);

-- Tabela de batches de import VAPCYC
CREATE TABLE IF NOT EXISTS public.vapcyc_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_zip text,
  status text NOT NULL DEFAULT 'pending',
  total_models integer NOT NULL DEFAULT 0,
  total_polynomials integer NOT NULL DEFAULT 0,
  total_cycles integer NOT NULL DEFAULT 0,
  total_fans integer NOT NULL DEFAULT 0,
  errors_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vapcyc_import_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "VIB: auth select" ON public.vapcyc_import_batches
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "VIB: auth insert" ON public.vapcyc_import_batches
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "VIB: auth update" ON public.vapcyc_import_batches
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "VIB: admin delete" ON public.vapcyc_import_batches
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Tabela auxiliar de templates de ciclo VAPCYC
CREATE TABLE IF NOT EXISTS public.vapcyc_cycle_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_db text,
  cycle_name text,
  cycle_type text,
  components_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  raw_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  vapcyc_batch_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vapcyc_cycle_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "VCT: auth select" ON public.vapcyc_cycle_templates
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "VCT: auth insert" ON public.vapcyc_cycle_templates
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "VCT: admin update" ON public.vapcyc_cycle_templates
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "VCT: admin delete" ON public.vapcyc_cycle_templates
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_vapcyc_cycle_source ON public.vapcyc_cycle_templates (source_db);
