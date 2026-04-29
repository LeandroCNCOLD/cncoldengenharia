
-- Limpa qualquer importação anterior parcial (idempotência)
DELETE FROM public.compressor_polynomials
  WHERE compressor_id IN (SELECT id FROM public.compressor_models WHERE source_db IS NOT NULL);
DELETE FROM public.compressor_models WHERE source_db IS NOT NULL;
DELETE FROM public.fan_models WHERE manufacturer = 'EBMPapst';
DELETE FROM public.vapcyc_cycle_templates;

-- Unique constraint para upsert
CREATE UNIQUE INDEX IF NOT EXISTS uq_compressor_models_source_key
  ON public.compressor_models (source_table_key)
  WHERE source_table_key IS NOT NULL;

-- Unique para evitar polinômios duplicados por modelo+curva
CREATE UNIQUE INDEX IF NOT EXISTS uq_compressor_poly_compressor_curve
  ON public.compressor_polynomials (compressor_id, curve_type);
