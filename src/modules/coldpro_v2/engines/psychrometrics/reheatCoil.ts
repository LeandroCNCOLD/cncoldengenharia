import type { ReheatInput, ReheatResult } from "../../domain/types";
import { humidityRatio, enthalpyMoistAir, saturationPressure } from "./psychrometricCore";

export function calculateReheat(input: ReheatInput): ReheatResult {
  const P_atm = input.P_atm ?? 101325;
  const warnings: string[] = [];

  const { W: W_in } = humidityRatio(input.T_air_in, input.RH_in, P_atm);
  const h_in = enthalpyMoistAir(input.T_air_in, W_in);

  const massFlow = Math.max(input.air_mass_flow_kg_s, 1e-6);
  const h_out = h_in + input.Q_reheat_w / massFlow / 1000;

  const W = W_in;
  const T_air_out = (h_out - W * 2501) / (1.006 + 1.86 * W);

  const W_out = W_in;

  const P_vapor = (W_in * P_atm) / (0.62198 + W_in);
  const P_ws_out = saturationPressure(T_air_out);
  const RH_out = Math.min(1.0, P_ws_out > 0 ? P_vapor / P_ws_out : 0);

  if (RH_out > 0.99) {
    warnings.push(
      "RH de saída próximo de 100% após reaquecimento. Verificar carga de reaquecimento.",
    );
  }

  return { T_air_out, RH_out, W_out, warnings };
}
