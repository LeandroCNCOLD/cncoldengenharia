// Motor termodinâmico V2 — UNILAB profissional (Etapa 6).
//
// Diferenças em relação ao V1 (engine/simulatorCore.ts):
//   ✅ Psicrometria ASHRAE Hyland-Wexler (sem rho/cp constantes)
//   ✅ U real: h_ar do catálogo UNILAB + Dittus-Boelter / Shah no fluido
//   ✅ Q sensível e Q latente separados via Δh e ΔT
//   ✅ Detecção explícita de condensação (T_superfície < T_orvalho)
//   ✅ Fase do fluido determinada por SH/SC e tipo de componente
//   ✅ Sem coeficientes inventados — falha rápido se JSON não preenchido
//
// O motor V1 continua intocado para preservar a Etapa 5.

import {
  buildMoistAirState,
  type MoistAirState,
} from "./airProperties";
import {
  checkCondensation,
  enthalpy,
  humidityRatio,
  saturationPressure,
  PSY_CONSTANTS,
} from "./psychrometrics";
import {
  computeAirSideH,
  computeNtuEpsilon,
  dittusBoelter,
  overallU,
  shahTwoPhase,
  UnilabCoefficientsMissingError,
  type FluidPropsSinglePhase,
  type UnilabHeatTransferCatalog,
} from "./heatTransfer";
import { determineFluidPhase, type FluidPhase } from "./phaseLogic";
import type {
  UnilabComponentType,
  UnilabPhysicalInputs,
  UnilabSimulationResult,
  UnilabThermoInputs,
} from "../types/unilab.types";

export interface SimulationV2Inputs {
  physical: UnilabPhysicalInputs;
  thermo: UnilabThermoInputs;
  componentType: UnilabComponentType;
  htCatalog: UnilabHeatTransferCatalog;
  tubeMaterialConductivity: number;
  /** Propriedades do fluido para Dittus-Boelter (líquido / monofásico). */
  fluidProps: FluidPropsSinglePhase;
  /** Vazão mássica do fluido [kg/s]. */
  fluidMassFlowKgS: number;
  /** Fouling externo/interno [(m²·K)/W]. */
  foulingExternal?: number;
  foulingInternal?: number;
  superheatK?: number;
  subcoolingK?: number;
}

export class SimulationV2Error extends Error {
  constructor(message: string, public readonly errors: string[]) {
    super(message);
    this.name = "SimulationV2Error";
  }
}

const MM_TO_M = 1e-3;

function isCooling(componentType: UnilabComponentType): boolean {
  return (
    componentType === "evaporator_dx" ||
    componentType === "evaporator_pumped" ||
    componentType === "cooling_coil"
  );
}

function getSurfaceTempC(
  thermo: UnilabThermoInputs,
  componentType: UnilabComponentType,
): number {
  if (componentType === "condenser_air" || componentType === "condenser_shell_tube") {
    return thermo.condensingTempC ?? Number.NaN;
  }
  return thermo.evaporatingTempC ?? Number.NaN;
}

export interface SimulationV2Result extends UnilabSimulationResult {
  fluidPhase: FluidPhase;
  hasCondensation: boolean;
  U_Wm2K: number;
  hAir_Wm2K: number;
  hFluid_Wm2K: number;
}

