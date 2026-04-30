-- Tabela de desenvolvimento de produtos
CREATE TABLE public.cn_product_development (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_model text NOT NULL UNIQUE,
  linha text,
  hp text,
  refrigerante text,
  status text NOT NULL DEFAULT 'a_analisar' CHECK (status IN ('a_analisar','em_analise','sugestoes_ok','aprovado','arquivado')),
  position integer NOT NULL DEFAULT 0,
  equipment_project_id uuid,
  notes text,
  archived_reason text,
  approved_at timestamptz,
  archived_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cn_product_dev_status ON public.cn_product_development(status, position);
CREATE INDEX idx_cn_product_dev_model ON public.cn_product_development(catalog_model);

ALTER TABLE public.cn_product_development ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CPD: auth select" ON public.cn_product_development FOR SELECT TO authenticated USING (true);
CREATE POLICY "CPD: auth insert" ON public.cn_product_development FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "CPD: auth update" ON public.cn_product_development FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "CPD: admin delete" ON public.cn_product_development FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger updated_at
CREATE TRIGGER trg_cpd_updated_at
  BEFORE UPDATE ON public.cn_product_development
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Backfill com modelos do catálogo
INSERT INTO public.cn_product_development (catalog_model, linha, hp, refrigerante, status, position)
SELECT
  modelo,
  MAX(linha),
  MAX(hp),
  MAX(refrigerante),
  'a_analisar',
  (ROW_NUMBER() OVER (ORDER BY modelo)) * 1000
FROM public.cn_catalog_performance_curves
WHERE modelo IS NOT NULL
GROUP BY modelo
ON CONFLICT (catalog_model) DO NOTHING;

-- Função e trigger: novo modelo no catálogo cria card automaticamente
CREATE OR REPLACE FUNCTION public.trg_cn_curve_to_product_dev()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_pos integer;
BEGIN
  IF NEW.modelo IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(MAX(position), 0) + 1000 INTO next_pos
    FROM public.cn_product_development
    WHERE status = 'a_analisar';

  INSERT INTO public.cn_product_development (catalog_model, linha, hp, refrigerante, status, position)
  VALUES (NEW.modelo, NEW.linha, NEW.hp, NEW.refrigerante, 'a_analisar', next_pos)
  ON CONFLICT (catalog_model) DO NOTHING;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_cn_curve_insert_product_dev
  AFTER INSERT ON public.cn_catalog_performance_curves
  FOR EACH ROW EXECUTE FUNCTION public.trg_cn_curve_to_product_dev();