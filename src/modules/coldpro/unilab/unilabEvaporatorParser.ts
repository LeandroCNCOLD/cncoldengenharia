/**
 * Parser Unilab — Evaporador.
 * Cobre o layout "Unilab Coils 9.x ev" (PT-BR) e variações em inglês.
 * Extrai geometria + lado ar + lado refrigerante + coeficientes.
 */
import { extractTextFromFile, extractFields, type FieldPattern, parseNumber } from "./unilabExtractor";

export interface UnilabEvaporatorFields {
  // Geometria
  description?: string;                  // ex.: "F Lantery EVP - CN COLD"
  lengthMm?: number;
  dividers?: number;
  tubesPerRow?: number;
  finPitchMm?: number;
  rows?: number;
  circuits?: number;
  tubeShape?: string;                    // Circular / Oval...
  tubeOdMm?: number;
  tubeIdMm?: number;
  finThicknessMm?: number;
  internalVolumeL?: number;
  surfaceAreaM2?: number;
  skippedTubes?: number;
  finMaterial?: string;
  tubeMaterial?: string;

  // Capacidades
  totalCapacityW?: number;
  sensibleCapacityW?: number;
  latentCapacityW?: number;
  sensibleRatio?: number;                // Qs/Qt
  waterProductionKgh?: number;
  globalCoeffW?: number;                 // W kg/(m² kJ)
  deltaHLogKjkg?: number;                // ΔH médio logarítmico

  // Lado do ar
  atmPressureBar?: number;
  altitudeM?: number;
  airflowM3h?: number;
  airMassFlowKgh?: number;               // "Fluxo máximo de ar"
  frontalVelocityMs?: number;
  airDensityInKgM3?: number;
  airTempInC?: number;
  rhInPct?: number;
  specHumInGkg?: number;
  enthalpyInKjkg?: number;
  airTempOutC?: number;
  rhOutPct?: number;
  specHumOutGkg?: number;
  enthalpyOutKjkg?: number;
  airPressureDropPa?: number;
  airSideUW?: number;                    // Coef. transformação parcial lado ar
  airFoulingM2KW?: number;

  // Lado refrigerante
  refrigerant?: string;
  refrigerantMassFlowKgh?: number;
  massVelocityKgM2s?: number;
  vapourVelocityMs?: number;
  liquidVelocityMs?: number;
  subcoolingK?: number;
  superheatK?: number;
  evapTempC?: number;
  condTempC?: number;                    // pode aparecer como referência
  refrigerantPressureDropKpa?: number;
  manifoldPressureDropKpa?: number;
  totalRefPressureDropKpa?: number;
  refrigerantSideUW?: number;
  refrigerantFoulingM2KW?: number;
}

/** Helper para campos que aparecem como "X / Y" (ex.: "1,01 / 0,00"). */
const parsePair = (s: string): [number | null, number | null] => {
  const m = s.match(/(-?[\d.,]+)\s*\/\s*(-?[\d.,]+)/);
  if (!m) return [parseNumber(s), null];
  return [parseNumber(m[1]), parseNumber(m[2])];
};