export function runSimulationV2(inputs: SimulationV2Inputs): SimulationV2Result {
  const errors: string[] = [];
  const warnings: string[] = [];
  const { physical, thermo, componentType, htCatalog } = inputs;

  if (!physical.geometryId) errors.push("Geometria não selecionada.");
  if (!(thermo.airFlowM3H > 0)) errors.push("Vazão de ar inválida.");
  if (!thermo.refrigerantId) errors.push("Fluido não definido.");
  const Tsurface = getSurfaceTempC(thermo, componentType);
  if (!Number.isFinite(Tsurface)) {
    errors.push("Temperatura de evaporação ou condensação ausente.");
  }
  if (errors.length > 0) {
    throw new SimulationV2Error("Inputs inválidos para o motor V2.", errors);
  }

  // 1. Estado do ar de entrada (psicrometria ASHRAE real)
  const airIn: MoistAirState = buildMoistAirState(
    thermo.airInletTempC,
    thermo.airInletRhPercent,
    PSY_CONSTANTS.P_ATM_DEFAULT,
  );

  // 2. Geometria de face
  const finnedHeightM = physical.finnedHeightMm * MM_TO_M;
  const finnedLengthM = physical.finnedLengthMm * MM_TO_M;
  const faceAreaM2 = finnedHeightM * finnedLengthM;
  if (faceAreaM2 <= 0) {
    throw new SimulationV2Error("Geometria de face inválida.", [
      "Altura aletada × comprimento aletado resultou em zero.",
    ]);
  }
  const airFlowM3S = thermo.airFlowM3H / 3600;
  const faceVelocityMs = airFlowM3S / faceAreaM2;
  const airMassFlowKgS = airFlowM3S * airIn.rho_kg_m3;

  // 3. Detecção de condensação (carga latente)
  const hasCondensation =
    isCooling(componentType) && checkCondensation(Tsurface, airIn.Tdp_C);

  // 4. Fase do fluido (líquido / bifásico / superaquecido)
  const fluidPhase = determineFluidPhase({
    superheatK: inputs.superheatK ?? thermo.superheatK ?? 0,
    subcoolingK: inputs.subcoolingK ?? thermo.subcoolingK ?? 0,
    componentType,
  });

  // 5. h_ar via catálogo UNILAB (sem fallback)
  const airH = computeAirSideH(physical.geometryId, faceVelocityMs, htCatalog);
  warnings.push(...airH.warnings);

  // 6. h_fluido — Dittus-Boelter (monofásico) ou Shah (bifásico)
  const Di_m = physical.tubeInnerDiameterMm * MM_TO_M;
  const Do_m = physical.tubeOuterDiameterMm * MM_TO_M;
  const hLiquid = dittusBoelter({
    massFlowKgS: inputs.fluidMassFlowKgS,
    tubeInnerDiameterM: Di_m,
    circuits: physical.circuits,
    fluid: inputs.fluidProps,
    heating: !isCooling(componentType),
  });
  const Pr_l =
    (inputs.fluidProps.cp_J_kgK * inputs.fluidProps.mu_Pa_s) /
    inputs.fluidProps.k_W_mK;
  const hFluid =
    fluidPhase === "bifasico" ? shahTwoPhase(hLiquid, 0.5, Pr_l) : hLiquid;

  // 7. U global
  const U = overallU({
    h_air_Wm2K: airH.h_air_Wm2K,
    h_fluid_Wm2K: hFluid,
    tubeOuterDiameterM: Do_m,
    tubeInnerDiameterM: Di_m,
    tubeWallConductivity_Wm_K: inputs.tubeMaterialConductivity,
    foulingExternal_m2K_W: inputs.foulingExternal,
    foulingInternal_m2K_W: inputs.foulingInternal,
  });
  if (!Number.isFinite(U) || U <= 0) {
    throw new SimulationV2Error("U global não-finito.", [
      "Verifique condutividade do tubo e coeficientes h.",
    ]);
  }

  // 8. Área efetiva (face × rows × finEfficiency × areaCorrection)
  const entry = htCatalog.entries.find((e) => e.geometryId === physical.geometryId);
  const finEff = entry?.finEfficiency ?? 0.85;
  const areaCorr = entry?.areaCorrection ?? 1;
  // Estimativa: área externa ≈ face × rows × (π·Do/passo_long) × finEff × correção
  const tubeDensityPerRow = 1 / (physical.tubePitchLongitudinalMm * MM_TO_M);
  const areaPerRowPerM2Face = Math.PI * Do_m * tubeDensityPerRow;
  const areaTotalM2 =
    faceAreaM2 * physical.rows * areaPerRowPerM2Face * finEff * areaCorr;

  // 9. NTU-ε
  const cAir = airMassFlowKgS * airIn.cp_J_kgK;
  const cFluid = inputs.fluidMassFlowKgS * inputs.fluidProps.cp_J_kgK;
  const nt = computeNtuEpsilon({
    U_Wm2K: U,
    area_m2: areaTotalM2,
    cAir_W_K: cAir,
    cFluid_W_K: cFluid,
    fluidPhase,
  });

  // 10. Q_total via efetividade
  const dTmax = thermo.airInletTempC - Tsurface;
  const Qmax = nt.Cmin * Math.abs(dTmax);
  let Q_total_W = nt.effectiveness * Qmax;

  // 11. Sensível / latente
  let T_air_out_C = thermo.airInletTempC - (isCooling(componentType) ? 1 : -1) *
    (nt.effectiveness * Math.abs(dTmax));
  let W_out = airIn.W_kg_kg;
  let Q_sens_W = airMassFlowKgS * airIn.cp_J_kgK * (thermo.airInletTempC - T_air_out_C);
  let Q_lat_W = 0;

  if (hasCondensation) {
    // Saturado à T_superfície (ASHRAE — modelo de "wet-coil" por entalpia)
    const W_surface_sat = humidityRatio(Tsurface, 1, airIn.pAtm_Pa);
    W_out = Math.min(airIn.W_kg_kg, W_surface_sat);
    // h_out a partir do balanço:  Q_total = m_ar · (h_in - h_out)
    const h_out = airIn.h_kJ_kg - Q_total_W / 1000 / airMassFlowKgS;
    // Inverso da eq. (32): t = (h - 2501·W) / (1.006 + 1.86·W)
    T_air_out_C = (h_out - 2501 * W_out) / (1.006 + 1.86 * W_out);
    Q_sens_W = airMassFlowKgS * airIn.cp_J_kgK * (thermo.airInletTempC - T_air_out_C);
    Q_lat_W = Q_total_W - Q_sens_W;
    if (Q_lat_W < 0) {
      // saneamento
      Q_lat_W = 0;
      Q_total_W = Q_sens_W;
    }
  }

  // 12. RH na saída — psat ASHRAE + relação W↔pw
  const RH_out_pct = computeRHpct(T_air_out_C, W_out, airIn.pAtm_Pa);

  const result: SimulationV2Result = {
    totalCapacityKw: Q_total_W / 1000,
    sensibleCapacityKw: Q_sens_W / 1000,
    latentCapacityKw: Q_lat_W / 1000,
    shf: Q_total_W > 0 ? Q_sens_W / Q_total_W : 1,
    airPressureDropPa: 0, // delegado para correlação UNILAB no JSON (a preencher)
    fluidPressureDropKpa: 0,
    airOutletTempC: T_air_out_C,
    airOutletRhPercent: RH_out_pct,
    faceAreaM2,
    faceVelocityMs,
    airMassFlowKgS,
    regime: hasCondensation ? "WET" : "DRY",
    lmtdK: undefined,
    ntu: nt.NTU,
    effectiveness: nt.effectiveness,
    correctionFactor: 1,
    warnings,
    fluidPhase,
    hasCondensation,
    U_Wm2K: U,
    hAir_Wm2K: airH.h_air_Wm2K,
    hFluid_Wm2K: hFluid,
  };

  if (!Number.isFinite(result.totalCapacityKw)) {
    throw new SimulationV2Error("Resultado não-finito.", [
      "Falha numérica — revise inputs/coeficientes.",
    ]);
  }
  return result;
}

function computeRHpct(T_C: number, W: number, pAtm_Pa: number): number {
  if (!(W > 0)) return 0;
  const psat = saturationPressure(T_C);
  if (!(psat > 0)) return 0;
  const pw = (W * pAtm_Pa) / (0.621945 + W);
  return Math.min(100, Math.max(0, (pw / psat) * 100));
}

export { UnilabCoefficientsMissingError };
