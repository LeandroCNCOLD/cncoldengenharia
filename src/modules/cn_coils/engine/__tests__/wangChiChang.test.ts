import { describe, expect, it } from "vitest";
import { calculateWangChiChang } from "../wangChiChang";

const BASE_PARAMS = {
  tubeOdMm: 9.52,
  finThicknessMm: 0.12,
  finPitchMm: 2.5,
  rowPitchMm: 21.65,
  tubePitchMm: 25,
  numberOfRows: 4,
  airFaceVelocityMs: 2.5,
};

describe("calculateWangChiChang — Reynolds range handling", () => {
  it("Wang-Chi-Chang Re=7500 — sem warning (dentro da faixa estendida)", () => {
    const result = calculateWangChiChang({
      ...BASE_PARAMS,
      Re: 7500,
      Pr: 0.72,
    });

    expect(
      result.warnings.filter((warning) => warning.includes("fora da faixa")),
    ).toHaveLength(0);
  });

  it("Wang-Chi-Chang Re=200 — aviso de laminar", () => {
    const result = calculateWangChiChang({
      ...BASE_PARAMS,
      Re: 200,
      Pr: 0.72,
    });

    expect(
      result.warnings.some(
        (warning) => warning.includes("laminar") || warning.includes("fora"),
      ),
    ).toBe(true);
    expect(result.hAirWm2K).toBeGreaterThan(0);
  });
});