const PATTERNS: FieldPattern[] = [
  // ===== Geometria =====
  { key: "lengthMm", patterns: [/comprimento\s+da\s+bateria/, /coil\s+length/] },
  { key: "dividers", patterns: [/n[º°.]?\s*divisores/, /number\s+of\s+dividers/] },
  { key: "tubesPerRow", patterns: [/numero\s+de\s+tubos\s+por\s+fileiras?/, /tubes\s+per\s+row/] },
  { key: "finPitchMm", patterns: [/passo\s+das?\s+aletas?/, /fin\s+pitch/] },
  { key: "rows", patterns: [/numero\s+de\s+fileiras/, /number\s+of\s+rows/] },
  { key: "circuits", patterns: [/numero\s+de\s+circuitos/, /number\s+of\s+circuits/] },
  {
    key: "tubeShape",
    patterns: [/formato\s+tubo/, /tube\s+shape/],
    parse: (s) => {
      const m = s.match(/(circular|oval|rifled|liso|smooth)/i);
      return m ? m[1] : null;
    },
  },
  { key: "tubeOdMm", patterns: [/diametro\s+externo\s+dos?\s+tubos?/, /tube\s+od/] },
  { key: "tubeIdMm", patterns: [/diametro\s+interno\s+dos?\s+tubos?/, /tube\s+id/] },
  { key: "finThicknessMm", patterns: [/espessura\s+das?\s+aletas?/, /fin\s+thickness/] },
  { key: "internalVolumeL", patterns: [/volume\s+interno\s+da\s+bateria/, /internal\s+volume/] },
  { key: "surfaceAreaM2", patterns: [/superficie\s+de\s+troca/, /heat\s+exchange\s+area/, /area\s+de\s+troca/] },
  { key: "skippedTubes", patterns: [/numero\s+dos?\s+tubos\s+saltados/, /skipped\s+tubes/] },
  {
    key: "finMaterial",
    patterns: [/material\s+das?\s+aletas/, /fin\s+material/],
    parse: (s) => {
      const m = s.match(/(aluminio|aluminium|cobre|copper|inox|stainless)/i);
      return m ? m[1] : null;
    },
  },
  {
    key: "tubeMaterial",
    patterns: [/material\s+dos?\s+tubos/, /tube\s+material/],
    parse: (s) => {
      const m = s.match(/(cobre|copper|aluminio|aluminium|inox|stainless)/i);
      return m ? m[1] : null;
    },
  },

  // ===== Capacidades =====
  // No Unilab evaporador a primeira linha de capacidade é só "Capacidade  13312 W"
  { key: "totalCapacityW", patterns: [/^capacidade\b/, /capacidade\s+total/, /total\s+capacity/] },
  { key: "sensibleCapacityW", patterns: [/potencialidade\s+sensivel/, /capacidade\s+sensivel/, /sensible\s+capacity/] },
  { key: "latentCapacityW", patterns: [/potencialidade\s+latente/, /capacidade\s+latente/, /latent\s+capacity/] },
  { key: "sensibleRatio", patterns: [/relacao\s+da\s+potencia\s+sensivel/, /sensible\s+heat\s+ratio/] },
  { key: "waterProductionKgh", patterns: [/quantidade\s+de\s+agua\s+produzida/, /water\s+production/] },
  { key: "globalCoeffW", patterns: [/coeficiente\s+de\s+transformacao\s+global/, /global.*exchange.*coeff/] },
  { key: "deltaHLogKjkg", patterns: [/delta\s*h\s+medio\s+logaritmico/, /logarithmic\s+mean\s+enthalpy/] },

  // ===== Lado do ar =====
  {
    key: "atmPressureBar",
    patterns: [/pressao\s+atmosferica\s*\/\s*altitude/, /atmospheric\s+pressure\s*\/\s*altitude/],
    parse: (s) => parsePair(s)[0],
  },
  {
    key: "altitudeM",
    patterns: [/pressao\s+atmosferica\s*\/\s*altitude/, /atmospheric\s+pressure\s*\/\s*altitude/],
    parse: (s) => parsePair(s)[1],
  },
  { key: "airflowM3h", patterns: [/fluxo\s+volumetrico\s+de\s+ar/, /vazao\s+de\s+ar/, /airflow/] },
  { key: "airMassFlowKgh", patterns: [/fluxo\s+maximo\s+de\s+ar/, /air\s+mass\s+flow/] },
  { key: "frontalVelocityMs", patterns: [/velocidade\s+frontal\s+(?:na\s+)?bateria/, /face\s+velocity/] },
  { key: "airDensityInKgM3", patterns: [/densidade\s+do\s+ar\s+na\s+entrada/, /air\s+density/] },
  { key: "airTempInC", patterns: [/temperatura\s+do?\s+ar\s+na\s+entrada/, /air\s+inlet\s+temperature/] },
  { key: "rhInPct", patterns: [/humidade\s+relativa\s+do?\s+ar\s+na\s+entrada/, /umidade\s+relativa.*entrada/, /inlet\s+rh/] },
  { key: "specHumInGkg", patterns: [/humidade\s+especifica\s+do?\s+ar\s+na\s+entrada/, /specific\s+humidity.*inlet/] },
  { key: "enthalpyInKjkg", patterns: [/entalpia\s+do?\s+ar\s+na\s+entrada/, /inlet\s+enthalpy/] },
  { key: "airTempOutC", patterns: [/temperatura\s+do?\s+ar\s+na\s+saida/, /air\s+outlet\s+temperature/] },
  { key: "rhOutPct", patterns: [/humidade\s+relativa\s+do?\s+ar\s+na\s+saida/, /umidade\s+relativa.*saida/, /outlet\s+rh/] },
  { key: "specHumOutGkg", patterns: [/humidade\s+especifica\s+do?\s+ar\s+na\s+saida/, /specific\s+humidity.*outlet/] },
  { key: "enthalpyOutKjkg", patterns: [/entalpia\s+do?\s+ar\s+na\s+saida/, /outlet\s+enthalpy/] },
  // "Queda de pressão" sem mais qualificadores aparece no bloco LADO VENTILAÇÃO
  { key: "airPressureDropPa", patterns: [/queda\s+de\s+pressao(?!\s+do\s+(fluido|colector|total))/, /air\s+pressure\s+drop/] },
  // Coeficientes — aparecem 2x (ar e refrigerante). Usamos primeira ocorrência para ar
  { key: "airSideUW", patterns: [/coeficiente\s+de\s+transformacao\s+parcial/, /partial\s+heat\s+transfer\s+coeff/] },
  { key: "airFoulingM2KW", patterns: [/coeficiente\s+de\s+sujidade/, /fouling\s+factor/] },

  // ===== Lado refrigerante =====
  {
    key: "refrigerant",
    patterns: [/^fluido\b/, /fluido\s+refrigerante/, /refrigerant\s*[:=]/],
    parse: (s) => {
      const m = s.match(/r[-\s]?\d{2,4}[a-z]?/i);
      return m ? m[0].toUpperCase().replace(/\s|-/g, "") : null;
    },
  },
  {
    key: "refrigerantMassFlowKgh",
    patterns: [/fluxo\s+maximo\s+do\s+fluido/, /refrigerant\s+mass\s+flow/],
    parse: (s) => parsePair(s)[0] ?? parseNumber(s),
  },
  {
    key: "massVelocityKgM2s",
    patterns: [/velocidade\s+de\s+massa/, /mass\s+velocity/, /fluxo\s+maximo\s+do\s+fluido/],
    parse: (s) => {
      const pair = parsePair(s);
      return pair[1] ?? parseNumber(s);
    },
  },
  {
    key: "vapourVelocityMs",
    patterns: [/velocidade\s+do\s+fluido\s*\(fase\s+gasosa\s*\/\s*fase\s+liquida\)/, /velocidade\s+do\s+fluido\s*\(fase\s+gasosa\)/, /vapour\s+velocity/],
    parse: (s) => parsePair(s)[0] ?? parseNumber(s),
  },
  {
    key: "liquidVelocityMs",
    patterns: [/velocidade\s+do\s+fluido\s*\(fase\s+gasosa\s*\/\s*fase\s+liquida\)/, /velocidade\s+do\s+fluido\s*\(fase\s+liquida\)/, /liquid\s+velocity/],
    parse: (s) => {
      const pair = parsePair(s);
      return pair[1] ?? parseNumber(s);
    },
  },
  { key: "subcoolingK", patterns: [/graus?\s+de\s+sub-?arrefecimento/, /subresfriamento/, /subcooling/] },
  { key: "superheatK", patterns: [/graus?\s+de\s+sobreaquecimento/, /superaquecimento/, /superheat/] },
  { key: "evapTempC", patterns: [/temperatura\s+de\s+evaporacao/, /evaporating\s+temperature/] },
  { key: "condTempC", patterns: [/temperatura\s+de\s+condensacao/, /condensing\s+temperature/] },
  { key: "refrigerantPressureDropKpa", patterns: [/queda\s+de\s+pressao\s+do\s+fluido(?!\s+total)/, /refrigerant\s+pressure\s+drop/] },
  { key: "manifoldPressureDropKpa", patterns: [/queda\s+de\s+pressao\s+do\s+colector/, /manifold\s+pressure\s+drop/] },
  { key: "totalRefPressureDropKpa", patterns: [/queda\s+de\s+pressao\s+total\s+do\s+lado\s+do\s+fluido/, /total\s+refrigerant\s+pressure\s+drop/] },
];

