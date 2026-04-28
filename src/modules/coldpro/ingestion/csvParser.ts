// CSV parser: detecta separador e decimal, converte em JSON.

import { PARSER_VERSION, type ParserResult } from "./ingestionTypes";

function detectSeparator(line: string): string {
  const counts = { ",": 0, ";": 0, "\t": 0 };
  for (const ch of line) if (ch in counts) counts[ch as keyof typeof counts]++;
  return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]) || ",";
}

function smartNumber(s: string, sep: string): string | number {
  const t = s.trim();
  if (!t) return "";
  // Decimal vírgula é provável quando o separador é ; ou \t
  const usesCommaDecimal = sep !== "," && /^-?\d+,\d+$/.test(t);
  const candidate = usesCommaDecimal ? t.replace(",", ".") : t;
  const n = Number(candidate);
  return Number.isFinite(n) && /^-?\d/.test(t) ? n : t;
}

function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQ = !inQ;
    } else if (ch === sep && !inQ) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

export async function csvParser(file: ArrayBuffer | string): Promise<ParserResult> {
  const warnings: string[] = [];
  const errors: string[] = [];
  let rows: (string | number)[][] = [];
  let rawText = "";
  try {
    rawText = typeof file === "string" ? file : new TextDecoder("utf-8").decode(file);
    const lines = rawText.split(/\r?\n/).filter((l) => l.length > 0);
    if (!lines.length) warnings.push("CSV vazio.");
    const sep = detectSeparator(lines[0] ?? "");
    rows = lines.map((l) => splitCsvLine(l, sep).map((c) => smartNumber(c, sep)));
  } catch (e) {
    errors.push((e as Error).message);
  }
  return {
    status: errors.length ? "failed" : rows.length ? "parsed" : "needs_review",
    parserUsed: "csvParser",
    parserVersion: PARSER_VERSION,
    rawText,
    structuredData: { rows },
    extractedFields: {},
    confidence: rows.length ? 0.8 : 0.2,
    warnings,
    errors,
  };
}
