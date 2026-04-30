/**
 * Helpers puros (sem React/Vite) para `equipmentReadiness.functions.ts`.
 * Mantidos em arquivo .server.ts separado para não serem "perdidos"
 * pelo splitter `tss-serverfn-split`.
 */

export type ReadinessLevel = "ok" | "incomplete" | "blocked";

export type ReadinessItemKey =
  | "evaporator"
  | "condenser"
  | "compressor"
  | "fan_evaporator"
  | "fan_condenser"
  | "refrigerant"
  | "sim_evaporator"
  | "sim_condenser"
  | "sim_system";

export interface ReadinessItem {
  key: ReadinessItemKey;
  label: string;
  status: ReadinessLevel;
  message: string;
  /** lista de campos faltando (quando aplicável) */
  missing?: string[];
}

export interface EquipmentReadinessResult {
  equipmentProjectId: string;
  refrigerant: string | null;
  catalogModel: string | null;
  /** % de "OK" entre os 9 itens (0..100) */
  completeness: number;
  /** próxima ação recomendada */
  nextAction:
    | "load_from_catalog"
    | "complete_components"
    | "simulate_coils"
    | "simulate_system"
    | "all_done";
  items: ReadinessItem[];
}

/** Campos mínimos do evaporator_coil_models para simular. */
export const REQUIRED_EVAP_FIELDS = [
  "rows",
  "tubes_per_row",
  "circuits",
  "length_mm",
  "fin_pitch_mm",
  "tube_od_mm",
  "nominal_airflow_m3h",
  "nominal_evap_temp_c",
] as const;

/** Campos mínimos do condenser_coil_models para simular. */
export const REQUIRED_COND_FIELDS = [
  "rows",
  "tubes_per_row",
  "circuits",
  "length_mm",
  "fin_pitch_mm",
  "tube_od_mm",
  "nominal_airflow_m3h",
  "nominal_cond_temp_c",
] as const;

export function missingFields<T extends Record<string, unknown>>(
  row: T | null | undefined,
  fields: readonly (keyof T & string)[],
): string[] {
  if (!row) return fields.slice() as string[];
  const out: string[] = [];
  for (const f of fields) {
    const v = row[f];
    if (v == null || v === "") out.push(f);
  }
  return out;
}

export function deriveNextAction(
  items: ReadinessItem[],
): EquipmentReadinessResult["nextAction"] {
  const by = (k: ReadinessItemKey) => items.find((i) => i.key === k);

  const compsCore = ["evaporator", "condenser", "compressor", "refrigerant"] as const;
  const allCoreOk = compsCore.every((k) => by(k)?.status === "ok");
  if (!allCoreOk) {
    const anyOk = compsCore.some((k) => by(k)?.status === "ok");
    return anyOk ? "complete_components" : "load_from_catalog";
  }

  const simEvap = by("sim_evaporator")?.status;
  const simCond = by("sim_condenser")?.status;
  if (simEvap !== "ok" || simCond !== "ok") return "simulate_coils";

  if (by("sim_system")?.status !== "ok") return "simulate_system";
  return "all_done";
}

export function computeCompleteness(items: ReadinessItem[]): number {
  if (items.length === 0) return 0;
  const okCount = items.filter((i) => i.status === "ok").length;
  return Math.round((okCount / items.length) * 100);
}
