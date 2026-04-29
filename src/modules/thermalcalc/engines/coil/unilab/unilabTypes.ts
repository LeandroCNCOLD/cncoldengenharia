// Tipos canônicos da camada Unilab. Espelham o que o motor híbrido consome
// (não dependem do schema bruto do banco — o mapper faz a tradução).

import type { CoilMode, FinType, TubeType, UnilabFactors } from '../engines/types';

export interface UnilabGeometry {
  geometryCode: string;
  sigla?: string | null;
  mode: CoilMode;
  finType: FinType;
  tubeType: TubeType;
  tubeOuterDiameterMm: number;
  tubeInnerDiameterMm: number;
  tubePitchMm: number;
  rowPitchMm: number;
  finPitchMm: number;
  finThicknessMm: number;
  rows?: number | null;
  circuits?: number | null;
}

export type UnilabGeometryFactors = UnilabFactors & {
  geometryCode: string;
};

export interface UnilabFluidProperties {
  fluidCode: string;
  temperatureC: number;
  liquidDensityKgM3?: number;
  vapourDensityKgM3?: number;
  liquidCpKjKgK?: number;
  vapourCpKjKgK?: number;
  liquidViscosityUPaS?: number;
  vapourViscosityUPaS?: number;
  liquidConductivityWmK?: number;
  latentHeatKjKg?: number;
}

export interface UnilabBundle {
  geometry: UnilabGeometry | null;
  factors: UnilabGeometryFactors | null;
  source: 'unilab' | 'fallback' | 'partial';
  warnings: string[];
}
