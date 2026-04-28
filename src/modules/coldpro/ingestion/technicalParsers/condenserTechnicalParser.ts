// Parser técnico de condensador.

import {
  PARSER_VERSION,
  type ExtractedField,
  type ParserResult,
} from "../ingestionTypes";

const FIELDS: { key: string; label: RegExp }[] = [
  { key: "capacity", label: /(capacidade|capacity)/i },
  { key: "airInletTemp", label: /(temperatura.*ar.*entrada|air inlet temperature)/i },
  { key: "airOutletTemp", label: /(temperatura.*ar.*sa[ií]da|air outlet temperature)/i },
  { key: "condensingTemp", label: /(temperatura de condensa|condensing temperature)/i },
  { key: "airFlow", label: /(vaz[aã]o.*ar|air flow)/i },
  { key: "exchangeArea", label: /([áa]rea de troca|exchange area)/i },
  { key: "internalVolume", label: /(volume interno|internal volume)/i },
  { key: "rows", label: /(fileiras|rows)/i },
  { key: "tubesPerRow", label: /(tubos por fileira|tubes per row)/i },
  { key: "circuits", label: /(circuitos|circuits)/i },
  { key: "pressureDrop", label: /(queda de press[aã]o|pressure drop)/i },
  { key: "subcooling", label: /(subresfriamento|sub-?cooling)/i },
  { key: "desuperheat", label: /(dessuperaquecimento|desuperheat)/i },
];

const NUMBER_UNIT = /(-?\d+[.,]?\d*)\s*([A-Za-z°²³µ%/.\-]+)?/;

export function condenserTechnicalParser(rawText: string): ParserResult {
  const fields: Record<string, ExtractedField> = {};
  const warnings: string[] = [];
  const text = rawText.replace(/\s+/g, " ");

  for (const f of FIELDS) {
    const m = text.match(new RegExp(`${f.label.source}[^\\d-]{0,40}${NUMBER_UNIT.source}`, "i"));
    if (!m) continue;
    const num = Number(m[2].replace(/\./g, "").replace(",", "."));
    if (Number.isFinite(num)) fields[f.key] = { value: num, unit: m[3], source: "regex" };
    else fields[f.key] = { value: m[2], unit: m[3], source: "regex" };
  }

  const fluid = text.match(/\b(R\d{2,4}[A-Z]?|R-\d{2,4}[A-Z]?|R134a|R404A|R407C|R410A|R290|R744|R717)\b/i);
  if (fluid) fields.fluid = { value: fluid[1].toUpperCase(), source: "regex" };

  const found = Object.keys(fields).length;
  if (!found) warnings.push("Nenhum campo de condensador identificado.");

  return {
    status: found >= 4 ? "parsed" : found > 0 ? "needs_review" : "failed",
    parserUsed: "condenserTechnicalParser",
    parserVersion: PARSER_VERSION,
    rawText,
    structuredData: null,
    extractedFields: fields,
    confidence: Math.min(0.95, 0.3 + found * 0.08),
    warnings,
    errors: [],
  };
}
