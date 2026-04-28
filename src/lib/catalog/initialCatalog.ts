// Catálogo técnico inicial CN Cold (entradas manuais já normalizadas).
import type {
  Catalog,
  CompressorCatalogItem,
  HeatExchangerCatalogItem,
} from "./types";

export const evaporatorCN1200LT: HeatExchangerCatalogItem = {
  id: "evap-cn-1200-lt",
  type: "evaporator",
  model: "CN 1200 LT",
  refrigerant: "R404A",
  nominalCapacityW: 1200,
  nominalAirInletTempC: 0,
  nominalExchangeTempC: -8,
  nominalDeltaT: 8,
  airFlowM3h: 850,
  faceVelocityMs: 2.0,
  exchangeAreaM2: 6.5,
  internalVolumeL: 1.2,
  rows: 3,
  tubesPerRow: 12,
  circuits: 3,
  finSpacingMm: 4.5,
  tubeOuterDiameterMm: 9.52,
  tubeInnerDiameterMm: 8.7,
  sourceFile: "manual:cn-1200-lt-evap",
};

export const condenserCN1200LT: HeatExchangerCatalogItem = {
  id: "cond-cn-1200-lt",
  type: "condenser",
  model: "CN 1200 LT",
  refrigerant: "R404A",
  nominalCapacityW: 1800,
  nominalAirInletTempC: 32,
  nominalExchangeTempC: 45,
  nominalDeltaT: 13,
  airFlowM3h: 1500,
  faceVelocityMs: 2.5,
  exchangeAreaM2: 8.0,
  internalVolumeL: 1.8,
  rows: 2,
  tubesPerRow: 16,
  circuits: 4,
  finSpacingMm: 2.1,
  tubeOuterDiameterMm: 9.52,
  tubeInnerDiameterMm: 8.7,
  sourceFile: "manual:cn-1200-lt-cond",
};

// Coeficientes AHRI-540 placeholder para Copeland (substituir pelos reais do CSV).
export const compressorCopelandPlaceholder: CompressorCatalogItem = {
  id: "comp-copeland-placeholder",
  model: "Copeland ZB",
  refrigerant: "R404A",
  polynomialCoefficients: [
    1500, 50, -30, 0.5, -0.2, 0.1, 0.001, -0.0005, 0.0002, -0.0001,
  ],
  unitSystem: "SI",
  sourceFile: "manual:copeland-placeholder",
};

export const initialCatalog: Catalog = {
  evaporators: [evaporatorCN1200LT],
  condensers: [condenserCN1200LT],
  compressors: [compressorCopelandPlaceholder],
};
