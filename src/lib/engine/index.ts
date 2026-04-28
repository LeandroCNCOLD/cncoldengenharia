// CN Cold Engineering — Motor de simulação (orquestrador).
import {
  parseAhriCoefficients,
  parseOperationalRange,
  type AhriCoefficients,
  type OperationalRange,
} from "./ahri540";
import {
  parseHxFromFields,
  uaFromNominal,
} from "./heat-exchanger";
import { solveEquilibrium, type EquilibriumResult } from "./equilibrium";
import { generateRecommendations, type Recommendation } from "./recommendations";

export * from "./ahri540";
export * from "./heat-exchanger";
export * from "./equilibrium";
export * from "./recommendations";

export interface ComponentBundle {
  fields: Record<string, unknown>;
}

export interface SimulationInput {
  tEvapTarget: number;
  tAirEvap: number;
  tAirCond: number;
  compressor: ComponentBundle;
  evaporator: ComponentBundle;
  condenser: ComponentBundle;
}

export interface SimulationOutput {
  result: EquilibriumResult;
  recommendations: Recommendation[];
  warnings: string[];
}

export class SimulationError extends Error {}

export function runSimulation(input: SimulationInput): SimulationOutput {
  const warnings: string[] = [];

  // Validações básicas
  if (!(input.tAirEvap > input.tEvapTarget)) {
    throw new SimulationError(
      "Temperatura do ar no evaporador deve ser maior que a temperatura de evaporação alvo.",
    );
  }
  if (input.tAirCond < -20 || input.tAirCond > 60) {
    warnings.push("Temperatura do ar no condensador fora da faixa típica (-20 a 60 °C).");
  }

  // Compressor — coeficientes AHRI
  const coeffs = parseAhriCoefficients(input.compressor.fields["coeficientes"]);
  if (!coeffs) {
    throw new SimulationError(
      "Compressor sem coeficientes AHRI 540 válidos. Esperado JSON com 'capacity' e 'power' (10 valores cada).",
    );
  }
  const range = parseOperationalRange(input.compressor.fields["faixa_operacional"]);
  if (range) {
    if (input.tEvapTarget < range.t_evap_min || input.tEvapTarget > range.t_evap_max) {
      warnings.push(
        `T_evap alvo (${input.tEvapTarget} °C) fora da faixa operacional do compressor (${range.t_evap_min}…${range.t_evap_max} °C).`,
      );
    }
  }

  // Trocadores
  const evapHx = parseHxFromFields(input.evaporator.fields, "evaporador");
  if (!evapHx) {
    throw new SimulationError("Evaporador sem capacidade nominal ou temperaturas de referência.");
  }
  const condHx = parseHxFromFields(input.condenser.fields, "condensador");
  if (!condHx) {
    throw new SimulationError("Condensador sem capacidade nominal ou temperaturas de referência.");
  }

  const result = solveEquilibrium({
    tEvapTarget: input.tEvapTarget,
    tAirEvap: input.tAirEvap,
    tAirCond: input.tAirCond,
    compressor: {
      coeffs,
      range,
      capacityNominalW: undefined,
    },
    evaporator: {
      ua: uaFromNominal(evapHx),
      capacityNominalW: evapHx.capacityNominalW,
    },
    condenser: {
      ua: uaFromNominal(condHx),
      capacityNominalW: condHx.capacityNominalW,
    },
  });

  const recommendations = generateRecommendations(result);

  return { result, recommendations, warnings };
}

export type { AhriCoefficients, OperationalRange, Recommendation };
