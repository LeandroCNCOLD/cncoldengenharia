import { describe, expect, it } from "vitest";
import { computeOverallU } from "../heatTransfer";

describe("computeOverallU", () => {
  it("computeOverallU — cobre, h_o=45, h_i=3000", () => {
    // Tubo 13.3mm OD, 11.5mm ID (geometria 133228)
    const result = computeOverallU({
      h_o: 45,
      h_i: 3000,
      r_o_m: 0.00665,
      r_i_m: 0.00575,
      k_tube_WmK: 385,
    });

    expect(result.U_o).toBeCloseTo(44.1, 0);
    expect(result.warnings).toHaveLength(0);
  });

  it("computeOverallU — fallback quando h_o=0", () => {
    const result = computeOverallU({
      h_o: 0,
      h_i: 3000,
      r_o_m: 0.00665,
      r_i_m: 0.00575,
    });

    expect(result.U_o).toBe(35);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
