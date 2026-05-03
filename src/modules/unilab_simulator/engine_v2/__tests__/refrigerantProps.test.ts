import { describe, it, expect } from "vitest";
import { getRefrigerantLiquidProps } from "../refrigerantProps";

describe("getRefrigerantLiquidProps — NIST interpolated tables", () => {
  it("R404A at -10°C returns expected properties", () => {
    const p = getRefrigerantLiquidProps("R404A", -10);
    expect(p.rho_kg_m3).toBeCloseTo(1120, -1);
    expect(p.cp_J_kgK).toBeCloseTo(1370, -1);
    expect(p.mu_Pa_s).toBeCloseTo(2.0e-4, 5);
    expect(p.k_W_mK).toBeCloseTo(0.083, 2);
    expect(p.warnings).toHaveLength(0);
  });

  it("REF_R410A at 0°C returns expected density and h_fg", () => {
    const p = getRefrigerantLiquidProps("REF_R410A", 0);
    expect(p.rho_kg_m3).toBeCloseTo(1088, -1);
    expect(p.h_fg_kJkg).toBeCloseTo(221, 0);
    expect(p.warnings).toHaveLength(0);
  });

  it("R717 (ammonia) at -20°C returns expected properties", () => {
    const p = getRefrigerantLiquidProps("R717", -20);
    expect(p.rho_kg_m3).toBeCloseTo(665, -1);
    expect(p.h_fg_kJkg).toBeCloseTo(1328, 0);
    expect(p.warnings).toHaveLength(0);
  });

  it("unknown refrigerant falls back to R404A with warning", () => {
    const p = getRefrigerantLiquidProps("R999X", -10);
    expect(p.rho_kg_m3).toBeCloseTo(1120, -1);
    expect(p.warnings.length).toBeGreaterThan(0);
    expect(p.warnings[0]).toContain("R999X");
    expect(p.warnings[0]).toContain("R404A");
  });
});
