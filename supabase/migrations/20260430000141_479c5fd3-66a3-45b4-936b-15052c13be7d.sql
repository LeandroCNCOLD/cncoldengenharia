-- Enum para o papel do componente no equipamento
DO $$ BEGIN
  CREATE TYPE public.equipment_component_role AS ENUM (
    'evaporator',
    'condenser',
    'compressor',
    'fan_evaporator',
    'fan_condenser',
    'valve',
    'fluid',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.equipment_component_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_project_id uuid NOT NULL,
  technical_component_id uuid NOT NULL,
  role public.equipment_component_role NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (equipment_project_id, technical_component_id, role)
);

CREATE INDEX IF NOT EXISTS idx_ecl_equipment ON public.equipment_component_links(equipment_project_id);
CREATE INDEX IF NOT EXISTS idx_ecl_component ON public.equipment_component_links(technical_component_id);
CREATE INDEX IF NOT EXISTS idx_ecl_role ON public.equipment_component_links(role);

ALTER TABLE public.equipment_component_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ECL: auth select" ON public.equipment_component_links
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "ECL: auth insert" ON public.equipment_component_links
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ECL: auth update" ON public.equipment_component_links
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "ECL: auth delete" ON public.equipment_component_links
  FOR DELETE TO authenticated USING (true);

CREATE TRIGGER trg_ecl_touch_updated_at
  BEFORE UPDATE ON public.equipment_component_links
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();