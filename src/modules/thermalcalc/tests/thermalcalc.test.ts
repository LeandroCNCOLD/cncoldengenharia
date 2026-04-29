import { describe, expect, it } from "vitest";

import {
  calculateCoilGeometry,
  calculateRefrigerantCharge,
  calculateThermalCalc,
  validateCoilGeometry,
} from "../engines";
import type { CoilGeometryInput } from "../types";

const baseTube = {
  outerDiameterMm: 9.52,
  wallThicknessMm: 0.35,
  tubePitchMm: 25,
  rowPitchMm: 22,
};

describe("thermalcalc geometry engine", () => {
  it("calcula caso real 5 x 32 - 16 circuitos - passo 2,10 mm - 1880 mm", () => {
    const input: CoilGeometryInput = {
      tube: {
        ...baseTube,
        rows: 5,
        tubesPerRow: 32,
        circuits: 16,
        usefulLengthMm: 1880,
      },
      fin: {
        finPitchMm: 2.1,
        finThicknessMm: 0.12,
      },
    };

    const geometry = calculateCoilGeometry(input);
    const charge = calculateRefrigerantCharge(geometry.internalVolumeM3, "R404A", {
      referenceTemperatureC: -10,
    });

    expect(geometry.innerDiameterM).toBeCloseTo(0.00882, 8);
    expect(geometry.totalTubes).toBe(160);
    expect(geometry.totalTubeLengthM).toBeCloseTo(300.8, 6);
    expect(geometry.internalAreaM2).toBeCloseTo(8.335, 3);
    expect(geometry.internalVolumeM3).toBeCloseTo(0.018378, 6);
    expect(geometry.internalVolumeL).toBeCloseTo(18.378, 3);
    expect(geometry.finCount).toBe(895);
    expect(geometry.externalAreaM2).toBeGreaterThan(30);
    expect(charge.massKg).toBeCloseTo(11.91, 2);
    expect(geometry.warnings.filter((w) => w.severity === "error")).toHaveLength(0);
  });

  it("calcula caso real 3 x 16 - 3 circuitos - passo 2,10 mm - 600 mm", () => {
    const input: CoilGeometryInput = {
      tube: {
        ...baseTube,
        rows: 3,
        tubesPerRow: 16,
        circuits: 3,
        usefulLengthMm: 600,
      },
      fin: {
        finPitchMm: 2.1,
        finThicknessMm: 0.12,
      },
    };

    const geometry = calculateCoilGeometry(input);
    const charge = calculateRefrigerantCharge(geometry.internalVolumeM3, "R134a");

    expect(geometry.innerDiameterM).toBeCloseTo(0.00882, 8);
    expect(geometry.totalTubes).toBe(48);
    expect(geometry.totalTubeLengthM).toBeCloseTo(28.8, 6);
    expect(geometry.internalAreaM2).toBeCloseTo(0.798, 3);
    expect(geometry.internalVolumeM3).toBeCloseTo(0.00176, 6);
    expect(geometry.internalVolumeL).toBeCloseTo(1.76, 3);
    expect(geometry.finCount).toBe(285);
    expect(charge.massKg).toBeCloseTo(1.32, 2);
  });

  it("valida circuitos e geometria incoerente antes do cálculo", () => {
    const warnings = validateCoilGeometry({
      tube: {
        outerDiameterMm: 9.52,
        wallThicknessMm: 5,
        usefulLengthMm: 600,
        rows: 1,
        tubesPerRow: 3,
        circuits: 5,
      },
      fin: {
        finPitchMm: 0,
      },
    });

    expect(warnings.map((w) => w.code)).toContain("INVALID_INNER_DIAMETER");
    expect(warnings.map((w) => w.code)).toContain("CIRCUITS_EXCEED_TUBES");
    expect(warnings.map((w) => w.code)).toContain("INVALID_FIN_PITCH");
  });

  it("compõe geometria, carga e capacidade térmica sem depender de React", () => {
    const result = calculateThermalCalc({
      geometry: {
        tube: {
          ...baseTube,
          rows: 3,
          tubesPerRow: 16,
          circuits: 3,
          usefulLengthMm: 600,
        },
        fin: {
          finPitchMm: 2.1,
          finThicknessMm: 0.12,
        },
      },
      refrigerantCode: "R290",
      heatTransfer: {
        airInletTemperatureC: 0,
        refrigerantTemperatureC: -8,
        overallHeatTransferCoefficientWm2K: 35,
      },
    });

    expect(result.refrigerantCharge?.massKg).toBeGreaterThan(0);
    expect(result.heatTransfer?.capacityW).toBeGreaterThan(0);
    expect(result.warnings.filter((w) => w.severity === "error")).toHaveLength(0);
  });
});
