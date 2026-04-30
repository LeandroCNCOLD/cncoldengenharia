ALTER TABLE public.cn_equipment_evaporator_master
  ADD COLUMN IF NOT EXISTS length_mm numeric;

ALTER TABLE public.cn_equipment_condenser_master
  ADD COLUMN IF NOT EXISTS length_mm numeric;

CREATE TABLE IF NOT EXISTS public.cn_equipment_reheat_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES public.cn_equipment_master(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  geometry text,
  tube_diameter numeric,
  tube_thickness numeric,
  tubes_per_row numeric,
  rows numeric,
  circuits numeric,
  fin_spacing numeric,
  airflow numeric,
  internal_volume numeric,
  exchange_area numeric,
  length_mm numeric,
  source_priority integer NOT NULL DEFAULT 999,
  raw_json jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.cn_equipment_reheat_master ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "CN reheat master read" ON public.cn_equipment_reheat_master
    FOR SELECT TO authenticated USING (true);
  CREATE POLICY "CN reheat master write" ON public.cn_equipment_reheat_master
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
