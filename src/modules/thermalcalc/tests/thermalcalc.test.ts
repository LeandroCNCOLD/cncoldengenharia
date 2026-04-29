import { describe, expect, it } from "vitest";

import {
  calculateAirSideHeatTransfer,
  calculateCoilGeometry,
  calculateEffectiveArea,
  calculateHeatTransfer,
  calculateRefrigerantCharge,
  calculateRefrigerantSideHeatTransfer,
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
    expect(geometry.externalTubeAreaM2).toBeCloseTo(8.996, 3);
    expect(geometry.externalFinAreaM2).toBeCloseTo(137.134, 3);
    expect(geometry.externalAreaM2).toBeCloseTo(146.13, 3);
    expect(geometry.effectiveExternalAreaM2).toBeGreaterThan(100);
    expect(geometry.finEfficiency).toBeGreaterThan(0.8);
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
    expect(geometry.externalTubeAreaM2).toBeCloseTo(0.861, 3);
    expect(geometry.externalFinAreaM2).toBeCloseTo(13.1, 3);
    expect(geometry.externalAreaM2).toBeCloseTo(13.962, 3);
    expect(charge.massKg).toBeCloseTo(1.32, 2);
  });

  it("calcula area efetiva com eficiencia de aleta para aletado ondulado", () => {
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
        surfaceType: "wavy",
      },
    };

    const area = calculateEffectiveArea(input, 55);

    expect(area.totalExternalAreaM2).toBeGreaterThan(130);
    expect(area.effectiveAreaM2).toBeLessThan(area.totalExternalAreaM2);
    expect(area.finEfficiency).toBeGreaterThan(0.75);
    expect(area.overallSurfaceEfficiency).toBeGreaterThan(0.75);
  });

  it("calcula h_air, h_refrigerante, U, DTML, capacidade e perdas de carga", () => {
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
        surfaceType: "louver",
        louverPitchMm: 1.4,
        louverAngleDeg: 27,
      },
    };

    const air = calculateAirSideHeatTransfer(input, { volumeFlowM3H: 6500 });
    const refrigerant = calculateRefrigerantSideHeatTransfer(
      input,
      {
        code: "R404A",
        massFlowKgS: 0.18,
        saturationTemperatureC: -8,
        quality: 0.35,
        correlation: "shah_evaporation",
      },
      -8,
    );
    const heat = calculateHeatTransfer({
      geometry: input,
      airInletTemperatureC: 0,
      airOutletTemperatureC: -4,
      refrigerantTemperatureC: -8,
      refrigerant: {
        code: "R404A",
        massFlowKgS: 0.18,
        saturationTemperatureC: -8,
        quality: 0.35,
        correlation: "shah_evaporation",
      },
      air: { volumeFlowM3H: 6500 },
    });

    expect(air.hAirWm2K).toBeGreaterThan(30);
    expect(air.correlation).toBe("Chang-Wang louver");
    expect(air.pressureDropPa).toBeGreaterThan(0);
    expect(refrigerant.hRefrigerantWm2K).toBeGreaterThan(500);
    expect(refrigerant.pressureDropPa).toBeGreaterThan(0);
    expect(heat.logMeanTemperatureDifferenceK).toBeCloseTo(5.77, 2);
    expect(heat.overallHeatTransferCoefficientWm2K).toBeGreaterThan(30);
    expect(heat.capacityW).toBeGreaterThan(20000);
    expect(heat.airPressureDropPa).toBeGreaterThan(0);
    expect(heat.refrigerantPressureDropPa).toBeGreaterThan(0);
  });

  it("valida circuitos e geometria incoerente antes do cálculo", () => {
    const warnings = validateCoilGeometry({
      tube: {
        outerDiameterMm: 9.52,
        wallThicknessMm: 5,
        rowPitchMm: 0,
        usefulLengthMm: 600,
        rows: 1,
        tubesPerRow: 3,
        circuits: 5,
        tubePitchMm: 0,
      },
      fin: {
        finPitchMm: 0,
      },
    });

    expect(warnings.map((w) => w.code)).toContain("INVALID_INNER_DIAMETER");
    expect(warnings.map((w) => w.code)).toContain("CIRCUITS_EXCEED_TUBES");
    expect(warnings.map((w) => w.code)).toContain("INVALID_FIN_PITCH");
    expect(warnings.map((w) => w.code)).toContain("ROW_PITCH_TOO_SMALL");
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
        air: { volumeFlowM3H: 1200 },
        refrigerant: { code: "R290", massFlowKgS: 0.03, quality: 0.2 },
      },
    });

    expect(result.refrigerantCharge?.massKg).toBeGreaterThan(0);
    expect(result.heatTransfer?.capacityW).toBeGreaterThan(0);
    expect(result.warnings.filter((w) => w.severity === "error")).toHaveLength(0);
  });
});
