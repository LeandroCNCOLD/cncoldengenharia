/**
 * CN COILS — Circuit Optimizer
 *
 * Sugere a circuitagem ideal combinando dois critérios:
 *  1. Velocidade de massa do fluido na faixa ideal (kg/m²·s)
 *  2. Distribuição viável do total de tubos entre os circuitos
 *
 * Faixa ideal padrão (DX evaporators): 150–350 kg/m²·s, alvo 250.
 */

export type HeaderPosition = "LL" | "LR" | "RL" | "RR" | "TB" | "BT";

export interface CircuitSuggestion {
  optimalCircuits: number;
  massVelocity: number; // kg/(m²·s)
  tubesPerCircuit: number;
  status: "optimal" | "acceptable" | "warning";
  reason: string;
}

export function suggestOptimalCircuits(
  totalTubes: number,
  massFlowRate: number, // kg/s
  internalTubeDiameter: number, // m
  _fluidType: string,
): CircuitSuggestion {
  if (totalTubes <= 0 || massFlowRate <= 0 || internalTubeDiameter <= 0) {
    return {
      optimalCircuits: Math.max(1, Math.round(totalTubes / 4)),
      massVelocity: 0,
      tubesPerCircuit: 4,
      status: "warning",
      reason: "Dados insuficientes para otimização térmica.",
    };
  }

  const tubeCrossSectionArea = Math.PI * Math.pow(internalTubeDiameter / 2, 2);

  const targetMin = 150;
  const targetMax = 350;
  const targetIdeal = 250;

  let bestCircuits = 1;
  let bestDiff = Infinity;
  let bestVelocity = 0;

  for (let circuits = 1; circuits <= totalTubes; circuits++) {
    if (totalTubes % circuits === 0 || totalTubes % circuits <= 2) {
      const currentVelocity =
        massFlowRate / (tubeCrossSectionArea * circuits);
      const diff = Math.abs(currentVelocity - targetIdeal);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestCircuits = circuits;
        bestVelocity = currentVelocity;
      }
    }
  }

  let status: CircuitSuggestion["status"] = "optimal";
  let reason = "Velocidade de massa ideal e distribuição perfeita.";

  if (bestVelocity < targetMin) {
    status = "warning";
    reason = `Velocidade baixa (${Math.round(bestVelocity)} kg/m²·s). Risco de retorno de óleo.`;
  } else if (bestVelocity > targetMax) {
    status = "warning";
    reason = `Velocidade alta (${Math.round(bestVelocity)} kg/m²·s). Risco de alta perda de carga.`;
  } else if (totalTubes % bestCircuits !== 0) {
    status = "acceptable";
    reason = `Deixará ${totalTubes % bestCircuits} tubo(s) inativo(s).`;
  }

  return {
    optimalCircuits: bestCircuits,
    massVelocity: bestVelocity,
    tubesPerCircuit: Math.floor(totalTubes / bestCircuits),
    status,
    reason,
  };
}
