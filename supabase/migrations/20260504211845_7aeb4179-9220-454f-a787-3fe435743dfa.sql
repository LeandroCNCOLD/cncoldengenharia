-- Generic helper isn't needed — repeating the policy pattern per table.

CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  client text,
  description text,
  status text NOT NULL DEFAULT 'draft',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.evaporators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  name text NOT NULL,
  model text,
  refrigerant text,
  capacity_w numeric,
  evap_temp_c numeric,
  superheat_k numeric,
  air_flow_m3h numeric,
  air_inlet_temp_c numeric,
  air_inlet_rh numeric,
  inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  results jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.condensers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  name text NOT NULL,
  model text,
  type text,
  refrigerant text,
  capacity_w numeric,
  cond_temp_c numeric,
  subcooling_k numeric,
  air_flow_m3h numeric,
  ambient_temp_c numeric,
  inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  results jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.compressors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  name text NOT NULL,
  manufacturer text,
  model text NOT NULL,
  refrigerant text,
  evap_temp_c numeric,
  cond_temp_c numeric,
  capacity_w numeric,
  power_kw numeric,
  cop numeric,
  inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  results jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.fans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  manufacturer text,
  model text,
  type text,
  diameter_mm numeric,
  air_flow_m3h numeric,
  static_pressure_pa numeric,
  power_w numeric,
  voltage_v numeric,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.refrigerants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  family text,
  gwp numeric,
  odp numeric,
  classification text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.cycle_simulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  name text NOT NULL,
  evaporator_id uuid REFERENCES public.evaporators(id) ON DELETE SET NULL,
  condenser_id uuid REFERENCES public.condensers(id) ON DELETE SET NULL,
  compressor_id uuid REFERENCES public.compressors(id) ON DELETE SET NULL,
  refrigerant text,
  evap_temp_c numeric,
  cond_temp_c numeric,
  capacity_w numeric,
  cop numeric,
  inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  results jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Triggers
CREATE TRIGGER trg_projects_updated BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_evaporators_updated BEFORE UPDATE ON public.evaporators FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_condensers_updated BEFORE UPDATE ON public.condensers FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_compressors_updated BEFORE UPDATE ON public.compressors FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_fans_updated BEFORE UPDATE ON public.fans FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_refrigerants_updated BEFORE UPDATE ON public.refrigerants FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_cycle_simulations_updated BEFORE UPDATE ON public.cycle_simulations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Indexes
CREATE INDEX idx_evaporators_project ON public.evaporators(project_id);
CREATE INDEX idx_condensers_project ON public.condensers(project_id);
CREATE INDEX idx_compressors_project ON public.compressors(project_id);
CREATE INDEX idx_cycle_simulations_project ON public.cycle_simulations(project_id);

-- Enable RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaporators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.condensers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compressors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refrigerants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cycle_simulations ENABLE ROW LEVEL SECURITY;

-- Generic policy pattern: shared read, owner/admin write
DO $$
DECLARE
  t text;
  tables text[] := ARRAY['projects','evaporators','condensers','compressors','fans','refrigerants','cycle_simulations'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('CREATE POLICY "%1$s_read_all" ON public.%1$s FOR SELECT TO authenticated USING (true)', t);
    EXECUTE format('CREATE POLICY "%1$s_insert_self" ON public.%1$s FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by)', t);
    EXECUTE format('CREATE POLICY "%1$s_update_owner_or_admin" ON public.%1$s FOR UPDATE TO authenticated USING (auth.uid() = created_by OR has_role(auth.uid(), ''admin''::app_role)) WITH CHECK (auth.uid() = created_by OR has_role(auth.uid(), ''admin''::app_role))', t);
    EXECUTE format('CREATE POLICY "%1$s_delete_owner_or_admin" ON public.%1$s FOR DELETE TO authenticated USING (auth.uid() = created_by OR has_role(auth.uid(), ''admin''::app_role))', t);
  END LOOP;
END $$;