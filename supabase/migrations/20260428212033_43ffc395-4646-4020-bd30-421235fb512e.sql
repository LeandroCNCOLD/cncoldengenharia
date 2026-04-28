-- Catálogo técnico estruturado por produto: produtos, arquivos versionados,
-- extrações e snapshots para aprovação no catálogo.

-- Enums
DO $$ BEGIN
  CREATE TYPE public.technical_file_group AS ENUM (
    'evaporador','condensador','compressor','laudos','planilhas',
    'curvas','imagens','documentos','outros'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.technical_file_category AS ENUM (
    'ficha_tecnica','laudo_teste','planilha_calculo','curva_compressor',
    'catalogo_fornecedor','desenho_tecnico','imagem','outro'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.technical_file_status AS ENUM (
    'uploaded','processing','parsed','validated','approved','rejected','archived'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1) technical_products
CREATE TABLE IF NOT EXISTS public.technical_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  manufacturer TEXT,
  family TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.technical_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "TP: auth select" ON public.technical_products
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "TP: auth insert" ON public.technical_products
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "TP: auth update" ON public.technical_products
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "TP: admin delete" ON public.technical_products
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER touch_technical_products
BEFORE UPDATE ON public.technical_products
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2) technical_files (cada upload físico)
CREATE TABLE IF NOT EXISTS public.technical_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.technical_products(id) ON DELETE CASCADE,
  file_group public.technical_file_group NOT NULL,
  technical_category public.technical_file_category NOT NULL,
  description TEXT,
  notes TEXT,
  original_filename TEXT NOT NULL,
  file_extension TEXT NOT NULL,
  mime_type TEXT,
  storage_path TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  version_label TEXT NOT NULL,
  file_hash TEXT,
  file_size BIGINT,
  status public.technical_file_status NOT NULL DEFAULT 'uploaded',
  is_current_version BOOLEAN NOT NULL DEFAULT true,
  uploaded_by UUID,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, file_group, technical_category, version_number)
);

CREATE INDEX IF NOT EXISTS idx_tf_product ON public.technical_files(product_id);
CREATE INDEX IF NOT EXISTS idx_tf_group_cat ON public.technical_files(product_id, file_group, technical_category);
CREATE INDEX IF NOT EXISTS idx_tf_current ON public.technical_files(product_id, file_group, technical_category) WHERE is_current_version;
CREATE INDEX IF NOT EXISTS idx_tf_hash ON public.technical_files(file_hash);

ALTER TABLE public.technical_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "TF: auth select" ON public.technical_files
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "TF: auth insert" ON public.technical_files
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploaded_by);
CREATE POLICY "TF: auth update" ON public.technical_files
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "TF: admin delete" ON public.technical_files
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER touch_technical_files
BEFORE UPDATE ON public.technical_files
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Garante apenas uma versão atual por (produto, grupo, categoria)
CREATE OR REPLACE FUNCTION public.enforce_single_current_technical_file()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.is_current_version THEN
    UPDATE public.technical_files
       SET is_current_version = false
     WHERE product_id = NEW.product_id
       AND file_group = NEW.file_group
       AND technical_category = NEW.technical_category
       AND id <> NEW.id
       AND is_current_version = true;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_single_current_tf
AFTER INSERT OR UPDATE OF is_current_version ON public.technical_files
FOR EACH ROW WHEN (NEW.is_current_version)
EXECUTE FUNCTION public.enforce_single_current_technical_file();

-- 3) technical_file_versions (auditoria de mudanças de versão/status)
CREATE TABLE IF NOT EXISTS public.technical_file_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  file_id UUID NOT NULL REFERENCES public.technical_files(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.technical_products(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  version_label TEXT NOT NULL,
  action TEXT NOT NULL,
  payload JSONB,
  user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tfv_file ON public.technical_file_versions(file_id);
CREATE INDEX IF NOT EXISTS idx_tfv_product ON public.technical_file_versions(product_id);

ALTER TABLE public.technical_file_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "TFV: auth select" ON public.technical_file_versions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "TFV: auth insert" ON public.technical_file_versions
  FOR INSERT TO authenticated WITH CHECK (true);

-- 4) technical_file_extractions (resultado bruto da extração)
CREATE TABLE IF NOT EXISTS public.technical_file_extractions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  file_id UUID NOT NULL REFERENCES public.technical_files(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.technical_products(id) ON DELETE CASCADE,
  parser TEXT NOT NULL,
  extracted_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  raw_preview TEXT,
  success BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tfe_file ON public.technical_file_extractions(file_id);

ALTER TABLE public.technical_file_extractions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "TFE: auth select" ON public.technical_file_extractions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "TFE: auth insert" ON public.technical_file_extractions
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "TFE: auth update" ON public.technical_file_extractions
  FOR UPDATE TO authenticated USING (true);

-- 5) technical_catalog_snapshots (versões aprovadas que alimentam o catálogo)
CREATE TABLE IF NOT EXISTS public.technical_catalog_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.technical_products(id) ON DELETE CASCADE,
  file_id UUID REFERENCES public.technical_files(id) ON DELETE SET NULL,
  file_group public.technical_file_group NOT NULL,
  technical_category public.technical_file_category NOT NULL,
  version_label TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  approved_by UUID,
  approved_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tcs_product ON public.technical_catalog_snapshots(product_id);

ALTER TABLE public.technical_catalog_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "TCS: auth select" ON public.technical_catalog_snapshots
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "TCS: auth insert" ON public.technical_catalog_snapshots
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = approved_by);
CREATE POLICY "TCS: admin delete" ON public.technical_catalog_snapshots
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- Storage policies do bucket existente "component-files" para o novo prefixo products/
DO $$ BEGIN
  CREATE POLICY "TF storage: auth read"
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'component-files' AND (storage.foldername(name))[1] = 'products');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "TF storage: auth insert"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'component-files' AND (storage.foldername(name))[1] = 'products');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "TF storage: auth update"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'component-files' AND (storage.foldername(name))[1] = 'products');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "TF storage: admin delete"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'component-files' AND (storage.foldername(name))[1] = 'products' AND public.has_role(auth.uid(),'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
