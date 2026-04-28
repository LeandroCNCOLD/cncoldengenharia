// Polinômio AHRI 540 / Copeland de 10 termos.

import type { CompressorCatalogItem } from "@/lib/catalog/types";
import type { CompressorPerformance } from "./thermalBalanceTypes";
import { ThermalEngineError } from "./thermalBalanceTypes";

const BTU_H_TO_W = 0.29307107;
const cToF = (c: number) => (c * 9) / 5 + 32;

function evalAhri540(coef: number[], te: number, tc: number): number {
  if (coef.length !== 10) {
    throw new ThermalEngineError(
      `Polinômio inválido: esperado 10 coeficientes, recebido ${coef.length}`,
    );
  }
  const [c0, c1, c2, c3, c4, c5, c6, c7, c8, c9] = coef;
  return (
    c0 +
    c1 * te +
    c2 * tc +
    c3 * te * te +
    c4 * te * tc +
    c5 * tc * tc +
    c6 * te * te * te +
    c7 * tc * te * te +
    c8 * te * tc * tc +
    c9 * tc * tc * tc
  );
}

/**
 * Avalia capacidade e potência do compressor a partir do polinômio AHRI 540.
 * Espera que `polynomialCoefficients` seja a curva de capacidade.
 * Se `powerCoefficients` estiver presente em `extra`, usa para potência;
 * caso contrário aplica fator empírico (capacity/COP_estimado) para evitar quebra.
 */
export function calculateCompressorPerformance(
  compressor: CompressorCatalogItem & {
    powerCoefficients?: number[];
  },
  tevapC: number,
  tcondC: number,
): CompressorPerformance {
  const isIP = compressor.unitSystem === "IP";
  const te = isIP ? cToF(tevapC) : tevapC;
  const tc = isIP ? cToF(tcondC) : tcondC;

  const rawCap = evalAhri540(compressor.polynomialCoefficients, te, tc);
  const coolingCapacityW = isIP ? rawCap * BTU_H_TO_W : rawCap;

  let powerInputW: number;
  if (compressor.powerCoefficients && compressor.powerCoefficients.length === 10) {
    const rawPwr = evalAhri540(compressor.powerCoefficients, te, tc);
    powerInputW = isIP ? rawPwr * BTU_H_TO_W : rawPwr;
  } else {
    // Estimativa Carnot-derivada quando não há curva de potência.
    const tEvapK = tevapC + 273.15;
    const tCondK = tcondC + 273.15;
    const carnot = tEvapK / Math.max(tCondK - tEvapK, 1);
    const copEst = Math.max(0.45 * carnot, 1.2);
    powerInputW = coolingCapacityW / copEst;
  }

  if (!(coolingCapacityW > 0) || !(powerInputW > 0)) {
    throw new ThermalEngineError(
      `Polinômio retornou valores não-físicos (Q=${coolingCapacityW}, W=${powerInputW})`,
      { tevapC, tcondC, model: compressor.model },
    );
  }

  return {
    coolingCapacityW,
    powerInputW,
    cop: coolingCapacityW / powerInputW,
  };
}
