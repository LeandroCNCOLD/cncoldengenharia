/**
 * compressorPerformanceService.ts
 *
 * Avalia o desempenho de um compressor no ponto de operação (Te, Tc)
 * usando os polinômios EN 12900 / ARI 540 (10 termos).
 *
 * Referências:
 *   - AHRI Standard 540 (2020)
 *   - EN 12900:2013
 */
import {
  evalPoly10,
  checkEnvelope,
} from "@/modules/coldpro_catalog/engines/compressorSelector";
import type { CompressorRecord } from "@/modules/coldpro_catalog/engines/compressorSelector";
import type {
  CompressorSelectionInput,
  CompressorSelectionResult,
} from "../types/application-engineering.types";

/**
 * Avalia um compressor específico no ponto de operação.
 */
export function evaluateCompressorAtPoint(
  record: CompressorRecord,
  input: CompressorSelectionInput,
): CompressorSelectionResult {
  const warnings: string[] = [];
  const { te_c, tc_c } = input.operating_point;

  // Verificar envelope
  const envelope = checkEnvelope(record, te_c, tc_c);
  if (!envelope.inside) {
    if (envelope.te_warning) warnings.push(envelope.te_warning);
    if (envelope.tc_warning) warnings.push(envelope.tc_warning);
  }

  const teUsed = envelope.te_clamped;
  const tcUsed = envelope.tc_clamped;

  // Avaliar polinômios
  let capacityKw: number;
  let powerKw: number;
  let currentA: number | null = null;
  let dataType: CompressorSelectionResult["status"] = "ok";

  if (
    record.capacity_coefficients &&
    record.capacity_coefficients.length >= 10 &&
    record.power_coefficients &&
    record.power_coefficients.length >= 10
  ) {
    capacityKw = evalPoly10(record.capacity_coefficients, teUsed, tcUsed);
    powerKw = evalPoly10(record.power_coefficients, teUsed, tcUsed);

    if (record.current_coefficients && record.current_coefficients.length >= 10) {
      currentA = evalPoly10(record.current_coefficients, teUsed, tcUsed);
    }

    if (!envelope.inside) {
      dataType = "clamped";
    }
  } else if (record.cooling_capacity_kw && record.power_input_kw) {
    // Dados nominais apenas
    capacityKw = record.cooling_capacity_kw;
    powerKw = record.power_input_kw;
    dataType = "ok_nominal";
    warnings.push(
      "Sem coeficientes polinomiais — usando dados nominais do catálogo.",
    );
  } else {
    capacityKw = 0;
    powerKw = 0;
    dataType = "no_data";
    warnings.push("Dados insuficientes para avaliação do compressor.");
  }

  // Garantir valores positivos
  capacityKw = Math.max(0, capacityKw);
  powerKw = Math.max(0.01, powerKw);

  const cop = capacityKw / powerKw;

  return {
    model: record.model,
    manufacturer: record.manufacturer ?? "Desconhecido",
    capacity_w: capacityKw * 1000,
    power_w: powerKw * 1000,
    cop_compressor: cop,
    te_used_c: teUsed,
    tc_used_c: tcUsed,
    current_a: currentA,
    status: dataType,
    catalog_id: record.id,
    warnings,
  };
}

/**
 * Seleciona o melhor compressor de uma lista de registros para o ponto de operação.
 * Critério: menor excesso de capacidade acima do requerido (sem subdimensionar).
 */
export function selectBestCompressor(
  records: CompressorRecord[],
  input: CompressorSelectionInput,
): CompressorSelectionResult | null {
  if (records.length === 0) return null;

  const evaluated = records
    .map((r) => evaluateCompressorAtPoint(r, input))
    .filter((r) => r.capacity_w > 0);

  if (evaluated.length === 0) return null;

  // Filtrar compressores que atendem a capacidade requerida
  const adequate = evaluated.filter(
    (r) => r.capacity_w >= input.required_capacity_w * 0.95,
  );

  // Se nenhum atende, retornar o de maior capacidade
  if (adequate.length === 0) {
    return evaluated.reduce((best, curr) =>
      curr.capacity_w > best.capacity_w ? curr : best,
    );
  }

  // Entre os adequados, escolher o de menor excesso (mais eficiente)
  return adequate.reduce((best, curr) => {
    const excessCurr = curr.capacity_w - input.required_capacity_w;
    const excessBest = best.capacity_w - input.required_capacity_w;
    return excessCurr < excessBest ? curr : best;
  });
}
