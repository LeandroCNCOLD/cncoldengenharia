CREATE TABLE public.equipment_test_bench_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  equipment_id TEXT NOT NULL,
  created_by UUID NOT NULL,
  evaporator_envelope JSONB,
  condenser_envelope JSONB,
  compressor_envelope JSONB,
  compressor_id TEXT,
  compressor_model TEXT,
  bench_inputs JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (equipment_id, created_by)
);

CREATE INDEX idx_etbc_equipment_id ON public.equipment_test_bench_configs(equipment_id);
CREATE INDEX idx_etbc_created_by ON public.equipment_test_bench_configs(created_by);

ALTER TABLE public.equipment_test_bench_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "etbc_read_all"
  ON public.equipment_test_bench_configs FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "etbc_insert_self"
  ON public.equipment_test_bench_configs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "etbc_update_owner_or_admin"
  ON public.equipment_test_bench_configs FOR UPDATE
  TO authenticated
  USING ((auth.uid() = created_by) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK ((auth.uid() = created_by) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "etbc_delete_owner_or_admin"
  ON public.equipment_test_bench_configs FOR DELETE
  TO authenticated
  USING ((auth.uid() = created_by) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_etbc_touch_updated_at
  BEFORE UPDATE ON public.equipment_test_bench_configs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();