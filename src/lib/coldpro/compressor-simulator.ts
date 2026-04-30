/**
 * Adapter para simulação de compressor a partir de um `TechnicalComponent`
 * da Biblioteca Técnica.
 *
 * Estratégia (fallback automático):
 *   1. Tenta `vapcycCompressorEngine` (polinômios AHRI 540 da tabela
 *      `compressor_polynomials` ligada ao `compressor_models` referenciado
 *      pelo componente).
 *   2. Se não houver curva VAPCYC, tenta `compressorEngine` clássico
 *      (10 coeficientes ARI armazenados no `normalized_json` do componente).
 *   3. Se nada existir, retorna alerta "sem dados de performance".
 *
 * Não faz cálculo no React — toda matemática vem do `thermalcalc`.
 */
import { supabase } from "@/integrations/supabase/client";
import type { TechnicalComponent } from "@/modules/coldpro/library/types";
import {
  evaluateCompressor,
  type VapcycCompressorRecord,
  type VapcycPolynomialRecord,
  type SimulateCompressorResult,
  type VapcycCurveType,
} from "@/modules/thermalcalc/engines/system/vapcycCompressorEngine";
import {
  runCompressor,
  type CompressorRunInput,
} from "@/modules/thermalcalc/engines/system/compressorEngine";
import type {
  CompressorResult,
  Refrigerant,
} from "@/modules/thermalcalc/engines/system/systemTypes";

export interface CompressorSimulationInput {
  component: TechnicalComponent;
  evaporatingTempC: number;
  condensingTempC: number;
}

export type CompressorSimulationOutput =
  | {
      kind: "vapcyc";
      result: SimulateCompressorResult;
      warnings: string[];
    }
  | {
      kind: "ari";
      result: CompressorResult;
      warnings: string[];
    }
  | {
      kind: "no_data";
      warnings: string[];
    };

interface CompressorModelRow {
  id: string;
  manufacturer: string | null;
  model: string;
  refrigerant: string;
  application_type: string | null;
  units_system: string | null;
  motor_efficiency: number | null;
  massflow_correction: number | null;
  power_correction: number | null;
  voltage_v: number | null;
  frequency_hz: number | null;
  rpm: number | null;
  temp_evap_min_c: number | null;
  temp_evap_max_c: number | null;
  temp_cond_min_c: number | null;
  temp_cond_max_c: number | null;
  source_db: string | null;
  source_table_key: string | null;
}

/**
 * Tenta resolver o `compressor_models.id` correspondente a um TechnicalComponent.
 * Convenção: o mapper VAPCYC grava `normalized_json.compressor_model_id` ou
 * `normalized_json.source_table_key`. Como fallback, tenta casar por
 * (manufacturer, model).
 */
async function resolveCompressorModelRow(
  component: TechnicalComponent,
): Promise<CompressorModelRow | null> {
  const norm = component.normalized_json ?? {};
  const explicitId = (norm["compressor_model_id"] ?? norm["compressorModelId"]) as
    | string
    | undefined;
  const explicitKey = (norm["source_table_key"] ?? norm["sourceTableKey"]) as
    | string
    | undefined;

  if (explicitId) {
    const { data } = await supabase
      .from("compressor_models")
      .select("*")
      .eq("id", explicitId)
      .maybeSingle();
    if (data) return data as CompressorModelRow;
  }
  if (explicitKey) {
    const { data } = await supabase
      .from("compressor_models")
      .select("*")
      .eq("source_table_key", explicitKey)
      .maybeSingle();
    if (data) return data as CompressorModelRow;
  }
  if (component.model) {
    const q = supabase.from("compressor_models").select("*").eq("model", component.model).limit(1);
    const { data } = await q;
    if (data && data.length > 0) return data[0] as CompressorModelRow;
  }
  return null;
}

async function loadVapcycPolynomials(
  compressorModelId: string,
): Promise<VapcycPolynomialRecord[]> {
  const { data } = await supabase
    .from("compressor_polynomials")
    .select("curve_type, unit_system, coefficients_json")
    .eq("compressor_id", compressorModelId);
  return (data ?? []).map((p) => ({
    curve_type: p.curve_type as VapcycCurveType,
    unit_system: p.unit_system ?? "",
    coefficients_json: Array.isArray(p.coefficients_json)
      ? (p.coefficients_json as number[])
      : [],
  }));
}

function tryAriFromNormalized(
  component: TechnicalComponent,
  evaporatingTempC: number,
  condensingTempC: number,
): { ok: true; result: CompressorResult } | { ok: false; reason: string } {
  const norm = component.normalized_json ?? {};
  const ariModelKey = (norm["ari_model"] ?? norm["library_model"]) as string | undefined;
  const refrigerant = (component.compatible_refrigerants_json?.[0] ??
    (norm["refrigerant"] as string | undefined)) as Refrigerant | undefined;
  if (!ariModelKey || !refrigerant) {
    return { ok: false, reason: "Sem chave de catálogo ARI ou refrigerante." };
  }
  const input: CompressorRunInput = {
    model: ariModelKey,
    refrigerant,
    evaporatingTempC,
    condensingTempC,
  };
  const result = runCompressor(input);
  if (result.qCompW <= 0 && result.warnings.some((w) => w.includes("não encontrado"))) {
    return { ok: false, reason: result.warnings[0] };
  }
  return { ok: true, result };
}

export async function simulateLibraryCompressor(
  input: CompressorSimulationInput,
): Promise<CompressorSimulationOutput> {
  const { component, evaporatingTempC, condensingTempC } = input;
  const warnings: string[] = [];

  // 1) VAPCYC
  const modelRow = await resolveCompressorModelRow(component);
  if (modelRow) {
    const polys = await loadVapcycPolynomials(modelRow.id);
    if (polys.length > 0) {
      const result = evaluateCompressor(
        modelRow as VapcycCompressorRecord,
        polys,
        evaporatingTempC,
        condensingTempC,
      );
      return { kind: "vapcyc", result, warnings: result.warnings };
    }
    warnings.push("Compressor encontrado em compressor_models, mas sem polinômios VAPCYC.");
  }

  // 2) ARI clássico (catálogo embutido)
  const ari = tryAriFromNormalized(component, evaporatingTempC, condensingTempC);
  if (ari.ok) {
    return { kind: "ari", result: ari.result, warnings };
  }
  warnings.push(ari.reason);

  // 3) sem dados
  warnings.push(
    "Sem dados de performance: o componente selecionado não possui polinômio VAPCYC nem chave de catálogo ARI no normalized_json.",
  );
  return { kind: "no_data", warnings };
}
