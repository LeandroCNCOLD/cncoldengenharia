// Tipos canônicos do catálogo técnico CN Cold.
// Todas as unidades já estão normalizadas (SI): °C, W, m³/h, Pa/kPa, L, m².

export type HeatExchangerType = "evaporator" | "condenser";

export type HeatExchangerCatalogItem = {
  id: string;
  type: HeatExchangerType;
  model: string;
  refrigerant: string;
  nominalCapacityW: number;
  nominalAirInletTempC: number;
  nominalExchangeTempC: number; // Tevap (evap) ou Tcond (cond)
  nominalDeltaT: number;
  airFlowM3h: number;
  airMassFlowKgh?: number;
  faceVelocityMs: number;
  exchangeAreaM2: number;
  internalVolumeL: number;
  rows: number;
  tubesPerRow: number;
  circuits: number;
  finSpacingMm: number;
  tubeOuterDiameterMm: number;
  tubeInnerDiameterMm: number;
  pressureDropAirPa?: number;
  pressureDropRefrigerantKpa?: number;
  sensibleCapacityW?: number;
  latentCapacityW?: number;
  sourceFile: string;
};

export type CompressorCatalogItem = {
  id: string;
  model: string;
  refrigerant: string;
  /** AHRI 540 - 10 coeficientes (capacidade ou potência). */
  polynomialCoefficients: number[];
  unitSystem: "SI" | "IP";
  sourceFile: string;
};

export type Catalog = {
  evaporators: HeatExchangerCatalogItem[];
  condensers: HeatExchangerCatalogItem[];
  compressors: CompressorCatalogItem[];
};

export class CatalogValidationError extends Error {
  constructor(
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "CatalogValidationError";
  }
}
