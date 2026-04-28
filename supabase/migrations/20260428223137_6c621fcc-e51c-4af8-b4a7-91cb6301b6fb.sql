-- Drop legacy
DROP TABLE IF EXISTS public.simulations CASCADE;
DROP TABLE IF EXISTS public.systems CASCADE;
DROP TABLE IF EXISTS public.component_history CASCADE;
DROP TABLE IF EXISTS public.component_data CASCADE;
DROP TABLE IF EXISTS public.component_files CASCADE;
DROP TABLE IF EXISTS public.components CASCADE;
DROP TABLE IF EXISTS public.technical_file_extractions CASCADE;
DROP TABLE IF EXISTS public.technical_file_versions CASCADE;
DROP TABLE IF EXISTS public.technical_catalog_snapshots CASCADE;
DROP TABLE IF EXISTS public.technical_files CASCADE;
DROP TABLE IF EXISTS public.technical_upload_batches CASCADE;
DROP TABLE IF EXISTS public.technical_equipments CASCADE;
DROP TABLE IF EXISTS public.technical_products CASCADE;

DROP FUNCTION IF EXISTS public.validate_system_component_types() CASCADE;
DROP FUNCTION IF EXISTS public.enforce_single_current_technical_file() CASCADE;

DROP TYPE IF EXISTS public.component_type CASCADE;
DROP TYPE IF EXISTS public.component_status CASCADE;
DROP TYPE IF EXISTS public.file_kind CASCADE;
DROP TYPE IF EXISTS public.file_processing_status CASCADE;
DROP TYPE IF EXISTS public.equipment_kind CASCADE;
DROP TYPE IF EXISTS public.equipment_status CASCADE;
DROP TYPE IF EXISTS public.upload_batch_status CASCADE;
DROP TYPE IF EXISTS public.technical_file_status CASCADE;
DROP TYPE IF EXISTS public.technical_category CASCADE;
DROP TYPE IF EXISTS public.file_group CASCADE;

-- Enums novos
CREATE TYPE public.equipment_kind AS ENUM (
  'plugin','split','rack','chiller','tunel_congelamento',
  'camara_fria','unidade_condensadora','unidade_evaporadora','outro'
);
CREATE TYPE public.equipment_application AS ENUM (
  'resfriamento','congelamento','conservacao','processo_industrial',
  'climatizacao_industrial','outro'
);
CREATE TYPE public.equipment_project_status AS ENUM ('draft','in_progress','validated','archived');
CREATE TYPE public.component_kind AS ENUM (
  'evaporador','condensador','compressor','ventilador',
  'valvula_expansao','separador_liquido','acumulador',
  'painel_eletrico','controlador','outro'
);
CREATE TYPE public.component_status AS ENUM ('draft','imported','simulated','validated','approved');

-- equipment_projects
CREATE TABLE public.equipment_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  commercial_name TEXT NOT NULL,
  family TEXT,
  equipment_kind public.equipment_kind NOT NULL DEFAULT 'outro',
  application public.equipment_application NOT NULL DEFAULT 'outro',
  refrigerant TEXT,
  target_temperature NUMERIC,
  target_capacity NUMERIC,
  notes TEXT,
  status public.equipment_project_status NOT NULL DEFAULT 'draft',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.equipment_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "EP: auth select" ON public.equipment_projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "EP: auth insert" ON public.equipment_projects FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "EP: auth update" ON public.equipment_projects FOR UPDATE TO authenticated USING (true);
CREATE POLICY "EP: auth delete" ON public.equipment_projects FOR DELETE TO authenticated USING (true);
CREATE TRIGGER ep_touch BEFORE UPDATE ON public.equipment_projects
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- component_items
CREATE TABLE public.component_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_project_id UUID NOT NULL REFERENCES public.equipment_projects(id) ON DELETE CASCADE,
  kind public.component_kind NOT NULL,
  code TEXT,
  manufacturer TEXT,
  model TEXT,
  description TEXT,
  status public.component_status NOT NULL DEFAULT 'draft',
  raw_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  validated_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.component_items(equipment_project_id);
ALTER TABLE public.component_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CI: auth select" ON public.component_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "CI: auth insert" ON public.component_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "CI: auth update" ON public.component_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "CI: auth delete" ON public.component_items FOR DELETE TO authenticated USING (true);
CREATE TRIGGER ci_touch BEFORE UPDATE ON public.component_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- component_files
CREATE TABLE public.component_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component_item_id UUID NOT NULL REFERENCES public.component_items(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  uploaded_by UUID,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.component_files(component_item_id);
ALTER TABLE public.component_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CF: auth select" ON public.component_files FOR SELECT TO authenticated USING (true);
CREATE POLICY "CF: auth insert" ON public.component_files FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploaded_by);
CREATE POLICY "CF: auth delete" ON public.component_files FOR DELETE TO authenticated USING (true);

