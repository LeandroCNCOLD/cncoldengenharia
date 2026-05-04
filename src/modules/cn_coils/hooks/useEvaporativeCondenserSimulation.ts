import { useMemo } from "react";

export interface EvaporativeCondenserInputs {
  Q_total_W: number;
  Twb_C: number;
  Tdb_C: number;
  altitude_m: number;
  tubeRows: number;
  tubesPerRow: number;
  tubeLength_m: number;
  tubeDiameter_mm: number;
  waterFlowRate_Lmin: number;
  airVelocity_ms: number;
}

export interface EvaporativeCondenserResult {
  Tc_C: number;
  Q_rejected_W: number;
  UA_WK: number;
  eta_rejection: number;
  waterEvaporation_Lh: number;
  waterMakeup_Lh: number;
  W_fans_W: number;
  A_ext_m2: number;
  P_atm_Pa: number;
}

export const DEFAULT_EVAPORATIVE_CONDENSER_INPUTS: EvaporativeCondenserInputs = {
  Q_total_W: 15000,
  Twb_C: 24,
  Tdb_C: 35,
  altitude_m: 0,
  tubeRows: 4,
  tubesPerRow: 20,
  tubeLength_m: 2.4,
  tubeDiameter_mm: 19.05,
  waterFlowRate_Lmin: 15,
  airVelocity_ms: 3,
};

export function calculateEvaporativeCondenser(
  inputs: EvaporativeCondenserInputs,
): EvaporativeCondenserResult {
  const P_atm_Pa = 101325 * Math.pow(1 - 2.2557e-5 * inputs.altitude_m, 5.2559);
  const A_ext_m2 =
    Math.PI *
    (inputs.tubeDiameter_mm / 1000) *
    inputs.tubeLength_m *
    inputs.tubeRows *
    inputs.tubesPerRow;
  const h_evap = 3500;
  const UA_WK = Math.max(1, h_evap * A_ext_m2);
  const Tc_C = inputs.Twb_C + inputs.Q_total_W / UA_WK;
  const eta_rejection = Math.min(UA_WK / (UA_WK + inputs.Q_total_W / 20), 0.95);
  const Q_rejected_W = inputs.Q_total_W * eta_rejection;
  const Q_evaporation_W = inputs.Q_total_W * 0.75;
  const waterEvaporation_Lh = (Q_evaporation_W / 2450e3) * 3600 * 1000;
  const waterMakeup_Lh = waterEvaporation_Lh * 1.5;
  const W_fans_W = inputs.airVelocity_ms * A_ext_m2 * 1.2 * 50;

  return {
    Tc_C,
    Q_rejected_W,
    UA_WK,
    eta_rejection,
    waterEvaporation_Lh,
    waterMakeup_Lh,
    W_fans_W,
    A_ext_m2,
    P_atm_Pa,
  };
}

export function useEvaporativeCondenserSimulation(inputs: EvaporativeCondenserInputs) {
  return useMemo(() => calculateEvaporativeCondenser(inputs), [inputs]);
}
