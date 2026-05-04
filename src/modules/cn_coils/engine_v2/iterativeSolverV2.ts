/**
 * Solver iterativo ṁ ↔ Q para o motor V2 (CN Coils).
 *
 * Quando a vazão mássica do refrigerante não é conhecida (ṁ = 0),
 * este solver estima ṁ a partir de Q/h_fg e itera até convergência.
 *
 * Algoritmo (baseado no método NIST ACSIM):
 *   1. Iteração 0: ṁ₀ = 0 → U_fallback = 35 W/m²K → obtém Q₀
 *   2. Iteração n: ṁₙ = Q_(n-1) / h_fg
 *   3. Critério de parada: |ṁₙ - ṁ_(n-1)| / ṁ_(n-1) < TOLERANCE
 *   4. Máximo MAX_ITER iterações
 *
 * Quando ṁ > 0 (fornecido pelo usuário), executa o motor diretamente
 * sem loop iterativo.
 */

import { runSimulationV2, type SimulationV2Inputs, type SimulationV2Result } from "./simulatorCoreV2";

/** Número máximo de iterações do solver. */
export const SOLVER_MAX_ITER = 20;

/** Tolerância relativa para convergência de ṁ (0.1%). */
export const SOLVER_TOLERANCE = 0.001;

export interface IterativeSolverV2Options {
  /** Máximo de iterações (padrão: SOLVER_MAX_ITER). */
  maxIter?: number;
  /** Tolerância relativa para convergência (padrão: SOLVER_TOLERANCE). */
  tolerance?: number;
}

export interface IterativeSolverV2Result {
  /** Resultado final do motor V2. */
  result: SimulationV2Result;
  /** Vazão mássica estimada pelo solver [kg/s]. */
  estimatedMassFlowKgS: number;
  /** Número de iterações realizadas (0 se ṁ foi fornecido pelo usuário). */
  iterations: number;
  /** Se o solver convergiu. Sempre true quando ṁ é fornecido pelo usuário. */
  converged: boolean;
  /** Mensagens geradas pelo solver (convergência, aviso de não-convergência). */
  solverWarnings: string[];
}

/**
 * Executa o motor V2 com solver iterativo ṁ ↔ Q.
 *
 * @param baseInputs - Inputs base do motor V2 (sem fluidMassFlowKgS).
 * @param userMassFlowKgS - Vazão mássica fornecida pelo usuário [kg/s].
 *   Se 0, o solver estima ṁ automaticamente.
 * @param h_fg_kJkg - Calor latente de vaporização [kJ/kg].
 *   Usado para estimar ṁ = Q / h_fg.
 * @param options - Opções do solver (maxIter, tolerance).
 */
export function runIterativeSolverV2(
  baseInputs: Omit<SimulationV2Inputs, "fluidMassFlowKgS">,
  userMassFlowKgS: number,
  h_fg_kJkg: number,
  options: IterativeSolverV2Options = {},
): IterativeSolverV2Result {
  const maxIter = options.maxIter ?? SOLVER_MAX_ITER;
  const tolerance = options.tolerance ?? SOLVER_TOLERANCE;
  const h_fg = Math.max(h_fg_kJkg, 1); // evitar divisão por zero

  // Caso 1: usuário forneceu ṁ → executa diretamente sem loop
  if (userMassFlowKgS > 0) {
    const result = runSimulationV2({ ...baseInputs, fluidMassFlowKgS: userMassFlowKgS });
    return {
      result,
      estimatedMassFlowKgS: userMassFlowKgS,
      iterations: 0,
      converged: true,
      solverWarnings: [],
    };
  }

  // Caso 2: ṁ não fornecido → solver iterativo ṁ ↔ Q
  //
  // Iteração 0: ṁ = 0 → motor usa U_fallback = 35 W/m²K → obtém Q₀
  let currentResult = runSimulationV2({ ...baseInputs, fluidMassFlowKgS: 0 });
  let prevMassFlowKgS = 0;
  let converged = false;
  let finalMassFlowKgS = 0;
  let finalIter = 0;
  const solverWarnings: string[] = [];

  for (let iter = 1; iter <= maxIter; iter++) {
    const Q_kW = currentResult.totalCapacityKw;
    // ṁ = Q / h_fg  (Q em kW, h_fg em kJ/kg → ṁ em kg/s)
    const massFlowKgS = Math.max(Q_kW / h_fg, 1e-6);

    currentResult = runSimulationV2({ ...baseInputs, fluidMassFlowKgS: massFlowKgS });

    // Critério de convergência: variação relativa de ṁ
    const relChange = prevMassFlowKgS > 0
      ? Math.abs(massFlowKgS - prevMassFlowKgS) / prevMassFlowKgS
      : 1;

    prevMassFlowKgS = massFlowKgS;
    finalMassFlowKgS = massFlowKgS;
    finalIter = iter;

    if (relChange < tolerance) {
      converged = true;
      solverWarnings.push(
        `Motor V2: convergência ṁ ↔ Q em ${iter} iteração(ões)` +
        ` (ṁ = ${(massFlowKgS * 3600).toFixed(1)} kg/h,` +
        ` Q = ${Q_kW.toFixed(2)} kW,` +
        ` Δṁ/ṁ = ${(relChange * 100).toFixed(3)}%)`,
      );
      break;
    }
  }

  if (!converged) {
    solverWarnings.push(
      `Motor V2: solver iterativo não convergiu em ${maxIter} iterações` +
      ` — resultado pode ser impreciso` +
      ` (ṁ final = ${(finalMassFlowKgS * 3600).toFixed(1)} kg/h)`,
    );
  }

  return {
    result: currentResult,
    estimatedMassFlowKgS: finalMassFlowKgS,
    iterations: finalIter,
    converged,
    solverWarnings,
  };
}
