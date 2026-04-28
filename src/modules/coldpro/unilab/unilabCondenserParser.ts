/**
 * Parser Unilab — Condensador.
 * Cobre o layout "Unilab Coils 9.x ev" (PT-BR) com bloco BATERIA DE CONDENSAÇÃO.
 */
import { extractTextFromFile, extractFields, type FieldPattern, parseNumber } from "./unilabExtractor";

export interface UnilabCondenserFields {
  // Geometria
  description?: string;
  lengthMm?: number;
  dividers?: number;
  tubesPerRow?: number;
  finPitchMm?: number;
  rows?: number;
  circuits?: number;
  tubeShape?: string;
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
  globalCoeffW?: number;                 // W/(m² K)
  deltaTLogK?: number;                   // ΔT médio logarítmico

  // Lado do ar
  atmPressureBar?: number;
  altitudeM?: number;
  airflowM3h?: number;
  airMassFlowKgh?: number;
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
  airSideUW?: number;
  airFoulingM2KW?: number;

  // Lado refrigerante
  refrigerant?: string;
  refrigerantMassFlowKgh?: number;
  massVelocityKgM2s?: number;
  vapourVelocityMs?: number;
  liquidVelocityMs?: number;
  subcoolingK?: number;
  desuperheatK?: number;                 // "Dessuperaquecimento"
  condTempC?: number;
  refrigerantPressureDropKpa?: number;
  manifoldPressureDropKpa?: number;
  totalRefPressureDropKpa?: number;
}

const parsePair = (s: string): [number | null, number | null] => {
  const m = s.match(/(-?[\d.,]+)\s*\/\s*(-?[\d.,]+)/);
  if (!m) return [parseNumber(s), null];
  return [parseNumber(m[1]), parseNumber(m[2])];
};

const PATTERNS: FieldPattern[] = [
  // ===== Geometria =====
  { key: "lengthMm", patterns: [/comprimento\s+da\s+bateria/, /coil\s+length/] },
  { key: "dividers", patterns: [/n[º°.]?\s*divisores/] },
  { key: "tubesPerRow", patterns: [/numero\s+de\s+tubos\s+por\s+fileiras?/, /tubes\s+per\s+row/] },
  { key: "finPitchMm", patterns: [/passo\s+das?\s+aletas?/, /fin\s+pitch/] },
  { key: "rows", patterns: [/numero\s+de\s+fileiras/, /number\s+of\s+rows/] },
  { key: "circuits", patterns: [/numero\s+de\s+circuitos/, /number\s+of\s+circuits/] },
  {
    key: "tubeShape",
    patterns: [/formato\s+tubo/],
    parse: (s) => (s.match(/(circular|oval|rifled|liso|smooth)/i)?.[1] ?? null),
  },
  { key: "tubeOdMm", patterns: [/diametro\s+externo\s+dos?\s+tubos?/, /tube\s+od/] },
  { key: "tubeIdMm", patterns: [/diametro\s+interno\s+dos?\s+tubos?/, /tube\s+id/] },
  { key: "finThicknessMm", patterns: [/espessura\s+das?\s+aletas?/] },
  { key: "internalVolumeL", patterns: [/volume\s+interno\s+da\s+bateria/] },
  { key: "surfaceAreaM2", patterns: [/superficie\s+de\s+troca/, /heat\s+exchange\s+area/] },
  { key: "skippedTubes", patterns: [/numero\s+dos?\s+tubos\s+saltados/] },
  {
    key: "finMaterial",
    patterns: [/material\s+das?\s+aletas/],
    parse: (s) => (s.match(/(aluminio|aluminium|cobre|copper|inox|stainless)/i)?.[1] ?? null),
  },
  {
    key: "tubeMaterial",
    patterns: [/material\s+dos?\s+tubos/],
    parse: (s) => (s.match(/(cobre|copper|aluminio|aluminium|inox|stainless)/i)?.[1] ?? null),
  },

  // ===== Capacidades =====
  { key: "totalCapacityW", patterns: [/^capacidade\b/, /capacidade\s+total/, /total\s+capacity/] },
  { key: "globalCoeffW", patterns: [/coeficiente\s+de\s+transformacao\s+global/] },
  { key: "deltaTLogK", patterns: [/delta\s*t\s+medio\s+logaritmico/, /logarithmic\s+mean\s+temperature/] },

  // ===== Lado do ar =====
  {
    key: "atmPressureBar",
    patterns: [/pressao\s+atmosferica\s*\/\s*altitude/],
    parse: (s) => parsePair(s)[0],
  },
  {
    key: "altitudeM",
    patterns: [/pressao\s+atmosferica\s*\/\s*altitude/],
    parse: (s) => parsePair(s)[1],
  },
  { key: "airflowM3h", patterns: [/fluxo\s+volumetrico\s+de\s+ar/, /vazao\s+de\s+ar/, /airflow/] },
  { key: "airMassFlowKgh", patterns: [/fluxo\s+maximo\s+de\s+ar/] },
  { key: "frontalVelocityMs", patterns: [/velocidade\s+frontal\s+(?:na\s+)?bateria/, /face\s+velocity/] },
  { key: "airDensityInKgM3", patterns: [/densidade\s+do\s+ar\s+na\s+entrada/] },
  { key: "airTempInC", patterns: [/temperatura\s+do?\s+ar\s+na\s+entrada/] },
  { key: "rhInPct", patterns: [/humidade\s+relativa\s+do?\s+ar\s+na\s+entrada/, /umidade\s+relativa.*entrada/] },
  { key: "specHumInGkg", patterns: [/humidade\s+especifica\s+do?\s+ar\s+na\s+entrada/] },
  { key: "enthalpyInKjkg", patterns: [/entalpia\s+do?\s+ar\s+na\s+entrada/] },
  { key: "airTempOutC", patterns: [/temperatura\s+do?\s+ar\s+na\s+saida/] },
  { key: "rhOutPct", patterns: [/humidade\s+relativa\s+do?\s+ar\s+na\s+saida/, /umidade\s+relativa.*saida/] },
  { key: "specHumOutGkg", patterns: [/humidade\s+especifica\s+do?\s+ar\s+na\s+saida/] },
  { key: "enthalpyOutKjkg", patterns: [/entalpia\s+do?\s+ar\s+na\s+saida/] },
  { key: "airPressureDropPa", patterns: [/queda\s+de\s+pressao(?!\s+do\s+(fluido|colector|total))/, /air\s+pressure\s+drop/] },
  { key: "airSideUW", patterns: [/coeficiente\s+de\s+transformacao\s+parcial/] },
  { key: "airFoulingM2KW", patterns: [/coeficiente\s+de\s+sujidade/] },

  // ===== Lado refrigerante =====
  {
    key: "refrigerant",
    patterns: [/^fluido\b/, /fluido\s+refrigerante/],
    parse: (s) => {
      const m = s.match(/r[-\s]?\d{2,4}[a-z]?/i);
      return m ? m[0].toUpperCase().replace(/\s|-/g, "") : null;
    },
  },
  { key: "refrigerantMassFlowKgh", patterns: [/fluxo\s+maximo\s+do\s+fluido/] },
  { key: "massVelocityKgM2s", patterns: [/velocidade\s+de\s+massa/] },
  { key: "vapourVelocityMs", patterns: [/velocidade\s+do\s+fluido\s*\(fase\s+gasosa\)/, /velocidade.*gasosa/] },
  { key: "liquidVelocityMs", patterns: [/velocidade\s+do\s+fluido\s*\(fase\s+liquida\)/, /velocidade.*liquida/] },
  { key: "subcoolingK", patterns: [/subresfriamento/, /sub-?arrefecimento/, /subcooling/] },
  { key: "desuperheatK", patterns: [/dessuperaquecimento/, /desuperheat/] },
  { key: "condTempC", patterns: [/temperatura\s+de\s+condensacao/, /condensing\s+temperature/] },
  { key: "refrigerantPressureDropKpa", patterns: [/queda\s+de\s+pressao\s+do\s+fluido(?!\s+total)/] },
  { key: "manifoldPressureDropKpa", patterns: [/queda\s+de\s+pressao\s+do\s+colector/] },
  { key: "totalRefPressureDropKpa", patterns: [/queda\s+de\s+pressao\s+total\s+do\s+lado\s+do\s+fluido/] },
];

