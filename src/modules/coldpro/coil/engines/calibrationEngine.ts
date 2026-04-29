/**
 * Calibração fina auditável para o motor híbrido.
 *
 * Regras críticas:
 *   1. Calibração é apenas ajuste fino — fatores devem ficar em [0.7, 1.3].
 *   2. Calibração só é aplicada se a `modelSignature` bater exatamente.
 *   3. Calibração nunca é aplicada duas vezes (responsabilidade do engine).
 *   4. Calibração nunca pode mascarar erro estrutural — fora da faixa
 *      vira `needs_review` e gera warning explícito.
 */
import type {
  CalibrationStatus,
  CoilCalculationInput,
  CoilCalculationResult,
  CoilCalibration,
} from './types';
import { simulateHybridCoil } from './hybridCoilEngine';

const FACTOR_MIN = 0.7;
const FACTOR_MAX = 1.3;
// Limite duro: além disso a calibração estaria mascarando erro estrutural.
const HARD_MIN = 0.3;
const HARD_MAX = 3.0;

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

// ============================================================================
// Compatibilidade
// ============================================================================

export function isCalibrationCompatible(
  calibration: CoilCalibration | null | undefined,
  currentSignature: string,
): boolean {
  if (!calibration) return false;
  if (!calibration.modelSignature) return false;
  return calibration.modelSignature === currentSignature;
}

// ============================================================================
// Validação dos fatores
// ============================================================================

export interface CalibrationFactorValidation {
  withinFineRange: boolean;
  warnings: string[];
}

export function validateCalibrationFactors(c: CoilCalibration): CalibrationFactorValidation {
  const warnings: string[] = [];
  const checks: Array<[string, number | undefined]> = [
    ['capacityCorrectionFactor', c.capacityCorrectionFactor],
    ['airPressureDropFactor', c.airPressureDropFactor],
    ['refrigerantPressureDropFactor', c.refrigerantPressureDropFactor],
    ['heatTransferFactor', c.heatTransferFactor],
  ];
  let withinFineRange = true;
  for (const [name, value] of checks) {
    if (value == null) continue;
    if (value < FACTOR_MIN || value > FACTOR_MAX) {
      withinFineRange = false;
      warnings.push(
        `Fator ${name}=${value.toFixed(2)} fora da faixa de ajuste fino [${FACTOR_MIN}, ${FACTOR_MAX}]. ` +
          'Verifique área, correlação, fatores Unilab ou dados do datasheet.',
      );
    }
  }
  return { withinFineRange, warnings };
}

// ============================================================================
// Aplicação de calibração (pós-processamento, idempotente)
// ============================================================================

export interface ApplyCalibrationOutput {
  result: CoilCalculationResult;
  applied: boolean;
  compatible: boolean;
  warnings: string[];
}

/**
 * Aplica fatores de calibração a um resultado já calculado SEM calibração.
 * Use só quando o engine não aplicou a calibração internamente.
 *
 * - Não aplica se incompatível.
 * - Não aplica duas vezes — exige `result.calibrationApplied === false`.
 */
export function applyCalibration(
  result: CoilCalculationResult,
  calibration: CoilCalibration | null | undefined,
): ApplyCalibrationOutput {
  const warnings: string[] = [];
  const compatible = isCalibrationCompatible(calibration, result.modelSignature);

  if (!calibration) {
    return { result, applied: false, compatible: false, warnings };
  }
  if (!compatible) {
    warnings.push('Calibração incompatível com a versão atual do modelo. Recalibre o componente.');
    return { result, applied: false, compatible: false, warnings };
  }
  if (result.calibrationApplied) {
    warnings.push('Calibração já aplicada — bloqueando segunda aplicação.');
    return { result, applied: false, compatible: true, warnings };
  }

  const { withinFineRange, warnings: factorWarnings } = validateCalibrationFactors(calibration);
  warnings.push(...factorWarnings);

  const cap = calibration.capacityCorrectionFactor ?? 1;
  const fa = calibration.airPressureDropFactor ?? 1;
  const fr = calibration.refrigerantPressureDropFactor ?? 1;

  const calibratedResult: CoilCalculationResult = {
    ...result,
    capacityW: result.capacityW * cap,
    capacityKcalh: result.capacityKcalh * cap,
    airPressureDropPa:
      result.airPressureDropPa != null ? result.airPressureDropPa * fa : null,
    refrigerantPressureDropKpa:
      result.refrigerantPressureDropKpa != null ? result.refrigerantPressureDropKpa * fr : null,
    calibrationApplied: true,
    calibrationCompatible: true,
    calibrationId: calibration.calibrationId ?? calibration.id,
    calibrationStatus: withinFineRange ? (calibration.status ?? 'calibrated') : 'needs_review',
    calibrationWarnings: [...(result.calibrationWarnings ?? []), ...warnings],
    warnings: [...result.warnings, ...warnings],
  };

  return { result: calibratedResult, applied: true, compatible: true, warnings };
}

// ============================================================================
// Construção de uma calibração a partir do datasheet Unilab
// ============================================================================

export interface DatasheetReference {
  capacityW: number;
  airPressureDropPa?: number;
  refrigerantPressureDropKpa?: number;
  label?: string;
}

export interface CalibrationDeviation {
  capacityPct?: number;
  airDpPct?: number;
  refDpPct?: number;
}

export interface CalibrationOutcome {
  status: CalibrationStatus;
  confidenceScore: number;
  meetsTargets: boolean;
  factors: Required<
    Pick<
      CoilCalibration,
      | 'capacityCorrectionFactor'
      | 'airPressureDropFactor'
      | 'refrigerantPressureDropFactor'
      | 'heatTransferFactor'
    >
  >;
  modelSignature: string;
  engineName: string;
  engineVersion: string;
  deviationBefore: CalibrationDeviation;
  deviationAfter: CalibrationDeviation;
  resultBefore: CoilCalculationResult;
  resultAfter: CoilCalculationResult;
  reference: DatasheetReference;
  warnings: string[];
}

