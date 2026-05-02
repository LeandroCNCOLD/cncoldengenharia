export interface AirGeometryInput {
  face_area_m2: number;
  tube_outer_diameter_m: number;
  tube_pitch_transverse_m: number;
  tube_pitch_longitudinal_m: number;
  fin_spacing_mm: number;
  fin_thickness_mm?: number;
  rows: number;
}

export interface AirGeometryResult {
  free_flow_area_ratio: number;
  hydraulic_diameter_m: number;
  air_total_area_m2: number;
  fin_density: number;
  warnings: string[];
}

export function calculateAirGeometry(input: AirGeometryInput): AirGeometryResult {
  const warnings: string[] = [];
  const Do = input.tube_outer_diameter_m;
  const pitchT = input.tube_pitch_transverse_m;
  const finPitchM = input.fin_spacing_mm / 1000;
  const finDensity = finPitchM > 0 ? 1 / finPitchM : 0;

  let finThickM: number;
  if (input.fin_thickness_mm !== undefined) {
    finThickM = input.fin_thickness_mm / 1000;
  } else {
    finThickM = 0.0001;
    warnings.push("fin_thickness não fornecido. Usando default = 0.1mm.");
  }

  let sigma = 0.5;
  if (pitchT > 0 && Do > 0 && finPitchM > 0) {
    sigma = 1 - Do / pitchT - (finThickM / finPitchM) * (1 - Do / pitchT);
    sigma = Math.max(0.1, Math.min(0.95, sigma));
  }

  let Dh: number;
  if (finPitchM > 0 && pitchT > 0 && Do > 0 && pitchT > Do) {
    const num = 4 * finPitchM * (pitchT - Do);
    const den = 2 * (finPitchM + pitchT - Do);
    Dh = den > 0 ? num / den : 0.004;
  } else {
    Dh = 0.004;
    warnings.push(
      "Dh calculado por aproximação geométrica simplificada. Forneça fin_spacing_mm, tube_pitch_transverse_m e tube_outer_diameter_m para maior precisão.",
    );
  }

  const air_total_area_m2 = input.face_area_m2 * (1 + 2 * finDensity * input.rows);

  return {
    free_flow_area_ratio: sigma,
    hydraulic_diameter_m: Dh,
    air_total_area_m2,
    fin_density: finDensity,
    warnings,
  };
}
