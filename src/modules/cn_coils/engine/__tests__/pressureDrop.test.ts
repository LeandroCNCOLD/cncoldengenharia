import { describe, expect, it } from "vitest";
import { computeAirPressureDrop, computeFluidPressureDrop } from "../pressureDrop";

describe("computeAirPressureDrop", () => {
  it("computeAirPressureDrop — geometria 133228 a 4.84 m/s", () => {
    const result = computeAirPressureDrop({
      v_face_ms: 4.84,
      T_ar_C: -26,
      N_rows: 4,
      D_c_m: 0.0133 + 2 * 0.0001,
      fin_pitch_m: 0.007,
      fin_thickness_m: 0.0001,
      tube_pitch_transv_m: 0.0381,
      tube_pitch_longit_m: 0.033,
    });

    expect(result.dP_Pa).toBeGreaterThan(10);
    expect(result.dP_Pa).toBeLessThan(150);
    expect(result.warnings).toHaveLength(0);
  });
});

describe("computeFluidPressureDrop", () => {
  it("computeFluidPressureDrop — R404A, Te=-35°C, 12 circuitos", () => {
    const result = computeFluidPressureDrop({
      refrigerant: "R404A",
      T_evap_C: -35,
      mass_flow_kg_s: 0.15,
      n_circuits: 12,
      L_tube_per_circuit_m: 8,
      D_i_m: 0.0115,
    });

    expect(result.dP_kPa).toBeGreaterThan(0.1);
    expect(result.dP_kPa).toBeLessThan(50);
    expect(result.warnings).toHaveLength(0);
  });
});
