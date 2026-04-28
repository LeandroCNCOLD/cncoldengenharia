// CN Cold Engineering — Orquestrador de parsing.
import { parseCsv } from "./csv";
import { parseXls } from "./xls";
import type { ComponentType, FileKind } from "@/lib/component-schema";

export interface ParseOutcome {
  fields: Record<string, unknown>;
  unmappedHeaders: string[];
  needsManualReview: boolean;
  reason?: string;
}

export async function parseComponentFile(
  file: File,
  kind: FileKind,
  type: ComponentType,
): Promise<ParseOutcome> {
  if (kind === "csv") {
    const r = await parseCsv(file, type);
    return { fields: r.fields, unmappedHeaders: r.unmappedHeaders, needsManualReview: false };
  }
  if (kind === "xls") {
    const r = await parseXls(file, type);
    return { fields: r.fields, unmappedHeaders: r.unmappedHeaders, needsManualReview: false };
  }
  // PDF: extração automática não implementada nesta fase
  return {
    fields: {},
    unmappedHeaders: [],
    needsManualReview: true,
    reason: "PDF requer revisão manual nesta fase.",
  };
}
