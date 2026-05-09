import type {
  CoilInput,
  CoilEngineResult,
  CoilAdvancedInput,
  CoilAdvancedResult,
} from "../domain/types";
import { calculateAirProperties } from "./airSide/airProperties";
import { calculateMassFlowAirKgS } from "./core/heatBalance";
import { calculateLMTD, calculateHeatTransferByLMTD } from "./core/lmtd";
import {
  calculateReynolds,
  calculateNusseltGnielinski,
  calculateConvectiveCoefficient,
} from "./core/dimensionless";
import { calculateDarcyFrictionFactor } from "./core/friction";
import { calculateDarcyWeisbachPressureDrop } from "./core/pressureDrop";
import { calculateOverallU } from "./core/overallHeatTransfer";
import { calculateFinEfficiencySimplified } from "./core/finEfficiency";
import { computeFinnedExternalArea } from "./core/finnedExternalArea";

const AIR_DENSITY_KGM3 = 1.2;
const CP_AIR_KJ_KGK = 1.005;
const KCALH_PER_KW = 859.845;
const KCALH_PER_TR = 3024;
const KCALH_PER_BTUH = 0.252;
const DEFAULT_FLUID_H = 1000;

// ── Basic engine (unchanged) ─────────────────────────────────────

export function calculateCoil(input: CoilInput): CoilEngineResult {
  const warnings: string[] = [];

  if (!input.rows) warnings.push("rows ausente");
  if (!input.tubes_per_row) warnings.push("tubes_per_row ausente");
  if (!input.circuits) warnings.push("circuits ausente");
  if (!input.length_mm) warnings.push("length_mm ausente");
  if (!input.airflow_m3h) warnings.push("airflow_m3h ausente");
  if (!input.delta_t_k) warnings.push("deltaT ausente");

  const airflow = input.airflow_m3h ?? 0;
  const deltaT = input.delta_t_k ?? 0;
  const rows = input.rows ?? 0;
  const tubesPerRow = input.tubes_per_row ?? 0;
  const circuits = input.circuits ?? 0;
  const lengthMm = input.length_mm ?? 0;
  const massFlowKgs = input.mass_flow_kgs ?? 0;

  const m_ar = (airflow / 3600) * AIR_DENSITY_KGM3;
  const q_kw = m_ar * CP_AIR_KJ_KGK * deltaT;
  const q_w = q_kw * 1000;
  const q_kcalh = q_kw * KCALH_PER_KW;
  const q_btuh = q_kcalh / KCALH_PER_BTUH;
  const q_tr = q_kcalh / KCALH_PER_TR;

  const exchange_area_m2 = rows * tubesPerRow * (lengthMm / 1000) * 0.02;

  const effectiveArea = Math.max(exchange_area_m2, 1);
  const air_pressure_drop_pa = (airflow / effectiveArea) * 0.5;

  const fluid_pressure_drop_kpa = circuits * 5;

  const effectiveCrossSection = Math.max(circuits * 0.0001, 0.0001);
  const fluid_velocity_ms = massFlowKgs / effectiveCrossSection;

  if (exchange_area_m2 < 0.1 && rows > 0) {
    warnings.push("área de troca muito baixa");
  }

  if (air_pressure_drop_pa > 500) {
    warnings.push("queda de pressão alta");
  }

  if (airflow > 0 && exchange_area_m2 > 0) {
    const faceVelocity = airflow / 3600 / Math.max(exchange_area_m2, 0.01);
    if (faceVelocity > 4.0) {
      warnings.push("velocidade frontal alta");
    }
  }

  let status: CoilEngineResult["status"] = "ok";
  if (warnings.length > 0) status = "warning";
  if (q_w === 0 && deltaT === 0 && airflow === 0) status = "error";

  return {
    capacity_w: q_w,
    capacity_kw: q_kw,
    capacity_kcalh: q_kcalh,
    capacity_btuh: q_btuh,
    capacity_tr: q_tr,
    sensible_capacity_w: q_w,
    latent_capacity_w: null,
    exchange_area_m2,
    air_pressure_drop_pa,
    fluid_pressure_drop_kpa,
    fluid_velocity_ms,
    warnings,
    status,
  };
}

// ── Advanced engine ──────────────────────────────────────────────

