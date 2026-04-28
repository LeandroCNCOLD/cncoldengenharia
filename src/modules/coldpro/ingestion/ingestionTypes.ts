// Tipos do motor de ingestão técnica.

export type FileType = "pdf" | "spreadsheet" | "csv" | "doc" | "image" | "unknown";

export type TechnicalDocumentType =
  | "evaporator"
  | "condenser"
  | "compressor"
  | "heat_exchanger"
  | "test_report"
  | "catalog"
  | "curve"
  | "generic";

export type ParserStatus = "pending" | "processing" | "parsed" | "needs_review" | "failed";

export type FileMetadata = {
  filename: string;
  mimeType?: string | null;
  extension: string;
  sizeBytes?: number | null;
};

export type Classification = {
  fileType: FileType;
  technicalDocumentType: TechnicalDocumentType;
  confidence: number;
  reasons: string[];
};

export type SheetData = {
  name: string;
  rows: unknown[][];
};

export type ExtractedField = {
  value: number | string;
  unit?: string;
  source?: string;
};

export type ParserResult = {
  status: "parsed" | "needs_review" | "failed";
  parserUsed: string;
  parserVersion: string;
  rawText: string;
  structuredData: unknown;
  extractedFields: Record<string, ExtractedField>;
  confidence: number;
  warnings: string[];
  errors: string[];
};

export const PARSER_VERSION = "1.0.0";
