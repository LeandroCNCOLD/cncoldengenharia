// Image parser: stub para futura integração com OCR.

import { PARSER_VERSION, type ParserResult } from "./ingestionTypes";

export async function imageParser(_file: ArrayBuffer): Promise<ParserResult> {
  void _file;
  return {
    status: "needs_review",
    parserUsed: "imageParser",
    parserVersion: PARSER_VERSION,
    rawText: "",
    structuredData: null,
    extractedFields: {},
    confidence: 0.1,
    warnings: ["OCR não configurado — arquivo enviado para revisão manual."],
    errors: [],
  };
}
