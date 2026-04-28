// Parser técnico de evaporador (formato Unilab Coils PDF + XLS).

import {
  PARSER_VERSION,
  type ExtractedField,
  type ParserResult,
} from "../ingestionTypes";

const LABELS: { key: string; pattern: RegExp; unit?: string }[] = [
  { key: "model", pattern: /^(c[oó]digo|modelo|model)\s*$/i },
  { key: "totalCapacity", pattern: /^capacidade\s*$/i, unit: "W" },
  { key: "sensibleCapacity", pattern: /potencialidade sens[íi]vel/i, unit: "W" },
  { key: "latentCapacity", pattern: /potencialidade latente/i, unit: "W" },
  { key: "shr", pattern: /rela[cç][aã]o.*pot[eê]ncia sens[íi]vel.*pot[eê]ncia total/i },
  { key: "waterProduced", pattern: /quantidade de [áa]gua produzida/i, unit: "kg/h" },
  { key: "exchangeArea", pattern: /superf[íi]cie de troca/i, unit: "m²" },
  { key: "globalU", pattern: /coeficiente de transforma[cç][aã]o global/i },
  { key: "deltaHLog", pattern: /delta h m[ée]dio logar[íi]tmico/i, unit: "kJ/kg" },
  { key: "internalVolume", pattern: /volume interno da bateria/i, unit: "l" },
  { key: "tubeOuterDiameterMm", pattern: /di[âa]metro externo dos tubos/i, unit: "mm" },
  { key: "tubeInnerDiameterMm", pattern: /di[âa]metro interno dos tubos/i, unit: "mm" },
  { key: "coilLengthMm", pattern: /comprimento da bateria/i, unit: "mm" },
  { key: "tubesPerRow", pattern: /n[uú]mero de tubos por fileiras?/i },
  { key: "rows", pattern: /n[uú]mero de fileiras/i },
  { key: "circuits", pattern: /n[uú]mero de circuitos/i },
  { key: "finSpacingMm", pattern: /passo das aletas/i, unit: "mm" },
  { key: "finThicknessMm", pattern: /espessura das aletas/i, unit: "mm" },
  // ar
  { key: "airFlow", pattern: /fluxo volum[ée]trico de ar/i, unit: "m³/h" },
  { key: "airMassFlow", pattern: /fluxo m[áa]ximo de ar/i, unit: "kg/h" },
  { key: "frontalAirVelocity", pattern: /velocidade frontal na bateria/i, unit: "m/s" },
  { key: "airInletTemp", pattern: /temperatura do ar na entrada/i, unit: "°C" },
  { key: "airOutletTemp", pattern: /temperatura do ar na sa[íi]da/i, unit: "°C" },
  { key: "airInletRH", pattern: /humidade relativa do ar na entrada/i, unit: "%" },
  { key: "airOutletRH", pattern: /humidade relativa do ar na sa[íi]da/i, unit: "%" },
  { key: "airPressureDrop", pattern: /^queda de press[aã]o\s*$/i, unit: "Pa" },
  // refrigerante
  { key: "subcooling", pattern: /sub-?arrefecimento|subresfriamento/i, unit: "K" },
  { key: "superheat", pattern: /sobreaquecimento|superaquecimento/i, unit: "K" },
  { key: "evaporationTemp", pattern: /temperatura de evapora[cç][aã]o/i, unit: "°C" },
  { key: "condensingTemp", pattern: /temperatura de condensa[cç][aã]o/i, unit: "°C" },
  { key: "fluidPressureDrop", pattern: /queda de press[aã]o total do lado do fluido/i, unit: "kPa" },
];

const NUM = /(-?\d+(?:[.,]\d+)?)/;

