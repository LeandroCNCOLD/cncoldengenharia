// ColdPro — Etapa 7: Sistema completo (evap + comp + cond)
// Tipos compartilhados entre os engines.

export type Refrigerant = string; // 'R404A' | 'R134a' | 'R290' | 'R744' | ...

export type Bottleneck = "evaporator" | "compressor" | "condenser" | "balanced" | "unknown";

/** Entrada do simulador de sistema completo. */
export interface SystemInput {
  /** Geometria do evaporador — código de catálogo Unilab/legado. */
  evaporatorGeometryCode: string;
  /** Geometria do condensador. */
  condenserGeometryCode: string;
  refrigerant: Refrigerant;

  /** Temperatura de evaporação inicial (chute) °C. */
  evaporatingTempC: number;
  /** Temperatura de condensação inicial (chute) °C. */
  condensingTempC: number;

  /** Temperatura do ar entrando no evaporador (câmara) °C. */
  airInletEvapC: number;
  /** Temperatura do ar entrando no condensador (ambiente) °C. */
  airInletCondC: number;

  airflowEvapM3h: number;
  airflowCondM3h: number;

  /** Modelo do compressor (chave para lookup de polinômios). */
  compressorModel: string;
  resolvedTechnicalData?: SystemResolvedTechnicalData;

  superheatK: number;
  subcoolingK: number;

  /** Tolerância do solver (default 0.03 = 3%). */
  tolerance?: number;
  /** Máximo de iterações (default 25). */
  maxIterations?: number;
}

export interface SystemResolvedCoilData {
  geometry: import("../coil/internals/types").GeometryInput;
  factors?: import("../coil/internals/types").UnilabFactors;
  unilabSource?: import("../coil/internals/types").UnilabSource;
  warnings?: string[];
}

export interface SystemResolvedFanData {
  nominalAirflowM3h?: number | null;
  nominalPressurePa?: number | null;
  nominalPowerW?: number | null;
  warnings?: string[];
}

export interface SystemResolvedCompressorData {
  vapcycModel: import("./vapcycCompressorEngine").VapcycCompressorRecord;
  vapcycPolynomials: import("./vapcycCompressorEngine").VapcycPolynomialRecord[];
  warnings?: string[];
}

export interface SystemResolvedTechnicalData {
  compressor?: SystemResolvedCompressorData;
  evaporatorCoil?: SystemResolvedCoilData;
  condenserCoil?: SystemResolvedCoilData;
  fans?: {
    evaporator?: SystemResolvedFanData;
    condenser?: SystemResolvedFanData;
  };
}

/** Polinômio AHRI 540 / EN 12900 (10 coeficientes). */
export interface CompressorPolynomial {
  /**
   * X = capacidade (W) ou potência (W) =
   *   c0 + c1·Te + c2·Tc + c3·Te² + c4·Te·Tc + c5·Tc²
   *      + c6·Te³ + c7·Tc·Te² + c8·Te·Tc² + c9·Tc³
   * Te, Tc em °C.
   */
  c: [number, number, number, number, number, number, number, number, number, number];
}

export interface CompressorModelData {
  model: string;
  refrigerant: Refrigerant;
  capacity: CompressorPolynomial;
  power: CompressorPolynomial;
  massFlow?: CompressorPolynomial;
  /** Faixa válida — usado para warning. */
  envelope?: {
    teMinC?: number | null;
    teMaxC?: number | null;
    tcMinC?: number | null;
    tcMaxC?: number | null;
  };
  /** Superaquecimento de referência da curva (K). */
  refSuperheatK?: number;
  /** Subresfriamento de referência (K). */
  refSubcoolingK?: number;
}

export interface CompressorResult {
  model: string;
  refrigerant: Refrigerant;
  qCompW: number;
  powerW: number;
  /** Vazão mássica estimada kg/h (a partir de Δh latente aproximado). */
  massFlowKgh: number;
  inEnvelope: boolean;
  warnings: string[];
}

export interface SectionResult {
  capacityW: number;
  uWm2K: number;
  hAirWm2K: number;
  hRefWm2K: number;
  airOutletTempC?: number;
  effectiveAreaM2: number;
  warnings: string[];
}

export interface SystemResult {
  /** Capacidade real do sistema (mínimo evap/comp considerando equilíbrio). */
  capacityRealW: number;
  compressorCapacityW: number;
  condenserCapacityW: number;
  evaporatorCapacityW: number;
  compressorPowerW: number;

  cop: number;
  /** Erro residual de balanço energético (qCond - (qEvap + W)) / qEvap. */
  energyBalanceError: number;

  /** Temperaturas de equilíbrio convergidas. */
  evaporatingTempC: number;
  condensingTempC: number;

  /** Aproveitamento (0..1) — capacidade real / capacidade nominal de cada etapa. */
  utilizationEvap: number;
  utilizationCond: number;
  utilizationComp: number;

  bottleneck: Bottleneck;

  iterations: number;
  converged: boolean;

  evaporator: SectionResult;
  condenser: SectionResult;
  compressor: CompressorResult;

  warnings: string[];
  debug: Record<string, unknown>;
}
