const MATERIAL_CONDUCTIVITY: Record<string, number> = {
  copper: 385,
  aluminum: 205,
  steel: 50,
  stainless_steel: 16,
};

export interface WallResistanceInput {
  tube_outer_diameter_m: number;
  tube_inner_diameter_m: number;
  tube_conductivity_w_mk?: number;
  tube_material?: string;
}

export interface WallResistanceResult {
  wall_resistance_m2k_w: number;
  warnings: string[];
}

export function calculateTubeWallResistance(input: WallResistanceInput): WallResistanceResult {
  const warnings: string[] = [];
  const Do = input.tube_outer_diameter_m;
  const Di = input.tube_inner_diameter_m;

  if (Do <= 0 || Di <= 0 || Di >= Do) {
    warnings.push("Diâmetros inválidos para cálculo de resistência de parede");
    return { wall_resistance_m2k_w: 0, warnings };
  }

  let k = input.tube_conductivity_w_mk ?? 0;

  if (k <= 0 && input.tube_material) {
    const mat = input.tube_material.toLowerCase().trim();
    k = MATERIAL_CONDUCTIVITY[mat] ?? 0;
    if (k <= 0) {
      warnings.push(`Material desconhecido: "${input.tube_material}". Usando copper como default.`);
      k = MATERIAL_CONDUCTIVITY["copper"]!;
    }
  }

  if (k <= 0) {
    k = MATERIAL_CONDUCTIVITY["copper"]!;
  }

  const wall_resistance_m2k_w = ((Do / 2) * Math.log(Do / Di)) / k;

  return { wall_resistance_m2k_w, warnings };
}
