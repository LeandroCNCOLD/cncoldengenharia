/**
 * applicationValidationService.ts
 *
 * Valida o sistema completo (compressor + evaporador + condensador)
 * e calcula COP total, alertas e status.
 */
import type {
  SystemValidationInput,
  SystemValidationResult,
  SystemAlert,
} from "../types/application-engineering.types";

export function validateSystem(
  input: SystemValidationInput,
): SystemValidationResult {
  const alerts: SystemAlert[] = [];
  const warnings: string[] = [];

  const { compressor, evaporator, condenser, required_capacity_w } = input;

  // ── COP do sistema ────────────────────────────────────────────────────────
  const copSystem =
    compressor.power_w > 0
      ? evaporator.capacity_w / compressor.power_w
      : 0;

  // ── Razão de cobertura ────────────────────────────────────────────────────
  const coverageRatio =
    required_capacity_w > 0
      ? evaporator.capacity_w / required_capacity_w
      : 1;

  // ── Calor total rejeitado ─────────────────────────────────────────────────
  const totalHeatRejectionW = evaporator.capacity_w + compressor.power_w;

  // ── Alertas ───────────────────────────────────────────────────────────────

  // Subdimensionamento do evaporador
  if (coverageRatio < 0.90) {
    alerts.push({
      code: "EVAP_UNDERSIZED",
      severity: "critical",
      message: `Evaporador subdimensionado: capacidade=${(evaporator.capacity_w / 1000).toFixed(2)} kW vs requerido=${(required_capacity_w / 1000).toFixed(2)} kW (${(coverageRatio * 100).toFixed(1)}%).`,
      recommendation: "Aumente o número de filas, comprimento ou vazão de ar do evaporador.",
    });
  } else if (coverageRatio < 0.97) {
    alerts.push({
      code: "EVAP_MARGINAL",
      severity: "warning",
      message: `Evaporador com margem baixa: ${(coverageRatio * 100).toFixed(1)}% da capacidade requerida.`,
      recommendation: "Considere aumentar levemente a geometria para garantir margem de segurança.",
    });
  }

  // Superdimensionamento excessivo
  if (coverageRatio > 1.30) {
    alerts.push({
      code: "EVAP_OVERSIZED",
      severity: "info",
      message: `Evaporador superdimensionado: ${(coverageRatio * 100).toFixed(1)}% da capacidade requerida.`,
      recommendation: "Considere reduzir a geometria para otimizar custo.",
    });
  }

  // COP baixo
  if (copSystem < 1.5) {
    alerts.push({
      code: "LOW_COP",
      severity: "warning",
      message: `COP do sistema baixo: ${copSystem.toFixed(2)}. Verifique ponto de operação.`,
      recommendation: "Revise Te e Tc — diferença excessiva reduz eficiência.",
    });
  }

  // Condensador subdimensionado
  const condCoverageRatio =
    totalHeatRejectionW > 0
      ? condenser.heat_rejection_w / totalHeatRejectionW
      : 1;

  if (condCoverageRatio < 0.90) {
    alerts.push({
      code: "COND_UNDERSIZED",
      severity: "critical",
      message: `Condensador subdimensionado: rejeita ${(condenser.heat_rejection_w / 1000).toFixed(2)} kW vs necessário ${(totalHeatRejectionW / 1000).toFixed(2)} kW.`,
      recommendation: "Aumente filas, comprimento ou vazão de ar do condensador.",
    });
  }

  // Velocidade do ar no evaporador alta (risco de arraste)
  if (evaporator.face_velocity_ms > 4.0) {
    alerts.push({
      code: "EVAP_HIGH_VELOCITY",
      severity: "warning",
      message: `Velocidade do ar no evaporador alta: ${evaporator.face_velocity_ms.toFixed(2)} m/s.`,
      recommendation: "Reduza a velocidade para < 4 m/s para evitar arraste de gotículas.",
    });
  }

  // Compressor fora do envelope
  if (compressor.status === "out_of_envelope" || compressor.status === "clamped") {
    alerts.push({
      code: "COMPRESSOR_OUT_OF_ENVELOPE",
      severity: "warning",
      message: `Compressor operando fora do envelope nominal (status: ${compressor.status}).`,
      recommendation: "Revise o ponto de operação ou selecione outro compressor.",
    });
  }

  // Propagar warnings dos subsistemas
  compressor.warnings.forEach((w) => warnings.push(`[Compressor] ${w}`));
  evaporator.warnings.forEach((w) => warnings.push(`[Evaporador] ${w}`));
  condenser.warnings.forEach((w) => warnings.push(`[Condensador] ${w}`));

  // ── Status geral ──────────────────────────────────────────────────────────
  const hasCritical = alerts.some((a) => a.severity === "critical");
  const hasWarning = alerts.some((a) => a.severity === "warning");
  const status = hasCritical ? "critical" : hasWarning ? "warning" : "ok";

  return {
    cop_system: copSystem,
    cop_compressor: compressor.cop_compressor,
    effective_capacity_w: evaporator.capacity_w,
    total_heat_rejection_w: totalHeatRejectionW,
    coverage_ratio: coverageRatio,
    status,
    alerts,
    warnings,
  };
}
