import type { CircuitFlowDistributionResult } from "../../domain/types";

export interface FlowDistributionInput {
  total_mass_flow_kgs: number;
  circuits: number;
  distribution_mode?: "uniform" | "estimated_imbalance";
  imbalance_factor?: number;
}

export function calculateCircuitFlowDistribution(
  input: FlowDistributionInput,
): CircuitFlowDistributionResult {
  const warnings: string[] = [];
  const mode = input.distribution_mode ?? "uniform";
  const imbalanceFactor = input.imbalance_factor ?? 0.1;
  let circuitCount = input.circuits;

  if (circuitCount <= 0) {
    circuitCount = 1;
    warnings.push("circuits <= 0. Usando default = 1.");
  }

  if (input.total_mass_flow_kgs <= 0) {
    warnings.push("total_mass_flow_kgs ausente ou zero.");
  }

  if (imbalanceFactor > 0.3) {
    warnings.push(`imbalance_factor = ${imbalanceFactor.toFixed(2)} > 0.3. Desbalanceamento alto.`);
  }

  const baseFlow = input.total_mass_flow_kgs / circuitCount;
  const rawFlows: number[] = [];

  if (mode === "estimated_imbalance") {
    for (let i = 0; i < circuitCount; i++) {
      const factor = i % 2 === 0 ? 1 + imbalanceFactor : 1 - imbalanceFactor;
      rawFlows.push(baseFlow * factor);
    }

    const rawSum = rawFlows.reduce((s, v) => s + v, 0);
    const normFactor = rawSum > 0 ? input.total_mass_flow_kgs / rawSum : 1;
    for (let i = 0; i < rawFlows.length; i++) {
      rawFlows[i] *= normFactor;
    }
  } else {
    for (let i = 0; i < circuitCount; i++) {
      rawFlows.push(baseFlow);
    }
  }

  const minFlow = 0.001;
  const circuit_flows = rawFlows.map((flow, idx) => {
    if (flow < minFlow && input.total_mass_flow_kgs > 0) {
      warnings.push(`Circuito ${idx}: vazão muito baixa (${flow.toFixed(6)} kg/s).`);
    }
    return {
      circuit_index: idx,
      mass_flow_kgs: flow,
      flow_fraction: input.total_mass_flow_kgs > 0 ? flow / input.total_mass_flow_kgs : 0,
    };
  });

  return {
    circuit_flows,
    total_mass_flow_kgs: input.total_mass_flow_kgs,
    circuits: circuitCount,
    distribution_mode: mode,
    imbalance_factor: imbalanceFactor,
    warnings,
  };
}
