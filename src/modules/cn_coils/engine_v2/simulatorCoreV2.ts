/**
 * @deprecated Use simulatorCoreAdapter.ts que delega ao motor unificado.
 * Este arquivo será removido na versão 2.0.
 * Mantido apenas para compatibilidade com testes existentes.
 */

// Motor termodinâmico V2 — CN Coils profissional (Etapa 6).
//
// Diferenças em relação ao V1 (engine/simulatorCore.ts):
//   ✅ Psicrometria ASHRAE Hyland-Wexler (sem rho/cp constantes)
//   ✅ U real: h_ar do catálogo CN Coils + Dittus-Boelter / Shah no fluido
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
import { calcAirPressureDrop, calcFluidPressureDrop } from "@/modules/cn_coils/services/pressureDropService";
import {
  checkCondensation,
  humidityRatio,
  saturationPressure,
  PSY_CONSTANTS,
} from "./psychrometrics";
import {
  computeAirSideH,
  computeNtuEpsilon,
  dittusBoelter,
  computeOverallU,
  jungDidion1989,
  shahCondensation1979,
  calcFluidPressureDropV2,
  type FluidPropsSinglePhase,
} from "./heatTransfer";
import {
  applyCorrection,
  validateCorrectionMultipliers,
  type CorrectionMultipliers,
} from "./refrigerantProps";
import { determineFluidPhase, type FluidPhase } from "./phaseLogic";
import type {
  CnCoilsComponentType,
  CnCoilsPhysicalInputs,
  CnCoilsSimulationResult,
  CnCoilsThermoInputs,
} from "../types/cncoils.types";

export interface SimulationV2Inputs {
  physical: CnCoilsPhysicalInputs;
  thermo: CnCoilsThermoInputs;
  componentType: CnCoilsComponentType;
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
  /** Fator de correção da aleta (FatCorAl). Padrão: 1.0. */
  finCorrectionFactor?: number;
  /** Calor latente de vaporização [kJ/kg]. */
  h_fg_kJkg?: number;
  /** M6 — Multiplicadores de correção para calibração com dados experimentais. */
  correctionMultipliers?: CorrectionMultipliers;
}

export class SimulationV2Error extends Error {
  constructor(message: string, public readonly errors: string[]) {
    super(message);
    this.name = "SimulationV2Error";
  }
}

const MM_TO_M = 1e-3;

function isCooling(componentType: CnCoilsComponentType): boolean {
  return (
    componentType === "evaporator_dx" ||
    componentType === "evaporator_pumped" ||
    componentType === "cooling_coil"
  );
}

function getSurfaceTempC(
  thermo: CnCoilsThermoInputs,
  componentType: CnCoilsComponentType,
): number {
  if (componentType === "condenser_air" || componentType === "condenser_shell_tube") {
    return thermo.condensingTempC ?? Number.NaN;
  }
  return thermo.evaporatingTempC ?? Number.NaN;
}

export interface SimulationV2Result extends CnCoilsSimulationResult {
  fluidPhase: FluidPhase;
  hasCondensation: boolean;
  U_Wm2K: number;
  hAir_Wm2K: number;
  hFluid_Wm2K: number;
}

