CREATE TABLE IF NOT EXISTS public.cn_catalog_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('official', '480', 'csv')),
  sheet_name text,
  total_rows integer NOT NULL DEFAULT 0,
  total_columns integer NOT NULL DEFAULT 0,
  imported_rows integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  errors_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cn_catalog_raw_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.cn_catalog_import_batches(id) ON DELETE CASCADE,
  source_type text NOT NULL,
  row_number integer NOT NULL,
  modelo text,
  raw_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cn_catalog_columns_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.cn_catalog_import_batches(id) ON DELETE CASCADE,
  column_name text NOT NULL,
  source_type text NOT NULL,
  detected_type text NOT NULL,
  mapped boolean NOT NULL DEFAULT false,
  target_table text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cn_equipment_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modelo text NOT NULL,
  linha text,
  hp text,
  gabinete text,
  tipo_gabinete text,
  refrigerante text,
  tipo_degelo text,
  origem_dados text NOT NULL,
  confianca numeric NOT NULL DEFAULT 0.5,
  raw_sources_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cn_equipment_master_modelo ON public.cn_equipment_master(modelo);

CREATE TABLE IF NOT EXISTS public.cn_equipment_evaporator_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES public.cn_equipment_master(id) ON DELETE CASCADE,
  geometry text,
  tube_diameter numeric,
  tube_thickness numeric,
  tubes_per_row numeric,
  rows numeric,
  circuits numeric,
  fin_spacing numeric,
  length_mm numeric,
  airflow numeric,
  internal_volume numeric,
  exchange_area numeric,
  source_priority integer NOT NULL DEFAULT 999,
  raw_json jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.cn_equipment_condenser_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES public.cn_equipment_master(id) ON DELETE CASCADE,
  geometry text,
  tube_diameter numeric,
  tube_thickness numeric,
  tubes_per_row numeric,
  rows numeric,
  circuits numeric,
  fin_spacing numeric,
  length_mm numeric,
  airflow numeric,
  internal_volume numeric,
  source_priority integer NOT NULL DEFAULT 999,
  raw_json jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.cn_equipment_reheat_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES public.cn_equipment_master(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  geometry text,
  length_mm numeric,
  raw_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cn_equipment_compressor_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES public.cn_equipment_master(id) ON DELETE CASCADE,
  copeland text,
  bitzer text,
  danfoss text,
  dorin text,
  secondary text,
  raw_json jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.cn_equipment_performance_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES public.cn_equipment_master(id) ON DELETE CASCADE,
  point_index integer NOT NULL DEFAULT 0,
  tevap numeric,
  tcond numeric,
  capacity_evap numeric,
  capacity_cond numeric,
  power numeric,
  cop numeric,
  airflow numeric,
  source text NOT NULL,
  raw_json jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_cn_raw_rows_batch ON public.cn_catalog_raw_rows(batch_id);
CREATE INDEX IF NOT EXISTS idx_cn_raw_rows_modelo ON public.cn_catalog_raw_rows(modelo);
CREATE INDEX IF NOT EXISTS idx_cn_columns_batch ON public.cn_catalog_columns_audit(batch_id);

ALTER TABLE public.cn_catalog_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cn_catalog_raw_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cn_catalog_columns_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cn_equipment_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cn_equipment_evaporator_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cn_equipment_condenser_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cn_equipment_compressor_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cn_equipment_performance_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cn_equipment_reheat_master ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "CN catalog read batches" ON public.cn_catalog_import_batches FOR SELECT TO authenticated USING (true);
  CREATE POLICY "CN catalog write batches" ON public.cn_catalog_import_batches FOR ALL TO authenticated USING (true) WITH CHECK (true);
  CREATE POLICY "CN catalog read raw" ON public.cn_catalog_raw_rows FOR SELECT TO authenticated USING (true);
  CREATE POLICY "CN catalog write raw" ON public.cn_catalog_raw_rows FOR ALL TO authenticated USING (true) WITH CHECK (true);
  CREATE POLICY "CN catalog read columns" ON public.cn_catalog_columns_audit FOR SELECT TO authenticated USING (true);
  CREATE POLICY "CN catalog write columns" ON public.cn_catalog_columns_audit FOR ALL TO authenticated USING (true) WITH CHECK (true);
  CREATE POLICY "CN equipment master read" ON public.cn_equipment_master FOR SELECT TO authenticated USING (true);
  CREATE POLICY "CN equipment master write" ON public.cn_equipment_master FOR ALL TO authenticated USING (true) WITH CHECK (true);
  CREATE POLICY "CN evap master read" ON public.cn_equipment_evaporator_master FOR SELECT TO authenticated USING (true);
  CREATE POLICY "CN evap master write" ON public.cn_equipment_evaporator_master FOR ALL TO authenticated USING (true) WITH CHECK (true);
  CREATE POLICY "CN cond master read" ON public.cn_equipment_condenser_master FOR SELECT TO authenticated USING (true);
  CREATE POLICY "CN cond master write" ON public.cn_equipment_condenser_master FOR ALL TO authenticated USING (true) WITH CHECK (true);
  CREATE POLICY "CN reheat master read" ON public.cn_equipment_reheat_master FOR SELECT TO authenticated USING (true);
  CREATE POLICY "CN reheat master write" ON public.cn_equipment_reheat_master FOR ALL TO authenticated USING (true) WITH CHECK (true);
  CREATE POLICY "CN comp master read" ON public.cn_equipment_compressor_master FOR SELECT TO authenticated USING (true);
  CREATE POLICY "CN comp master write" ON public.cn_equipment_compressor_master FOR ALL TO authenticated USING (true) WITH CHECK (true);
  CREATE POLICY "CN perf master read" ON public.cn_equipment_performance_master FOR SELECT TO authenticated USING (true);
  CREATE POLICY "CN perf master write" ON public.cn_equipment_performance_master FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
