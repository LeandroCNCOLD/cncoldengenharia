import { describe, expect, it } from "vitest";
import { computeFluidVelocity } from "../utils/coilDerivedMetrics";

describe("computeFluidVelocity", () => {
  it("R404A, Te=-35°C, 12 circuitos, Q=13kW → v entre 0.3 e 2.5 m/s", () => {
    const velocity = computeFluidVelocity({
      refrigerant: "R404A",
      T_evap_C: -35,
      Q_total_W: 13000,
      nCircuits: 12,
      tubeID_m: 0.0115,
    });

    expect(velocity).toBeGreaterThan(0.3);
    expect(velocity).toBeLessThan(2.5);
  });
});
