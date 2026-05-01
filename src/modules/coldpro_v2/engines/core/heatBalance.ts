export interface SensibleHeatParams {
  massFlow_kg_s: number;
  cp_j_kg_k: number;
  deltaT_k: number;
}

export function calculateSensibleHeatW(params: SensibleHeatParams): number {
  return params.massFlow_kg_s * params.cp_j_kg_k * params.deltaT_k;
}

export function calculateMassFlowAirKgS(airflow_m3h: number, density_kg_m3: number): number {
  return (airflow_m3h / 3600) * density_kg_m3;
}

export function calculateHeatCapacityRateW_K(massFlow_kg_s: number, cp_j_kg_k: number): number {
  return massFlow_kg_s * cp_j_kg_k;
}
