export interface DarcyWeisbachParams {
  frictionFactor: number;
  length_m: number;
  hydraulicDiameter_m: number;
  density_kg_m3: number;
  velocity_m_s: number;
}

export function calculateDarcyWeisbachPressureDrop(params: DarcyWeisbachParams): number {
  const { frictionFactor, length_m, hydraulicDiameter_m, density_kg_m3, velocity_m_s } = params;

  if (hydraulicDiameter_m <= 0) return 0;

  return (
    (frictionFactor *
      (length_m / hydraulicDiameter_m) *
      (density_kg_m3 * velocity_m_s * velocity_m_s)) /
    2
  );
}