function toNumber(raw: string): number | string {
  const cleaned = raw.replace(/\./g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : raw;
}

function extractFromText(rawText: string, fields: Record<string, ExtractedField>) {
  const text = rawText.replace(/\s+/g, " ");
  for (const f of LABELS) {
    const re = new RegExp(`${f.pattern.source}[^\\d-]{0,60}${NUM.source}`, "i");
    const m = text.match(re);
    if (!m) continue;
    const value = toNumber(m[2]);
    if (fields[f.key] === undefined) {
      fields[f.key] = { value, unit: f.unit, source: "pdf-text" };
    }
  }
  // Fluxo + Velocidade de Massa juntos: "568 / 105"
  const compoundFlow = text.match(/fluxo m[áa]ximo do fluido[^\d-]*?(-?\d+(?:[.,]\d+)?)\s*\/\s*(-?\d+(?:[.,]\d+)?)/i);
  if (compoundFlow) {
    if (!fields.refrigerantMassFlow) fields.refrigerantMassFlow = { value: toNumber(compoundFlow[1]), unit: "kg/h", source: "pdf-text" };
    if (!fields.massVelocity) fields.massVelocity = { value: toNumber(compoundFlow[2]), unit: "kg/(m²·s)", source: "pdf-text" };
  }
  // Velocidades gás/líquido juntas: "11,43 / 0,08"
  const compoundVel = text.match(/velocidade do fluido \(fase gasosa.*?l[íi]quida\)[^\d-]*?(-?\d+(?:[.,]\d+)?)\s*\/\s*(-?\d+(?:[.,]\d+)?)/i);
  if (compoundVel) {
    if (!fields.refrigerantGasVelocity) fields.refrigerantGasVelocity = { value: toNumber(compoundVel[1]), unit: "m/s", source: "pdf-text" };
    if (!fields.refrigerantLiquidVelocity) fields.refrigerantLiquidVelocity = { value: toNumber(compoundVel[2]), unit: "m/s", source: "pdf-text" };
  }

  const fluid = text.match(/fluido[^A-Z]{0,15}(R[\s-]?\d{2,4}[A-Za-z]?)/i)
    ?? text.match(/\b(R\d{2,4}[A-Za-z]?|R-\d{2,4}[A-Za-z]?|R134a|R404A|R407C|R410A|R290|R744|R717)\b/i);
  if (fluid && !fields.fluid) {
    fields.fluid = { value: fluid[1].replace(/\s|-/g, "").toUpperCase(), source: "pdf-text" };
  }
}

type Sheet = { name: string; rows: unknown[][] };

function buildCapacityCurve(sheets: Sheet[]) {
  const sheet = sheets.find((s) => /capacidades?/i.test(s.name));
  if (!sheet || sheet.rows.length < 3) return { curve: null, hasErr: false };
  const tempsRow = sheet.rows[1] ?? [];
  const valuesRow = sheet.rows[2] ?? [];
  const hasErr = sheet.rows.some((r) => r.some((c) => /Err-?\d/i.test(String(c ?? ""))));
  const points: { tempC: number; value: number }[] = [];
  for (let i = 2; i < tempsRow.length; i++) {
    const t = Number(tempsRow[i]);
    const v = Number(valuesRow[i]);
    if (Number.isFinite(t) && Number.isFinite(v)) points.push({ tempC: t, value: v });
  }
  const unit = String(valuesRow[1] ?? "kW");
  const model = String(valuesRow[0] ?? "");
  return { curve: points.length ? { model, unit, points } : null, hasErr };
}

function extractFancoilRow(sheets: Sheet[], fields: Record<string, ExtractedField>) {
  const sheet = sheets.find((s) => /fancoil/i.test(s.name));
  if (!sheet || sheet.rows.length < 3) return;
  const headers = (sheet.rows[0] ?? []).map((h) => String(h ?? "").toLowerCase());
  const row = sheet.rows.slice(2).find((r) => Number(r[14] ?? 0) > 0) ?? sheet.rows[2];
  const pick = (re: RegExp) => headers.findIndex((h) => re.test(h));
  const add = (key: string, re: RegExp, unit?: string) => {
    if (fields[key] !== undefined) return;
    const idx = pick(re);
    const v = idx >= 0 ? row?.[idx] : undefined;
    if (v !== undefined && v !== null && v !== "") {
      fields[key] = { value: v as string | number, unit, source: "spreadsheet-fancoil" };
    }
  };
  add("model", /^modelo$/i);
  add("coilHeightMm", /altura da serpentina/i, "mm");
  add("finnedLengthMm", /comprimento do aletado/i, "mm");
  add("rows", /^n.*filas/i);
  add("circuits", /circuitos/i);
  add("finSpacingMm", /passo da aleta/i, "mm");
  add("airFlow", /fluxo de ar/i, "m³/h");
  add("airInletTemp", /temperatura de entrada/i, "°C");
  add("evaporationTemp", /evapora|cond/i, "°C");
  add("refrigerantMassFlow", /fluxo fluido/i, "kg/h");
  add("frontalAirVelocity", /velocidade frontal/i, "m/s");
  add("totalCapacity", /^capacidade$/i, "W");
  add("fluidPressureDrop", /queda da press[aã]o do flu/i, "kPa");
  add("airPressureDrop", /quada da press[aã]o do ar|queda da press[aã]o do ar/i, "Pa");
}

export function evaporatorTechnicalParser(rawText: string, structured?: unknown): ParserResult {
  const fields: Record<string, ExtractedField> = {};
  const warnings: string[] = [];

  if (rawText) extractFromText(rawText, fields);

  const sheets = (structured as { sheets?: Sheet[] } | null)?.sheets ?? [];
  if (sheets.length) {
    extractFancoilRow(sheets, fields);
    const { curve, hasErr } = buildCapacityCurve(sheets);
    if (curve) {
      fields.capacityCurve = { value: JSON.stringify(curve), unit: curve.unit, source: "spreadsheet-capacidades" };
      if (fields.totalCapacity === undefined) {
        const mid = curve.points[Math.floor(curve.points.length / 2)];
        if (mid) fields.totalCapacity = { value: mid.value * 1000, unit: "W", source: "spreadsheet-capacidades" };
      }
    } else if (hasErr) {
      warnings.push("Planilha de capacidades veio com 'Err-1' — arquivo de origem corrompido. Use o PDF como referência.");
    }
  }

  const found = Object.keys(fields).length;
  if (!found) warnings.push("Nenhum campo de evaporador identificado.");

  return {
    status: found >= 5 ? "parsed" : found > 0 ? "needs_review" : "failed",
    parserUsed: "evaporatorTechnicalParser",
    parserVersion: PARSER_VERSION,
    rawText,
    structuredData: structured ?? null,
    extractedFields: fields,
    confidence: Math.min(0.95, 0.25 + found * 0.05),
    warnings,
    errors: [],
  };
}
