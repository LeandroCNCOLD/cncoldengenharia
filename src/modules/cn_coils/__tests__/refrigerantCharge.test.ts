import { describe, expect, it } from "vitest";
import { calcRefrigerantCharge } from "../utils/coilDerivedMetrics";

describe("calcRefrigerantCharge", () => {
  it("R404A, Te=-35°C, 12 circuitos, ID=11.5mm → volume e carga reais", () => {
    const charge = calcRefrigerantCharge({
      refrigerant: "R404A",
      T_evap_C: -35,
      tubeID_m: 0.0115,
      nTubesPerRow: 24,
      nRows: 4,
      nCircuits: 12,
      L_fin_m: 1.25,
    });

    expect(charge.L).toBeCloseTo(12.46, 0);
    expect(charge.kg).toBeCloseTo(14.65, 0);
  });
});
