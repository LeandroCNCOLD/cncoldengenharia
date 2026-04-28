// CN Cold Engineering — schema dos campos esperados por tipo de componente.
// Pronto para alimentar futuros motores térmicos sem refatoração.

export type ComponentType = "compressor" | "evaporador" | "condensador";
export type ComponentStatus = "incompleto" | "validando" | "pronto" | "invalido";
export type FileKind = "csv" | "pdf" | "xls";
export type FileProcessingStatus = "pendente" | "processando" | "processado" | "erro";
export type FieldSource = "arquivo" | "manual";

export interface FieldDef {
  key: string;
  label: string;
  required: boolean;
  type: "text" | "number" | "textarea" | "json";
  unit?: string;
}

export const COMPONENT_FIELDS: Record<ComponentType, FieldDef[]> = {
  compressor: [
    { key: "modelo", label: "Modelo", required: true, type: "text" },
    { key: "fabricante", label: "Fabricante", required: true, type: "text" },
    { key: "fluido", label: "Fluido", required: true, type: "text" },
    { key: "coeficientes", label: "Coeficientes (AHRI 540)", required: true, type: "json" },
    { key: "faixa_operacional", label: "Faixa operacional", required: true, type: "json" },
    { key: "observacoes", label: "Observações", required: false, type: "textarea" },
  ],
  evaporador: [
    { key: "descricao", label: "Descrição", required: true, type: "text" },
    { key: "capacidade_nominal", label: "Capacidade nominal", required: true, type: "number", unit: "kW" },
    { key: "fluido", label: "Fluido", required: true, type: "text" },
    { key: "temp_evaporacao_ref", label: "Temp. evaporação ref.", required: true, type: "number", unit: "°C" },
    { key: "temp_entrada_ar", label: "Temp. entrada ar", required: true, type: "number", unit: "°C" },
    { key: "vazao_ar", label: "Vazão de ar", required: true, type: "number", unit: "m³/h" },
    { key: "geometria_minima", label: "Geometria mínima", required: false, type: "json" },
    { key: "queda_pressao", label: "Queda de pressão", required: false, type: "number", unit: "Pa" },
    { key: "observacoes", label: "Observações", required: false, type: "textarea" },
  ],
  condensador: [
    { key: "descricao", label: "Descrição", required: true, type: "text" },
    { key: "capacidade_nominal", label: "Capacidade nominal", required: true, type: "number", unit: "kW" },
    { key: "fluido", label: "Fluido", required: true, type: "text" },
    { key: "temp_condensacao_ref", label: "Temp. condensação ref.", required: true, type: "number", unit: "°C" },
    { key: "temp_entrada_ar", label: "Temp. entrada ar", required: true, type: "number", unit: "°C" },
    { key: "vazao_ar", label: "Vazão de ar", required: true, type: "number", unit: "m³/h" },
    { key: "geometria_minima", label: "Geometria mínima", required: false, type: "json" },
    { key: "queda_pressao", label: "Queda de pressão", required: false, type: "number", unit: "Pa" },
    { key: "observacoes", label: "Observações", required: false, type: "textarea" },
  ],
};

export const EXPECTED_FILE_KINDS: Record<ComponentType, FileKind[]> = {
  compressor: ["csv"],
  evaporador: ["pdf", "xls"],
  condensador: ["pdf", "xls"],
};

export const COMPONENT_TYPE_LABELS: Record<ComponentType, string> = {
  compressor: "Compressor",
  evaporador: "Evaporador",
  condensador: "Condensador",
};

export const STATUS_LABELS: Record<ComponentStatus, string> = {
  incompleto: "Incompleto",
  validando: "Validando",
  pronto: "Pronto",
  invalido: "Inválido",
};

export const STATUS_COLORS: Record<ComponentStatus, string> = {
  incompleto: "bg-muted text-muted-foreground border-border",
  validando: "bg-warning/15 text-warning-foreground border-warning/40",
  pronto: "bg-success/15 text-success border-success/40",
  invalido: "bg-destructive/15 text-destructive border-destructive/40",
};

export function computeComponentStatus(
  type: ComponentType,
  files: { file_kind: FileKind; processing_status: FileProcessingStatus }[],
  fields: Record<string, unknown>,
): ComponentStatus {
  const expected = EXPECTED_FILE_KINDS[type];
  const hasAllKinds = expected.every((k) => files.some((f) => f.file_kind === k));
  const requiredFields = COMPONENT_FIELDS[type].filter((f) => f.required).map((f) => f.key);
  const hasAllFields = requiredFields.every((k) => {
    const v = fields[k];
    return v !== undefined && v !== null && v !== "";
  });

  const allErrored = files.length > 0 && files.every((f) => f.processing_status === "erro");
  if (allErrored) return "invalido";

  const anyProcessing = files.some(
    (f) => f.processing_status === "pendente" || f.processing_status === "processando",
  );
  if (anyProcessing) return "validando";

  if (hasAllKinds && hasAllFields) return "pronto";
  return "incompleto";
}
