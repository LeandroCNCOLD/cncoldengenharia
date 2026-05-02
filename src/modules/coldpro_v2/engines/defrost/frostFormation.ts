import type { FrostFormationInput, FrostFormationResult } from "../../domain/types";
import { humidityRatio, dewPoint } from "../psychrometrics/psychrometricCore";

function buildErrorResult(warnings: string[]): FrostFormationResult {
  return {
    mode: "dry",
    dew_point_c: 0,
    W_in: 0,
    W_surface: 0,
    water_condensed_kg_h: 0,
    frost_fraction: 0,
    frost_formation_kg_h: 0,
    frost_mass_kg: 0,
    frost_density_kg_m3: 0,
    frost_volume_m3: 0,
    frost_thickness_mm: 0,
    airflow_reduction_factor: 1,
    estimated_capacity_loss_pct: 0,
    recommended_defrost: false,
    estimated_time_to_defrost_h: null,
    warnings,
    status: "error",
  };
}

export function calculateFrostFormation(input: FrostFormationInput): FrostFormationResult {
  const warnings: string[] = [];

  if (input.air_mass_flow_kg_s <= 0) {
    warnings.push("air_mass_flow_kg_s <= 0.");
    return buildErrorResult(warnings);
  }
  if (input.operation_time_h <= 0) {
    warnings.push("operation_time_h <= 0.");
    return buildErrorResult(warnings);
  }
  if (input.evaporator_external_area_m2 <= 0) {
    warnings.push("evaporator_external_area_m2 <= 0.");
    return buildErrorResult(warnings);
  }

  let RH = input.air_relative_humidity;
  if (RH > 1) {
    RH = RH / 100;
    warnings.push(
      "air_relative_humidity fornecido como porcentagem. Convertido para fração decimal.",
    );
  }
  RH = Math.max(0, Math.min(1, RH));

  const P_atm = input.P_atm ?? 101325;
  const frostDensity = input.frost_density_kg_m3 ?? 250;
  const thresholdThicknessMm = input.defrost_threshold_frost_thickness_mm ?? 3;
  const thresholdMassKg = input.defrost_threshold_frost_mass_kg ?? Infinity;

  const { T_dp } = dewPoint(input.air_temperature_c, RH);
  const { W: W_in } = humidityRatio(input.air_temperature_c, RH, P_atm);
  const { W: W_surface } = humidityRatio(input.coil_surface_temperature_c, 1.0, P_atm);

  const Ts = input.coil_surface_temperature_c;

  if (Ts >= T_dp) {
    return {
      mode: "dry",
      dew_point_c: T_dp,
      W_in,
      W_surface,
      water_condensed_kg_h: 0,
      frost_fraction: 0,
      frost_formation_kg_h: 0,
      frost_mass_kg: 0,
      frost_density_kg_m3: frostDensity,
      frost_volume_m3: 0,
      frost_thickness_mm: 0,
      airflow_reduction_factor: 1,
      estimated_capacity_loss_pct: 0,
      recommended_defrost: false,
      estimated_time_to_defrost_h: null,
      warnings,
      status: "ok",
    };
  }

  const waterCondensedKgS = input.air_mass_flow_kg_s * Math.max(0, W_in - W_surface);
  const waterCondensedKgH = waterCondensedKgS * 3600;

  let frostFraction: number;
  let mode: FrostFormationResult["mode"];

  if (Ts > 0) {
    mode = "condensation_only";
    frostFraction = 0;
  } else {
    mode = "frosting";
    if (Ts <= -5) {
      frostFraction = 1.0;
    } else {
      frostFraction = Math.abs(Ts) / 5;
    }
    frostFraction = Math.max(0, Math.min(1, frostFraction));
  }

  const frostFormationKgH = waterCondensedKgH * frostFraction;
  const frostMassKg = frostFormationKgH * input.operation_time_h;

  const frostVolumeM3 = frostDensity > 0 ? frostMassKg / frostDensity : 0;
  const area = input.evaporator_external_area_m2;
  const frostThicknessM = area > 0 ? frostVolumeM3 / area : 0;
  const frostThicknessMm = frostThicknessM * 1000;

  const capacityLoss = Math.min(50, frostThicknessMm * 7);
  const airflowReduction = Math.max(0.5, 1 - frostThicknessMm * 0.05);

  if (frostThicknessMm > 3) {
    warnings.push("Espessura de gelo acima de 3 mm. Recomenda-se ciclo de degelo.");
  }
  if (capacityLoss > 20) {
    warnings.push("Perda estimada de capacidade acima de 20%.");
  }

  let recommendedDefrost = false;
  if (frostMassKg >= thresholdMassKg) recommendedDefrost = true;
  if (frostThicknessMm >= thresholdThicknessMm) recommendedDefrost = true;

  let estimatedTimeH: number | null = null;
  if (frostFormationKgH > 0) {
    const times: number[] = [];

    if (Number.isFinite(thresholdMassKg)) {
      times.push(thresholdMassKg / frostFormationKgH);
    }

    const massAtThickness = (thresholdThicknessMm / 1000) * area * frostDensity;
    if (massAtThickness > 0) {
      times.push(massAtThickness / frostFormationKgH);
    }

    if (times.length > 0) {
      estimatedTimeH = Math.min(...times);
    }
  }

  let status: FrostFormationResult["status"] = "ok";
  if (recommendedDefrost || warnings.length > 0) status = "warning";

  return {
    mode,
    dew_point_c: T_dp,
    W_in,
    W_surface,
    water_condensed_kg_h: waterCondensedKgH,
    frost_fraction: frostFraction,
    frost_formation_kg_h: frostFormationKgH,
    frost_mass_kg: frostMassKg,
    frost_density_kg_m3: frostDensity,
    frost_volume_m3: frostVolumeM3,
    frost_thickness_mm: frostThicknessMm,
    airflow_reduction_factor: airflowReduction,
    estimated_capacity_loss_pct: capacityLoss,
    recommended_defrost: recommendedDefrost,
    estimated_time_to_defrost_h: estimatedTimeH,
    warnings,
    status,
  };
}
