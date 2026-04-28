// Parser técnico de compressor: tenta achar coeficientes AHRI no rawText/structuredData.

import {
  PARSER_VERSION,
  type ExtractedField,
  type ParserResult,
} from "../ingestionTypes";

function findCoefficients(text: string, label: RegExp): number[] | null {
  // Procura linha com label seguida de 10 números.
  const re = new RegExp(`${label.source}[^\\d-]*((?:[-+]?\\d+(?:[.,]\\d+)?(?:[eE][-+]?\\d+)?[\\s,;]+){9,}[-+]?\\d+(?:[.,]\\d+)?(?:[eE][-+]?\\d+)?)`, "i");
  const m = text.match(re);
  if (!m) return null;
  const nums = m[1]
    .split(/[\s,;]+/)
    .map((s) => Number(s.replace(",", ".")))
    .filter((n) => Number.isFinite(n));
  if (nums.length < 10) return null;
  return nums.slice(0, 10);
}

export function compressorTechnicalParser(rawText: string, structured?: unknown): ParserResult {
  const fields: Record<string, ExtractedField> = {};
  const warnings: string[] = [];
  const errors: string[] = [];
  const text = rawText.replace(/\s+/g, " ");

  // Modelo
  const model = text.match(/\bmodelo?\s*[:=]?\s*([A-Z0-9\-]+)/i);
  if (model) fields.model = { value: model[1], source: "regex" };

  // Refrigerante
  const fluid = text.match(/\b(R\d{2,4}[A-Z]?|R-\d{2,4}[A-Z]?|R134a|R404A|R407C|R410A|R290|R744|R717)\b/i);
  if (fluid) fields.fluid = { value: fluid[1].toUpperCase(), source: "regex" };

  // Tipo de unidade
  const unitSystem = /\b(BTU\/?h|imperial)\b/i.test(text) ? "IP" : /\b(SI|kW|watts?)\b/i.test(text) ? "SI" : null;
  if (unitSystem) fields.unitSystem = { value: unitSystem, source: "regex" };

  // Coeficientes de capacidade
  const cap = findCoefficients(text, /capacit(?:y|ade)\s*coefficients?/i)
    ?? findCoefficients(text, /coeficientes? de capacidade/i);
  if (cap) fields.capacityCoefficients = { value: JSON.stringify(cap), source: "regex" };
  else warnings.push("Coeficientes de capacidade não localizados.");

  // Coeficientes de potência
  const pwr = findCoefficients(text, /power\s*coefficients?/i)
    ?? findCoefficients(text, /coeficientes? de pot[eê]ncia/i);
  if (pwr) fields.powerCoefficients = { value: JSON.stringify(pwr), source: "regex" };

  // Coeficientes de corrente
  const cur = findCoefficients(text, /current\s*coefficients?/i)
    ?? findCoefficients(text, /coeficientes? de corrente/i);
  if (cur) fields.currentCoefficients = { value: JSON.stringify(cur), source: "regex" };

  // Envelope
  const env = text.match(/envelope[^\n]{0,80}(-?\d+[.,]?\d*)\s*°?C[^\n]{0,40}(-?\d+[.,]?\d*)\s*°?C/i);
  if (env) {
    fields.envelopeMinC = { value: Number(env[1].replace(",", ".")), unit: "°C", source: "regex" };
    fields.envelopeMaxC = { value: Number(env[2].replace(",", ".")), unit: "°C", source: "regex" };
  }

  // Tenta também procurar no structured (planilha)
  void structured;

  const found = Object.keys(fields).length;
  if (!found) errors.push("Nenhum campo de compressor identificado.");

  return {
    status: cap ? "parsed" : found > 0 ? "needs_review" : "failed",
    parserUsed: "compressorTechnicalParser",
    parserVersion: PARSER_VERSION,
    rawText,
    structuredData: structured ?? null,
    extractedFields: fields,
    confidence: cap ? 0.85 : Math.min(0.7, 0.2 + found * 0.07),
    warnings,
    errors,
  };
}
