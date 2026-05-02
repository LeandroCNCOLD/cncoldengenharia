import type { DripTrayCoilInput, DripTrayCoilResult, DripTrayCondition } from "../../domain/types";
import { calculateFluidProperties } from "../fluidSide/fluidProperties";
import { calculateInternalFluidHTC } from "../fluidSide/fluidHeatTransfer";
import { calculateTubeWallResistance } from "../core/wallResistance";
import { fromWatts } from "../../utils/unitConverter";

function buildErrorResult(
  input: DripTrayCoilInput,
  warnings: string[],
  Di: number,
): DripTrayCoilResult {
  return {
    number_of_passes: 0,
    bend_diameter_m: 0,
    straight_length_m: 0,
    bend_length_m: 0,
    total_length_m: 0,
    external_area_m2: 0,
    tube_inner_diameter_m: Di,
    h_internal_w_m2k: 0,
    h_external_w_m2k: 0,
    wall_resistance_m2k_w: 0,
    u_w_m2k: 0,
    reynolds_internal: 0,
    prandtl_internal: 0,
    nusselt_internal: 0,
    internal_velocity_ms: 0,
    T_liquid_in_c: input.T_liquid_in_c,
    T_liquid_out_c: input.T_liquid_in_c,
    liquid_subcooling_k: 0,
    T_tray_c: input.T_tray_c,
    tray_condition: input.tray_condition,
    lmtd_k: 0,
    q_tray_w: 0,
    q_tray_kcalh: 0,
    converged: false,
    iterations: 0,
    warnings,
    status: "error",
  };
}

function calculateTrayExternalHTC(
  trayCondition: DripTrayCondition,
  T_tray_c: number,
  T_surface_c: number,
  D_o: number,
): { h_external_w_m2k: number; warnings: string[] } {
  const warnings: string[] = [];

  if (trayCondition === "melting_ice") {
    warnings.push("Modo melting_ice: usando h_external fixo conservador = 500 W/m²K.");
    return { h_external_w_m2k: 500, warnings };
  }

  if (trayCondition === "dry_air") {
    warnings.push("Modo dry_air: usando convecção natural em ar h_external = 8 W/m²K.");
    return { h_external_w_m2k: 8, warnings };
  }

  const T_film = (T_tray_c + T_surface_c) / 2;
  const waterProps = calculateFluidProperties({ fluid: "water", temperature_c: T_film });
  warnings.push(...waterProps.warnings);

  const beta = 1 / (T_film + 273.15);
  const g = 9.81;
  const deltaT = Math.abs(T_surface_c - T_tray_c);

  if (deltaT < 0.01) {
    warnings.push("DeltaT muito pequeno para convecção natural. Usando h_external = 100 W/m²K.");
    return { h_external_w_m2k: 100, warnings };
  }

  const nu = waterProps.viscosity_pa_s / waterProps.density_kg_m3;
  const alpha = waterProps.conductivity_w_m_k / (waterProps.density_kg_m3 * waterProps.cp_j_kg_k);

  if (nu <= 0 || alpha <= 0) {
    warnings.push("Ra inválido. Usando h_external fallback = 100 W/m²K.");
    return { h_external_w_m2k: 100, warnings };
  }

  const Gr = (g * beta * deltaT * D_o * D_o * D_o) / (nu * nu);
  const Pr = waterProps.prandtl;
  const Ra = Gr * Pr;

  if (!Number.isFinite(Ra) || Ra <= 0) {
    warnings.push("Ra inválido. Usando h_external fallback = 100 W/m²K.");
    return { h_external_w_m2k: 100, warnings };
  }

  let Nu: number;
  if (Ra < 1e9) {
    Nu = 0.53 * Math.pow(Ra, 0.25);
  } else {
    Nu = 0.13 * Math.pow(Ra, 0.333);
  }

  const h = (Nu * waterProps.conductivity_w_m_k) / D_o;
  return { h_external_w_m2k: h, warnings };
}

