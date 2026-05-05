-- Catálogo público de ventiladores (biblioteca de fabricantes)
-- Separado da tabela `fans` (que armazena seleções/registros do usuário)
CREATE TABLE public.fans_catalog (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  manufacturer TEXT NOT NULL,
  article_number TEXT,
  type_key TEXT NOT NULL,
  series TEXT,
  fan_genre TEXT,                 -- 'axial' | 'centrifugal'
  design TEXT,                    -- V-A, V-E, GR-E/D, RH, etc.
  size_mm NUMERIC,
  motor TEXT,
  motor_family TEXT,              -- ECblue, ZAmotbasic, AC, ECQ...
  motor_power_w NUMERIC,
  voltage_v NUMERIC,
  phases INTEGER,
  frequency_hz NUMERIC,
  electrical TEXT,
  rpm NUMERIC,
  airflow_m3h NUMERIC,            -- ponto nominal (1º operating point)
  static_pressure_pa NUMERIC,
  power_w NUMERIC,
  efficiency_pct NUMERIC,
  sfp_class TEXT,
  sfp_value NUMERIC,
  sound_db TEXT,
  operating_points JSONB NOT NULL DEFAULT '[]'::jsonb,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(manufacturer, article_number)
);

CREATE INDEX idx_fans_catalog_manufacturer ON public.fans_catalog(manufacturer);
CREATE INDEX idx_fans_catalog_type_key ON public.fans_catalog(type_key);
CREATE INDEX idx_fans_catalog_genre ON public.fans_catalog(fan_genre);
CREATE INDEX idx_fans_catalog_size ON public.fans_catalog(size_mm);
CREATE INDEX idx_fans_catalog_series ON public.fans_catalog(series);

ALTER TABLE public.fans_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fans_catalog_read_all"
  ON public.fans_catalog FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "fans_catalog_admin_insert"
  ON public.fans_catalog FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "fans_catalog_admin_update"
  ON public.fans_catalog FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "fans_catalog_admin_delete"
  ON public.fans_catalog FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_fans_catalog_updated_at
  BEFORE UPDATE ON public.fans_catalog
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();