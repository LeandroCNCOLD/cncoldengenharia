
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'engenheiro');
CREATE TYPE public.component_type AS ENUM ('compressor', 'evaporador', 'condensador');
CREATE TYPE public.component_status AS ENUM ('incompleto', 'validando', 'pronto', 'invalido');
CREATE TYPE public.file_kind AS ENUM ('csv', 'pdf', 'xls');
CREATE TYPE public.file_processing_status AS ENUM ('pendente', 'processando', 'processado', 'erro');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER_ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role: security definer to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- ============ COMPONENTS ============
CREATE TABLE public.components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type public.component_type NOT NULL,
  manufacturer TEXT,
  fluid TEXT,
  status public.component_status NOT NULL DEFAULT 'incompleto',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.components ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_components_type ON public.components(type);
CREATE INDEX idx_components_status ON public.components(status);

-- ============ COMPONENT_FILES ============
CREATE TABLE public.component_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component_id UUID NOT NULL REFERENCES public.components(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_kind public.file_kind NOT NULL,
  storage_path TEXT NOT NULL,
  size_bytes BIGINT,
  processing_status public.file_processing_status NOT NULL DEFAULT 'pendente',
  error_message TEXT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);
ALTER TABLE public.component_files ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_component_files_component ON public.component_files(component_id);
CREATE INDEX idx_component_files_status ON public.component_files(processing_status);

-- ============ COMPONENT_DATA ============
-- One row per component; JSONB holds typed fields with origin tracking
CREATE TABLE public.component_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component_id UUID NOT NULL UNIQUE REFERENCES public.components(id) ON DELETE CASCADE,
  fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- per-field origin map: { "field_name": "arquivo" | "manual" }
  field_sources JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.component_data ENABLE ROW LEVEL SECURITY;

-- ============ COMPONENT_HISTORY ============
CREATE TABLE public.component_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component_id UUID NOT NULL REFERENCES public.components(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.component_history ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_component_history_component ON public.component_history(component_id);

-- ============ TIMESTAMP TRIGGERS ============
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_components_updated BEFORE UPDATE ON public.components
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_component_data_updated BEFORE UPDATE ON public.component_data
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ NEW USER TRIGGER ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  -- Default role: engenheiro
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'engenheiro');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ RLS POLICIES ============

-- profiles
CREATE POLICY "Profiles: own select" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Profiles: admin select all" ON public.profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Profiles: own update" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Profiles: insert self" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- user_roles
CREATE POLICY "Roles: own select" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Roles: admin select all" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Roles: admin insert" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Roles: admin delete" ON public.user_roles
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- components: any authenticated user can read/write
CREATE POLICY "Components: auth select" ON public.components
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Components: auth insert" ON public.components
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Components: auth update" ON public.components
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Components: auth delete" ON public.components
  FOR DELETE TO authenticated USING (true);

-- component_files
CREATE POLICY "Files: auth select" ON public.component_files
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Files: auth insert" ON public.component_files
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploaded_by);
CREATE POLICY "Files: auth update" ON public.component_files
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Files: auth delete" ON public.component_files
  FOR DELETE TO authenticated USING (true);

-- component_data
CREATE POLICY "Data: auth select" ON public.component_data
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Data: auth insert" ON public.component_data
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Data: auth update" ON public.component_data
  FOR UPDATE TO authenticated USING (true);

-- component_history
CREATE POLICY "History: auth select" ON public.component_history
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "History: auth insert" ON public.component_history
  FOR INSERT TO authenticated WITH CHECK (true);

-- ============ STORAGE BUCKET ============
INSERT INTO storage.buckets (id, name, public)
VALUES ('component-files', 'component-files', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Component files: auth read" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'component-files');
CREATE POLICY "Component files: auth insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'component-files');
CREATE POLICY "Component files: auth update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'component-files');
CREATE POLICY "Component files: auth delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'component-files');
