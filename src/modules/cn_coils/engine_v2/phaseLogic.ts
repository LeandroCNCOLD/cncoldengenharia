// Determinação da fase do refrigerante na seção considerada.
// Baseado em superaquecimento (SH) e subresfriamento (SC) declarados.
//
// Convenção:
//  - SH > 0  → vapor superaquecido na saída do evaporador
//  - SC > 0  → líquido subresfriado na saída do condensador
//  - SH = 0 e SC = 0 → mistura bifásica (mudança de fase)

export type FluidPhase = "liquido" | "bifasico" | "superaquecido";

export interface PhaseInputs {
  superheatK: number;
  subcoolingK: number;
  /** Tipo do componente — define qual lado é o "interesse" */
  componentType:
    | "evaporator_dx"
    | "evaporator_pumped"
    | "condenser_air"
    | "condenser_shell_tube"
    | "heating_coil"
    | "cooling_coil"
    | "defrost_steam_coil"
    | "recuperator"
    | "shell_tube"
    | "chiller_unit";
}

export function determineFluidPhase(inputs: PhaseInputs): FluidPhase {
  const sh = Number.isFinite(inputs.superheatK) ? inputs.superheatK : 0;
  const sc = Number.isFinite(inputs.subcoolingK) ? inputs.subcoolingK : 0;

  switch (inputs.componentType) {
    case "evaporator_dx":
    case "evaporator_pumped":
      // Para o cálculo NTU-ε global, o fluido no evaporador é predominantemente bifásico.
      // O SH é uma condição de saída (boundary condition), não uma fase global.
      // Usar C_fluido = Infinity (mudança de fase) é consistente com o modelo NTU-ε
      // e com o motor V1 (Cr = 0). A variável `sh` é mantida para uso futuro.
      void sh;
      return "bifasico";
    case "condenser_air":
    case "condenser_shell_tube":
      // A condensação ocorre a temperatura constante (C_fluido → ∞ no modelo NTU-ε).
      // O subresfriamento (SC) é uma condição de saída, não uma fase global do trocador.
      // Tratar como "liquido" quando SC > 0 causaria Cmin = m_dot × cp_liq ≪ cAir,
      // resultando em capacidade subestimada em 10-15×.
      // Referência: ASHRAE Fundamentals 2017, Cap. 23; Incropera 7ª ed., Cap. 11.
      void sc;
      return "bifasico";
    case "heating_coil":
    case "cooling_coil":
      // hidrônico — sempre líquido monofásico
      return "liquido";
    case "defrost_steam_coil":
      // vapor saturado condensando — bifásico
      return "bifasico";
    default:
      return "bifasico";
  }
}
