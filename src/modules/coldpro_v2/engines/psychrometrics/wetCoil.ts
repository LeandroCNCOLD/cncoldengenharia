import type { WetCoilInput, WetCoilResult } from "../../domain/types";
import { humidityRatio, enthalpyMoistAir, dewPoint, cpMoistAir } from "./psychrometricCore";

export function calculateWetCoil(input: WetCoilInput): WetCoilResult {
  const P_atm = input.P_atm ?? 101325;
  const warnings: string[] = [];

  const { W: W_in, warnings: wWarn } = humidityRatio(input.T_air_in, input.RH_in, P_atm);
  warnings.push(...wWarn);

  const h_in = enthalpyMoistAir(input.T_air_in, W_in);
  const { T_dp, warnings: dpWarn } = dewPoint(input.T_air_in, input.RH_in);
  warnings.push(...dpWarn);

  if (input.T_surface >= T_dp) {
    return {
      mode: "dry",
      T_air_out: input.T_air_in,
      RH_out: input.RH_in,
      W_in,
      W_out: W_in,
      water_removed_kg_s: 0,
      latent_load_w: 0,
      sensible_load_w: 0,
      total_load_w: 0,
      warnings: [...warnings, "Superfície acima do ponto de orvalho. Operação em modo seco."],
    };
  }

  // C5: Wet-coil acoplado ao coil.
  // Se U e A forem fornecidos, itera T_ar_out até Q_coil = U×A×LMTD converge
  // com o balanço psicrométrico. Caso contrário, usa o fallback T_surf+2°C.
  let T_air_out: number;
  if (
    input.U_w_m2k && input.U_w_m2k > 0 &&
    input.A_exchange_m2 && input.A_exchange_m2 > 0
  ) {
    const U = input.U_w_m2k;
    const A = input.A_exchange_m2;
    const cp_kJ = cpMoistAir(W_in);
    const C_air = input.air_mass_flow_kg_s * cp_kJ * 1000; // W/K
    T_air_out = input.T_surface + 2; // estimativa inicial
    for (let i = 0; i < 50; i++) {
      const dT1 = input.T_air_in - input.T_surface;
      const dT2 = Math.max(T_air_out - input.T_surface, 0.01);
      const LMTD = Math.abs(dT1 - dT2) < 1e-4
        ? dT1
        : (dT1 - dT2) / Math.log(dT1 / dT2);
      const Q_coil = U * A * LMTD;
      const T_ao_new = input.T_air_in - Q_coil / C_air;
      const T_ao_clamped = Math.max(input.T_surface + 0.05, Math.min(input.T_air_in - 0.05, T_ao_new));
      if (Math.abs(T_ao_clamped - T_air_out) < 0.01) {
        T_air_out = T_ao_clamped;
        break;
      }
      T_air_out = T_air_out + 0.3 * (T_ao_clamped - T_air_out);
    }
    warnings.push("Wet-coil acoplado (C5): T_ar_out via iteração U×A×LMTD");
  } else {
    // Fallback legado: T_ar_out = T_surf + 2°C
    T_air_out = input.T_surface + 2;
    warnings.push("Wet-coil fallback: T_ar_out = T_surf + 2°C (fornecer U e A para acoplamento)");
  }

  const RH_out = 1.0;
  const { W: W_out } = humidityRatio(T_air_out, 1.0, P_atm);
  const h_out = enthalpyMoistAir(T_air_out, W_out);

  let m_water = input.air_mass_flow_kg_s * (W_in - W_out);
  if (m_water < 0) {
    warnings.push("W_out > W_in. Verificar dados de entrada. m_water forçado a zero.");
    m_water = 0;
  }

  const L_condensacao = 2501000 - 2361 * input.T_surface;
  const L_clamp = Math.max(2400000, Math.min(2501000, L_condensacao));
  const latent_load_w = m_water * L_clamp;

  const cp_umido_kJ = cpMoistAir(W_in);
  const sensible_load_w =
    input.air_mass_flow_kg_s * cp_umido_kJ * 1000 * (input.T_air_in - T_air_out);

  const total_load_w = input.air_mass_flow_kg_s * (h_in - h_out) * 1000;

  return {
    mode: "wet",
    T_air_out,
    RH_out,
    W_in,
    W_out,
    water_removed_kg_s: m_water,
    latent_load_w,
    sensible_load_w,
    total_load_w,
    warnings,
  };
}
