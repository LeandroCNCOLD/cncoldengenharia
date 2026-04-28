// Parser técnico de compressor — suporta CSV ARI/AHRI Copeland (10 coeficientes).
//
// Formato Copeland CSV (separador ',' e vírgula como decimal nos coeficientes):
//   Header: RR,Rev.Date,Modelo,Situação de Dados,Folha Perf.,Appl,
//           Códigos de Voltagem,Tensão de Teste,Hertz,Fase,Refr,
//           Sub-Resfriamento Total (K),Superaquecimento Constant (K),
//           Temp.Constante de Retorno de Gás (°C),
//           Tcond_min,Tcond_max,Tevap_min,Tevap_max,
//           <10 coef cap>, <10 coef pwr>, <10 coef cur>, <10 coef massflow>
// Como o decimal é vírgula e o separador é vírgula, cada coeficiente vira 2 colunas.

import {
  PARSER_VERSION,
  type ExtractedField,
  type ParserResult,
} from "../ingestionTypes";

type Row = (string | number)[];
type Structured = { rows?: Row[]; sheets?: { name: string; rows: unknown[][] }[] } | null | undefined;

/** Reagrupa pares (intPart, fracPart) em coeficientes decimais. */
function mergeCoefficientPairs(values: (string | number)[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < values.length; i += 2) {
    const a = String(values[i] ?? "").trim();
    const b = String(values[i + 1] ?? "").trim();
    if (a === "" && b === "") continue;
    const merged = `${a}${b ? "." + b : ""}`;
    const n = Number(merged);
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

const NAMED_HEADERS: { key: string; pattern: RegExp; unit?: string }[] = [
  { key: "model", pattern: /^modelo$/i },
  { key: "fluid", pattern: /^refr$/i },
  { key: "voltage", pattern: /tens[aã]o de teste/i, unit: "V" },
  { key: "frequency", pattern: /^hertz$/i, unit: "Hz" },
  { key: "phase", pattern: /^fase$/i },
  { key: "subcoolingK", pattern: /sub.?resfriamento total/i, unit: "K" },
  { key: "superheatK", pattern: /superaquecimento/i, unit: "K" },
  { key: "returnGasTempC", pattern: /retorno de g[áa]s/i, unit: "°C" },
  { key: "application", pattern: /^appl$/i },
  { key: "voltageCodes", pattern: /c[oó]digos? de voltagem/i },
  { key: "perfSheet", pattern: /folha perf/i },
];

/** Tenta interpretar como CSV Copeland: structured.rows com 2 linhas (header + valores). */
function parseCopelandCsv(rows: Row[], fields: Record<string, ExtractedField>, warnings: string[]): boolean {
  if (!rows || rows.length < 2) return false;
  const header = rows[0].map((c) => String(c ?? ""));
  const data = rows[1];

  // Detecta formato Copeland pela presença de "Refr" e "Sub-Resfriamento"
  const looksLikeCopeland = header.some((h) => /refr/i.test(h)) && header.some((h) => /sub.?resfriamento/i.test(h));
  if (!looksLikeCopeland) return false;

  // Campos nomeados
  for (const h of NAMED_HEADERS) {
    const idx = header.findIndex((c) => h.pattern.test(c));
    if (idx >= 0 && data[idx] !== undefined && data[idx] !== "") {
      const raw = data[idx];
      const num = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));
      fields[h.key] = {
        value: Number.isFinite(num) && /^-?\d/.test(String(raw)) ? num : String(raw),
        unit: h.unit,
        source: "csv-copeland",
      };
    }
  }

  // Faixas Tevap/Tcond: normalmente 4 colunas após "Retorno de Gás" (Tcond_max, Tcond_min, Tevap_max, Tevap_min)
  // Podem aparecer como inteiros isolados antes do bloco de 40 valores.
  const gasIdx = header.findIndex((c) => /retorno de g[áa]s/i.test(c));
  if (gasIdx > 0) {
    const after = data.slice(gasIdx + 1);
    // Pega os primeiros 4 valores que sejam inteiros pequenos (faixas em °F ou °C)
    const ranges: number[] = [];
    for (const v of after) {
      const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
      if (Number.isFinite(n) && Math.abs(n) < 500 && Number.isInteger(n)) {
        ranges.push(n);
        if (ranges.length === 4) break;
      } else if (ranges.length > 0) break;
    }
    if (ranges.length === 4) {
      fields.condensingTempMax = { value: ranges[0], unit: "°F/°C", source: "csv-copeland" };
      fields.condensingTempMin = { value: ranges[1], unit: "°F/°C", source: "csv-copeland" };
      fields.evaporationTempMax = { value: ranges[2], unit: "°F/°C", source: "csv-copeland" };
      fields.evaporationTempMin = { value: ranges[3], unit: "°F/°C", source: "csv-copeland" };
    }

    // Coeficientes: pega tudo após as 4 faixas
    const coefStart = gasIdx + 1 + ranges.length;
    const coefValues = data.slice(coefStart);
    const allCoefs = mergeCoefficientPairs(coefValues);

    if (allCoefs.length >= 10) {
      fields.capacityCoefficients = {
        value: JSON.stringify(allCoefs.slice(0, 10)),
        source: "csv-copeland",
      };
    }
    if (allCoefs.length >= 20) {
      fields.powerCoefficients = {
        value: JSON.stringify(allCoefs.slice(10, 20)),
        source: "csv-copeland",
      };
    }
    if (allCoefs.length >= 30) {
      fields.currentCoefficients = {
        value: JSON.stringify(allCoefs.slice(20, 30)),
        source: "csv-copeland",
      };
    }
    if (allCoefs.length >= 40) {
      fields.massFlowCoefficients = {
        value: JSON.stringify(allCoefs.slice(30, 40)),
        source: "csv-copeland",
      };
    }
    if (allCoefs.length < 10) warnings.push("Coeficientes não localizados após o cabeçalho ARI.");
    fields.unitSystem = { value: "IP", source: "csv-copeland" };
  }

  return true;
}

