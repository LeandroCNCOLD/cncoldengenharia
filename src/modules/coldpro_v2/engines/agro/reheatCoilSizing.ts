import type { ReheatCoilSizingInput, ReheatCoilSizingResult } from "../../domain/types";
import { calculateAirGeometry } from "../airSide/airGeometry";
import { calculateAirSideHTC } from "../airSide/airHeatTransfer";
import { calculateAirPressureDrop } from "../airSide/airPressureDrop";
import { calculateAirProperties } from "../airSide/airProperties";
import { calculateTubeWallResistance } from "../core/wallResistance";
import { fromWatts } from "../../utils/unitConverter";

const H_REFRIGERANT = 3000;

function buildErrorResult(
  input: ReheatCoilSizingInput,
  warnings: string[],
): ReheatCoilSizingResult {
  return {
    rows_required: 0,
    total_tube_length_m: 0,
    external_area_m2: 0,
    internal_area_m2: 0,
    h_air_w_m2k: 0,
    h_refrigerant_w_m2k: H_REFRIGERANT,
    u_w_m2k: 0,
    lmtd_k: 0,
    Q_available_w: 0,
    Q_available_kcalh: 0,
    Q_target_w: input.Q_reheat_target_w,
    Q_target_kcalh: fromWatts(input.Q_reheat_target_w, "kcal/h"),
    capacity_ratio: 0,
    reheat_air_pressure_drop_pa: 0,
    total_air_pressure_drop_pa: input.evaporator_air_pressure_drop_pa ?? 0,
    fan_feasible: true,
    T_air_in_c: input.T_air_in_c,
    T_air_out_c: input.T_air_out_c,
    T_condensing_c: input.T_condensing_c,
    sizing_feasible: false,
    converged: false,
    warnings,
    status: "error",
  };
}

