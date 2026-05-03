// Configuração por aplicação UNILAB.
// Mapeia cada tipo de componente para os campos do Lado Fluido conforme o
// software original (Unilab Coils 9.0): condensador mostra Temp. Condensação +
// Subresfriamento, evaporador mostra Temp. Evaporação + Sobreaquecimento,
// baterias hidrônicas mostram Temp. Entrada/Saída do fluido, etc.
//
// Esta é apenas configuração de UI — não há cálculo aqui.

import type { UnilabComponentType } from "../types/unilab.types";

export type FluidKind = "refrigerant" | "water_glycol" | "steam";

export interface FluidFieldDef {
  key:
    | "condensingTemp"
    | "evaporatingTemp"
    | "superheat"
    | "subcooling"
    | "fluidInletTemp"
    | "fluidOutletTemp"
    | "fluidFlowMass"
    | "steamPressure";
  label: string;
  unit: string;
  required: boolean;
}

export interface ApplicationConfig {
  type: UnilabComponentType;
  label: string;
  shortLabel: string;
  fluidKind: FluidKind;
  /** Título do bloco direito */
  fluidPanelTitle: string;
  /** Campos exibidos no Lado Fluido (em ordem) */
  fluidFields: FluidFieldDef[];
  /** Mostra coluna de queda de pressão do fluido? */
  showFluidPressureDrop: boolean;
  /** Mostra velocidade do fluido (fase gás)? */
  showFluidVelocity: boolean;
}

