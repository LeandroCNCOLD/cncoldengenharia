
-- Add source/context classification to technical_components
ALTER TABLE public.technical_components
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS context text NOT NULL DEFAULT 'reference';

-- Soft constraints via CHECK (immutable enums)
ALTER TABLE public.technical_components
  DROP CONSTRAINT IF EXISTS technical_components_context_check;
ALTER TABLE public.technical_components
  ADD CONSTRAINT technical_components_context_check
  CHECK (context IN ('reference','cn_standard','test','legacy','validated'));

-- Index for engine filter
CREATE INDEX IF NOT EXISTS idx_technical_components_context
  ON public.technical_components(context);
CREATE INDEX IF NOT EXISTS idx_technical_components_source
  ON public.technical_components(source);

-- Backfill source from manufacturer for existing rows
UPDATE public.technical_components
SET source = CASE
  WHEN upper(coalesce(manufacturer,'')) LIKE '%BITZER%' THEN 'BITZER'
  WHEN upper(coalesce(manufacturer,'')) LIKE '%DANFOSS%' THEN 'DANFOSS'
  WHEN upper(coalesce(manufacturer,'')) LIKE '%TORIN%' THEN 'TORIN'
  WHEN upper(coalesce(manufacturer,'')) LIKE '%UNILAB%' THEN 'UNILAB'
  WHEN upper(coalesce(manufacturer,'')) LIKE '%VAPCYC%' THEN 'VAPCYC'
  ELSE coalesce(upper(manufacturer), 'UNKNOWN')
END
WHERE source IS NULL;
