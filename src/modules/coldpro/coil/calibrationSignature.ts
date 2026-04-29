/**
 * Controle de validade da calibração.
 *
 * A `model_signature` representa todos os fatores que, se mudarem,
 * invalidam a calibração existente. Mudou qualquer um → recalibrar.
 *
 * Bumpe `ENGINE_VERSION` ou `CORRELATION_SET_VERSION` sempre que
 * alterar correlações de h_air, h_refrigerant, fórmula de U, fórmula
 * de Q ou aplicação de fatores Unilab.
 */

import type { CoilSimulatorInput } from "./coilSimulatorTypes";
import type { UnilabGeometryFactor } from "../unilabData/types";

export const ENGINE_NAME = "physical_simple";
/** Bumpar quando a fórmula de U ou Q mudar. */
export const ENGINE_VERSION = "v2-2026-04-29";
/** Bumpar quando correlações de h_air ou h_ref mudarem. */
export const CORRELATION_SET_VERSION = "v2-base";

export interface ModelSignatureInput {
  input: CoilSimulatorInput;
  unilabGeometryFactor?: UnilabGeometryFactor | null;
  externalAreaM2?: number | null;
  uBaseWm2k?: number | null;
}

function round(n: number | null | undefined, digits = 4): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  const f = Math.pow(10, digits);
  return Math.round(n * f) / f;
}

/**
 * Hash estável (FNV-1a 32-bit, em hex) — não-criptográfico, apenas
 * para detectar mudanças.
 */
function fnv1aHex(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** Gera assinatura única dos parâmetros que afetam o resultado físico. */
export function generateModelSignature(params: ModelSignatureInput): string {
  const { input, unilabGeometryFactor, externalAreaM2, uBaseWm2k } = params;

  const payload = {
    engine: ENGINE_NAME,
    engineVersion: ENGINE_VERSION,
    correlationVersion: CORRELATION_SET_VERSION,
    coilType: input.coilType,
    geometry: {
      code: unilabGeometryFactor?.geometry_code ?? null,
      rows: input.geometry.rows ?? null,
      tubesPerRow: input.geometry.tubesPerRow ?? null,
      circuits: input.geometry.circuits ?? null,
      finPitchMm: round(input.geometry.finPitchMm),
      tubeOdMm: round(input.geometry.tubeOdMm),
      tubeIdMm: round(input.geometry.tubeIdMm),
      coilLengthMm: round(input.geometry.coilLengthMm),
      tubeMaterial: input.geometry.tubeMaterial ?? null,
      finMaterial: input.geometry.finMaterial ?? null,
    },
    unilabFactors: unilabGeometryFactor
      ? {
          id: unilabGeometryFactor.id ?? null,
          fat_cor_al: round(unilabGeometryFactor.fat_cor_al),
          fat_coef_lato_tubo: round(unilabGeometryFactor.fat_coef_lato_tubo),
          fat_rid_aum_sup: round(unilabGeometryFactor.fat_rid_aum_sup),
          fat_corr_fat_attr: round(unilabGeometryFactor.fat_corr_fat_attr),
          fattore_attr_aria: round(unilabGeometryFactor.fattore_attr_aria),
          security_factor: round(unilabGeometryFactor.security_factor),
        }
      : null,
    externalAreaM2: round(externalAreaM2 ?? null, 3),
    uBaseWm2k: round(uBaseWm2k ?? null, 2),
    refrigerant: input.refrigerant.refrigerant ?? null,
  };

  return `${ENGINE_VERSION}|${CORRELATION_SET_VERSION}|${fnv1aHex(JSON.stringify(payload))}`;
}

export interface CalibrationValidity {
  isValid: boolean;
  reason?: string;
}

export function checkCalibrationValidity(
  calibrationSignature: string | null | undefined,
  currentSignature: string,
): CalibrationValidity {
  if (!calibrationSignature) {
    return { isValid: false, reason: "Calibração sem assinatura — recalibre o componente." };
  }
  if (calibrationSignature !== currentSignature) {
    return {
      isValid: false,
      reason: "Calibração desatualizada. Recalibre o componente.",
    };
  }
  return { isValid: true };
}
