-- Enum do tipo de equipamento
DO $$ BEGIN
  CREATE TYPE public.equipment_kind AS ENUM (
    'unidade_condensadora','evaporador','condensador','compressor','rack','sistema_completo','outro'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.equipment_status AS ENUM ('active','draft','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.upload_batch_status AS ENUM (
    'uploaded','processing','parsed','needs_review','approved','rejected','archived'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Pasta de equipamento
CREATE TABLE IF NOT EXISTS public.technical_equipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  internal_code text,
  slug text NOT NULL UNIQUE,
  family text,
  equipment_kind public.equipment_kind NOT NULL DEFAULT 'outro',
  default_refrigerant text,
  description text,
  status public.equipment_status NOT NULL DEFAULT 'active',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.technical_equipments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "TE: auth select" ON public.technical_equipments FOR SELECT TO authenticated USING (true);
CREATE POLICY "TE: auth insert" ON public.technical_equipments FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "TE: auth update" ON public.technical_equipments FOR UPDATE TO authenticated USING (true);
CREATE POLICY "TE: admin delete" ON public.technical_equipments FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER trg_te_updated BEFORE UPDATE ON public.technical_equipments
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Lote de upload técnico
CREATE TABLE IF NOT EXISTS public.technical_upload_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id uuid NOT NULL REFERENCES public.technical_equipments(id) ON DELETE CASCADE,
  batch_number int NOT NULL,
  batch_label text NOT NULL,
  notes text,
  status public.upload_batch_status NOT NULL DEFAULT 'uploaded',
  uploaded_by uuid,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (equipment_id, batch_number)
);

ALTER TABLE public.technical_upload_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "TUB: auth select" ON public.technical_upload_batches FOR SELECT TO authenticated USING (true);
CREATE POLICY "TUB: auth insert" ON public.technical_upload_batches FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploaded_by);
CREATE POLICY "TUB: auth update" ON public.technical_upload_batches FOR UPDATE TO authenticated USING (true);
CREATE POLICY "TUB: admin delete" ON public.technical_upload_batches FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER trg_tub_updated BEFORE UPDATE ON public.technical_upload_batches
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- technical_files: vínculo com equipamento + lote + tipos detectados
ALTER TABLE public.technical_files
  ADD COLUMN IF NOT EXISTS equipment_id uuid REFERENCES public.technical_equipments(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS upload_batch_id uuid REFERENCES public.technical_upload_batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS detected_file_type text,
  ADD COLUMN IF NOT EXISTS detected_technical_type text;

-- product_id agora opcional (mantém compatibilidade)
ALTER TABLE public.technical_files ALTER COLUMN product_id DROP NOT NULL;
ALTER TABLE public.technical_files ALTER COLUMN file_group DROP NOT NULL;
ALTER TABLE public.technical_files ALTER COLUMN technical_category DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tf_equipment ON public.technical_files(equipment_id);
CREATE INDEX IF NOT EXISTS idx_tf_batch ON public.technical_files(upload_batch_id);
CREATE INDEX IF NOT EXISTS idx_tub_equipment ON public.technical_upload_batches(equipment_id);