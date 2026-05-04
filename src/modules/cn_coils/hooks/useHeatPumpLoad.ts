import { useMemo } from "react";

export interface HeatPumpInputs {
  mode: "heating" | "cooling" | "both";
  Q_heating_W: number;
  Tsupply_heating_C: number;
  Treturn_heating_C: number;
  Q_cooling_W: number;
  Tsupply_cooling_C: number;
  Treturn_cooling_C: number;
  sourceType: "air" | "water" | "ground";
  Tsource_C: number;
  voltage_V: number;
  frequency_Hz: number;
}

export interface HeatPumpResult {
  COP_heating: number;
  W_comp_heating_W: number;
  Q_source_W: number;
  COP_cooling: number;
  W_comp_cooling_W: number;
  savingsVsElectric_pct: number;
  Te_eq_C: number;
  Tc_eq_C: number;
}

export const DEFAULT_HEAT_PUMP_INPUTS: HeatPumpInputs = {
  mode: "both",
  Q_heating_W: 10000,
  Tsupply_heating_C: 45,
  Treturn_heating_C: 40,
  Q_cooling_W: 8000,
  Tsupply_cooling_C: 7,
  Treturn_cooling_C: 12,
  sourceType: "air",
  Tsource_C: 10,
  voltage_V: 380,
  frequency_Hz: 60,
};

export function calculateHeatPumpLoad(inputs: HeatPumpInputs): HeatPumpResult {
  const Te_hp_C = inputs.Tsource_C - 5;
  const Tc_hp_C = inputs.Tsupply_heating_C + 5;
  const Te_K = Te_hp_C + 273.15;
  const Tc_K = Tc_hp_C + 273.15;
  const COP_carnot_heating = Tc_K / Math.max(1, Tc_K - Te_K);
  const COP_heating = Math.max(1.05, COP_carnot_heating * 0.55);
  const COP_cooling = Math.max(0.1, COP_heating - 1);
  const W_comp_heating_W = inputs.Q_heating_W / COP_heating;
  const W_comp_cooling_W = inputs.Q_cooling_W / COP_cooling;
  const Q_source_W = Math.max(0, inputs.Q_heating_W - W_comp_heating_W);
  const savingsVsElectric_pct = Math.max(0, (1 - 1 / COP_heating) * 100);

  return {
    COP_heating,
    W_comp_heating_W,
    Q_source_W,
    COP_cooling,
    W_comp_cooling_W,
    savingsVsElectric_pct,
    Te_eq_C: Te_hp_C,
    Tc_eq_C: Tc_hp_C,
  };
}

export function useHeatPumpLoad(inputs: HeatPumpInputs) {
  return useMemo(() => calculateHeatPumpLoad(inputs), [inputs]);
}