const REQUIRED_FIELDS: (keyof UnilabCondenserFields)[] = [
  "totalCapacityW",
  "condTempC",
  "airTempInC",
  "airflowM3h",
  "refrigerant",
  "rows",
  "tubesPerRow",
  "circuits",
];

export interface ParseCondenserResult {
  fields: UnilabCondenserFields;
  warnings: string[];
  missingFields: string[];
  confidenceScore: number;
  rawPreview: string;
}

function extractDescription(text: string): string | undefined {
  const battery = text.split(/\n+/).find((l) =>
    /bateria\s+de\s+condensacao/i.test(l.normalize("NFD").replace(/[\u0300-\u036f]/g, "")),
  );
  return battery?.replace(/^.*?-\s*/, "").trim();
}

export async function parseUnilabCondenser(file: File): Promise<ParseCondenserResult> {
  const { text } = await extractTextFromFile(file);
  const fields = extractFields(text, PATTERNS) as UnilabCondenserFields;
  fields.description = extractDescription(text);

  const warnings: string[] = [];
  const allKeys = PATTERNS.map((p) => p.key);
  const missingFields = allKeys.filter((k) => fields[k as keyof UnilabCondenserFields] == null);
  const confidenceScore = (allKeys.length - missingFields.length) / allKeys.length;

  for (const k of REQUIRED_FIELDS) {
    if (fields[k] == null) warnings.push(`Campo obrigatório ausente: ${k}`);
  }
  if (fields.totalCapacityW != null && fields.totalCapacityW < 100) {
    warnings.push(`Capacidade parece estar em kW (${fields.totalCapacityW}). Convertendo para W.`);
    fields.totalCapacityW *= 1000;
  }

  return { fields, warnings, missingFields, confidenceScore, rawPreview: text.slice(0, 4000) };
}
