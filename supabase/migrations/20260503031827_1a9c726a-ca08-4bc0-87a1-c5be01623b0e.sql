DROP POLICY IF EXISTS "Geometries: authenticated update" ON public.coil_geometry_overrides;

CREATE POLICY "Geometries: owner or admin update"
ON public.coil_geometry_overrides FOR UPDATE
TO authenticated
USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));