const REQUIRED_FIELDS: (keyof UnilabEvaporatorFields)[] = [
  "totalCapacityW",
  "evapTempC",
  "airTempInC",
  "airflowM3h",
  "refrigerant",
  "rows",
  "tubesPerRow",
  "circuits",
];

export interface ParseEvaporatorResult {
  fields: UnilabEvaporatorFields;
  warnings: string[];
  missingFields: string[];
  confidenceScore: number;
  rawPreview: string;
}

/** Extrai a "descrição do modelo" — geralmente a primeira linha após "Geometria". */
function extractDescription(text: string): string | undefined {
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  // procura linha que contenha "BATERIA DE EXPANSÃO" ou "BATERIA DE CONDENSAÇÃO"
  const battery = lines.find((l) => /bateria\s+de\s+(expansao|condensacao)/i.test(l.normalize("NFD").replace(/[\u0300-\u036f]/g, "")));
  return battery?.replace(/^.*?-\s*/, "").trim();
}

export async function parseUnilabEvaporator(file: File): Promise<ParseEvaporatorResult> {
  const { text } = await extractTextFromFile(file);
  const fields = extractFields(text, PATTERNS) as UnilabEvaporatorFields;
  fields.description = extractDescription(text);

  const warnings: string[] = [];
  const allKeys = PATTERNS.map((p) => p.key);
  const missingFields = allKeys.filter((k) => fields[k as keyof UnilabEvaporatorFields] == null);
  const confidenceScore = (allKeys.length - missingFields.length) / allKeys.length;

  for (const k of REQUIRED_FIELDS) {
    if (fields[k] == null) warnings.push(`Campo obrigatório ausente: ${k}`);
  }

  // sanity: capacidade em kW ao invés de W
  if (fields.totalCapacityW != null && fields.totalCapacityW < 50) {
    warnings.push(`Capacidade total parece estar em kW (${fields.totalCapacityW}). Convertendo para W.`);
    fields.totalCapacityW *= 1000;
  }

  return { fields, warnings, missingFields, confidenceScore, rawPreview: text.slice(0, 4000) };
}
