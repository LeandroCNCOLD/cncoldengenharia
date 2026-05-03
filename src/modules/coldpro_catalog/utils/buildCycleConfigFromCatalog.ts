import type { CycleSystemConfig } from "@/modules/cn_coils/engines/cycle/cycleTypes";
import type { CompressorRecord } from "@/modules/cn_coils/engines/compressor/compressorModel";
import type { CatalogEquipmentRow } from "../data/equipmentCatalog.types";

/** Compressor fallback (Bitzer 2KES-05 R404A) usado quando não houver match no catálogo de coeficientes. */
const FALLBACK_COMPRESSOR: CompressorRecord = {
  id: "BITZER_2KES05",
  model: "2KES-05",
  manufacturer: "BITZER",
  refrigerant: "R404A",
  modelType: "bitzer_native",
  bitzerNative: {
    displacement_m3h: 4.06,
    coeff_lambda: [1.08, -0.0069, 4.66e-5],
    coeff_current: [-0.116, 0.00605, -9.54e-5],
    coeff_specific_power: [0.565, 0.0155, 1.99e-4],
    rpm: 1450,
  },
};

const DEFAULT_EVAPORATOR: CycleSystemConfig["evaporator"] = {
  physical: {
    rows: 4,
    finnedLengthMm: 1250,
    finnedHeightMm: 400,
    finPitchMm: 6,
    tubePitchTransversalMm: 38.1,
    tubePitchLongitudinalMm: 33,
    tubeExternalDiameterMm: 12.7,
    tubeInternalDiameterMm: 11.5,
    tubesPerRow: 10,
    circuits: 5,
    finThicknessMm: 0.15,
    finType: "plain",
  },
  airInletTempC: 5,
  airRelativeHumidity: 0.85,
  airFlowM3H: 5000,
  superheatK: 5,
  subcoolingK: 5,
  htCatalog: {},
  tubeMaterialConductivity: 385,
};

const DEFAULT_CONDENSER: CycleSystemConfig["condenser"] = {
  physical: {
    rows: 2,
    finnedLengthMm: 800,
    finnedHeightMm: 600,
    finPitchMm: 3,
    tubePitchTransversalMm: 25.4,
    tubePitchLongitudinalMm: 22,
    tubeExternalDiameterMm: 9.52,
    tubeInternalDiameterMm: 8.5,
    tubesPerRow: 24,
    circuits: 4,
    finThicknessMm: 0.1,
    finType: "plain",
  },
  airInletTempC: 32,
  airRelativeHumidity: 0.5,
  airFlowM3H: 8000,
  superheatK: 0,
  subcoolingK: 5,
  htCatalog: {},
  tubeMaterialConductivity: 385,
};

export interface BuildCycleConfigInputs {
  row: CatalogEquipmentRow;
  refrigerantId: string;
  Te_C: number;
  Tc_C: number;
  superheatK: number;
  subcoolingK: number;
  compressor?: CompressorRecord | null;
}

export function buildCycleConfigFromCatalog({
  row,
  refrigerantId,
  Te_C,
  Tc_C,
  superheatK,
  subcoolingK,
  compressor,
}: BuildCycleConfigInputs): CycleSystemConfig {
  const comp: CompressorRecord = compressor
    ? { ...compressor, refrigerant: refrigerantId }
    : { ...FALLBACK_COMPRESSOR, refrigerant: refrigerantId };

  // Air inlet near catalog evap/cond temperatures (a bit warmer than Te / cooler than Tc)
  const airEvapIn = Math.max(Te_C + 8, -30);
  const airCondIn = Math.max(Tc_C - 12, 20);

  return {
    id: `catalog-validation-${row.id}`,
    name: `Validação ${row.modelo}`,
    refrigerantId,
    compressor: comp,
    evaporator: {
      ...DEFAULT_EVAPORATOR,
      airInletTempC: airEvapIn,
      superheatK,
    },
    condenser: {
      ...DEFAULT_CONDENSER,
      airInletTempC: airCondIn,
      subcoolingK,
    },
    expansionDevice: { type: "txv", superheatTarget_K: superheatK },
    solver: {
      Te_initial_C: Te_C,
      Tc_initial_C: Tc_C,
      tolerance: 0.02,
      maxIterations: 30,
      relaxation: 0.4,
    },
  };
}
