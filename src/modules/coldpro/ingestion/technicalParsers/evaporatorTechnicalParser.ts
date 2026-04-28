// Parser técnico de evaporador.

import {
  PARSER_VERSION,
  type ExtractedField,
  type ParserResult,
} from "../ingestionTypes";

const FIELDS: { key: string; label: RegExp; unit?: string }[] = [
  { key: "totalCapacity", label: /(capacidade total|total capacity)/i },
  { key: "sensibleCapacity", label: /(capacidade sens[ií]vel|sensible capacity)/i },
  { key: "latentCapacity", label: /(capacidade latente|latent capacity)/i },
  { key: "airInletTemp", label: /(temperatura.*ar.*entrada|air inlet temperature)/i },
  { key: "airOutletTemp", label: /(temperatura.*ar.*sa[ií]da|air outlet temperature)/i },
  { key: "evaporationTemp", label: /(temperatura de evapora|evaporation temperature)/i },
  { key: "airFlow", label: /(vaz[aã]o.*ar|air flow)/i },
  { key: "exchangeArea", label: /([áa]rea de troca|exchange area|surface area)/i },
  { key: "internalVolume", label: /(volume interno|internal volume)/i },
  { key: "rows", label: /(fileiras|rows)/i },
  { key: "tubesPerRow", label: /(tubos por fileira|tubes per row)/i },
  { key: "circuits", label: /(circuitos|circuits)/i },
  { key: "fluid", label: /(refrigerante|refrigerant|fluido)/i },
  { key: "pressureDrop", label: /(queda de press[aã]o|pressure drop)/i },
  { key: "superheat", label: /(superaquecimento|superheat)/i },
  { key: "subcooling", label: /(subresfriamento|subcooling)/i },
];

const NUMBER_UNIT = /(-?\d+[.,]?\d*)\s*([A-Za-z°²³µ%/.\-]+)?/;

function addStructuredFields(fields: Record<string, ExtractedField>, structured?: unknown) {
  const sheets = (structured as { sheets?: { name: string; rows: unknown[][] }[] } | null)?.sheets ?? [];
  const table = sheets.find((s) => /fancoil/i.test(s.name));
  if (!table || table.rows.length < 3) return;
  const headers = (table.rows[0] ?? []).map((h) => String(h ?? "").toLowerCase());
  const row = table.rows.slice(2).find((r) => Number(r[14] ?? 0) > 0) ?? table.rows[2];
  const pick = (label: RegExp) => headers.findIndex((h) => label.test(h));
  const add = (key: string, label: RegExp, unit?: string) => {
    const idx = pick(label);
    const value = idx >= 0 ? row?.[idx] : undefined;
    if (value !== undefined && value !== null && value !== "") fields[key] = { value: value as string | number, unit, source: "spreadsheet" };
  };
  add("model", /^modelo$/i);
  add("coilHeightMm", /altura da serpentina/i, "mm");
  add("finnedLengthMm", /comprimento do aletado/i, "mm");
  add("rows", /filas/i);
  add("circuits", /circuitos/i);
  add("finSpacingMm", /passo da aleta/i, "mm");
  add("airFlow", /fluxo de ar/i, "m³/h");
  add("airInletTemp", /temperatura de entrada/i, "°C");
  add("evaporationTemp", /evaporação/i, "°C");
  add("capacity", /capacidade/i, "W");
  add("pressureDrop", /pressão do flu/i, "kPa");
  add("airPressureDrop", /pressão do ar/i, "Pa");
}

export function evaporatorTechnicalParser(rawText: string, structured?: unknown): ParserResult {
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

  // Fluido: pega R-XXX se aparecer no texto.
  const fluid = text.match(/\b(R\d{2,4}[A-Z]?|R-\d{2,4}[A-Z]?|R134a|R404A|R407C|R410A|R290|R744|R717)\b/i);
  if (fluid && !fields.fluid) fields.fluid = { value: fluid[1].toUpperCase(), source: "regex" };
  addStructuredFields(fields, structured);

  const found = Object.keys(fields).length;
  if (!found) warnings.push("Nenhum campo de evaporador identificado.");

  return {
    status: found >= 5 ? "parsed" : found > 0 ? "needs_review" : "failed",
    parserUsed: "evaporatorTechnicalParser",
    parserVersion: PARSER_VERSION,
    rawText,
    structuredData: null,
    extractedFields: fields,
    confidence: Math.min(0.95, 0.3 + found * 0.07),
    warnings,
    errors: [],
  };
}