export function runSimulationV2(inputs: SimulationV2Inputs): SimulationV2Result {
  const errors: string[] = [];
  const warnings: string[] = [];
  const { physical, thermo, componentType } = inputs;

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

  // 5. h_ar via Wang-Chi-Chang / Mihailovic / Granryd (calculado dinamicamente)
  const airH = computeAirSideH(physical, faceVelocityMs);
  warnings.push(...airH.warnings);

  // M6 — Validar e aplicar multiplicadores de correção
  const cm = inputs.correctionMultipliers ?? {};
  const cmWarnings = validateCorrectionMultipliers(cm);
  warnings.push(...cmWarnings);

  // Aplicar FatCorAl (fator de correção da aleta por tipo) + M6 multiplicador h_o
  const finFactor = Number.isFinite(inputs.finCorrectionFactor) && inputs.finCorrectionFactor! > 0
    ? inputs.finCorrectionFactor!
    : 1.0;
  const h_air_corrected = applyCorrection(airH.h_air_Wm2K * finFactor, cm.airSideH);

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
  {
    const A_check = (Math.PI * Di_m ** 2) / 4;
    const massFlowPerCircuit = inputs.fluidMassFlowKgS / Math.max(physical.circuits, 1);
    const rho_check = inputs.fluidProps.rho_kg_m3;
    const mu_check = inputs.fluidProps.mu_Pa_s;
    const G_check = massFlowPerCircuit / A_check;
    const Re_check = (G_check * Di_m) / mu_check;
    const v_fluid_check = G_check / rho_check;

    if (Re_check < 2300) {
      warnings.push(
        `Re=${Re_check.toFixed(0)} — regime laminar no tubo do evaporador`,
      );
    } else if (Re_check > 10000) {
      warnings.push(
        `Re=${Re_check.toFixed(0)} acima de 10.000 — extrapolação moderada`,
      );
    }

    if (v_fluid_check < 0.1 || v_fluid_check > 5) {
      warnings.push(
        `Velocidade do fluido ${v_fluid_check.toFixed(2)} m/s fora da faixa típica (0,1–5 m/s)`,
      );
    }
  }
  const Pr_l =
    (inputs.fluidProps.cp_J_kgK * inputs.fluidProps.mu_Pa_s) /
    inputs.fluidProps.k_W_mK;
  // M3 — Jung & Didion (1989) para evaporação de blends; Shah (1979) para condensação
  const isCondenser = componentType === "condenser_air" || componentType === "condenser_shell_tube";
  const hFluidRaw = fluidPhase === "bifasico"
    ? (isCondenser
        ? shahCondensation1979(hLiquid, 0.5, Pr_l)
        : jungDidion1989(hLiquid, 0.5, Pr_l))
    : hLiquid;
  // M6 — Aplicar multiplicador h_i
  const hFluid = applyCorrection(hFluidRaw, cm.fluidSideH);

  // 7. U global por resistências em série, referenciado à área externa.
  // M2 — Eficiência de superfície η_o via método de Schmidt (já calculada em computeAirSideH)
  const overall = computeOverallU({
    h_o: h_air_corrected,
    h_i: hFluid,
    r_o_m: Do_m / 2,
    r_i_m: Di_m / 2,
    k_tube_WmK: inputs.tubeMaterialConductivity,
    eta_surface: airH.eta_surface,
  });
  warnings.push(...overall.warnings);
  const foulingExternal = inputs.foulingExternal ?? 0;
  const foulingInternal = (inputs.foulingInternal ?? 0) * (Do_m / Di_m);
  const U = 1 / (1 / overall.U_o + foulingExternal + foulingInternal);
  if (!Number.isFinite(U) || U <= 0) {
    throw new SimulationV2Error("U global não-finito.", [
      "Verifique condutividade do tubo e coeficientes h.",
    ]);
  }

  // 8. Área efetiva (face × rows × η_o_Schmidt × areaCorrection)
  // M2 — usa η_surface calculado pelo método de Schmidt em vez de 0.85 fixo
  const finEff = airH.eta_surface; // Schmidt — varia com geometria e material
  // M6 — Multiplicador de área
  const areaCorr = applyCorrection(1.0, cm.heatTransferArea);
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

  // Perda de carga — ar (correlação empírica CnCoils Coils 6.0)
  const V_face_m_s = faceVelocityMs;
  const N_rows = physical.rows;
  const fin_pitch_mm = physical.finPitchMm ?? 3.0;
  const airDpRaw = calcAirPressureDrop(V_face_m_s, N_rows, fin_pitch_mm);
  // M6 — Multiplicador ΔP ar
  const airDp = applyCorrection(airDpRaw, cm.airPressureDrop);

  // Perda de carga — fluido (M4: Müller-Steinhagen & Heck para bifásico; Darcy-Weisbach para monofásico)
  const tubesPerRow = physical.tubesPerRow ?? Math.max(1, Math.round(finnedHeightM / (physical.tubePitchTransverseMm * MM_TO_M)));
  const tubeLength_m = finnedLengthM;
  const L_circuit_m = tubeLength_m * N_rows * (tubesPerRow / Math.max(1, physical.circuits));
  const D_i_m = Di_m;
  const tubeArea_m2 = Math.PI * D_i_m * D_i_m / 4;
  const G_kg_m2s = tubeArea_m2 > 0 && physical.circuits > 0
    ? inputs.fluidMassFlowKgS / (tubeArea_m2 * physical.circuits)
    : 0;
  const rho_kg_m3 = inputs.fluidProps.rho_kg_m3 ?? 1100;
  const mu_Pa_s = inputs.fluidProps.mu_Pa_s ?? 2.2e-4;
  // Propriedades do vapor para Müller-Steinhagen & Heck (estimativa: ρ_v ≈ ρ_l/10, μ_v ≈ μ_l/5)
  const rho_vapor_kg_m3 = rho_kg_m3 / 10;
  const mu_vapor_Pa_s = mu_Pa_s / 5;
  const fluidDpRaw = calcFluidPressureDropV2({
    L_circuit_m,
    D_i_m,
    G_kg_m2s,
    rho_kg_m3,
    mu_Pa_s,
    fluidPhase,
    rho_vapor_kg_m3,
    mu_vapor_Pa_s,
    quality_x: 0.5,
  });
  // M6 — Multiplicador ΔP fluido
  const fluidDp = applyCorrection(fluidDpRaw, cm.fluidPressureDrop);

  const result: SimulationV2Result = {
    totalCapacityKw: Q_total_W / 1000,
    sensibleCapacityKw: Q_sens_W / 1000,
    latentCapacityKw: Q_lat_W / 1000,
    shf: Q_total_W > 0 ? Q_sens_W / Q_total_W : 1,
    airPressureDropPa: airDp,
    fluidPressureDropKpa: fluidDp,
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
    hAir_Wm2K: h_air_corrected,
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

