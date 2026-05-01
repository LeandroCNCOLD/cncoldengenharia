import type { CoilInput, CoilEngineResult } from "../domain/types";

const AIR_DENSITY_KGM3 = 1.2;
const CP_AIR_KJ_KGK = 1.005;
const KCALH_PER_KW = 859.845;
const KCALH_PER_TR = 3024;
const KCALH_PER_BTUH = 0.252;

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
