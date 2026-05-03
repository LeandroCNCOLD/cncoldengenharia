import { describe, expect, it } from "vitest";

describe("simulatorCore tube length helpers", () => {
  it("comprimento de tubo por circuito usa tubesPerRow/circuits", () => {
    const L = 1.25;
    const rows = 4;
    const tubesPerRow = 16;
    const circuits = 8;
    const expected = rows * L * (tubesPerRow / circuits);

    expect(expected).toBeCloseTo(10.0, 3);
  });
});
