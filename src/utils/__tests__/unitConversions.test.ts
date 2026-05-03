import { describe, expect, it } from "vitest";
import { convertPower, fmtBR } from "../unitConversions";

describe("convertPower", () => {
  it("1000W = 860 kcal/h", () => {
    expect(convertPower(1000, "kcal/h")).toBeCloseTo(860, 0);
  });

  it("1000W = 3412 BTU/h", () => {
    expect(convertPower(1000, "BTU/h")).toBeCloseTo(3412, 0);
  });

  it("3517W = 1 TR", () => {
    expect(convertPower(3517, "TR")).toBeCloseTo(1, 2);
  });
});

describe("fmtBR — formatação pt-BR", () => {
  it("formata 5000 como 5.000,0 com 1 decimal", () => {
    expect(fmtBR(5000, 1)).toBe("5.000,0");
  });

  it("formata 13312 como 13.312 com 0 decimais", () => {
    expect(fmtBR(13312, 0)).toBe("13.312");
  });

  it("formata 128.7 como 128,7 com 1 decimal", () => {
    expect(fmtBR(128.7, 1)).toBe("128,7");
  });

  it("retorna '—' para undefined", () => {
    expect(fmtBR(undefined)).toBe("—");
  });

  it("retorna '—' para NaN", () => {
    expect(fmtBR(NaN)).toBe("—");
  });

  it("formata 2626 como 2.626 com 0 decimais (vazão ventilador)", () => {
    expect(fmtBR(2626, 0)).toBe("2.626");
  });
});
