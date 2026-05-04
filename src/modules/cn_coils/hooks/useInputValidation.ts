/**
 * Feature A — Validação de Completude dos Inputs
 * Valida inputs dos workspaces antes de executar cálculos.
 */

import { useMemo } from "react";
import type { CycleSystemConfig } from "../engines/cycle/cycleTypes";
import type { CondenserInputs } from "./useCondenserSimulation";
import type { CompressorWorkspaceInputs } from "./useCompressorEnvelopeGenerator";

// ── Tipos ────────────────────────────────────────────────────────────────────

export type ValidationResult = {
  isValid: boolean;
  errors: string[];
  warnings: string[];
};

// ── Funções de validação ─────────────────────────────────────────────────────

export function validateCycleInputs(inputs: CycleSystemConfig): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Geometria do evaporador
  const evap = inputs.evaporator?.physical;
  if (evap) {
    if (!evap.finnedHeightMm || evap.finnedHeightMm <= 0)
      errors.push("Geometria: altura do aletado deve ser > 0 mm.");
    if (!evap.finnedLengthMm || evap.finnedLengthMm <= 0)
      errors.push("Geometria: comprimento do aletado deve ser > 0 mm.");
    if (!evap.finPitchMm || evap.finPitchMm <= 0)
      errors.push("Geometria: passo de aleta deve ser > 0 mm.");
    if (!evap.tubeExternalDiameterMm || evap.tubeExternalDiameterMm <= 0)
      errors.push("Geometria: diâmetro externo do tubo deve ser > 0 mm.");
    if (!evap.rows || evap.rows <= 0)
      errors.push("Geometria: número de fileiras deve ser > 0.");
  } else {
    errors.push("Geometria do evaporador não definida.");
  }

  // Lado do ar
  const airFlow = inputs.evaporator?.airFlowM3H;
  const Tdb = inputs.evaporator?.airInletTempC;
  if (!airFlow || airFlow <= 0)
    errors.push("Ventilação: vazão de ar deve ser > 0 m³/h.");
  if (Tdb === undefined || Tdb < -40 || Tdb > 60)
    errors.push("Ventilação: temperatura de entrada do ar deve estar entre -40 °C e 60 °C.");

  // Lado do fluido
  const Te = inputs.solver?.Te_initial_C ?? -10;
  const Tc = inputs.solver?.Tc_initial_C ?? 40;
  const SH = inputs.evaporator?.superheatK ?? 0;
  const SC = inputs.condenser?.subcoolingK ?? 0;

  if (Te >= Tc)
    errors.push(`Fluido: temperatura de evaporação (${Te} °C) deve ser menor que a de condensação (${Tc} °C).`);
  if (SH < 0)
    errors.push("Fluido: superaquecimento não pode ser negativo.");
  if (SC < 0)
    errors.push("Fluido: subresfriamento não pode ser negativo.");
  if (SH > 30)
    warnings.push(`Fluido: superaquecimento elevado (${SH} K). Verifique se é intencional.`);
  if (Tc - Te < 10)
    warnings.push(`Fluido: diferença Te-Tc muito pequena (${Tc - Te} K). Pode indicar erro de entrada.`);

  return { isValid: errors.length === 0, errors, warnings };
}

export function validateCondenserInputs(inputs: CondenserInputs): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!inputs.Tc || inputs.Tc <= -50)
    errors.push("Condensador: temperatura de condensação inválida.");
  if (inputs.Tair_in === undefined || inputs.Tair_in < -20 || inputs.Tair_in > 55)
    errors.push("Condensador: temperatura ambiente deve estar entre -20 °C e 55 °C.");
  if (inputs.Tc !== undefined && inputs.Tair_in !== undefined && inputs.Tc <= inputs.Tair_in + 5)
    errors.push(
      `Condensador: Tc (${inputs.Tc} °C) deve ser pelo menos 5 °C acima de Tamb (${inputs.Tair_in} °C).`,
    );
  if (inputs.subcooling !== undefined && inputs.subcooling < 0)
    errors.push("Condensador: subresfriamento não pode ser negativo.");
  if (inputs.fanCount !== undefined && inputs.fanCount <= 0)
    errors.push("Condensador: número de ventiladores deve ser > 0.");

  return { isValid: errors.length === 0, errors, warnings };
}

export function validateCompressorInputs(inputs: CompressorWorkspaceInputs): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!inputs.compressorId || inputs.compressorId.trim() === "")
    errors.push("Compressor: nenhum compressor selecionado.");
  if (inputs.Te_C >= inputs.Tc_C)
    errors.push(
      `Compressor: Te (${inputs.Te_C} °C) deve ser menor que Tc (${inputs.Tc_C} °C).`,
    );
  if (inputs.Te_C < -50 || inputs.Te_C > 20)
    errors.push("Compressor: temperatura de evaporação fora do intervalo válido (-50 a 20 °C).");
  if (inputs.Tc_C < 20 || inputs.Tc_C > 70)
    errors.push("Compressor: temperatura de condensação fora do intervalo válido (20 a 70 °C).");
  if (inputs.Tsuperheating_K < 0)
    errors.push("Compressor: superaquecimento não pode ser negativo.");
  if (inputs.Tsubcooling_K < 0)
    errors.push("Compressor: subresfriamento não pode ser negativo.");

  return { isValid: errors.length === 0, errors, warnings };
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useInputValidation(
  inputs: unknown,
  type: "cycle" | "condenser" | "compressor",
): ValidationResult {
  return useMemo(() => {
    try {
      if (type === "cycle") return validateCycleInputs(inputs as CycleSystemConfig);
      if (type === "condenser") return validateCondenserInputs(inputs as CondenserInputs);
      if (type === "compressor") return validateCompressorInputs(inputs as CompressorWorkspaceInputs);
    } catch {
      // inputs malformados — retorna inválido sem travar
    }
    return { isValid: false, errors: ["Inputs inválidos ou incompletos."], warnings: [] };
  }, [inputs, type]);
}

// ── Componente ValidationBanner ───────────────────────────────────────────────
// Exportado como JSX — importar em arquivos .tsx

export type { ValidationResult as ValidationResultType };
