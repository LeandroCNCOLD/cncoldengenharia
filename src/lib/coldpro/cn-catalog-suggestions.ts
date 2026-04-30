/**
 * Motor de sugestão de componentes reais a partir do Catálogo CN.
 *
 * IMPORTANTE: o catálogo CN é REFERÊNCIA. Não substitui compressor_models,
 * fan_models, fan_curves, coils ou válvulas. Esta função recebe um modelo CN
 * (com curva de operação real) e procura componentes COMPATÍVEIS na biblioteca
 * técnica do projeto, retornando ranking + score + motivo.
 *
 * Estratégia (conforme decidido com o usuário): "ambos em cascata"
 *   1. Filtro grosso: refrigerante compatível + envelope T + faixa HP
 *   2. Ranking fino: erro de capacidade na curva (quando há polinomial)
 *   3. Tier: ideal (≤5%) | bom (≤10%) | aceitavel (≤15%) | rejeitado
 */

import { supabase } from "@/integrations/supabase/client";
import type { CatalogCurve, CatalogCurvePoint } from "./catalog-curves";

// ============================================================================
// Tipos
// ============================================================================

export type SuggestionTier = "ideal" | "bom" | "aceitavel" | "rejeitado";
export type ComponentType = "compressor" | "fan" | "coil" | "valve";

export interface ComponentSuggestion {
  componentType: ComponentType;
  suggestedTable: string;
  suggestedComponentId: string;
  /** rótulo humano: "fabricante - modelo" */
  label: string;
  manufacturer: string | null;
  model: string;
  score: number;            // 0..1
  ranking: number;          // 1 = melhor
  tier: SuggestionTier;
  reason: Record<string, unknown>;
  simulatedValues: Record<string, unknown>;
}

export interface SuggestComponentsResult {
  catalogModelId: string;
  catalogModel: string;
  refrigerante: string | null;
  compressor_suggestions: ComponentSuggestion[];
  fan_suggestions: ComponentSuggestion[];
  coil_suggestions: ComponentSuggestion[];
  valve_suggestions: ComponentSuggestion[];
  warnings: string[];
}

// ============================================================================
// Helpers
// ============================================================================

const REFRIGERANT_ALIASES: Record<string, string[]> = {
  R404A: ["R404A", "R-404A", "R404"],
  R134A: ["R134A", "R-134A", "R134"],
  R22:   ["R22", "R-22"],
  R407C: ["R407C", "R-407C"],
  R410A: ["R410A", "R-410A"],
  R290:  ["R290"],
  R744:  ["R744", "CO2"],
  R32:   ["R32"],
};

function normalizeRefrigerant(r: string | null | undefined): string | null {
  if (!r) return null;
  const up = r.toUpperCase().replace(/[\s-]/g, "");
  for (const [canon, aliases] of Object.entries(REFRIGERANT_ALIASES)) {
    if (aliases.some((a) => a.toUpperCase().replace(/[\s-]/g, "") === up)) return canon;
  }
  return up;
}

function refrigerantCompatible(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizeRefrigerant(a);
  const nb = normalizeRefrigerant(b);
  if (!na || !nb) return false;
  return na === nb;
}

function tierFromError(errPct: number): SuggestionTier {
  const e = Math.abs(errPct);
  if (e <= 5) return "ideal";
  if (e <= 10) return "bom";
  if (e <= 15) return "aceitavel";
  return "rejeitado";
}

function scoreFromError(errPct: number): number {
  // 0% erro -> 1.0 ; 30% erro -> 0
  const e = Math.min(Math.abs(errPct), 30);
  return Math.max(0, 1 - e / 30);
}

