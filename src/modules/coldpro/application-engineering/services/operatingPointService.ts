/**
 * operatingPointService.ts
 *
 * Resolve o ponto de operação (Te, Tc) a partir dos modos A ou B.
 *
 * Modo A: Te e Tc fornecidos diretamente.
 * Modo B: Te = T_câmara - ΔT_evap; Tc = T_ambiente + ΔT_cond
 */
import type {
  OperatingPointInput,
  OperatingPointResult,
} from "../types/application-engineering.types";

const DEFAULT_SUPERHEAT_K = 10;
const DEFAULT_SUBCOOLING_K = 5;
const DEFAULT_DT_EVAP_K = 8;
const DEFAULT_DT_COND_K = 12;

export function resolveOperatingPoint(
  input: OperatingPointInput,
): OperatingPointResult {
  const warnings: string[] = [];

  if (input.mode === "A") {
    const te = input.te_c;
    const tc = input.tc_c;

    if (tc - te < 20) {
      warnings.push(
        `Diferença Tc-Te=${(tc - te).toFixed(1)} K muito baixa — verifique os valores.`,
      );
    }
    if (tc - te > 80) {
      warnings.push(
        `Diferença Tc-Te=${(tc - te).toFixed(1)} K muito alta — verifique os valores.`,
      );
    }

    return {
      te_c: te,
      tc_c: tc,
      superheat_k: input.superheat_k ?? DEFAULT_SUPERHEAT_K,
      subcooling_k: input.subcooling_k ?? DEFAULT_SUBCOOLING_K,
      warnings,
    };
  }

  // Modo B
  const dtEvap = input.dt_evap_k ?? DEFAULT_DT_EVAP_K;
  const dtCond = input.dt_cond_k ?? DEFAULT_DT_COND_K;
  const te = input.t_room_c - dtEvap;
  const tc = input.t_ambient_c + dtCond;

  if (te < -45) {
    warnings.push(
      `Te calculado=${te.toFixed(1)}°C abaixo de -45°C — verifique T_câmara e ΔT_evap.`,
    );
  }
  if (tc > 65) {
    warnings.push(
      `Tc calculado=${tc.toFixed(1)}°C acima de 65°C — verifique T_ambiente e ΔT_cond.`,
    );
  }

  return {
    te_c: te,
    tc_c: tc,
    superheat_k: input.superheat_k ?? DEFAULT_SUPERHEAT_K,
    subcooling_k: input.subcooling_k ?? DEFAULT_SUBCOOLING_K,
    warnings,
  };
}
