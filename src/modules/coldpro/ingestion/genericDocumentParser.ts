// Parser genérico: aplica regex sobre rawText extraído por outro parser.

import {
  PARSER_VERSION,
  type ExtractedField,
  type ParserResult,
} from "./ingestionTypes";

const PATTERNS: { key: string; regex: RegExp; unit?: string }[] = [
  { key: "capacity", regex: /capacidade\s*(?:total)?\s*[:=]?\s*([\d.,]+)\s*(W|kW|BTU\/h|kcal\/h|TR)\b/i },
  { key: "temperature", regex: /temperatura\s*[:=]?\s*(-?[\d.,]+)\s*(°?[CFK])\b/i },
  { key: "airFlow", regex: /vaz[aã]o\s*(?:de\s*ar)?\s*[:=]?\s*([\d.,]+)\s*(m3\/h|m³\/h|m3\/s|CFM|L\/s)\b/i },
  { key: "fluid", regex: /\b(R\d{2,4}[A-Z]?|R-\d{2,4}[A-Z]?|R134a|R404A|R407C|R410A|R290|R744|R717)\b/ },
  { key: "pressure", regex: /press[aã]o\s*[:=]?\s*([\d.,]+)\s*(Pa|kPa|bar|psi|mbar)\b/i },
  { key: "volume", regex: /volume\s*(?:interno)?\s*[:=]?\s*([\d.,]+)\s*(L|dm3|m3|m³)\b/i },
  { key: "area", regex: /[aá]rea\s*(?:de\s*troca)?\s*[:=]?\s*([\d.,]+)\s*(m2|m²)\b/i },
];

function toNumber(s: string): number {
  const t = s.replace(/\./g, "").replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? n : Number(s.replace(",", "."));
}

export function extractGenericFields(rawText: string): Record<string, ExtractedField> {
  const out: Record<string, ExtractedField> = {};
  if (!rawText) return out;
  for (const p of PATTERNS) {
    const m = rawText.match(p.regex);
    if (!m) continue;
    if (p.key === "fluid") {
      out[p.key] = { value: m[1].toUpperCase(), source: "regex" };
    } else {
      out[p.key] = { value: toNumber(m[1]), unit: m[2], source: "regex" };
    }
  }
  return out;
}

export async function genericDocumentParser(rawText: string): Promise<ParserResult> {
  const fields = extractGenericFields(rawText);
  const found = Object.keys(fields).length;
  return {
    status: found ? "parsed" : "needs_review",
    parserUsed: "genericDocumentParser",
    parserVersion: PARSER_VERSION,
    rawText,
    structuredData: null,
    extractedFields: fields,
    confidence: Math.min(0.85, 0.3 + found * 0.1),
    warnings: found ? [] : ["Nenhum campo genérico identificado."],
    errors: [],
  };
}
