/**
 * Serviço de ponte: converte propriedades de saturação (tabelas CoolProp)
 * para o formato FluidProps usado pelo motor V2 (simulatorCoreV2).
 */
import { getRefrigerantSatProps } from "./refrigerantProperties";

export interface FluidPropsForMotor {
  /** Densidade (kg/m3) */
  rho_kg_m3: number;
  /** Viscosidade dinâmica (Pa.s) */
  mu_Pa_s: number;
  /** Calor específico (J/kg.K) */
  cp_J_kgK: number;
  /** Condutividade térmica (W/m.K) */
  k_W_mK: number;
  warnings: string[];
}

/**
 * Retorna as propriedades do fluido na fase correta para o motor V2.
 * - Evaporador: usa propriedades do líquido saturado (fase dominante no tubo)
 * - Condensador: usa propriedades do vapor saturado (fase dominante na entrada)
 */
export async function getRefrigerantFluidProps(
  refrigerantId: string,
  T_sat_C: number,
  phase: "liquid" | "vapor",
): Promise<FluidPropsForMotor> {
  const satProps = await getRefrigerantSatProps(refrigerantId, T_sat_C);
  const src = phase === "liquid" ? satProps.liquid : satProps.vapor;

  return {
    rho_kg_m3: src.rho_kgm3,
    mu_Pa_s: src.mu_Pas,
    cp_J_kgK: src.cp_kJkgK * 1000,
    k_W_mK: src.k_WmK,
    warnings: satProps.warnings,
  };
}
