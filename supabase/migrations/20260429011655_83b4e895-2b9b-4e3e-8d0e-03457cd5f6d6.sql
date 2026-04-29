-- ColdPro / Unilab geometry factors
-- Safe additive migration. Does not modify previous coil tables.

create table if not exists public.unilab_import_batches (
  id uuid primary key default gen_random_uuid(),
  source_name text not null default 'unilab_all_tables',
  source_version text,
  source_hash text,
  imported_by uuid,
  imported_at timestamptz not null default now(),
  notes text
);

create table if not exists public.coil_geometry_factors (
  id uuid primary key default gen_random_uuid(),
  import_batch_id uuid references public.unilab_import_batches(id) on delete set null,
  mode text not null check (mode in ('cooling','heating','condensing','direct_expansion')),
  geometry_code text not null,
  battery_code text,
  sigla text,
  description text,
  tube_arrangement text,
  fin_type text,
  tube_type text,
  tube_shape text,

  row_spacing_mm numeric,
  tube_spacing_mm numeric,
  tube_outer_diameter_mm numeric,
  tube_thickness_mm numeric,
  fin_thickness_mm numeric,
  fin_height_mm numeric,
  tube_height_mm numeric,
  tube_width_mm numeric,

  fat_cor_al numeric default 1,
  fat_coef_lato_tubo numeric default 1,
  fat_rid_aum_sup numeric default 1,
  fat_corr_fat_attr numeric default 1,
  rid_area_pass_tubo numeric default 1,
  fattore_attr_aria numeric default 1,
  fattore_attr_aria_latente numeric default 1,
  slope_fat_cor_al numeric default 0,
  slope_fat_coef_lato_tubo numeric default 0,
  slope_fat_corr_fat_attr numeric default 0,
  slope_fattore_attr_aria numeric default 0,
  security_factor numeric default 1,
  factor_a0 numeric default 0,
  factor_a1 numeric default 0,
  factor_a2 numeric default 0,
  factor_fatc numeric default 1,
  fatt_pdc_concentrate numeric default 1,

  raw_json jsonb not null default '{}'::jsonb,
  source_table text not null,
  source_row_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(mode, geometry_code, sigla, source_table)
);

create index if not exists idx_coil_geometry_factors_lookup
  on public.coil_geometry_factors(mode, sigla, description, geometry_code);

create table if not exists public.coil_factor_application_logs (
  id uuid primary key default gen_random_uuid(),
  component_item_id uuid,
  equipment_project_id uuid,
  geometry_factor_id uuid references public.coil_geometry_factors(id) on delete set null,
  engine text not null,
  mode text,
  base_result_json jsonb not null default '{}'::jsonb,
  factors_json jsonb not null default '{}'::jsonb,
  final_result_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid
);

alter table public.unilab_import_batches enable row level security;
alter table public.coil_geometry_factors enable row level security;
alter table public.coil_factor_application_logs enable row level security;

do $$ begin
  create policy "UIB: read"   on public.unilab_import_batches      for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "UIB: insert" on public.unilab_import_batches      for insert to authenticated with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "CGF: read"   on public.coil_geometry_factors      for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "CGF: insert" on public.coil_geometry_factors      for insert to authenticated with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "CGF: update" on public.coil_geometry_factors      for update to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "CFAL: read"   on public.coil_factor_application_logs for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "CFAL: insert" on public.coil_factor_application_logs for insert to authenticated with check (true);
exception when duplicate_object then null; end $$;