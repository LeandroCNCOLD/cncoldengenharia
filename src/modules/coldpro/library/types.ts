/**
 * Biblioteca Técnica Universal — tipos canônicos.
 *
 * Camadas:
 *   uploaded → raw_imported → mapped → validated → approved
 *
 * O motor (thermalcalc) só consome registros com status `validated` ou `approved`.
 */

export type TechnicalEntityType =
  | "compressor"
  | "fan"
  | "expansion_valve"
  | "solenoid_valve"
  | "hot_gas_valve"
  | "condenser_coil"
  | "evaporator_coil"
  | "refrigerant"
  | "fluid"
  | "controller"
  | "sensor"
  | "accessory"
  | "unknown";

export type TechnicalRecordStatus =
  | "raw_imported"
  | "mapped"
  | "needs_review"
  | "validated"
  | "approved"
  | "rejected"
  | "unmapped";

export type TechnicalBatchStatus =
  | "pending"
  | "processing"
  | "mapped"
  | "partially_validated"
  | "completed"
  | "failed";

/** Status que o motor aceita como fonte oficial de dados técnicos. */
export const ENGINE_USABLE_STATUSES: TechnicalRecordStatus[] = ["validated", "approved"];

export interface TechnicalImportBatch {
  id: string;
  source_name: string;
  source_type: string | null;
  manufacturer: string | null;
  file_name: string | null;
  status: TechnicalBatchStatus;
  total_files: number;
  total_rows: number;
  mapped_rows: number;
  validated_rows: number;
  approved_rows: number;
  errors_json: unknown[];
  summary_json: Record<string, unknown>;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TechnicalRawRecord {
  id: string;
  batch_id: string;
  source_file: string | null;
  source_table: string | null;
  row_index: number | null;
  detected_entity_type: TechnicalEntityType;
  detected_manufacturer: string | null;
  raw_json: Record<string, unknown>;
  status: TechnicalRecordStatus;
  notes: string | null;
  created_at: string;
}

export interface TechnicalMappedRecord {
  id: string;
  batch_id: string;
  raw_record_id: string | null;
  entity_type: TechnicalEntityType;
  manufacturer: string | null;
  model: string | null;
  code: string | null;
  normalized_json: Record<string, unknown>;
  confidence_score: number;
  mapping_status: TechnicalRecordStatus;
  validation_errors_json: unknown[];
  mapper_name: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  approved_component_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Origem do dado: catálogo do fabricante ou interno CN. */
export type TechnicalSource =
  | "UNILAB"
  | "BITZER"
  | "DANFOSS"
  | "TORIN"
  | "VAPCYC"
  | "CN_INTERNAL"
  | "UNKNOWN";

/** Contexto de uso. O motor consome apenas `cn_standard` e `validated` por padrão. */
export type TechnicalContext =
  | "reference"
  | "cn_standard"
  | "test"
  | "legacy"
  | "validated";

/** Lista canônica de sources para popular UIs (filtros, selects). */
export const TECHNICAL_SOURCES: TechnicalSource[] = [
  "UNILAB",
  "BITZER",
  "DANFOSS",
  "TORIN",
  "VAPCYC",
  "CN_INTERNAL",
  "UNKNOWN",
];

export const TECHNICAL_CONTEXTS: TechnicalContext[] = [
  "reference",
  "cn_standard",
  "validated",
  "test",
  "legacy",
];

/** Contextos que o motor aceita por padrão. */
export const ENGINE_USABLE_CONTEXTS: TechnicalContext[] = ["cn_standard", "validated"];

export interface TechnicalComponent {
  id: string;
  entity_type: TechnicalEntityType;
  manufacturer: string | null;
  model: string | null;
  code: string | null;
  family: string | null;
  application: string | null;
  compatible_refrigerants_json: string[];
  status: TechnicalRecordStatus;
  source: TechnicalSource | null;
  context: TechnicalContext;
  source_batch_id: string | null;
  source_raw_id: string | null;
  source_mapped_id: string | null;
  normalized_json: Record<string, unknown>;
  approved_by: string | null;
  approved_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** Resultado retornado por um mapper. */
export interface MapperResult {
  entityType: TechnicalEntityType;
  manufacturer: string | null;
  model: string | null;
  code: string | null;
  normalized: Record<string, unknown>;
  confidence: number; // 0..1
  errors: string[];
  warnings: string[];
  mapperName: string;
}

/** Contexto que o universalMapper passa para os mappers especializados. */
export interface MapperInput {
  raw: Record<string, unknown>;
  sourceFile?: string | null;
  sourceTable?: string | null;
  hintManufacturer?: string | null;
  hintEntityType?: TechnicalEntityType | null;
}

/** Interface comum a todos os mappers especializados. */
export interface TechnicalMapper {
  name: string;
  /** Retorna true se este mapper consegue tratar o input. */
  canHandle(input: MapperInput): boolean;
  /** Mapeia o input bruto para a forma normalizada. */
  map(input: MapperInput): MapperResult;
}
