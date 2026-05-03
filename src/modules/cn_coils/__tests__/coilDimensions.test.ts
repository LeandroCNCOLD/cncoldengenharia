import { describe, expect, it } from "vitest";
import { calcCoilHeight, validateFanFit } from "../utils/coilDerivedMetrics";

describe("coil dimensions helpers", () => {
  it("24 tubos × 31.75mm → altura = 762mm", () => {
    expect(calcCoilHeight(24, 31.75)).toBe(762);
  });

  it("ventilador Ø800mm NÃO cabe em altura 762mm", () => {
    const v = validateFanFit({
      fanD: 800,
      altura_mm: 762,
      largura_mm: 1250,
      nFans: 1,
    });

    expect(v.fitsHeight).toBe(false);
    expect(v.warnings[0]).toContain("800");
    expect(v.warnings[0]).toContain("762");
  });

  it("ventilador Ø500mm CABE em altura 762mm e largura 1250mm", () => {
    const v = validateFanFit({
      fanD: 500,
      altura_mm: 762,
      largura_mm: 1250,
      nFans: 2,
    });

    expect(v.fitsHeight).toBe(true);
    expect(v.fitsWidthTotal).toBe(true);
  });

  it("2× Ø700mm NÃO CABE na largura 1250mm", () => {
    const v = validateFanFit({
      fanD: 700,
      altura_mm: 762,
      largura_mm: 1250,
      nFans: 2,
    });

    expect(v.fitsWidthTotal).toBe(false);
    expect(v.warnings[0]).toContain("1400");
  });
});