/** Fallback: tenta achar coeficientes no rawText (formato livre). */
function fallbackText(rawText: string, fields: Record<string, ExtractedField>) {
  const text = rawText.replace(/\s+/g, " ");
  if (!fields.model) {
    const m = text.match(/\bmodelo?\s*[:=]?\s*([A-Z0-9-]+)/i);
    if (m) fields.model = { value: m[1], source: "regex" };
  }
  if (!fields.fluid) {
    const f = text.match(/\b(R\d{2,4}[A-Za-z]?|R134a|R404A|R407C|R410A|R290|R744|R717)\b/i);
    if (f) fields.fluid = { value: f[1].toUpperCase(), source: "regex" };
  }
}

export function compressorTechnicalParser(rawText: string, structured?: unknown): ParserResult {
  const fields: Record<string, ExtractedField> = {};
  const warnings: string[] = [];
  const errors: string[] = [];

  const s = structured as Structured;
  let parsed = false;
  if (s?.rows && Array.isArray(s.rows)) {
    parsed = parseCopelandCsv(s.rows, fields, warnings);
  }
  if (!parsed && rawText) {
    fallbackText(rawText, fields);
  }

  const found = Object.keys(fields).length;
  const hasCoefs = !!fields.capacityCoefficients;
  if (!found) errors.push("Nenhum campo de compressor identificado.");

  return {
    status: hasCoefs ? "parsed" : found > 0 ? "needs_review" : "failed",
    parserUsed: "compressorTechnicalParser",
    parserVersion: PARSER_VERSION,
    rawText,
    structuredData: structured ?? null,
    extractedFields: fields,
    confidence: hasCoefs ? 0.9 : Math.min(0.7, 0.2 + found * 0.05),
    warnings,
    errors,
  };
}
