// ColdPro — defaults de geometria por código de catálogo.
// Quando integrado a Unilab, este resolver buscará no banco; por ora usa parâmetros típicos.
import type { CoilMode, GeometryInput } from '../coil/engines/types';

interface GeometryPreset {
  tubeOd: number;
  tubeId: number;
  tubePitch: number;
  rowPitch: number;
  finPitch: number;
  finThickness: number;
  length: number;
  rows: number;
  tubesPerRow: number;
  circuits: number;
}

const EVAP_DEFAULT: GeometryPreset = {
  tubeOd: 9.52,
  tubeId: 8.92,
  tubePitch: 25,
  rowPitch: 22,
  finPitch: 4,
  finThickness: 0.13,
  length: 1000,
  rows: 4,
  tubesPerRow: 12,
  circuits: 4,
};

const COND_DEFAULT: GeometryPreset = {
  tubeOd: 9.52,
  tubeId: 8.92,
  tubePitch: 25,
  rowPitch: 22,
  finPitch: 2.1,
  finThickness: 0.13,
  length: 1000,
  rows: 3,
  tubesPerRow: 16,
  circuits: 6,
};

export function defaultGeometryFromCode(code: string, mode: CoilMode): GeometryInput {
  const preset = mode === 'condensation' ? COND_DEFAULT : EVAP_DEFAULT;
  return {
    code: code || (mode === 'condensation' ? 'COND_DEFAULT' : 'EVAP_DEFAULT'),
    mode,
    finType: 'wavy',
    tubeType: 'smooth',
    tubeOuterDiameterMm: preset.tubeOd,
    tubeInnerDiameterMm: preset.tubeId,
    tubePitchMm: preset.tubePitch,
    rowPitchMm: preset.rowPitch,
    finPitchMm: preset.finPitch,
    finThicknessMm: preset.finThickness,
    coilLengthMm: preset.length,
    coilHeightMm: preset.tubesPerRow * preset.tubePitch,
    coilDepthMm: preset.rows * preset.rowPitch,
    rows: preset.rows,
    tubesPerRow: preset.tubesPerRow,
    circuits: preset.circuits,
  };
}
