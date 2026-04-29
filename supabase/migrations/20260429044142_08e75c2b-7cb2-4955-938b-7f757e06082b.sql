
-- =========================================================================
-- ColdPro Technical Database — Etapa 8a schema
-- =========================================================================

-- 1) Import batches (v2 — coexiste com unilab_import_batches legado)
CREATE TABLE public.unilab_import_batches_v2 (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_file TEXT NOT NULL,
  source_version TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  total_tables INTEGER NOT NULL DEFAULT 0,
  total_rows INTEGER NOT NULL DEFAULT 0,
  errors_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.unilab_import_batches_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "UIBV2: auth select" ON public.unilab_import_batches_v2 FOR SELECT TO authenticated USING (true);
CREATE POLICY "UIBV2: auth insert" ON public.unilab_import_batches_v2 FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "UIBV2: auth update" ON public.unilab_import_batches_v2 FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "UIBV2: admin delete" ON public.unilab_import_batches_v2 FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_uibv2_updated BEFORE UPDATE ON public.unilab_import_batches_v2 FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2) Raw tables (linhas brutas de CSVs)
CREATE TABLE public.unilab_raw_tables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  import_batch_id UUID NOT NULL REFERENCES public.unilab_import_batches_v2(id) ON DELETE CASCADE,
  source_table TEXT NOT NULL,
  row_index INTEGER NOT NULL,
  raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_urt_batch ON public.unilab_raw_tables(import_batch_id);
CREATE INDEX idx_urt_source ON public.unilab_raw_tables(source_table);
ALTER TABLE public.unilab_raw_tables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "URT: auth select" ON public.unilab_raw_tables FOR SELECT TO authenticated USING (true);
CREATE POLICY "URT: auth insert" ON public.unilab_raw_tables FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "URT: admin delete" ON public.unilab_raw_tables FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- 3) Geometries
CREATE TABLE public.unilab_geometries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  import_batch_id UUID REFERENCES public.unilab_import_batches_v2(id) ON DELETE SET NULL,
  source_table TEXT,
  mode TEXT NOT NULL,
  geometry_code TEXT NOT NULL,
  description TEXT,
  fin_type TEXT,
  tube_type TEXT,
  tube_outer_diameter_mm NUMERIC,
  tube_inner_diameter_mm NUMERIC,
  tube_pitch_mm NUMERIC,
  row_pitch_mm NUMERIC,
  fin_pitch_mm NUMERIC,
  fin_thickness_mm NUMERIC,
  rows INTEGER,
  circuits INTEGER,
  raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ug_code ON public.unilab_geometries(geometry_code);
CREATE INDEX idx_ug_mode ON public.unilab_geometries(mode);
ALTER TABLE public.unilab_geometries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "UG: auth select" ON public.unilab_geometries FOR SELECT TO authenticated USING (true);
CREATE POLICY "UG: auth insert" ON public.unilab_geometries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "UG: admin update" ON public.unilab_geometries FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "UG: admin delete" ON public.unilab_geometries FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_ug_updated BEFORE UPDATE ON public.unilab_geometries FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4) Geometry factors (tabela nova, separada de coil_geometry_factors legada)
CREATE TABLE public.unilab_geometries_factors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  import_batch_id UUID REFERENCES public.unilab_import_batches_v2(id) ON DELETE SET NULL,
  geometry_code TEXT NOT NULL,
  mode TEXT NOT NULL,
  fat_cor_al NUMERIC,
  fat_coef_lattub NUMERIC,
  fat_rid_aum_sup NUMERIC,
  fattore_attr_aria NUMERIC,
  fattore_attr_aria_latente NUMERIC,
  fat_corr_fat_attr NUMERIC,
  slope_fat_cor_al NUMERIC,
  slope_fat_coef_lattub NUMERIC,
  slope_fattore_attr_aria NUMERIC,
  security_factor NUMERIC,
  factor_a0 NUMERIC,
  factor_a1 NUMERIC,
  factor_a2 NUMERIC,
  factor_fatc NUMERIC,
  raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ugf_code ON public.unilab_geometries_factors(geometry_code, mode);
ALTER TABLE public.unilab_geometries_factors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "UGF: auth select" ON public.unilab_geometries_factors FOR SELECT TO authenticated USING (true);
CREATE POLICY "UGF: auth insert" ON public.unilab_geometries_factors FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "UGF: admin update" ON public.unilab_geometries_factors FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "UGF: admin delete" ON public.unilab_geometries_factors FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_ugf_updated BEFORE UPDATE ON public.unilab_geometries_factors FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 5) Refrigerants
CREATE TABLE public.refrigerants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT,
  type TEXT,
  family TEXT,
  safety_class TEXT,
  gwp NUMERIC,
  odp NUMERIC,
  raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.refrigerants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "REF: auth select" ON public.refrigerants FOR SELECT TO authenticated USING (true);
