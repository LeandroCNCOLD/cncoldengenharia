import { describe, expect, it } from "vitest";
import { validatePhysicalInputs } from "../validators/simulationValidator";
import type { CnCoilsPhysicalInputs } from "../types/cncoils.types";

const VALID_PHYSICAL_INPUTS: CnCoilsPhysicalInputs = {
  componentType: "evaporator_dx",
  geometryId: "133228_C_S",
  finnedHeightMm: 600,
  finnedLengthMm: 1250,
  rows: 4,
  circuits: 12,
  tubeMaterialId: "copper",
  finPitchMm: 3,
  finThicknessMm: 0.12,
  tubePitchTransverseMm: 33,
  tubePitchLongitudinalMm: 28,
  tubeOuterDiameterMm: 12.7,
  tubeInnerDiameterMm: 11.7,
};

describe("validatePhysicalInputs", () => {
  it("requires a selected geometry before calculation", () => {
    const result = validatePhysicalInputs({
      ...VALID_PHYSICAL_INPUTS,
      geometryId: "  ",
    });

    expect(result).toEqual({
      isValid: false,
      errors: ["Selecione uma geometria antes de calcular."],
    });
  });

  it("accepts complete physical inputs with geometry", () => {
    expect(validatePhysicalInputs(VALID_PHYSICAL_INPUTS)).toEqual({
      isValid: true,
      errors: [],
    });
  });
});
