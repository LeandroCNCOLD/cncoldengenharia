export type FluidType = "water" | "glycol_30" | "glycol_50" | "refrigerant_default";

export interface FluidPropertiesInput {
  fluid: string;
  temperature_c: number;
  pressure_kpa?: number;
}

export interface FluidProperties {
  density_kg_m3: number;
  cp_j_kg_k: number;
  viscosity_pa_s: number;
  conductivity_w_m_k: number;
  prandtl: number;
  warnings: string[];
}

function waterProperties(T: number): FluidProperties {
  const warnings: string[] = [];
  if (T < 0 || T > 100) {
    warnings.push(`Temperatura ${T.toFixed(1)}°C fora da faixa válida para água (0–100°C)`);
  }

  const density_kg_m3 = 999.83 - 0.0624 * T - 0.00363 * T * T;
  const cp_j_kg_k = 4217.6 - 3.2 * T + 0.0952 * T * T;
  const viscosity_pa_s = 0.001787 * Math.exp(-0.0249 * T);
  const conductivity_w_m_k = 0.5694 + 0.00188 * T - 0.0000073 * T * T;
  const prandtl = (cp_j_kg_k * viscosity_pa_s) / Math.max(conductivity_w_m_k, 1e-10);

  return { density_kg_m3, cp_j_kg_k, viscosity_pa_s, conductivity_w_m_k, prandtl, warnings };
}

function glycol30Properties(T: number): FluidProperties {
  const warnings: string[] = [];
  if (T < -15 || T > 80) {
    warnings.push(`Temperatura ${T.toFixed(1)}°C fora da faixa válida para glycol 30% (-15–80°C)`);
  }

  const density_kg_m3 = 1046.0 - 0.45 * T;
  const cp_j_kg_k = 3800.0 - 2.5 * T;
  const viscosity_pa_s = 0.003 * Math.exp(-0.025 * T);
  const conductivity_w_m_k = 0.432 + 0.00065 * T;
  const prandtl = (cp_j_kg_k * viscosity_pa_s) / Math.max(conductivity_w_m_k, 1e-10);

  return { density_kg_m3, cp_j_kg_k, viscosity_pa_s, conductivity_w_m_k, prandtl, warnings };
}

function glycol50Properties(T: number): FluidProperties {
  const warnings: string[] = [];
  if (T < -30 || T > 80) {
    warnings.push(`Temperatura ${T.toFixed(1)}°C fora da faixa válida para glycol 50% (-30–80°C)`);
  }

  const density_kg_m3 = 1075.0 - 0.55 * T;
  const cp_j_kg_k = 3350.0 - 3.0 * T;
  const viscosity_pa_s = 0.006 * Math.exp(-0.028 * T);
  const conductivity_w_m_k = 0.368 + 0.00055 * T;
  const prandtl = (cp_j_kg_k * viscosity_pa_s) / Math.max(conductivity_w_m_k, 1e-10);

  return { density_kg_m3, cp_j_kg_k, viscosity_pa_s, conductivity_w_m_k, prandtl, warnings };
}

function refrigerantDefaultProperties(): FluidProperties {
  return {
    density_kg_m3: 1200,
    cp_j_kg_k: 1400,
    viscosity_pa_s: 0.00015,
    conductivity_w_m_k: 0.085,
    prandtl: (1400 * 0.00015) / 0.085,
    warnings: [
      "refrigerant_default usa propriedades simplificadas. Modelo bifásico será implementado em fase posterior.",
    ],
  };
}

export function calculateFluidProperties(input: FluidPropertiesInput): FluidProperties {
  const fluid = input.fluid.toLowerCase().trim();
  const T = input.temperature_c;

  switch (fluid) {
    case "water":
      return waterProperties(T);
    case "glycol_30":
      return glycol30Properties(T);
    case "glycol_50":
      return glycol50Properties(T);
    case "refrigerant_default":
      return refrigerantDefaultProperties();
    default:
      return {
        ...refrigerantDefaultProperties(),
        warnings: [
          `Fluido desconhecido: "${input.fluid}". Usando propriedades default de refrigerante.`,
        ],
      };
  }
}
