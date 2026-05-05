import { supabase } from "@/integrations/supabase/client";
import type {
  CompressorEnvelopePoint,
  CondenserEnvelopePoint,
  CoilEnvelope,
} from "@/modules/cn_coils/store/useCoilEnvelopeStore";

export interface TestBenchConfigPayload {
  evaporator_envelope?: CoilEnvelope | null;
  condenser_envelope?: CondenserEnvelopePoint[] | null;
  compressor_envelope?: CompressorEnvelopePoint[] | null;
  compressor_id?: string | null;
  compressor_model?: string | null;
  bench_inputs?: Record<string, unknown>;
}

export interface TestBenchConfigRow extends TestBenchConfigPayload {
  id: string;
  equipment_id: string;
  created_by: string;
  updated_at: string;
}

export const testBenchConfigService = {
  async load(equipmentId: string): Promise<TestBenchConfigRow | null> {
    const { data, error } = await supabase
      .from("equipment_test_bench_configs")
      .select("*")
      .eq("equipment_id", equipmentId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error("[testBenchConfig] load error", error);
      return null;
    }
    return (data as unknown as TestBenchConfigRow) ?? null;
  },

  async save(
    equipmentId: string,
    payload: TestBenchConfigPayload,
  ): Promise<TestBenchConfigRow | null> {
    const { data: userRes } = await supabase.auth.getUser();
    const userId = userRes.user?.id;
    if (!userId) {
      console.warn("[testBenchConfig] no user; skipping remote save");
      return null;
    }

    const { data, error } = await supabase
      .from("equipment_test_bench_configs")
      .upsert(
        [
          {
            equipment_id: equipmentId,
            created_by: userId,
            ...payload,
          },
        ] as never,
        { onConflict: "equipment_id,created_by" },
      )
      .select()
      .maybeSingle();

    if (error) {
      console.error("[testBenchConfig] save error", error);
      return null;
    }
    return (data as unknown as TestBenchConfigRow) ?? null;
  },
};
