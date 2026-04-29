// Tipos canônicos da camada de correlações.
// Toda correlação (ar / refrigerante / ΔP) recebe um CorrelationContext e
// devolve um CorrelationResult — uniformizando seleção, fallback e debug.

export type CoilSide = 'evaporator' | 'condenser';

export type Phase =
  | 'single_phase'
  | 'two_phase_evaporation'
  | 'two_phase_condensation';

export type FinType = 'plain' | 'wavy' | 'louver' | 'herringbone' | 'unknown';
export type TubeType = 'smooth' | 'microfin' | 'grooved' | 'unknown';

export type CoilMode =
  | 'cooling'
  | 'heating'
  | 'condensation'
  | 'direct_expansion'
  | 'steam'
  | 'pump_evaporator'
  | 'multiphase';

export interface CorrelationContext {
  coilType: CoilSide;
  mode: CoilMode;
  finType: FinType;
  tubeType: TubeType;
  wet: boolean;
  phase: Phase;

  reynoldsAir: number;
  reynoldsRefrigerant: number;
  prandtlAir: number;
  prandtlRefrigerant: number;

  airVelocityMs: number;
  refrigerantMassFluxKgM2s: number;

  airDensityKgM3: number;
  airViscosityPaS: number;
  airConductivityWmK: number;
  airSpecificHeatJkgK: number;

  hydraulicDiameterAirM: number;
  tubeInnerDiameterM: number;

  refrigerant?: string;
  geometryCode?: string;
}

export interface CorrelationResult {
  /** Nome humano e auditável (ex.: "ChangWangLouverHTC"). */
  correlationName: string;
  /** Grupo lógico — "air_dry", "ref_two_phase_evap", etc. */
  group: string;
  /** Valor calculado (h em W/m²K, ou ΔP em Pa). */
  value: number;
  /** 0..1 — quanto confiamos no valor. */
  confidence: number;
  /** Se true, valor é aproximação ou fallback. */
  isEstimated: boolean;
  warnings: string[];
}
