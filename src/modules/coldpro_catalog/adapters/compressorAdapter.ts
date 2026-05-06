/**
 * compressorAdapter.ts
 *
 * Converte registros do banco de compressores (LibraryCompressor / CatalogEquipmentRow)
 * para o formato CompressorSpec usado pelo motor de cálculo.
 *
 * Hierarquia de avaliação:
 * 1. Se o registro tem coeficientes polinomiais ARI 540 (10 termos):
 *    → Avalia Q(Te,Tc) e W(Te,Tc) no ponto de operação desejado
 *    → Verifica envelope operacional e clampeia se necessário
 * 2. Se não tem coeficientes:
 *    → Usa dados nominais diretamente com aviso
 */

import type { CatalogEquipmentRow } from "../data/equipmentCatalog.types";
import type { CompressorSpec } from "@/modules/coldpro_v2";
import type { LibraryCompressor } from "@/modules/coldpro/hooks/useEquipmentLibrary";
import {
  evaluateCompressorAtPoint,
  type CompressorRecord,
  type CompressorEvalResult,
} from "../engines/compressorSelector";

const KCALH_TO_W = 1.163;

// ─── Adaptador principal: LibraryCompressor → CompressorSpec ─────────────────

/**
 * Converte um registro da biblioteca de compressores para CompressorSpec,
 * avaliando os coeficientes polinomiais no ponto de operação (Te, Tc).
 *
 * @param comp - Registro da biblioteca de compressores
 * @param te   - Temperatura de evaporação desejada (°C). Default: -10°C
 * @param tc   - Temperatura de condensação desejada (°C). Default: 40°C
 */
export function libraryCompressorToSpec(
  comp: LibraryCompressor,
  te = -10,
  tc = 40
): CompressorSpec & { _eval?: CompressorEvalResult } {
  const record: CompressorRecord = {
    id: comp.id,
    source: comp.source,
    model: comp.model,
    manufacturer: comp.manufacturer,
    refrigerant: comp.refrigerant,
    type: comp.type,
    cooling_capacity_kw: comp.cooling_capacity_kw,
    power_input_kw: comp.power_input_kw,
    cop: comp.cop,
    min_evap_temp_c: comp.min_evap_temp_c,
    max_evap_temp_c: comp.max_evap_temp_c,
    min_cond_temp_c: comp.min_cond_temp_c,
    max_cond_temp_c: comp.max_cond_temp_c,
    nominal_conditions: comp.nominal_conditions,
    capacity_coefficients: comp.capacity_coefficients,
    power_coefficients: comp.power_coefficients,
    data_quality: comp.data_quality,
    standard: comp.standard,
  };

  const eval_ = evaluateCompressorAtPoint(record, te, tc);

  const refrigerant = Array.isArray(comp.refrigerant)
    ? comp.refrigerant[0] ?? "R404A"
    : (comp.refrigerant as string) ?? "R404A";

  return {
    cooling_capacity_w: eval_.cooling_capacity_kw * 1000,
    power_w: eval_.power_input_kw * 1000,
    refrigerant: refrigerant === "unknown" ? "R404A" : refrigerant,
    evap_temp_c: eval_.te_used_c,
    cond_temp_c: eval_.tc_used_c,
    _eval: eval_,
  };
}

// ─── Adaptador legado: CatalogEquipmentRow → CompressorSpec ──────────────────

/**
 * Converte uma linha do catálogo de equipamentos (CatalogEquipmentRow) para
 * CompressorSpec. Usado pelo SystemConfigTabContent e sessionToMotorInputAdapter.
 *
 * @param row - Linha do catálogo de equipamentos
 * @param te  - Temperatura de evaporação desejada (°C). Default: usa tempEvaporacaoC da linha
 * @param tc  - Temperatura de condensação desejada (°C). Default: usa tempCondensacaoC da linha
 */