export function calculateReheatCoilSizing(input: ReheatCoilSizingInput): ReheatCoilSizingResult {
  const warnings: string[] = [];

  const Di = input.tube_outer_diameter_m - 2 * input.tube_thickness_m;

  if (input.Q_reheat_target_w <= 0) {
    warnings.push("Q_reheat_target_w <= 0.");
    return buildErrorResult(input, warnings);
  }
  if (input.air_mass_flow_kg_s <= 0) {
    warnings.push("air_mass_flow_kg_s <= 0.");
    return buildErrorResult(input, warnings);
  }
  if (input.tube_outer_diameter_m <= 0 || input.tube_thickness_m <= 0 || Di <= 0) {
    warnings.push("Dimensões de tubo inválidas.");
    return buildErrorResult(input, warnings);
  }
  if (input.coil_length_m <= 0 || input.circuits <= 0) {
    warnings.push("coil_length_m ou circuits inválido.");
    return buildErrorResult(input, warnings);
  }
  if (input.T_condensing_c <= input.T_air_in_c || input.T_condensing_c <= input.T_air_out_c) {
    warnings.push("Temperatura do ar maior ou igual à de condensação. Troca térmica impossível.");
    return buildErrorResult(input, warnings);
  }

  const dT1 = input.T_condensing_c - input.T_air_in_c;
  const dT2 = input.T_condensing_c - input.T_air_out_c;
  let lmtd: number;

  if (Math.abs(dT1 - dT2) < 1e-6) {
    lmtd = dT1;
  } else {
    lmtd = (dT1 - dT2) / Math.log(dT1 / dT2);
  }

  const wall = calculateTubeWallResistance({
    tube_outer_diameter_m: input.tube_outer_diameter_m,
    tube_inner_diameter_m: Di,
    tube_material: input.tube_material ?? "copper",
  });
  warnings.push(...wall.warnings);

  const T_air_mean = (input.T_air_in_c + input.T_air_out_c) / 2;
  const airProps = calculateAirProperties(T_air_mean);

  const maxRows = input.max_rows ?? 4;

  let lastResult: ReheatCoilSizingResult | null = null;

  for (let nRows = 1; nRows <= maxRows; nRows++) {
    const totalTubes = nRows * input.circuits;
    const totalTubeLength = totalTubes * input.coil_length_m;
    const externalArea = Math.PI * input.tube_outer_diameter_m * totalTubeLength;
    const internalArea = Math.PI * Di * totalTubeLength;

    const faceArea = input.coil_length_m * (nRows * input.tube_pitch_longitudinal_m);

    const geom = calculateAirGeometry({
      face_area_m2: faceArea,
      tube_outer_diameter_m: input.tube_outer_diameter_m,
      tube_pitch_transverse_m: input.tube_pitch_transversal_m,
      tube_pitch_longitudinal_m: input.tube_pitch_longitudinal_m,
      fin_spacing_mm: input.fin_spacing_m * 1000,
      fin_thickness_mm: input.fin_thickness_m * 1000,
      rows: nRows,
    });

    const airVelocity =
      faceArea > 0 ? input.air_mass_flow_kg_s / (airProps.density_kg_m3 * faceArea) : 0;

    const airHtc = calculateAirSideHTC({
      air_velocity_ms: airVelocity,
      air_properties: airProps,
      geometry: geom,
    });

    const hAir = airHtc.h_air_w_m2k;
    const aRatio = input.tube_outer_diameter_m / Di;
    const totalR = 1 / hAir + wall.wall_resistance_m2k_w + aRatio / H_REFRIGERANT;
    const U = totalR > 0 ? 1 / totalR : 0;

    const Q_available = U * externalArea * lmtd;
    const capacityRatio = input.Q_reheat_target_w > 0 ? Q_available / input.Q_reheat_target_w : 0;

    const airDp = calculateAirPressureDrop({
      air_velocity_ms: airVelocity,
      air_density: airProps.density_kg_m3,
      geometry: geom,
      rows: nRows,
      tube_pitch_longitudinal_m: input.tube_pitch_longitudinal_m,
    });

    const reheatDp = airDp.pressure_drop_pa;
    const totalDp = reheatDp + (input.evaporator_air_pressure_drop_pa ?? 0);

    let fanFeasible = true;
    if (input.fan_static_pressure_pa !== undefined) {
      fanFeasible = totalDp <= input.fan_static_pressure_pa;
      if (!fanFeasible) {
        warnings.push(
          `ΔP total (${totalDp.toFixed(1)} Pa) excede a pressão estática do ventilador (${input.fan_static_pressure_pa} Pa). Verificar seleção do ventilador.`,
        );
      }
    }

    lastResult = {
      rows_required: nRows,
      total_tube_length_m: totalTubeLength,
      external_area_m2: externalArea,
      internal_area_m2: internalArea,
      h_air_w_m2k: hAir,
      h_refrigerant_w_m2k: H_REFRIGERANT,
      u_w_m2k: U,
      lmtd_k: lmtd,
      Q_available_w: Q_available,
      Q_available_kcalh: fromWatts(Q_available, "kcal/h"),
      Q_target_w: input.Q_reheat_target_w,
      Q_target_kcalh: fromWatts(input.Q_reheat_target_w, "kcal/h"),
      capacity_ratio: capacityRatio,
      reheat_air_pressure_drop_pa: reheatDp,
      total_air_pressure_drop_pa: totalDp,
      fan_feasible: fanFeasible,
      T_air_in_c: input.T_air_in_c,
      T_air_out_c: input.T_air_out_c,
      T_condensing_c: input.T_condensing_c,
      sizing_feasible: capacityRatio >= 1,
      converged: capacityRatio >= 1,
      warnings: [...warnings],
      status: capacityRatio >= 1 ? (fanFeasible ? "ok" : "warning") : "warning",
    };

    if (capacityRatio >= 1) {
      return lastResult;
    }
  }

  if (lastResult) {
    lastResult.warnings.push(
      `Capacidade insuficiente com max_rows=${maxRows}. capacity_ratio=${lastResult.capacity_ratio.toFixed(3)}.`,
    );
    lastResult.status = "warning";
    return lastResult;
  }

  warnings.push("Capacidade insuficiente com max_rows.");
  return buildErrorResult(input, warnings);
}
