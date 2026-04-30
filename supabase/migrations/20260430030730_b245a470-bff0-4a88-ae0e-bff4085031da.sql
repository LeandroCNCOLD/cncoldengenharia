
-- ============================================================================
-- cn_catalog_component_suggestions
-- Cache de sugestões de componentes reais (compressor/fan/coil/valve) para
-- cada modelo do catálogo CN.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.cn_catalog_component_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_model_id uuid NOT NULL REFERENCES public.cn_catalog_performance_curves(id) ON DELETE CASCADE,
  catalog_model text NOT NULL,
  refrigerante text,
  component_type text NOT NULL CHECK (component_type IN ('compressor','fan','coil','valve')),
  -- O componente sugerido pode estar em diferentes tabelas — guardamos id + tabela.
  suggested_table text NOT NULL,        -- 'compressor_models' | 'fan_models' | 'unilab_geometries' | 'technical_components' | 'component_items'
  suggested_component_id uuid NOT NULL,
  score numeric NOT NULL DEFAULT 0,     -- 0..1
  ranking int NOT NULL DEFAULT 0,        -- 1 = melhor
  tier text NOT NULL DEFAULT 'aceitavel' CHECK (tier IN ('ideal','bom','aceitavel','rejeitado')),
  reason_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  simulated_values_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested','accepted','rejected','outdated')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE INDEX IF NOT EXISTS idx_cncs_catalog ON public.cn_catalog_component_suggestions(catalog_model_id, component_type, ranking);
CREATE INDEX IF NOT EXISTS idx_cncs_status ON public.cn_catalog_component_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_cncs_model ON public.cn_catalog_component_suggestions(catalog_model);

ALTER TABLE public.cn_catalog_component_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CNCS: auth select" ON public.cn_catalog_component_suggestions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "CNCS: auth insert" ON public.cn_catalog_component_suggestions
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "CNCS: auth update" ON public.cn_catalog_component_suggestions
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "CNCS: admin delete" ON public.cn_catalog_component_suggestions
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_cncs_touch_updated_at
  BEFORE UPDATE ON public.cn_catalog_component_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================================
-- Trigger: invalidar cache quando bibliotecas técnicas mudarem
-- Marca sugestões 'suggested' como 'outdated' quando seu componente referenciado
-- ou qualquer item do mesmo tipo é modificado.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.invalidate_cn_suggestions_for_type(_component_type text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.cn_catalog_component_suggestions
     SET status = 'outdated', updated_at = now()
   WHERE component_type = _component_type
     AND status = 'suggested';
$$;

CREATE OR REPLACE FUNCTION public.trg_invalidate_cn_compressor()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.invalidate_cn_suggestions_for_type('compressor');
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.trg_invalidate_cn_fan()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.invalidate_cn_suggestions_for_type('fan');
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.trg_invalidate_cn_coil()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.invalidate_cn_suggestions_for_type('coil');
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.trg_invalidate_cn_valve()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.invalidate_cn_suggestions_for_type('valve');
  RETURN NULL;
END $$;

-- compressor_models / compressor_polynomials
DROP TRIGGER IF EXISTS trg_cn_inv_compressor_models ON public.compressor_models;
CREATE TRIGGER trg_cn_inv_compressor_models
  AFTER INSERT OR UPDATE OR DELETE ON public.compressor_models
  FOR EACH STATEMENT EXECUTE FUNCTION public.trg_invalidate_cn_compressor();

DROP TRIGGER IF EXISTS trg_cn_inv_compressor_polys ON public.compressor_polynomials;
CREATE TRIGGER trg_cn_inv_compressor_polys
  AFTER INSERT OR UPDATE OR DELETE ON public.compressor_polynomials
  FOR EACH STATEMENT EXECUTE FUNCTION public.trg_invalidate_cn_compressor();

-- fan_models / fan_curves
DROP TRIGGER IF EXISTS trg_cn_inv_fan_models ON public.fan_models;
CREATE TRIGGER trg_cn_inv_fan_models
  AFTER INSERT OR UPDATE OR DELETE ON public.fan_models
  FOR EACH STATEMENT EXECUTE FUNCTION public.trg_invalidate_cn_fan();

DROP TRIGGER IF EXISTS trg_cn_inv_fan_curves ON public.fan_curves;
CREATE TRIGGER trg_cn_inv_fan_curves
  AFTER INSERT OR UPDATE OR DELETE ON public.fan_curves
  FOR EACH STATEMENT EXECUTE FUNCTION public.trg_invalidate_cn_fan();

-- coil sources
DROP TRIGGER IF EXISTS trg_cn_inv_unilab_geom ON public.unilab_geometries;
CREATE TRIGGER trg_cn_inv_unilab_geom
  AFTER INSERT OR UPDATE OR DELETE ON public.unilab_geometries
  FOR EACH STATEMENT EXECUTE FUNCTION public.trg_invalidate_cn_coil();

DROP TRIGGER IF EXISTS trg_cn_inv_evap_coil ON public.evaporator_coil_models;
CREATE TRIGGER trg_cn_inv_evap_coil
  AFTER INSERT OR UPDATE OR DELETE ON public.evaporator_coil_models
  FOR EACH STATEMENT EXECUTE FUNCTION public.trg_invalidate_cn_coil();

DROP TRIGGER IF EXISTS trg_cn_inv_cond_coil ON public.condenser_coil_models;
CREATE TRIGGER trg_cn_inv_cond_coil
  AFTER INSERT OR UPDATE OR DELETE ON public.condenser_coil_models
  FOR EACH STATEMENT EXECUTE FUNCTION public.trg_invalidate_cn_coil();

-- valves vivem em technical_components → invalida coil + valve quando muda
DROP TRIGGER IF EXISTS trg_cn_inv_tech_components ON public.technical_components;
CREATE OR REPLACE FUNCTION public.trg_invalidate_cn_tech_components()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.invalidate_cn_suggestions_for_type('valve');
  PERFORM public.invalidate_cn_suggestions_for_type('coil');
  RETURN NULL;
END $$;
CREATE TRIGGER trg_cn_inv_tech_components
  AFTER INSERT OR UPDATE OR DELETE ON public.technical_components
  FOR EACH STATEMENT EXECUTE FUNCTION public.trg_invalidate_cn_tech_components();
