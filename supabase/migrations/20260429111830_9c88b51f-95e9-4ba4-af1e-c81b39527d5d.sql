
DROP INDEX IF EXISTS public.uq_compressor_models_source_key;
CREATE UNIQUE INDEX uq_compressor_models_source_key
  ON public.compressor_models (source_table_key);