function pctDeviation(actual: number | null | undefined, expected: number | undefined): number | undefined {
  if (actual == null || expected == null || expected === 0) return undefined;
  return ((actual - expected) / expected) * 100;
}

/**
 * Calibra o motor híbrido contra um ponto do datasheet Unilab.
 *
 * Fluxo:
 *   1. Roda motor SEM calibração → baseline
 *   2. Calcula desvios vs datasheet
 *   3. Deriva fatores limitados a [0.3, 3.0] (clamp duro só para impedir NaN/explosão;
 *      faixa "fina" [0.7, 1.3] é apenas de qualidade, não de bloqueio)
 *   4. Roda motor com calibração → resultado calibrado
 *   5. Mede desvio pós-calibração
 *   6. Determina status e confiança
 */
export function calibrateAgainstUnilabDatasheet(
  input: CoilCalculationInput,
  reference: DatasheetReference,
): CalibrationOutcome {
  const neutral: CoilCalculationInput = { ...input, calibration: null };
  const baseline = simulateHybridCoil(neutral);

  // Bloqueio de erro estrutural: se baseline diverge >30%, sinalizar.
  const capDevBefore = pctDeviation(baseline.capacityW, reference.capacityW) ?? 0;
  const structuralWarning: string[] = [];
  if (Math.abs(capDevBefore) > 30) {
    structuralWarning.push(
      `Erro estrutural ${capDevBefore.toFixed(1)}% antes da calibração. ` +
        'Calibração não corrige erro estrutural — revise área, correlação ou fatores Unilab.',
    );
  }

  const factors = {
    capacityCorrectionFactor: clamp(
      reference.capacityW / Math.max(baseline.capacityW, 1e-6),
      HARD_MIN,
      HARD_MAX,
    ),
    airPressureDropFactor:
      reference.airPressureDropPa != null && baseline.airPressureDropPa
        ? clamp(reference.airPressureDropPa / baseline.airPressureDropPa, HARD_MIN, HARD_MAX)
        : 1,
    refrigerantPressureDropFactor:
      reference.refrigerantPressureDropKpa != null && baseline.refrigerantPressureDropKpa
        ? clamp(
            reference.refrigerantPressureDropKpa / baseline.refrigerantPressureDropKpa,
            HARD_MIN,
            HARD_MAX,
          )
        : 1,
    heatTransferFactor: 1,
  };
  // Espelha o ajuste de capacidade no fator de troca térmica (mesma fonte do erro).
  factors.heatTransferFactor = factors.capacityCorrectionFactor;

  const calibration: CoilCalibration = {
    ...factors,
    modelSignature: baseline.modelSignature,
    engineName: baseline.engine,
    engineVersion: 'v1',
    status: 'draft',
  };

  const factorValidation = validateCalibrationFactors(calibration);

  const calibrated = simulateHybridCoil({ ...input, calibration });
  const capDevAfter = pctDeviation(calibrated.capacityW, reference.capacityW) ?? 0;
  const airDpDevAfter = pctDeviation(calibrated.airPressureDropPa, reference.airPressureDropPa);
  const refDpDevAfter = pctDeviation(
    calibrated.refrigerantPressureDropKpa,
    reference.refrigerantPressureDropKpa,
  );

  const meetsCapacity = Math.abs(capDevAfter) <= 5;
  const meetsAirDp = airDpDevAfter == null ? true : Math.abs(airDpDevAfter) <= 10;
  const meetsRefDp = refDpDevAfter == null ? true : Math.abs(refDpDevAfter) <= 15;
  const meetsTargets =
    meetsCapacity && meetsAirDp && meetsRefDp && factorValidation.withinFineRange;

  let status: CalibrationStatus;
  let confidenceScore: number;
  if (meetsTargets) {
    status = 'calibrated';
    confidenceScore = 0.85;
  } else {
    status = 'needs_review';
    confidenceScore = 0.7;
  }

  const warnings = [...structuralWarning, ...factorValidation.warnings];
  if (!meetsCapacity) {
    warnings.push(
      `Capacidade pós-calibração diverge ${capDevAfter.toFixed(1)}% do datasheet (limite ±5%).`,
    );
  }
  if (airDpDevAfter != null && !meetsAirDp) {
    warnings.push(`ΔP ar pós-calibração diverge ${airDpDevAfter.toFixed(1)}% (limite ±10%).`);
  }
  if (refDpDevAfter != null && !meetsRefDp) {
    warnings.push(
      `ΔP refrigerante pós-calibração diverge ${refDpDevAfter.toFixed(1)}% (limite ±15%).`,
    );
  }

  return {
    status,
    confidenceScore,
    meetsTargets,
    factors,
    modelSignature: baseline.modelSignature,
    engineName: baseline.engine,
    engineVersion: 'v1',
    deviationBefore: {
      capacityPct: capDevBefore,
      airDpPct: pctDeviation(baseline.airPressureDropPa, reference.airPressureDropPa),
      refDpPct: pctDeviation(
        baseline.refrigerantPressureDropKpa,
        reference.refrigerantPressureDropKpa,
      ),
    },
    deviationAfter: {
      capacityPct: capDevAfter,
      airDpPct: airDpDevAfter,
      refDpPct: refDpDevAfter,
    },
    resultBefore: baseline,
    resultAfter: calibrated,
    reference,
    warnings,
  };
}

// ============================================================================
// Backwards-compat: alias do nome legado (usado em outras partes do app)
// ============================================================================

export const calibrateAgainstDatasheet = calibrateAgainstUnilabDatasheet;
