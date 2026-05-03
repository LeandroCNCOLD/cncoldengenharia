-- Tabela para customizações/overrides do catálogo de geometrias de serpentina
CREATE TABLE public.coil_geometry_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id text,
  codigo text NOT NULL,
  descricao text NOT NULL,
  name text NOT NULL,
  tipo_serpentina text,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  deleted boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX coil_geometry_overrides_base_id_idx ON public.coil_geometry_overrides(base_id);
CREATE INDEX coil_geometry_overrides_codigo_idx ON public.coil_geometry_overrides(codigo);

CREATE TRIGGER coil_geometry_overrides_touch
BEFORE UPDATE ON public.coil_geometry_overrides
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.coil_geometry_overrides ENABLE ROW LEVEL SECURITY;

-- Qualquer usuário autenticado pode visualizar
CREATE POLICY "Geometries: authenticated read"
ON public.coil_geometry_overrides FOR SELECT
TO authenticated
USING (true);

-- Qualquer autenticado pode criar geometrias customizadas
CREATE POLICY "Geometries: authenticated insert"
ON public.coil_geometry_overrides FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

-- Qualquer autenticado pode editar (overrides são compartilhados — engenheiros colaboram)
CREATE POLICY "Geometries: authenticated update"
ON public.coil_geometry_overrides FOR UPDATE
TO authenticated
USING (true);

-- APENAS admin pode excluir (hard delete)
CREATE POLICY "Geometries: admin delete"
ON public.coil_geometry_overrides FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));