export function calculateCoilAdvanced(input: CoilAdvancedInput): CoilAdvancedResult {
  const warnings: string[] = [];

  if (!input.rows) warnings.push("rows ausente");
  if (!input.tubes_per_row) warnings.push("tubes_per_row ausente");
  if (!input.circuits) warnings.push("circuits ausente");
  if (!input.length_mm) warnings.push("length_mm ausente");
  if (!input.airflow_m3h) warnings.push("airflow_m3h ausente");

  const airflow = input.airflow_m3h ?? 0;
  const rows = input.rows ?? 0;
  const tubesPerRow = input.tubes_per_row ?? 0;
  const circuits = input.circuits ?? 0;
  const lengthMm = input.length_mm ?? 0;
  const tubeDiamMm = input.tube_diameter_mm ?? 9.52;
  const tubeThickMm = input.tube_thickness_mm ?? 0.35;
  const roughness = input.tube_roughness_m ?? 0.0000015;

  // 1. Air properties
  const airInletTemp = input.air_inlet_temp_c ?? 35;
  const airProps = calculateAirProperties(airInletTemp);

  // 2. Air mass flow
  const m_air = calculateMassFlowAirKgS(airflow, airProps.density_kg_m3);

  // 3. Exchange area — C_AREA: área externa total (tubo nu + aletas), convenção LMTD.
  // η_o aplicado em h_ar via calculateOverallU (finEfficiency), NÃO na área.
  const lengthM = lengthMm / 1000;
  const tubeDiamM = tubeDiamMm / 1000;
  const pitchTmm_adv = input.tube_pitch_transverse_m ? input.tube_pitch_transverse_m * 1000 : 0;
  const pitchLmm_adv = input.tube_pitch_longitudinal_m ? input.tube_pitch_longitudinal_m * 1000 : 0;
  const finSpacingMm_adv = input.fin_spacing_mm ?? 0;
  const finThickMm_adv = input.fin_thickness_mm ?? 0.12;
  const hasFinnedGeometry_adv = pitchTmm_adv > 0 && pitchLmm_adv > 0 && finSpacingMm_adv > 0;

  let exchange_area_m2: number;
  if (hasFinnedGeometry_adv) {
    const finnedArea = computeFinnedExternalArea({
      rows,
      tubes_per_row: tubesPerRow,
      length_mm: lengthMm,
      tube_diameter_mm: tubeDiamMm,
      tube_pitch_transverse_mm: pitchTmm_adv,
      tube_pitch_longitudinal_mm: pitchLmm_adv,
      fin_spacing_mm: finSpacingMm_adv,
      fin_thickness_mm: finThickMm_adv,
    });
    warnings.push(...finnedArea.warnings);
    exchange_area_m2 = finnedArea.A_total_m2;
  } else {
    exchange_area_m2 = rows * tubesPerRow * lengthM * Math.PI * tubeDiamM;
    if (finSpacingMm_adv <= 0) {
      warnings.push(
        "fin_spacing_mm ausente — área calculada como tubo nu apenas. " +
        "Fornecer tube_pitch_transverse_m, tube_pitch_longitudinal_m e fin_spacing_mm para área com aletas.",
      );
    }
  }

  // 4. Face velocity (approximate)
  const faceArea = Math.max(tubesPerRow * lengthM * 0.025, 0.01);
  const faceVelocity = airflow > 0 ? airflow / 3600 / faceArea : 0;

  if (faceVelocity > 4.0) {
    warnings.push("velocidade frontal alta");
  }

  // 5. Reynolds (air side, over tube OD)
  const Re_air = calculateReynolds({
    density_kg_m3: airProps.density_kg_m3,
    velocity_m_s: faceVelocity,
    hydraulicDiameter_m: tubeDiamM,
    viscosity_pa_s: airProps.viscosity_pa_s,
  });

  // 6. Prandtl (air)
  const Pr_air = airProps.prandtl;

  // 7. Friction factor (air side, approximate using tube geometry)
  const f_air = calculateDarcyFrictionFactor({
    reynolds: Re_air,
    roughness_m: roughness,
    hydraulicDiameter_m: tubeDiamM,
  });

  // 8. Nusselt (air)
  const nuResult = calculateNusseltGnielinski({
    reynolds: Re_air,
    prandtl: Pr_air,
    frictionFactor: f_air,
  });
  warnings.push(...nuResult.warnings);

  // 9. h_air
  const h_air = calculateConvectiveCoefficient({
    nusselt: nuResult.nusselt,
    conductivity_w_m_k: airProps.conductivity_w_m_k,
    hydraulicDiameter_m: tubeDiamM,
  });

  // 10. h_fluid (default or provided)
  const h_fluid = input.fluid_h_w_m2k ?? DEFAULT_FLUID_H;

  // 11. Fin efficiency
  const finCond = input.fin_conductivity_w_mk ?? 200;
  const finThick = input.fin_thickness_m ?? 0.0001;
  const finResult = calculateFinEfficiencySimplified({
    h_air_w_m2k: h_air,
    finConductivity_w_mk: finCond,
    finThickness_m: finThick,
  });
  warnings.push(...finResult.warnings);
  const finEff = finResult.finEfficiency;

  // 12. Overall U
  const wallThickM = tubeThickMm / 1000;
  const wallConductivity = 385;
  const wallResistance = wallThickM > 0 ? wallThickM / wallConductivity : 0;

  const U = calculateOverallU({
    airSideH_w_m2k: h_air,
    fluidSideH_w_m2k: h_fluid,
    wallResistance_m2k_w: input.wall_resistance_m2k_w ?? wallResistance,
    foulingAir_m2k_w: input.fouling_air_m2k_w ?? 0,
    foulingFluid_m2k_w: input.fouling_fluid_m2k_w ?? 0,
    finEfficiency: finEff,
  });

  // 13/14. Capacity calculation
  let capacity_w = 0;
  let lmtd_k: number | null = null;

  const hasTemps =
    input.air_inlet_temp_c !== null &&
    input.air_outlet_temp_c !== null &&
    input.fluid_inlet_temp_c !== null &&
    input.fluid_outlet_temp_c !== null;

  if (hasTemps) {
    const lmtdResult = calculateLMTD({
      hotIn_c: input.air_inlet_temp_c!,
      hotOut_c: input.air_outlet_temp_c!,
      coldIn_c: input.fluid_inlet_temp_c!,
      coldOut_c: input.fluid_outlet_temp_c!,
    });
    warnings.push(...lmtdResult.warnings);
    lmtd_k = lmtdResult.lmtd_k;

    if (lmtd_k !== null && lmtd_k > 0) {
      capacity_w = calculateHeatTransferByLMTD({
        u_w_m2k: U,
        area_m2: exchange_area_m2,
        lmtd_k,
      });
    }
  }

  if (capacity_w === 0) {
    const deltaT = input.delta_t_k ?? 0;
    if (!deltaT) warnings.push("deltaT ausente");
    capacity_w = m_air * airProps.cp_j_kg_k * deltaT;
  }

  // Air pressure drop
  const airRowDepth = rows * tubeDiamM * 2;
  const air_pressure_drop_pa = calculateDarcyWeisbachPressureDrop({
    frictionFactor: f_air,
    length_m: airRowDepth,
    hydraulicDiameter_m: tubeDiamM,
    density_kg_m3: airProps.density_kg_m3,
    velocity_m_s: faceVelocity,
  });

  // Fluid side pressure drop (simplified)
  const tubeInnerDiamM = Math.max(tubeDiamM - 2 * wallThickM, 0.001);
  const fluidCrossSection = Math.max(circuits * Math.PI * (tubeInnerDiamM / 2) ** 2, 0.0001);
  const massFlowKgs = input.mass_flow_kgs ?? 0;
  // FIX: velocidade = ṁ / (ρ × A). A divisão por 1000 anterior era um atalho
  // incorreto que tentava simular densidade da água (≈1000 kg/m³) mas sem base
  // física — não usava a densidade real do fluido.
  const fluidDensity = input.fluid_density_kg_m3 ?? 1000; // padrão água; fornecer para refrigerantes
  const fluidVelocity = massFlowKgs / (fluidCrossSection * fluidDensity);

  const fluidTubeLength = (rows * tubesPerRow * lengthM) / Math.max(circuits, 1);
  const f_fluid = calculateDarcyFrictionFactor({
    reynolds: 10000,
    roughness_m: roughness,
    hydraulicDiameter_m: tubeInnerDiamM,
  });

  const fluid_pressure_drop_pa = calculateDarcyWeisbachPressureDrop({
    frictionFactor: f_fluid,
    length_m: fluidTubeLength,
    hydraulicDiameter_m: tubeInnerDiamM,
    density_kg_m3: 1000,
    velocity_m_s: fluidVelocity,
  });
  const fluid_pressure_drop_kpa = fluid_pressure_drop_pa / 1000;

  // Unit conversions
  const capacity_kw = capacity_w / 1000;
  const capacity_kcalh = capacity_kw * KCALH_PER_KW;
  const capacity_btuh = capacity_kcalh / KCALH_PER_BTUH;
  const capacity_tr = capacity_kcalh / KCALH_PER_TR;

  if (exchange_area_m2 < 0.1 && rows > 0) {
    warnings.push("área de troca muito baixa");
  }

  if (air_pressure_drop_pa > 500) {
    warnings.push("queda de pressão ar alta");
  }

  let status: CoilAdvancedResult["status"] = "ok";
  if (warnings.length > 0) status = "warning";
  if (capacity_w === 0 && airflow === 0) status = "error";

  return {
    capacity_w,
    capacity_kw,
    capacity_kcalh,
    capacity_btuh,
    capacity_tr,
    sensible_capacity_w: capacity_w,
    latent_capacity_w: null,
    lmtd_k,
    u_w_m2k: U,
    air_h_w_m2k: h_air,
    fluid_h_w_m2k: h_fluid,
    reynolds_air: Re_air,
    prandtl_air: Pr_air,
    nusselt_air: nuResult.nusselt,
    exchange_area_m2,
    air_pressure_drop_pa,
    fluid_pressure_drop_kpa,
    fluid_velocity_ms: fluidVelocity,
    fin_efficiency: finEff,
    warnings,
    status,
  };
}
