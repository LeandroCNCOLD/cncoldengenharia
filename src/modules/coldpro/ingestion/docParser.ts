// DOCX parser via mammoth.

import { PARSER_VERSION, type ParserResult } from "./ingestionTypes";

export async function docParser(file: ArrayBuffer): Promise<ParserResult> {
  const warnings: string[] = [];
  const errors: string[] = [];
  let rawText = "";
  try {
    const mammoth = await import("mammoth");
    const res = await mammoth.extractRawText({ arrayBuffer: file });
    rawText = res.value.trim();
    if (res.messages.length) {
      warnings.push(...res.messages.slice(0, 5).map((m) => m.message));
    }
  } catch (e) {
    errors.push((e as Error).message);
  }
  return {
    status: errors.length ? "failed" : rawText ? "parsed" : "needs_review",
    parserUsed: "docParser",
    parserVersion: PARSER_VERSION,
    rawText,
    structuredData: null,
    extractedFields: {},
    confidence: rawText ? 0.7 : 0.2,
    warnings,
    errors,
  };
}