function parseHpToNumber(hp: string | null | undefined): number | null {
  if (!hp) return null;
  const m = String(hp).replace(",", ".").match(/(\d+(\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

/**
 * Tenta extrair um ponto de operação representativo (médio) da curva CN.
 * A estrutura do curva_json varia conforme o CSV; pegamos o ponto central
 * e tentamos detectar tevap, tcond, capacidade.
 */
export interface OperatingPoint {
  tevapC: number | null;
  tcondC: number | null;
  capacityW: number | null;
  currentA: number | null;
  powerW: number | null;
}

function pickNum(p: CatalogCurvePoint, keys: string[]): number | null {
  for (const k of keys) {
    const v = p[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const n = Number(v.replace(",", "."));
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

export function midOperatingPoint(curve: CatalogCurve): OperatingPoint {
  const pts = curve.curva_json ?? [];
  if (pts.length === 0) {
    return {
      tevapC: null,
      tcondC: null,
      capacityW: null,
      currentA: curve.corrente_estimada ?? null,
      powerW: null,
    };
  }
  const mid = pts[Math.floor(pts.length / 2)];
  // capacidade pode vir em W, kW ou kcal/h
  let capW = pickNum(mid, ["capacidade_w", "capacity_w", "Q_w", "capacidade"]);
  const capKW = pickNum(mid, ["capacidade_kw", "capacity_kw", "Q_kw"]);
  const capKcal = pickNum(mid, ["capacidade_kcalh", "capacity_kcalh", "Q_kcal_h", "Q_kcalh"]);
  if (capW == null && capKW != null) capW = capKW * 1000;
  if (capW == null && capKcal != null) capW = capKcal * 1.163; // kcal/h → W

  return {
    tevapC: pickNum(mid, ["tevap_c", "te_c", "te", "tevap", "evap_temp_c"]),
    tcondC: pickNum(mid, ["tcond_c", "tc_c", "tc", "tcond", "cond_temp_c"]),
    capacityW: capW,
    currentA: pickNum(mid, ["corrente_a", "current_a", "I", "amp", "corrente"]) ?? curve.corrente_estimada ?? null,
    powerW: pickNum(mid, ["potencia_w", "power_w", "P_w", "potencia"]),
  };
}

// ============================================================================
// COMPRESSOR
// ============================================================================

interface CompressorRow {
  id: string;
  manufacturer: string | null;
  model: string;
  refrigerant: string | null;
  displacement: number | null;
  temp_evap_min_c: number | null;
  temp_evap_max_c: number | null;
  temp_cond_min_c: number | null;
  temp_cond_max_c: number | null;
}

function envelopeFits(
  c: CompressorRow,
  tevapC: number | null,
  tcondC: number | null,
): boolean {
  if (tevapC != null) {
    if (c.temp_evap_min_c != null && tevapC < c.temp_evap_min_c) return false;
    if (c.temp_evap_max_c != null && tevapC > c.temp_evap_max_c) return false;
  }
  if (tcondC != null) {
    if (c.temp_cond_min_c != null && tcondC < c.temp_cond_min_c) return false;
    if (c.temp_cond_max_c != null && tcondC > c.temp_cond_max_c) return false;
  }
  return true;
}

async function suggestCompressors(
  curve: CatalogCurve,
  op: OperatingPoint,
  warnings: string[],
): Promise<ComponentSuggestion[]> {
  const refr = normalizeRefrigerant(curve.refrigerante);
  if (!refr) {
    warnings.push("Catálogo sem refrigerante definido — pulando compressores.");
    return [];
  }
  const hpNum = parseHpToNumber(curve.hp);

  // Filtro grosso: refrigerante exato; deslocamento ~ HP (proxy 30 cc/HP)
  const { data: rows, error } = await supabase
    .from("compressor_models")
    .select("id,manufacturer,model,refrigerant,displacement,temp_evap_min_c,temp_evap_max_c,temp_cond_min_c,temp_cond_max_c")
    .ilike("refrigerant", refr);
  if (error) throw error;

  const candidates: CompressorRow[] = (rows ?? []).filter((c) =>
    envelopeFits(c as CompressorRow, op.tevapC, op.tcondC),
  ) as CompressorRow[];

  if (candidates.length === 0) {
    warnings.push(`Nenhum compressor com refrigerante ${refr} dentro do envelope.`);
    return [];
  }

  // Ranking: prioriza candidatos cujo HP-equivalente esteja próximo do HP do catálogo
  // (proxy quando não temos polinomial avaliado em runtime aqui).
  const scored = candidates.map((c) => {
    let score = 0.4; // base por refrigerante OK + envelope OK
    let reasonParts: string[] = ["refrigerante compatível", "envelope T ok"];
    let errPct: number | null = null;

    if (hpNum != null && c.displacement != null) {
      // proxy: 1 HP ~ 30 cc deslocamento (aproximado, usado só como ranking)
      const hpEquiv = c.displacement / 30;
      errPct = ((hpEquiv - hpNum) / hpNum) * 100;
      score = scoreFromError(errPct);
      reasonParts.push(`HP catálogo=${hpNum}, equiv=${hpEquiv.toFixed(2)}, erro=${errPct.toFixed(1)}%`);
    }

    const tier = errPct == null ? "aceitavel" : tierFromError(errPct);

    return {
      componentType: "compressor" as const,
      suggestedTable: "compressor_models",
      suggestedComponentId: c.id,
      label: `${c.manufacturer ?? "—"} ${c.model}`,
      manufacturer: c.manufacturer,
      model: c.model,
      score,
      ranking: 0,
      tier,
      reason: { motivo: reasonParts, errorPct: errPct },
      simulatedValues: {
        displacement_cc: c.displacement,
        envelope: {
          tevap: [c.temp_evap_min_c, c.temp_evap_max_c],
          tcond: [c.temp_cond_min_c, c.temp_cond_max_c],
        },
      },
    } as ComponentSuggestion;
  });

  scored.sort((a, b) => b.score - a.score);
  scored.forEach((s, i) => (s.ranking = i + 1));
  return scored.slice(0, 10);
}

// ============================================================================
// FAN
// ============================================================================

interface FanRow {
  id: string;
  manufacturer: string | null;
  model: string;
  fan_type: string | null;
  diameter_mm: number | null;
  nominal_airflow_m3h: number | null;
  nominal_pressure_pa: number | null;
  nominal_power_w: number | null;
}

async function suggestFans(
  curve: CatalogCurve,
  op: OperatingPoint,
  options: { fanCount?: number; airflowM3h?: number; pressurePa?: number },
  warnings: string[],
): Promise<ComponentSuggestion[]> {
  const fanCount = options.fanCount ?? 1;
  const totalFlow = options.airflowM3h ?? null;
  const reqFlow = totalFlow != null ? totalFlow / fanCount : null;
  const reqPressure = options.pressurePa ?? null;

  const { data: rows, error } = await supabase
    .from("fan_models")
    .select("id,manufacturer,model,fan_type,diameter_mm,nominal_airflow_m3h,nominal_pressure_pa,nominal_power_w");
  if (error) throw error;

  const fans = (rows ?? []) as FanRow[];
  if (fans.length === 0) {
    warnings.push("Nenhum ventilador na biblioteca.");
    return [];
  }

  const scored = fans.map((f) => {
    let score = 0.3;
    let errFlowPct: number | null = null;
    let pressureOk = true;
    const reasonParts: string[] = [];

    if (reqFlow != null && f.nominal_airflow_m3h != null && f.nominal_airflow_m3h > 0) {
      errFlowPct = ((f.nominal_airflow_m3h - reqFlow) / reqFlow) * 100;
      score = scoreFromError(errFlowPct);
      reasonParts.push(`vazão req/fan=${reqFlow.toFixed(0)}, fan=${f.nominal_airflow_m3h}, erro=${errFlowPct.toFixed(1)}%`);
    } else {
      reasonParts.push("vazão requerida não informada — ranking apenas por presença");
    }

    if (reqPressure != null && f.nominal_pressure_pa != null) {
      pressureOk = f.nominal_pressure_pa >= reqPressure;
      if (!pressureOk) score = Math.min(score, 0.2);
      reasonParts.push(`pressão req=${reqPressure}Pa, disp=${f.nominal_pressure_pa}Pa`);
    }

    let tier: SuggestionTier;
    if (!pressureOk) tier = "rejeitado";
    else if (errFlowPct == null) tier = "aceitavel";
    else tier = tierFromError(errFlowPct);

    return {
      componentType: "fan" as const,
      suggestedTable: "fan_models",
      suggestedComponentId: f.id,
      label: `${f.manufacturer ?? "—"} ${f.model}`,
      manufacturer: f.manufacturer,
      model: f.model,
      score,
      ranking: 0,
      tier,
      reason: { motivo: reasonParts, errorPct: errFlowPct, pressureOk, fanCount },
      simulatedValues: {
        nominal_airflow_m3h: f.nominal_airflow_m3h,
        nominal_pressure_pa: f.nominal_pressure_pa,
        nominal_power_w: f.nominal_power_w,
        suggested_quantity: fanCount,
      },
    } as ComponentSuggestion;
  });

  scored.sort((a, b) => b.score - a.score);
  scored.forEach((s, i) => (s.ranking = i + 1));
  return scored.slice(0, 10);
}

// ============================================================================
// COIL
// ============================================================================

async function suggestCoils(
  curve: CatalogCurve,
  op: OperatingPoint,
  warnings: string[],
): Promise<ComponentSuggestion[]> {
  // Estratégia: buscar geometrias unilab aprovadas; ranking por presença de
  // dimensões compatíveis (sem cálculo térmico aqui — feito no detalhe).
  const { data: rows, error } = await supabase
    .from("unilab_geometries")
    .select("id,geometry_code,description,mode,fin_type,tube_type,rows,circuits,fin_pitch_mm,tube_outer_diameter_mm")
    .eq("approval_status", "approved")
    .limit(200);
  if (error) throw error;

  const geoms = rows ?? [];
  if (geoms.length === 0) {
    warnings.push("Nenhuma geometria de serpentina aprovada.");
    return [];
  }

  const scored = geoms.map((g) => {
    const score = 0.5; // base — sem cálculo térmico no ranking inicial
    return {
      componentType: "coil" as const,
      suggestedTable: "unilab_geometries",
      suggestedComponentId: g.id as string,
      label: `${g.geometry_code} ${g.description ? `· ${g.description}` : ""}`.trim(),
      manufacturer: null,
      model: g.geometry_code as string,
      score,
      ranking: 0,
      tier: "aceitavel" as SuggestionTier,
      reason: {
        motivo: ["geometria aprovada — validação térmica feita ao aceitar"],
        mode: g.mode,
        fin_type: g.fin_type,
        tube_type: g.tube_type,
      },
      simulatedValues: {
        rows: g.rows,
        circuits: g.circuits,
        fin_pitch_mm: g.fin_pitch_mm,
        tube_od_mm: g.tube_outer_diameter_mm,
      },
    } as ComponentSuggestion;
  });

  scored.forEach((s, i) => (s.ranking = i + 1));
  return scored.slice(0, 10);
}

// ============================================================================
// VALVE
// ============================================================================

async function suggestValves(
  curve: CatalogCurve,
  op: OperatingPoint,
  warnings: string[],
): Promise<ComponentSuggestion[]> {
  const refr = normalizeRefrigerant(curve.refrigerante);
  const { data: rows, error } = await supabase
    .from("technical_components")
    .select("id,manufacturer,model,code,entity_type,normalized_json,compatible_refrigerants_json")
    .in("entity_type", ["expansion_valve", "solenoid_valve", "hot_gas_valve"])
    .eq("status", "approved")
    .limit(200);
  if (error) throw error;

  const valves = rows ?? [];
  if (valves.length === 0) {
    warnings.push("Nenhuma válvula na biblioteca técnica.");
    return [];
  }

  const scored = valves
    .map((v) => {
      const compat = Array.isArray(v.compatible_refrigerants_json)
        ? (v.compatible_refrigerants_json as string[]).map((r) => normalizeRefrigerant(r)).filter(Boolean)
        : [];
      const refrOk = !refr || compat.length === 0 || compat.includes(refr);
      const score = refrOk ? 0.6 : 0.1;
      const tier: SuggestionTier = refrOk ? "aceitavel" : "rejeitado";
      return {
        componentType: "valve" as const,
        suggestedTable: "technical_components",
        suggestedComponentId: v.id as string,
        label: `${v.manufacturer ?? "—"} ${v.model ?? v.code ?? ""}`.trim(),
        manufacturer: v.manufacturer,
        model: (v.model ?? v.code ?? "—") as string,
        score,
        ranking: 0,
        tier,
        reason: {
          motivo: refrOk ? ["refrigerante compatível"] : ["refrigerante incompatível"],
          entity_type: v.entity_type,
          compatible: compat,
        },
        simulatedValues: {},
      } as ComponentSuggestion;
    })
    .sort((a, b) => b.score - a.score);

  scored.forEach((s, i) => (s.ranking = i + 1));
  return scored.slice(0, 10);
}

// ============================================================================
// API pública
// ============================================================================

export interface SuggestComponentsOptions {
  fanCount?: number;
  airflowM3h?: number;
  pressurePa?: number;
}

export async function suggestComponentsForCatalogModel(
  curve: CatalogCurve,
  options: SuggestComponentsOptions = {},
): Promise<SuggestComponentsResult> {
  const warnings: string[] = [];
  const op = midOperatingPoint(curve);

  const [compressor_suggestions, fan_suggestions, coil_suggestions, valve_suggestions] = await Promise.all([
    suggestCompressors(curve, op, warnings),
    suggestFans(curve, op, options, warnings),
    suggestCoils(curve, op, warnings),
    suggestValves(curve, op, warnings),
  ]);

  return {
    catalogModelId: curve.id,
    catalogModel: curve.modelo,
    refrigerante: curve.refrigerante,
    compressor_suggestions,
    fan_suggestions,
    coil_suggestions,
    valve_suggestions,
    warnings,
  };
}