export function calculateDripTrayCoil(input: DripTrayCoilInput): DripTrayCoilResult {
  const warnings: string[] = [];
  const D_o = input.tube_outer_diameter_m;
  const thickness = input.tube_thickness_m;
  const Di = D_o - 2 * thickness;

  if (D_o <= 0 || thickness <= 0 || Di <= 0) {
    warnings.push("Diâmetros de tubo inválidos.");
    return buildErrorResult(input, warnings, Math.max(Di, 0));
  }
  if (input.tray_length_m <= 0) {
    warnings.push("tray_length_m inválido.");
    return buildErrorResult(input, warnings, Di);
  }
  if (input.liquid_mass_flow_kgs <= 0) {
    warnings.push("liquid_mass_flow_kgs inválido.");
    return buildErrorResult(input, warnings, Di);
  }
  if (input.T_liquid_in_c <= input.T_tray_c) {
    warnings.push("T_liquid_in_c <= T_tray_c. Sem driving force para troca térmica.");
    return buildErrorResult(input, warnings, Di);
  }

  let pitch = input.pitch_m;
  if (pitch === undefined) {
    pitch = 2 * D_o;
    warnings.push("pitch_m não informado. Usando default = 2 * tube_outer_diameter_m.");
  }

  const numberOfPasses = input.number_of_bends + 1;
  const bendDiameter = pitch;
  const straightLength = numberOfPasses * input.tray_length_m;
  const bendLength = input.number_of_bends * ((Math.PI * bendDiameter) / 2);
  const totalLength = straightLength + bendLength;
  const externalArea = Math.PI * D_o * totalLength;

  const fluid = input.refrigerant ?? "refrigerant_default";
  if (!input.refrigerant) {
    warnings.push("Refrigerante não informado. Usando refrigerant_default como padrão.");
  }

  const wall = calculateTubeWallResistance({
    tube_outer_diameter_m: D_o,
    tube_inner_diameter_m: Di,
    tube_material: input.tube_material ?? "copper",
  });
  warnings.push(...wall.warnings);

  const maxIter = input.max_iterations ?? 100;
  const toleranceC = input.tolerance_c ?? 0.01;

  let T_liquid_out = input.T_liquid_in_c - 2;
  if (T_liquid_out <= input.T_tray_c) {
    T_liquid_out = input.T_tray_c + 0.1;
  }

  let converged = false;
  let iterations = 0;
  let lastHInternal = 0;
  let lastHExternal = 0;
  let lastU = 0;
  let lastLMTD = 0;
  let lastQ = 0;
  let lastReInternal = 0;
  let lastPrInternal = 0;
  let lastNuInternal = 0;
  let lastVelocity = 0;
  let status: "ok" | "warning" | "error" = "ok";

  for (let i = 0; i < maxIter; i++) {
    iterations = i + 1;
    const T_mean = (input.T_liquid_in_c + T_liquid_out) / 2;

    const fluidProps = calculateFluidProperties({ fluid, temperature_c: T_mean });
    if (i === 0) warnings.push(...fluidProps.warnings);

    const htc = calculateInternalFluidHTC({
      mass_flow_kgs: input.liquid_mass_flow_kgs,
      circuits: 1,
      tube_inner_diameter_m: Di,
      fluid_properties: fluidProps,
      tube_length_m: totalLength,
    });
    if (i === 0) warnings.push(...htc.warnings);

    lastHInternal = htc.h_w_m2k;
    lastReInternal = htc.reynolds;
    lastPrInternal = htc.prandtl;
    lastNuInternal = htc.nusselt;
    lastVelocity = htc.velocity_m_s;

    const T_surface = (input.T_liquid_in_c + T_liquid_out) / 2;

    const ext = calculateTrayExternalHTC(input.tray_condition, input.T_tray_c, T_surface, D_o);
    if (i === 0) warnings.push(...ext.warnings);
    lastHExternal = ext.h_external_w_m2k;

    if (lastHInternal <= 0 || lastHExternal <= 0) {
      warnings.push("h_internal ou h_external <= 0. Impossível calcular U.");
      status = "error";
      break;
    }

    const totalR = 1 / lastHInternal + wall.wall_resistance_m2k_w + 1 / lastHExternal;
    lastU = totalR > 0 ? 1 / totalR : 0;

    if (!Number.isFinite(lastU) || lastU <= 0) {
      warnings.push("U inválido.");
      status = "error";
      break;
    }

    const dT1 = input.T_liquid_in_c - input.T_tray_c;
    const dT2 = T_liquid_out - input.T_tray_c;

    if (dT1 <= 0 || dT2 <= 0) {
      warnings.push("DeltaT inválido para LMTD na serpentina de bandeja.");
      status = "error";
      break;
    }

    const ratio = dT1 / dT2;
    lastLMTD = Math.abs(ratio - 1) < 1e-6 ? (dT1 + dT2) / 2 : (dT1 - dT2) / Math.log(ratio);

    lastQ = lastU * externalArea * lastLMTD;

    const T_raw = input.T_liquid_in_c - lastQ / (input.liquid_mass_flow_kgs * fluidProps.cp_j_kg_k);
    const relaxation = 0.3;
    const T_new = T_liquid_out + relaxation * (T_raw - T_liquid_out);

    let T_clamped = T_new;
    if (T_clamped < input.T_tray_c) {
      T_clamped = input.T_tray_c + 0.01;
      if (i === 0)
        warnings.push("T_liquid_out limitado por T_tray_c. Subresfriamento máximo atingido.");
    }
    if (T_clamped > input.T_liquid_in_c) {
      T_clamped = input.T_liquid_in_c;
      if (i === 0) warnings.push("T_liquid_out maior que T_liquid_in. Resultado ajustado.");
    }

    const errorC = Math.abs(T_clamped - T_liquid_out);
    T_liquid_out = T_clamped;

    if (errorC < toleranceC) {
      converged = true;
      break;
    }
  }

  if (!converged && status !== "error") {
    status = "warning";
    warnings.push("Serpentina de bandeja não convergiu dentro do limite de iterações.");
  }

  const subcooling = input.T_liquid_in_c - T_liquid_out;

  lastQ = lastU * externalArea * lastLMTD;
  const q_kcalh = fromWatts(lastQ, "kcal/h");

  if (converged && status === "ok" && warnings.length > 0) {
    status = "warning";
  }

  return {
    number_of_passes: numberOfPasses,
    bend_diameter_m: bendDiameter,
    straight_length_m: straightLength,
    bend_length_m: bendLength,
    total_length_m: totalLength,
    external_area_m2: externalArea,
    tube_inner_diameter_m: Di,
    h_internal_w_m2k: lastHInternal,
    h_external_w_m2k: lastHExternal,
    wall_resistance_m2k_w: wall.wall_resistance_m2k_w,
    u_w_m2k: lastU,
    reynolds_internal: lastReInternal,
    prandtl_internal: lastPrInternal,
    nusselt_internal: lastNuInternal,
    internal_velocity_ms: lastVelocity,
    T_liquid_in_c: input.T_liquid_in_c,
    T_liquid_out_c: T_liquid_out,
    liquid_subcooling_k: subcooling,
    T_tray_c: input.T_tray_c,
    tray_condition: input.tray_condition,
    lmtd_k: lastLMTD,
    q_tray_w: lastQ,
    q_tray_kcalh: q_kcalh,
    converged,
    iterations,
    warnings,
    status,
  };
}
