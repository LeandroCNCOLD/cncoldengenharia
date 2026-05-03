import { describe, expect, it } from "vitest";
import { calcRefrigerantCharge } from "../utils/coilDerivedMetrics";

describe("calcRefrigerantCharge", () => {
  it("R404A, Te=-35°C, 12 circuitos, ID=11.5mm → carga entre 0.5 e 3 kg", () => {
    const charge = calcRefrigerantCharge({
      refrigerant: "R404A",
      T_evap_C: -35,
      tubeID_m: 0.0115,
      nCircuits: 12,
      L_per_circuit_m: 5,
    });

    expect(charge.kg).toBeGreaterThan(0.5);
    expect(charge.kg).toBeLessThan(3);
  });
});