export function catalogToCompressorSpec(
  row: CatalogEquipmentRow,
  te?: number,
  tc?: number
): CompressorSpec {
  const capCoef = (row as unknown as Record<string, unknown>)["capacity_coefficients"] as
    | number[]
    | undefined;
  const pwrCoef = (row as unknown as Record<string, unknown>)["power_coefficients"] as
    | number[]
    | undefined;

  const teEval = te ?? row.tempEvaporacaoC ?? -10;
  const tcEval = tc ?? row.tempCondensacaoC ?? 40;

  if (capCoef && capCoef.length >= 10 && capCoef.some((c) => c !== 0)) {
    const record: CompressorRecord = {
      id: row.id,
      model: row.modelo ?? row.id,
      cooling_capacity_kw: row.capacidadeFrigorificaKcalH
        ? row.capacidadeFrigorificaKcalH / 860
        : undefined,
      power_input_kw: row.potenciaCompressorKw ?? row.potenciaEletricaKw,
      min_evap_temp_c: row.tempEvaporacaoC ? row.tempEvaporacaoC - 15 : -30,
      max_evap_temp_c: row.tempEvaporacaoC ? row.tempEvaporacaoC + 15 : 15,
      min_cond_temp_c: 20,
      max_cond_temp_c: 65,
      nominal_conditions: {
        te_c: row.tempEvaporacaoC ?? -10,
        tc_c: row.tempCondensacaoC ?? 40,
      },
      capacity_coefficients: capCoef,
      power_coefficients: pwrCoef,
    };

    const eval_ = evaluateCompressorAtPoint(record, teEval, tcEval);

    return {
      cooling_capacity_w: eval_.cooling_capacity_kw * 1000,
      power_w: eval_.power_input_kw * 1000,
      refrigerant:
        row.refrigerante === "unknown" ? "R404A" : (row.refrigerante ?? "R404A"),
      evap_temp_c: eval_.te_used_c,
      cond_temp_c: eval_.tc_used_c,
    };
  }

  // Fallback: dados nominais da linha do catálogo
  const capacityKcalH = row.capacidadeCompressorKcalH ?? row.capacidadeFrigorificaKcalH;
  if (!capacityKcalH) {
    throw new Error(`Compressor sem capacidade frigorífica: ${row.id}`);
  }

  return {
    cooling_capacity_w: capacityKcalH * KCALH_TO_W,
    power_w: (row.potenciaCompressorKw ?? row.potenciaEletricaKw ?? 1.0) * 1000,
    refrigerant:
      row.refrigerante === "unknown" ? "R404A" : (row.refrigerante ?? "R404A"),
    evap_temp_c: teEval,
    cond_temp_c: tcEval,
  } satisfies CompressorSpec;
}

// ─── Utilitário: avaliar compressor em grade de pontos ───────────────────────

/**
 * Avalia um LibraryCompressor em uma grade de pontos (Te, Tc).
 * Útil para gerar mapas de desempenho no Hub de Testes.
 */
export function evaluateCompressorGrid(
  comp: LibraryCompressor,
  teRange: [number, number, number] = [-30, 10, 5],
  tcRange: [number, number, number] = [25, 55, 5]
): Array<{ te: number; tc: number; cap_kw: number; pwr_kw: number; cop: number; status: string }> {
  const record: CompressorRecord = {
    id: comp.id,
    source: comp.source,
    model: comp.model,
    cooling_capacity_kw: comp.cooling_capacity_kw,
    power_input_kw: comp.power_input_kw,
    min_evap_temp_c: comp.min_evap_temp_c,
    max_evap_temp_c: comp.max_evap_temp_c,
    min_cond_temp_c: comp.min_cond_temp_c,
    max_cond_temp_c: comp.max_cond_temp_c,
    nominal_conditions: comp.nominal_conditions,
    capacity_coefficients: comp.capacity_coefficients,
    power_coefficients: comp.power_coefficients,
  };

  const results = [];
  const [teMin, teMax, teStep] = teRange;
  const [tcMin, tcMax, tcStep] = tcRange;

  for (let te = teMin; te <= teMax + 1e-9; te += teStep) {
    for (let tc = tcMin; tc <= tcMax + 1e-9; tc += tcStep) {
      const r = Math.round;
      const eval_ = evaluateCompressorAtPoint(record, r(te * 10) / 10, r(tc * 10) / 10);
      results.push({
        te: r(te * 10) / 10,
        tc: r(tc * 10) / 10,
        cap_kw: eval_.cooling_capacity_kw,
        pwr_kw: eval_.power_input_kw,
        cop: eval_.cop,
        status: eval_.status,
      });
    }
  }
  return results;
}
