import { calculateCoilGeometry } from "@/modules/thermalcalc/engines/geometry/coilGeometry";
import { calculateEffectiveArea } from "@/modules/thermalcalc/engines/geometry/effectiveArea";
import { wattsToKcalh } from "@/modules/thermalcalc/engines/units";
import type {
  HeatTransferInput,
  HeatTransferResult,
  ValidationWarning,
} from "@/modules/thermalcalc/types";
import { calculateAirSideHeatTransfer } from "./airSide";
import { calculateRefrigerantSideHeatTransfer } from "./refrigerantSide";

const DEFAULT_WALL_CONDUCTIVITY_WMK = 385;
const DEFAULT_WALL_FOULING_M2KW = 0.00005;

export function calculateLogMeanTemperatureDifference(
  airInletTemperatureC: number,
  airOutletTemperatureC: number | undefined,
  refrigerantTemperatureC: number,
  refrigerantOutletTemperatureC?: number,
): number {
  const refOut = refrigerantOutletTemperatureC ?? refrigerantTemperatureC;
  const airOut =
    airOutletTemperatureC ??
    airInletTemperatureC - (airInletTemperatureC - refrigerantTemperatureC) * 0.35;
  const dt1 = Math.abs(airInletTemperatureC - refOut);
  const dt2 = Math.abs(airOut - refrigerantTemperatureC);

  if (dt1 <= 0 || dt2 <= 0) return Math.max(dt1, dt2, 0);
  if (Math.abs(dt1 - dt2) < 1e-9) return dt1;
  return (dt1 - dt2) / Math.log(dt1 / dt2);
}

export function calculateOverallHeatTransferCoefficient(
  airHeatTransferCoefficientWm2K: number,
  refrigerantHeatTransferCoefficientWm2K: number,
  wallThicknessM: number,
  wallConductivityWmK = DEFAULT_WALL_CONDUCTIVITY_WMK,
  foulingM2KW = DEFAULT_WALL_FOULING_M2KW,
): number {
  const hAir = Math.max(airHeatTransferCoefficientWm2K, 1e-6);
  const hRef = Math.max(refrigerantHeatTransferCoefficientWm2K, 1e-6);
  const wallResistance = wallThicknessM > 0 ? wallThicknessM / wallConductivityWmK : 0;
  return 1 / (1 / hAir + wallResistance + foulingM2KW + 1 / hRef);
}

export function calculateHeatTransfer(input: HeatTransferInput): HeatTransferResult {
  const preliminaryGeometry = calculateCoilGeometry(input.geometry);
  const airSide = calculateAirSideHeatTransfer(input.geometry, input.air);
  const effectiveArea = calculateEffectiveArea(input.geometry, airSide.hAirWm2K);
  const effectiveAreaM2 =
    preliminaryGeometry.effectiveExternalAreaM2 * (input.effectiveAreaFactor ?? 1);
  const geometry = {
    ...preliminaryGeometry,
    effectiveExternalAreaM2: preliminaryGeometry.effectiveExternalAreaM2,
    finEfficiency: preliminaryGeometry.finEfficiency,
    overallSurfaceEfficiency: preliminaryGeometry.overallSurfaceEfficiency,
  };
  const refrigerantSide = calculateRefrigerantSideHeatTransfer(
    input.geometry,
    input.refrigerant,
    input.refrigerantTemperatureC,
  );
  const u =
    input.overallHeatTransferCoefficientWm2K ??
    calculateOverallHeatTransferCoefficient(
      airSide.hAirWm2K * preliminaryGeometry.overallSurfaceEfficiency,
      refrigerantSide.hRefrigerantWm2K,
      (input.geometry.tube.wallThicknessMm ?? 0.35) / 1000,
    );
  const lmtd = calculateLogMeanTemperatureDifference(
    input.airInletTemperatureC,
    input.airOutletTemperatureC,
    input.refrigerantTemperatureC,
    input.refrigerantOutletTemperatureC,
  );
  const deltaTemperatureK = Math.abs(input.airInletTemperatureC - input.refrigerantTemperatureC);
  const capacityW = u * effectiveAreaM2 * lmtd;
  const warnings: ValidationWarning[] = [
    ...geometry.warnings,
    ...(preliminaryGeometry.geometrySource === "calculated" ? effectiveArea.warnings : []),
    ...airSide.warnings,
    ...refrigerantSide.warnings,
  ];

  if (lmtd <= 0) {
    warnings.push({
      code: "INVALID_LMTD",
      severity: "error",
      message: "DTML deve ser maior que zero para calcular capacidade térmica.",
      path: "heatTransfer",
    });
  }

  return {
    deltaTemperatureK,
    logMeanTemperatureDifferenceK: lmtd,
    airHeatTransferCoefficientWm2K: airSide.hAirWm2K,
    refrigerantHeatTransferCoefficientWm2K: refrigerantSide.hRefrigerantWm2K,
    overallHeatTransferCoefficientWm2K: u,
    effectiveAreaM2,
    capacityW,
    capacityKcalh: wattsToKcalh(capacityW),
    airPressureDropPa: airSide.pressureDropPa,
    refrigerantPressureDropPa: refrigerantSide.pressureDropPa,
    airCorrelation: airSide.correlation,
    refrigerantCorrelation: refrigerantSide.correlation,
    geometry,
    effectiveArea: {
      ...effectiveArea,
      totalExternalAreaM2: preliminaryGeometry.externalAreaM2,
      effectiveAreaM2: preliminaryGeometry.effectiveExternalAreaM2,
      finEfficiency: preliminaryGeometry.finEfficiency,
      overallSurfaceEfficiency: preliminaryGeometry.overallSurfaceEfficiency,
    },
    warnings,
  };
}
