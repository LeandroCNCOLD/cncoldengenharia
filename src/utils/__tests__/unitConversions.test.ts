import { describe, expect, it } from "vitest";
import { convertPower } from "../unitConversions";

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
