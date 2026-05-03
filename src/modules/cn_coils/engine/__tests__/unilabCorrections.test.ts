import { describe, expect, it } from "vitest";
import { applyAirVelocityCorrection } from "../unilabCorrections";
import type { AirVelocityCorrectionItem } from "../../types/unilab.types";

const CATALOG: AirVelocityCorrectionItem[] = [
  {
    geometryId: "1",
    vMin: 1,
    vMax: 4,
    coefficients: [1.1],
  },
];

describe("applyAirVelocityCorrection", () => {
  it('geometria desconhecida usa fallback geometryId="1" sem warning', () => {
    const result = applyAirVelocityCorrection(
      "GEOM_QUALQUER_999",
      2.5,
      CATALOG,
    );

    expect(result.factor).toBeGreaterThan(0);
    expect(result.warnings).toHaveLength(0);
  });

  it("usa curva de fallback cuja faixa contém a velocidade de face", () => {
    const result = applyAirVelocityCorrection("GEOM_QUALQUER_999", 2.5, [
      {
        geometryId: "1",
        vMin: 0.5,
        vMax: 1,
        coefficients: [0.5],
      },
      {
        geometryId: "1",
        vMin: 2,
        vMax: 3,
        coefficients: [1.2],
      },
    ]);

    expect(result.factor).toBeCloseTo(1.2);
    expect(result.warnings).toHaveLength(0);
  });

  it("ignora a coluna extra do export UNILAB quando há 8 coeficientes", () => {
    const result = applyAirVelocityCorrection("GEOM_QUALQUER_999", 2.5, [
      {
        geometryId: "1",
        vMin: 1,
        vMax: 4,
        coefficients: [1, 0, 0, 0, 0, 0, 0, 1],
      },
    ]);

    expect(result.factor).toBe(1);
    expect(result.warnings).toHaveLength(0);
  });

  it("emite warning apenas quando catálogo está ausente", () => {
    const result = applyAirVelocityCorrection("GEOM_QUALQUER_999", 2.5, []);

    expect(result.factor).toBe(1);
    expect(result.warnings).toEqual([
      "Catálogo de coeficientes UNILAB ausente ou vazio.",
    ]);
  });
});
