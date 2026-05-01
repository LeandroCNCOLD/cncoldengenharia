import type { CircuitPerformanceResult, CircuitAggregationResult } from "../../domain/types";

export function aggregateCircuitResults(
  results: CircuitPerformanceResult[],
): CircuitAggregationResult {
  const warnings: string[] = [];

  if (results.length === 0) {
    warnings.push("Nenhum resultado de circuito para agregar.");
    return {
      average_h_w_m2k: 0,
      min_h_w_m2k: 0,
      max_h_w_m2k: 0,
      average_reynolds: 0,
      min_reynolds: 0,
      max_reynolds: 0,
      average_velocity_m_s: 0,
      min_velocity_m_s: 0,
      max_velocity_m_s: 0,
      max_pressure_drop_kpa: 0,
      average_pressure_drop_kpa: 0,
      limiting_circuit_index: 0,
      warnings,
    };
  }

  const n = results.length;

  const hValues = results.map((r) => r.h_w_m2k);
  const reValues = results.map((r) => r.reynolds);
  const velValues = results.map((r) => r.velocity_m_s);
  const dpValues = results.map((r) => r.pressure_drop_kpa);

  const min_h = Math.min(...hValues);
  const max_h = Math.max(...hValues);
  const avg_h = hValues.reduce((s, v) => s + v, 0) / n;

  const min_re = Math.min(...reValues);
  const max_re = Math.max(...reValues);
  const avg_re = reValues.reduce((s, v) => s + v, 0) / n;

  const min_vel = Math.min(...velValues);
  const max_vel = Math.max(...velValues);
  const avg_vel = velValues.reduce((s, v) => s + v, 0) / n;

  const max_dp = Math.max(...dpValues);
  const avg_dp = dpValues.reduce((s, v) => s + v, 0) / n;

  let limitingIdx = 0;
  let limitingH = hValues[0]!;
  for (let i = 1; i < n; i++) {
    if (hValues[i]! < limitingH) {
      limitingH = hValues[i]!;
      limitingIdx = results[i]!.circuit_index;
    }
  }

  if (max_h > 0 && (max_h - min_h) / max_h > 0.2) {
    warnings.push(
      `Diferença entre max_h (${max_h.toFixed(1)}) e min_h (${min_h.toFixed(1)}) > 20%.`,
    );
  }

  for (const r of results) {
    if (r.flow_regime === "laminar") {
      warnings.push(`Circuito ${r.circuit_index}: regime laminar (Re = ${r.reynolds.toFixed(0)}).`);
    }
    if (r.velocity_m_s < 0.1 && r.mass_flow_kgs > 0) {
      warnings.push(
        `Circuito ${r.circuit_index}: velocidade muito baixa (${r.velocity_m_s.toFixed(3)} m/s).`,
      );
    }
    if (r.velocity_m_s > 3.0) {
      warnings.push(
        `Circuito ${r.circuit_index}: velocidade muito alta (${r.velocity_m_s.toFixed(2)} m/s).`,
      );
    }
  }

  return {
    average_h_w_m2k: avg_h,
    min_h_w_m2k: min_h,
    max_h_w_m2k: max_h,
    average_reynolds: avg_re,
    min_reynolds: min_re,
    max_reynolds: max_re,
    average_velocity_m_s: avg_vel,
    min_velocity_m_s: min_vel,
    max_velocity_m_s: max_vel,
    max_pressure_drop_kpa: max_dp,
    average_pressure_drop_kpa: avg_dp,
    limiting_circuit_index: limitingIdx,
    warnings,
  };
}