-- unilab_extractions
CREATE TABLE public.unilab_extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component_item_id UUID NOT NULL REFERENCES public.component_items(id) ON DELETE CASCADE,
  component_file_id UUID REFERENCES public.component_files(id) ON DELETE SET NULL,
  parser TEXT NOT NULL,
  extracted_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  raw_preview TEXT,
  success BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.unilab_extractions(component_item_id);
ALTER TABLE public.unilab_extractions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "UE: auth select" ON public.unilab_extractions FOR SELECT TO authenticated USING (true);
CREATE POLICY "UE: auth insert" ON public.unilab_extractions FOR INSERT TO authenticated WITH CHECK (true);

-- evaporator_coil_models
CREATE TABLE public.evaporator_coil_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component_item_id UUID NOT NULL UNIQUE REFERENCES public.component_items(id) ON DELETE CASCADE,
  nominal_capacity_w NUMERIC,
  nominal_sensible_w NUMERIC,
  nominal_latent_w NUMERIC,
  nominal_air_temp_in_c NUMERIC,
  nominal_air_temp_out_c NUMERIC,
  nominal_evap_temp_c NUMERIC,
  nominal_airflow_m3h NUMERIC,
  refrigerant TEXT,
  rows INT,
  tubes_per_row INT,
  circuits INT,
  length_mm NUMERIC,
  fin_pitch_mm NUMERIC,
  tube_od_mm NUMERIC,
  tube_id_mm NUMERIC,
  surface_area_m2 NUMERIC,
  internal_volume_l NUMERIC,
  exponent_n NUMERIC NOT NULL DEFAULT 1.20,
  raw_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.evaporator_coil_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ECM: auth select" ON public.evaporator_coil_models FOR SELECT TO authenticated USING (true);
CREATE POLICY "ECM: auth insert" ON public.evaporator_coil_models FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ECM: auth update" ON public.evaporator_coil_models FOR UPDATE TO authenticated USING (true);
CREATE POLICY "ECM: auth delete" ON public.evaporator_coil_models FOR DELETE TO authenticated USING (true);
CREATE TRIGGER ecm_touch BEFORE UPDATE ON public.evaporator_coil_models
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- condenser_coil_models
CREATE TABLE public.condenser_coil_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component_item_id UUID NOT NULL UNIQUE REFERENCES public.component_items(id) ON DELETE CASCADE,
  nominal_capacity_w NUMERIC,
  nominal_air_temp_in_c NUMERIC,
  nominal_air_temp_out_c NUMERIC,
  nominal_cond_temp_c NUMERIC,
  nominal_airflow_m3h NUMERIC,
  refrigerant TEXT,
  rows INT,
  tubes_per_row INT,
  circuits INT,
  length_mm NUMERIC,
  fin_pitch_mm NUMERIC,
  tube_od_mm NUMERIC,
  tube_id_mm NUMERIC,
  surface_area_m2 NUMERIC,
  internal_volume_l NUMERIC,
  exponent_n NUMERIC NOT NULL DEFAULT 1.15,
  raw_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.condenser_coil_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CCM: auth select" ON public.condenser_coil_models FOR SELECT TO authenticated USING (true);
CREATE POLICY "CCM: auth insert" ON public.condenser_coil_models FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "CCM: auth update" ON public.condenser_coil_models FOR UPDATE TO authenticated USING (true);
CREATE POLICY "CCM: auth delete" ON public.condenser_coil_models FOR DELETE TO authenticated USING (true);
CREATE TRIGGER ccm_touch BEFORE UPDATE ON public.condenser_coil_models
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- coil_simulations
CREATE TABLE public.coil_simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component_item_id UUID NOT NULL REFERENCES public.component_items(id) ON DELETE CASCADE,
  inputs JSONB NOT NULL DEFAULT '{}'::jsonb,
  outputs JSONB NOT NULL DEFAULT '{}'::jsonb,
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.coil_simulations(component_item_id);
ALTER TABLE public.coil_simulations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CS: auth select" ON public.coil_simulations FOR SELECT TO authenticated USING (true);
CREATE POLICY "CS: auth insert" ON public.coil_simulations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "CS: auth delete" ON public.coil_simulations FOR DELETE TO authenticated USING (true);

-- equipment_simulations
CREATE TABLE public.equipment_simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_project_id UUID NOT NULL REFERENCES public.equipment_projects(id) ON DELETE CASCADE,
  inputs JSONB NOT NULL DEFAULT '{}'::jsonb,
  outputs JSONB NOT NULL DEFAULT '{}'::jsonb,
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.equipment_simulations(equipment_project_id);
ALTER TABLE public.equipment_simulations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ES: auth select" ON public.equipment_simulations FOR SELECT TO authenticated USING (true);
CREATE POLICY "ES: auth insert" ON public.equipment_simulations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ES: auth delete" ON public.equipment_simulations FOR DELETE TO authenticated USING (true);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('component-uploads','component-uploads', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "CU: auth read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'component-uploads');
CREATE POLICY "CU: auth insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'component-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "CU: auth delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'component-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
