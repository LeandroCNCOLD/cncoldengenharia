// Parser de planilhas (xls/xlsx): converte abas em JSON e gera rawText.

import * as XLSX from "xlsx";
import { PARSER_VERSION, type ParserResult, type SheetData } from "./ingestionTypes";

export async function spreadsheetParser(file: ArrayBuffer): Promise<ParserResult> {
  const warnings: string[] = [];
  const errors: string[] = [];
  const sheets: SheetData[] = [];
  let rawText = "";
  try {
    const wb = XLSX.read(new Uint8Array(file), { type: "array" });
    for (const name of wb.SheetNames) {
      const ws = wb.Sheets[name];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false }) as unknown[][];
      sheets.push({ name, rows });
      rawText += `# ${name}\n` + rows.map((r) => r.join("\t")).join("\n") + "\n\n";
    }
    if (!sheets.length) warnings.push("Planilha sem abas legíveis.");
  } catch (e) {
    errors.push((e as Error).message);
  }
  return {
    status: errors.length ? "failed" : sheets.length ? "parsed" : "needs_review",
    parserUsed: "spreadsheetParser",
    parserVersion: PARSER_VERSION,
    rawText: rawText.trim(),
    structuredData: { sheets },
    extractedFields: {},
    confidence: sheets.length ? 0.75 : 0.2,
    warnings,
    errors,
  };
}
