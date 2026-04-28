-- ============================================================
-- coil_materials: biblioteca de materiais de tubo e aleta
-- ============================================================
CREATE TABLE public.coil_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  category text NOT NULL CHECK (category IN ('tube', 'fin', 'both')),
  thermal_conductivity_w_mk numeric NOT NULL,
  density_kg_m3 numeric,
  roughness_mm numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.coil_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CM: auth select" ON public.coil_materials
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "CM: admin insert" ON public.coil_materials
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "CM: admin update" ON public.coil_materials
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "CM: admin delete" ON public.coil_materials
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER coil_materials_updated_at
  BEFORE UPDATE ON public.coil_materials
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.coil_materials (name, category, thermal_conductivity_w_mk, density_kg_m3, roughness_mm, notes) VALUES
  ('Cobre', 'tube', 401, 8960, 0.0015, 'Padrão para tubos de baterias HVAC-R'),
  ('Alumínio', 'fin', 237, 2700, 0.0015, 'Padrão para aletas'),
  ('Alumínio (tubo)', 'tube', 237, 2700, 0.0015, 'Microcanal / all-aluminum'),
  ('Aço Inox 304', 'both', 16, 8000, 0.015, 'Indústria alimentícia'),
  ('Aço Carbono', 'tube', 50, 7850, 0.045, 'Aplicações industriais'),
  ('Cobre estanhado', 'tube', 380, 8900, 0.002, 'Ambientes corrosivos');

-- ============================================================
-- coil_fluids: biblioteca de fluidos
-- ============================================================
CREATE TABLE public.coil_fluids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  fluid_type text NOT NULL CHECK (fluid_type IN ('refrigerant', 'secondary')),
  family text,
  molar_mass_g_mol numeric,
  critical_temp_c numeric,
  critical_pressure_bar numeric,
  gwp numeric,
  -- Propriedades nominais (à pressão de saturação típica de evap)
  liquid_density_kg_m3 numeric,
  vapour_density_kg_m3 numeric,
  liquid_cp_kj_kgk numeric,
  vapour_cp_kj_kgk numeric,
  liquid_viscosity_upa_s numeric,
  vapour_viscosity_upa_s numeric,
  liquid_conductivity_w_mk numeric,
  latent_heat_kj_kg numeric,
  reference_temp_c numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.coil_fluids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CFL: auth select" ON public.coil_fluids
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "CFL: admin insert" ON public.coil_fluids
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "CFL: admin update" ON public.coil_fluids
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "CFL: admin delete" ON public.coil_fluids
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER coil_fluids_updated_at
  BEFORE UPDATE ON public.coil_fluids
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.coil_fluids
  (name, fluid_type, family, molar_mass_g_mol, critical_temp_c, critical_pressure_bar, gwp,
   liquid_density_kg_m3, vapour_density_kg_m3, liquid_cp_kj_kgk, vapour_cp_kj_kgk,
   liquid_viscosity_upa_s, vapour_viscosity_upa_s, liquid_conductivity_w_mk,
   latent_heat_kj_kg, reference_temp_c, notes)
VALUES
  ('R-404A', 'refrigerant', 'HFC blend', 97.6, 72.1, 37.4, 3922,
    1150, 30.4, 1.55, 1.05, 175, 12.0, 0.069, 165, -10, 'Comum em comercial baixa temperatura'),
  ('R-134a', 'refrigerant', 'HFC', 102.0, 101.1, 40.6, 1430,
    1260, 14.4, 1.43, 1.03, 220, 11.8, 0.082, 195, 0, 'Média/alta temperatura'),
  ('R-410A', 'refrigerant', 'HFC blend', 72.6, 71.4, 49.0, 2088,
    1080, 30.6, 1.74, 1.10, 145, 13.0, 0.094, 220, 5, 'Climatização'),
  ('R-407C', 'refrigerant', 'HFC blend', 86.2, 86.0, 46.3, 1774,
    1180, 23.5, 1.55, 1.02, 195, 12.3, 0.090, 215, 0, 'Substituto de R-22'),
  ('R-22', 'refrigerant', 'HCFC', 86.5, 96.1, 49.9, 1810,
    1210, 21.2, 1.26, 0.85, 200, 12.4, 0.090, 205, 0, 'Legado, em phase-out'),
  ('R-290', 'refrigerant', 'HC (propano)', 44.1, 96.7, 42.5, 3,
    520, 11.0, 2.55, 1.78, 115, 8.0, 0.097, 380, 0, 'Natural, inflamável'),
  ('R-744', 'refrigerant', 'CO2', 44.0, 31.0, 73.8, 1,
    910, 100.0, 2.95, 2.20, 95, 16.0, 0.105, 230, -10, 'Transcrítico em alta'),
  ('Água', 'secondary', 'water', 18.0, NULL, NULL, NULL,
    1000, NULL, 4.18, NULL, 1000, NULL, 0.6, NULL, 5, 'Fluido secundário'),
  ('Etilenoglicol 30%', 'secondary', 'glycol', NULL, NULL, NULL, NULL,
    1040, NULL, 3.78, NULL, 2400, NULL, 0.46, NULL, -5, 'Anticongelante'),
  ('Propilenoglicol 30%', 'secondary', 'glycol', NULL, NULL, NULL, NULL,
    1025, NULL, 3.85, NULL, 3500, NULL, 0.43, NULL, -5, 'Grau alimentício');

-- ============================================================
-- coil_calibrations: fatores de correção contra Unilab
-- ============================================================
CREATE TABLE public.coil_calibrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  component_item_id uuid NOT NULL,
  coil_type text NOT NULL CHECK (coil_type IN ('evaporator', 'condenser')),
  engine text NOT NULL DEFAULT 'physical_simple',
  -- Fatores aplicados ao motor físico
  capacity_correction_factor numeric NOT NULL DEFAULT 1.0,
  air_dp_correction_factor numeric NOT NULL DEFAULT 1.0,
  ref_dp_correction_factor numeric NOT NULL DEFAULT 1.0,
  ua_correction_factor numeric NOT NULL DEFAULT 1.0,
  -- Resultados do processo
  reference_source text,
  deviation_before jsonb NOT NULL DEFAULT '{}'::jsonb,
  deviation_after jsonb NOT NULL DEFAULT '{}'::jsonb,
  meets_targets boolean NOT NULL DEFAULT false,
  notes text,
  inputs_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  outputs_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_coil_calibrations_component ON public.coil_calibrations(component_item_id);

ALTER TABLE public.coil_calibrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CC: auth select" ON public.coil_calibrations
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "CC: auth insert" ON public.coil_calibrations
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "CC: auth delete" ON public.coil_calibrations
  FOR DELETE TO authenticated USING (true);