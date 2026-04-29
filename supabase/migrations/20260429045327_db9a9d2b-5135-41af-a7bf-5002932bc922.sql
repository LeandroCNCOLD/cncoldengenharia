-- Tabela de catálogo dos arquivos importados do pacote Unilab
CREATE TABLE IF NOT EXISTS public.unilab_source_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_batch_id uuid REFERENCES public.unilab_import_batches_v2(id) ON DELETE SET NULL,
  source_database text NOT NULL,
  source_table text NOT NULL,
  source_path text NOT NULL,
  file_kind text NOT NULL DEFAULT 'csv',
  sheet_name text,
  column_count integer NOT NULL DEFAULT 0,
  row_count integer NOT NULL DEFAULT 0,
  headers_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  content_hash text,
  status text NOT NULL DEFAULT 'imported',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_database, source_table, sheet_name)
);

CREATE INDEX IF NOT EXISTS idx_usf_database ON public.unilab_source_files(source_database);
CREATE INDEX IF NOT EXISTS idx_usf_table ON public.unilab_source_files(source_table);
CREATE INDEX IF NOT EXISTS idx_usf_batch ON public.unilab_source_files(import_batch_id);

ALTER TABLE public.unilab_source_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "USF: auth select" ON public.unilab_source_files FOR SELECT TO authenticated USING (true);
CREATE POLICY "USF: auth insert" ON public.unilab_source_files FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "USF: admin update" ON public.unilab_source_files FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "USF: admin delete" ON public.unilab_source_files FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_usf_updated_at
BEFORE UPDATE ON public.unilab_source_files
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Tabela de linhas (raw JSONB) — uma linha por linha de cada CSV/aba
CREATE TABLE IF NOT EXISTS public.unilab_source_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_file_id uuid NOT NULL REFERENCES public.unilab_source_files(id) ON DELETE CASCADE,
  row_index integer NOT NULL,
  raw_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usr_file ON public.unilab_source_rows(source_file_id);
CREATE INDEX IF NOT EXISTS idx_usr_file_row ON public.unilab_source_rows(source_file_id, row_index);
CREATE INDEX IF NOT EXISTS idx_usr_raw_gin ON public.unilab_source_rows USING gin (raw_json);

ALTER TABLE public.unilab_source_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "USR: auth select" ON public.unilab_source_rows FOR SELECT TO authenticated USING (true);
CREATE POLICY "USR: auth insert" ON public.unilab_source_rows FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "USR: admin delete" ON public.unilab_source_rows FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));