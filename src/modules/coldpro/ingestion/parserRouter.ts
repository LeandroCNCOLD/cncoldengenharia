// Roteador: escolhe parser base pelo fileType e parser técnico pelo documentType.

import { csvParser } from "./csvParser";
import { docParser } from "./docParser";
import { genericDocumentParser } from "./genericDocumentParser";
import { imageParser } from "./imageParser";
import type {
  Classification,
  FileType,
  ParserResult,
  TechnicalDocumentType,
} from "./ingestionTypes";
import { pdfParser } from "./pdfParser";
import { spreadsheetParser } from "./spreadsheetParser";
import { compressorTechnicalParser } from "./technicalParsers/compressorTechnicalParser";
import { condenserTechnicalParser } from "./technicalParsers/condenserTechnicalParser";
import { evaporatorTechnicalParser } from "./technicalParsers/evaporatorTechnicalParser";

async function runBaseParser(fileType: FileType, file: ArrayBuffer): Promise<ParserResult> {
  switch (fileType) {
    case "pdf":
      return pdfParser(file);
    case "spreadsheet":
      return spreadsheetParser(file);
    case "csv":
      return csvParser(file);
    case "doc":
      return docParser(file);
    case "image":
      return imageParser(file);
    default:
      return genericDocumentParser("");
  }
}

function runTechnicalParser(
  type: TechnicalDocumentType,
  rawText: string,
  structured: unknown,
): ParserResult | null {
  switch (type) {
    case "evaporator":
    case "heat_exchanger":
      return evaporatorTechnicalParser(rawText);
    case "condenser":
      return condenserTechnicalParser(rawText);
    case "compressor":
    case "curve":
      return compressorTechnicalParser(rawText, structured);
    default:
      return null;
  }
}

/** Combina o resultado base + técnico em um único ParserResult. */
function merge(base: ParserResult, tech: ParserResult | null): ParserResult {
  if (!tech) return base;
  return {
    status:
      tech.status === "failed" && base.status === "parsed" ? "needs_review" : tech.status,
    parserUsed: `${base.parserUsed}+${tech.parserUsed}`,
    parserVersion: base.parserVersion,
    rawText: base.rawText,
    structuredData: base.structuredData,
    extractedFields: { ...base.extractedFields, ...tech.extractedFields },
    confidence: Math.max(base.confidence * 0.5, tech.confidence),
    warnings: [...base.warnings, ...tech.warnings],
    errors: [...base.errors, ...tech.errors],
  };
}

export async function routeParser(
  classification: Classification,
  file: ArrayBuffer,
): Promise<ParserResult> {
  const base = await runBaseParser(classification.fileType, file);
  const tech = runTechnicalParser(
    classification.technicalDocumentType,
    base.rawText,
    base.structuredData,
  );
  // Se não houve parser técnico e nenhum campo, tenta genérico para enriquecer.
  if (!tech && base.rawText && Object.keys(base.extractedFields).length === 0) {
    const generic = await genericDocumentParser(base.rawText);
    return merge(base, generic);
  }
  return merge(base, tech);
}
