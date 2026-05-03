import { describe, it, expect } from "vitest";
import { calcCoilEffectiveArea, calcFinEfficiency, calcEffectiveArea } from "../engine/effectiveArea";
import { calcAirSideHeatTransfer, mihailovic2019 } from "../engine/wangChiChang";
import { getRefrigerantProps } from "../services/refrigerantProperties";
import { calcAirPressureDrop } from "../services/pressureDropService";

describe("calcCoilEffectiveArea — geometric area", () => {
  it("computes reasonable area for a typical 3-row coil", () => {
    const result = calcCoilEffectiveArea({
      N_rows: 3,
      N_tubes_per_row: 16,
      L_tube_m: 0.6,
      D_o_m: 0.0127,
      P_t_m: 0.0315,
      P_l_m: 0.027,
      F_p_m: 0.005,
      delta_f_m: 0.0001,
    });

    expect(result.A_total_m2).toBeGreaterThan(2.0);
    expect(result.A_total_m2).toBeLessThan(15.0);
    expect(result.A_internal_m2).toBeGreaterThan(0);
    expect(result.surface_ratio).toBeGreaterThan(5);
  });
});

describe("calcFinEfficiency — Schmidt 1949", () => {
  it("returns high efficiency for aluminum fins with typical geometry", () => {
    const eta = calcFinEfficiency(
      50,       // h_air W/m²K
      200,      // k_fin W/mK (aluminum)
      0.0001,   // delta_f m
      0.00635,  // r_o m
      0.0315,   // P_t m
      0.027,    // P_l m
    );

    expect(eta).toBeGreaterThanOrEqual(0.80);
    expect(eta).toBeLessThanOrEqual(1.0);
  });
});

describe("calcAirSideHeatTransfer — Wang-Chi-Chang plain", () => {
  it("computes physically reasonable h for plain fins (D_o <= 12mm)", () => {
    const result = calcAirSideHeatTransfer({
      finType: "plain",
      D_o: 0.0100,
      P_t: 0.025,
      P_l: 0.022,
      F_p: 0.003,
      N: 3,
      V_face: 2.5,
      T_air_C: 25,
    });

    expect(result.h_air_W_m2K).toBeGreaterThan(20);
    expect(result.h_air_W_m2K).toBeLessThan(150);
    expect(result.j).toBeGreaterThan(0);
    expect(result.j).toBeLessThan(1);
    expect(result.correlation).toBe("Wang-Chi-Chang-2000-plain");
  });
});

describe("calcAirSideHeatTransfer — Chang-Wang louver", () => {
  it("louver correlation produces physically valid h and correct label", () => {
    const louverResult = calcAirSideHeatTransfer({
      finType: "louver",
      D_o: 0.0100,
      P_t: 0.025,
      P_l: 0.022,
      F_p: 0.0018,
      N: 2,
      V_face: 2.0,
      T_air_C: 35,
      L_p: 0.0012,
      theta_L: 28,
      L_fin: 0.020,
    });

    expect(louverResult.h_air_W_m2K).toBeGreaterThan(0);
    expect(louverResult.h_air_W_m2K).toBeLessThan(300);
    expect(louverResult.j).toBeGreaterThan(0);
    expect(louverResult.j).toBeLessThan(1);
    expect(louverResult.correlation).toBe("Chang-Wang-1997-louver");
  });
});

describe("getRefrigerantProps — interpolated fluid properties", () => {
  it("R404A at -10°C returns expected density and Prandtl", () => {
    const props = getRefrigerantProps("R404A", -10, "liquid");
    expect(props).not.toBeNull();
    expect(props!.rho_kg_m3).toBeGreaterThan(1108 - 50);
    expect(props!.rho_kg_m3).toBeLessThan(1108 + 50);
    expect(props!.Pr).toBeGreaterThan(4.02 - 0.5);
    expect(props!.Pr).toBeLessThan(4.02 + 0.5);
  });

  it("R410A at 0°C returns expected density", () => {
    const props = getRefrigerantProps("R410A", 0, "liquid");
    expect(props).not.toBeNull();
    expect(props!.rho_kg_m3).toBeGreaterThan(1099 - 50);
    expect(props!.rho_kg_m3).toBeLessThan(1099 + 50);
  });

  it("unknown refrigerant returns null", () => {
    const props = getRefrigerantProps("R999X", -10, "liquid");
    expect(props).toBeNull();
  });
});

describe("calcAirPressureDrop — empirical polynomial", () => {
  it("reasonable pressure drop for typical conditions", () => {
    const dp = calcAirPressureDrop(2.5, 3, 3.0);
    expect(dp).toBeGreaterThan(0);
    expect(dp).toBeLessThan(200);
  });

  it("zero velocity gives non-negative result", () => {
    const dp = calcAirPressureDrop(0, 3, 3.0);
    expect(dp).toBeGreaterThanOrEqual(0);
  });
});

describe("mihailovic2019 — industrial evaporators (D_o > 12mm)", () => {
  it("D_o 13.3mm returns h_ar between 30 and 80 W/m²K", () => {
    const result = mihailovic2019({
      finType: "plain",
      D_o: 0.0133,
      P_t: 0.038,
      P_l: 0.033,
      F_p: 0.007,
      N: 4,
      V_face: 2.5,
      T_air_C: -5,
    });
    expect(result.h_air_W_m2K).toBeGreaterThan(30);
    expect(result.h_air_W_m2K).toBeLessThan(80);
    expect(result.correlation).toBe("Mihailovic-2019-industrial");
  });
});

describe("calcAirSideHeatTransfer — diameter-based routing", () => {
  it("Wang-Chi-Chang is NOT called for D_o > 12mm", () => {
    const result = calcAirSideHeatTransfer({
      finType: "plain",
      D_o: 0.0133,
      P_t: 0.038,
      P_l: 0.033,
      F_p: 0.007,
      N: 4,
      V_face: 2.5,
      T_air_C: -5,
    });
    expect(result.correlation).not.toBe("Wang-Chi-Chang-2000-plain");
    expect(result.h_air_W_m2K).toBeLessThan(100);
  });
});