export const APPLICATION_CONFIGS: Record<UnilabComponentType, ApplicationConfig> = {
  evaporator_dx: {
    type: "evaporator_dx",
    label: "Evaporador DX (Expansão Direta)",
    shortLabel: "Evaporador DX",
    fluidKind: "refrigerant",
    fluidPanelTitle: "LADO FLUIDO",
    fluidFields: [
      { key: "evaporatingTemp", label: "Temp. Evaporação", unit: "°C", required: true },
      { key: "superheat", label: "Sobreaquecimento", unit: "K", required: true },
    ],
    showFluidPressureDrop: true,
    showFluidVelocity: true,
  },
  evaporator_pumped: {
    type: "evaporator_pumped",
    label: "Evaporador Bombeado (Recirculado)",
    shortLabel: "Evaporador Bombeado",
    fluidKind: "refrigerant",
    fluidPanelTitle: "LADO FLUIDO",
    fluidFields: [
      { key: "evaporatingTemp", label: "Temp. Evaporação", unit: "°C", required: true },
    ],
    showFluidPressureDrop: true,
    showFluidVelocity: false,
  },
  condenser_air: {
    type: "condenser_air",
    label: "Condensador a Ar",
    shortLabel: "Condensador a Ar",
    fluidKind: "refrigerant",
    fluidPanelTitle: "LADO FLUIDO",
    fluidFields: [
      { key: "condensingTemp", label: "Temp. Condensação", unit: "°C", required: true },
      { key: "superheat", label: "Sobreaquecimento", unit: "K", required: true },
      { key: "subcooling", label: "Subresfriamento", unit: "K", required: true },
    ],
    showFluidPressureDrop: true,
    showFluidVelocity: true,
  },
  condenser_shell_tube: {
    type: "condenser_shell_tube",
    label: "Condensador Casco-Tubo",
    shortLabel: "Condensador Casco-Tubo",
    fluidKind: "refrigerant",
    fluidPanelTitle: "LADO FLUIDO",
    fluidFields: [
      { key: "condensingTemp", label: "Temp. Condensação", unit: "°C", required: true },
      { key: "subcooling", label: "Subresfriamento", unit: "K", required: false },
    ],
    showFluidPressureDrop: true,
    showFluidVelocity: false,
  },
  heating_coil: {
    type: "heating_coil",
    label: "Bateria de Aquecimento (Água/Glicol)",
    shortLabel: "Bateria Aquecimento",
    fluidKind: "water_glycol",
    fluidPanelTitle: "LADO FLUIDO (HIDRÔNICO)",
    fluidFields: [
      { key: "fluidInletTemp", label: "Temp. Entrada Fluido", unit: "°C", required: true },
      { key: "fluidOutletTemp", label: "Temp. Saída Fluido", unit: "°C", required: false },
      { key: "fluidFlowMass", label: "Vazão Mássica", unit: "kg/h", required: true },
    ],
    showFluidPressureDrop: true,
    showFluidVelocity: true,
  },
  cooling_coil: {
    type: "cooling_coil",
    label: "Bateria de Resfriamento (Água/Glicol)",
    shortLabel: "Bateria Resfriamento",
    fluidKind: "water_glycol",
    fluidPanelTitle: "LADO FLUIDO (HIDRÔNICO)",
    fluidFields: [
      { key: "fluidInletTemp", label: "Temp. Entrada Fluido", unit: "°C", required: true },
      { key: "fluidOutletTemp", label: "Temp. Saída Fluido", unit: "°C", required: false },
      { key: "fluidFlowMass", label: "Vazão Mássica", unit: "kg/h", required: true },
    ],
    showFluidPressureDrop: true,
    showFluidVelocity: true,
  },
  defrost_steam_coil: {
    type: "defrost_steam_coil",
    label: "Serpentina de Degelo a Vapor",
    shortLabel: "Degelo a Vapor",
    fluidKind: "steam",
    fluidPanelTitle: "LADO FLUIDO (VAPOR)",
    fluidFields: [
      { key: "steamPressure", label: "Pressão do Vapor", unit: "kPa", required: true },
      { key: "fluidInletTemp", label: "Temp. Entrada Vapor", unit: "°C", required: false },
    ],
    showFluidPressureDrop: false,
    showFluidVelocity: false,
  },
  recuperator: {
    type: "recuperator",
    label: "Recuperador de Calor (Ar-Ar)",
    shortLabel: "Recuperador",
    fluidKind: "water_glycol",
    fluidPanelTitle: "LADO AR DE EXAUSTÃO",
    fluidFields: [
      { key: "fluidInletTemp", label: "Temp. Entrada Ar Exaustão", unit: "°C", required: true },
      { key: "fluidOutletTemp", label: "Temp. Saída Ar Exaustão", unit: "°C", required: false },
    ],
    showFluidPressureDrop: true,
    showFluidVelocity: false,
  },
  shell_tube: {
    type: "shell_tube",
    label: "Trocador Casco-Tubo (Shell & Tube)",
    shortLabel: "Casco-Tubo",
    fluidKind: "refrigerant",
    fluidPanelTitle: "LADO FLUIDO",
    fluidFields: [
      { key: "fluidInletTemp", label: "Temp. Entrada Fluido", unit: "°C", required: true },
      { key: "fluidOutletTemp", label: "Temp. Saída Fluido", unit: "°C", required: false },
      { key: "fluidFlowMass", label: "Vazão Mássica", unit: "kg/h", required: true },
    ],
    showFluidPressureDrop: true,
    showFluidVelocity: false,
  },
  chiller_unit: {
    type: "chiller_unit",
    label: "Chiller / Unidade Completa",
    shortLabel: "Chiller",
    fluidKind: "refrigerant",
    fluidPanelTitle: "CICLO COMPLETO",
    fluidFields: [
      { key: "evaporatingTemp", label: "Temp. Evaporação", unit: "°C", required: true },
      { key: "condensingTemp", label: "Temp. Condensação", unit: "°C", required: true },
      { key: "superheat", label: "Sobreaquecimento", unit: "K", required: false },
      { key: "subcooling", label: "Subresfriamento", unit: "K", required: false },
    ],
    showFluidPressureDrop: false,
    showFluidVelocity: false,
  },
};

export function getApplicationConfig(t: UnilabComponentType): ApplicationConfig {
  return APPLICATION_CONFIGS[t] ?? APPLICATION_CONFIGS.evaporator_dx;
}
