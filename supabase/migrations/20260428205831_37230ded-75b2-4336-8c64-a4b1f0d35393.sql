-- Tabela: systems
CREATE TABLE public.systems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  compressor_id UUID NOT NULL REFERENCES public.components(id) ON DELETE RESTRICT,
  evaporator_id UUID NOT NULL REFERENCES public.components(id) ON DELETE RESTRICT,
  condenser_id UUID NOT NULL REFERENCES public.components(id) ON DELETE RESTRICT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_systems_created_by ON public.systems(created_by);

ALTER TABLE public.systems ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Systems: auth select" ON public.systems FOR SELECT TO authenticated USING (true);
CREATE POLICY "Systems: auth insert" ON public.systems FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Systems: auth update" ON public.systems FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Systems: auth delete" ON public.systems FOR DELETE TO authenticated USING (true);

CREATE TRIGGER trg_systems_touch
BEFORE UPDATE ON public.systems
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Trigger de validação dos tipos referenciados
CREATE OR REPLACE FUNCTION public.validate_system_component_types()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  t_comp component_type;
  t_evap component_type;
  t_cond component_type;
BEGIN
  SELECT type INTO t_comp FROM public.components WHERE id = NEW.compressor_id;
  SELECT type INTO t_evap FROM public.components WHERE id = NEW.evaporator_id;
  SELECT type INTO t_cond FROM public.components WHERE id = NEW.condenser_id;

  IF t_comp IS DISTINCT FROM 'compressor' THEN
    RAISE EXCEPTION 'compressor_id deve referenciar um componente do tipo compressor';
  END IF;
  IF t_evap IS DISTINCT FROM 'evaporador' THEN
    RAISE EXCEPTION 'evaporator_id deve referenciar um componente do tipo evaporador';
  END IF;
  IF t_cond IS DISTINCT FROM 'condensador' THEN
    RAISE EXCEPTION 'condenser_id deve referenciar um componente do tipo condensador';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_systems_validate_types
BEFORE INSERT OR UPDATE ON public.systems
FOR EACH ROW EXECUTE FUNCTION public.validate_system_component_types();

-- Tabela: simulations
CREATE TABLE public.simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id UUID NOT NULL REFERENCES public.systems(id) ON DELETE CASCADE,

  -- Condições de operação
  t_evap_target NUMERIC NOT NULL,
  t_air_evap NUMERIC NOT NULL,
  t_air_cond NUMERIC NOT NULL,

  -- Resultados do equilíbrio
  t_cond_eq NUMERIC,
  q_evap NUMERIC,
  q_comp NUMERIC,
  w_comp NUMERIC,
  q_cond NUMERIC,
  cop NUMERIC,
  balance_error NUMERIC,

  -- Análise de gargalos
  util_comp NUMERIC,
  util_evap NUMERIC,
  util_cond NUMERIC,
  bottleneck TEXT,

  -- Recomendações + dados brutos
  recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_simulations_system ON public.simulations(system_id, created_at DESC);

ALTER TABLE public.simulations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Simulations: auth select" ON public.simulations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Simulations: auth insert" ON public.simulations FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Simulations: auth update" ON public.simulations FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Simulations: auth delete" ON public.simulations FOR DELETE TO authenticated USING (true);