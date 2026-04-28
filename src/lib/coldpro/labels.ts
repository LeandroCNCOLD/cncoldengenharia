import type { Database } from "@/integrations/supabase/types";

export type EquipmentKind = Database["public"]["Enums"]["equipment_kind"];
export type EquipmentApplication = Database["public"]["Enums"]["equipment_application"];
export type EquipmentProjectStatus = Database["public"]["Enums"]["equipment_project_status"];
export type ComponentKind = Database["public"]["Enums"]["component_kind"];
export type ComponentStatus = Database["public"]["Enums"]["component_status"];

export const EQUIPMENT_KIND_LABELS: Record<EquipmentKind, string> = {
  plugin: "Plugin",
  split: "Split",
  rack: "Rack",
  chiller: "Chiller",
  tunel_congelamento: "Túnel de congelamento",
  camara_fria: "Câmara fria",
  unidade_condensadora: "Unidade condensadora",
  unidade_evaporadora: "Unidade evaporadora",
  outro: "Outro",
};

export const EQUIPMENT_APPLICATION_LABELS: Record<EquipmentApplication, string> = {
  resfriamento: "Resfriamento",
  congelamento: "Congelamento",
  conservacao: "Conservação",
  processo_industrial: "Processo industrial",
  climatizacao_industrial: "Climatização industrial",
  outro: "Outro",
};

export const EQUIPMENT_PROJECT_STATUS_LABELS: Record<EquipmentProjectStatus, string> = {
  draft: "Rascunho",
  in_progress: "Em projeto",
  validated: "Validado",
  archived: "Arquivado",
};

export const COMPONENT_KIND_LABELS: Record<ComponentKind, string> = {
  evaporador: "Evaporador",
  condensador: "Condensador",
  compressor: "Compressor",
  ventilador: "Ventilador",
  valvula_expansao: "Válvula de expansão",
  separador_liquido: "Separador de líquido",
  acumulador: "Acumulador",
  painel_eletrico: "Painel elétrico",
  controlador: "Controlador",
  outro: "Outro",
};

export const COMPONENT_STATUS_LABELS: Record<ComponentStatus, string> = {
  draft: "Rascunho",
  imported: "Importado",
  simulated: "Simulado",
  validated: "Validado",
  needs_review: "Revisar",
  approved: "Aprovado",
};

export const COMPONENT_STATUS_COLORS: Record<ComponentStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  imported: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  simulated: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  validated: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  needs_review: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  approved: "bg-primary/15 text-primary",
};