CREATE POLICY "REF: auth insert" ON public.refrigerants FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "REF: admin update" ON public.refrigerants FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "REF: admin delete" ON public.refrigerants FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_ref_updated BEFORE UPDATE ON public.refrigerants FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 6) Refrigerant polynomials
CREATE TABLE public.refrigerant_polynomials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  refrigerant_id UUID REFERENCES public.refrigerants(id) ON DELETE CASCADE,
  refrigerant_code TEXT,
  property_id TEXT,
  property_name TEXT NOT NULL,
  phase TEXT,
  temp_min_c NUMERIC,
  temp_max_c NUMERIC,
  c0 NUMERIC, c1 NUMERIC, c2 NUMERIC, c3 NUMERIC, c4 NUMERIC, c5 NUMERIC, c6 NUMERIC,
  unit TEXT,
  raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_rp_ref ON public.refrigerant_polynomials(refrigerant_code, property_name, phase);
ALTER TABLE public.refrigerant_polynomials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "RP: auth select" ON public.refrigerant_polynomials FOR SELECT TO authenticated USING (true);
CREATE POLICY "RP: auth insert" ON public.refrigerant_polynomials FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "RP: admin delete" ON public.refrigerant_polynomials FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- 7) Compressor models
CREATE TABLE public.compressor_models (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  manufacturer TEXT,
  model TEXT NOT NULL,
  refrigerant TEXT,
  compressor_type TEXT,
  displacement NUMERIC,
  voltage TEXT,
  frequency TEXT,
  raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cm_model ON public.compressor_models(model);
ALTER TABLE public.compressor_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CMOD: auth select" ON public.compressor_models FOR SELECT TO authenticated USING (true);
CREATE POLICY "CMOD: auth insert" ON public.compressor_models FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "CMOD: admin update" ON public.compressor_models FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "CMOD: admin delete" ON public.compressor_models FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_cmod_updated BEFORE UPDATE ON public.compressor_models FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 8) Compressor polynomials
CREATE TABLE public.compressor_polynomials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  compressor_id UUID REFERENCES public.compressor_models(id) ON DELETE CASCADE,
  curve_type TEXT NOT NULL,
  unit_system TEXT,
  coefficients_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  temp_evap_min_c NUMERIC,
  temp_evap_max_c NUMERIC,
  temp_cond_min_c NUMERIC,
  temp_cond_max_c NUMERIC,
  raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cp_comp ON public.compressor_polynomials(compressor_id, curve_type);
ALTER TABLE public.compressor_polynomials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CP: auth select" ON public.compressor_polynomials FOR SELECT TO authenticated USING (true);
CREATE POLICY "CP: auth insert" ON public.compressor_polynomials FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "CP: admin delete" ON public.compressor_polynomials FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- 9) Fan models
CREATE TABLE public.fan_models (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  manufacturer TEXT,
  model TEXT NOT NULL,
  fan_type TEXT,
  diameter_mm NUMERIC,
  nominal_airflow_m3h NUMERIC,
  nominal_pressure_pa NUMERIC,
  nominal_power_w NUMERIC,
  raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.fan_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "FM: auth select" ON public.fan_models FOR SELECT TO authenticated USING (true);
CREATE POLICY "FM: auth insert" ON public.fan_models FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "FM: admin update" ON public.fan_models FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "FM: admin delete" ON public.fan_models FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_fm_updated BEFORE UPDATE ON public.fan_models FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 10) Fan curves
CREATE TABLE public.fan_curves (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fan_id UUID REFERENCES public.fan_models(id) ON DELETE CASCADE,
  curve_type TEXT NOT NULL,
  coefficients_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  table_data_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.fan_curves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "FC: auth select" ON public.fan_curves FOR SELECT TO authenticated USING (true);
CREATE POLICY "FC: auth insert" ON public.fan_curves FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "FC: admin delete" ON public.fan_curves FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- 11) Coil correlations catalog
CREATE TABLE public.coil_correlations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  group_name TEXT,
  phase TEXT,
  fluid_side TEXT,
  geometry_type TEXT,
  wet_mode TEXT,
  application TEXT,
  validity_range_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.coil_correlations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CCR: auth select" ON public.coil_correlations FOR SELECT TO authenticated USING (true);
CREATE POLICY "CCR: auth insert" ON public.coil_correlations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "CCR: admin update" ON public.coil_correlations FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "CCR: admin delete" ON public.coil_correlations FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_ccr_updated BEFORE UPDATE ON public.coil_correlations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================================
-- Storage bucket — coldpro-imports (private)
-- =========================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('coldpro-imports', 'coldpro-imports', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "coldpro-imports: auth read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'coldpro-imports');

CREATE POLICY "coldpro-imports: auth upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'coldpro-imports');

CREATE POLICY "coldpro-imports: auth delete own"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'coldpro-imports' AND owner = auth.uid());
