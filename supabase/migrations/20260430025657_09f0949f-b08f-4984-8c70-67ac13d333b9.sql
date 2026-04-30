CREATE TABLE IF NOT EXISTS public.cn_catalog_performance_curves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modelo TEXT NOT NULL,
  linha TEXT,
  hp TEXT,
  gabinete TEXT,
  tipo TEXT,
  refrigerante TEXT,
  curva_indice INTEGER,
  total_pontos INTEGER,
  curva_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  corrente_estimada NUMERIC,
  corrente_partida NUMERIC,
  carga_fluido NUMERIC,
  origem TEXT,
  raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cn_catalog_modelo ON public.cn_catalog_performance_curves (modelo);
CREATE INDEX IF NOT EXISTS idx_cn_catalog_modelo_ref ON public.cn_catalog_performance_curves (modelo, refrigerante);

ALTER TABLE public.cn_catalog_performance_curves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CCPC: auth select"
  ON public.cn_catalog_performance_curves FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "CCPC: auth insert"
  ON public.cn_catalog_performance_curves FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "CCPC: auth update"
  ON public.cn_catalog_performance_curves FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "CCPC: admin delete"
  ON public.cn_catalog_performance_curves FOR DELETE
  TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_ccpc_touch_updated_at
  BEFORE UPDATE ON public.cn_catalog_performance_curves
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();