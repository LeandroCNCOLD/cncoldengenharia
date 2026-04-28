/**
 * Parser Unilab — Evaporador.
 * Lê PDF / XLS / XLSX e extrai os campos técnicos de um aletado evaporador.
 * Referência: datasheet CN 1200 LT.
 */
import { extractTextFromFile, extractFields, type FieldPattern } from "./unilabExtractor";

export interface UnilabEvaporatorFields {
  totalCapacityW?: number;
  sensibleCapacityW?: number;
  latentCapacityW?: number;
  airflowM3h?: number;
  airMassFlowKgs?: number;
  frontalVelocityMs?: number;
  airTempInC?: number;
  airTempOutC?: number;
  rhInPct?: number;
  rhOutPct?: number;
  evapTempC?: number;
  superheatK?: number;
  subcoolingK?: number;
  surfaceAreaM2?: number;
  internalVolumeL?: number;
  airPressureDropPa?: number;
  refrigerantPressureDropKpa?: number;
  rows?: number;
  tubesPerRow?: number;
  circuits?: number;
  lengthMm?: number;
  finPitchMm?: number;
  tubeOdMm?: number;
  tubeIdMm?: number;
  refrigerant?: string;
}

const PATTERNS: FieldPattern[] = [
  {
    key: "totalCapacityW",
    patterns: [
      /capacidade\s+total/,
      /potencia\s+total/,
      /total\s+capacity/,
      /capacidade\s+frigorifica/,
    ],
  },
  { key: "sensibleCapacityW", patterns: [/capacidade\s+sensivel/, /sensible\s+capacity/] },
  { key: "latentCapacityW", patterns: [/capacidade\s+latente/, /latent\s+capacity/] },
  { key: "airflowM3h", patterns: [/vazao\s+de\s+ar/, /vazao\s+ar/, /airflow/, /caudal\s+de\s+ar/] },
  { key: "airMassFlowKgs", patterns: [/vazao\s+massica\s+de\s+ar/, /air\s+mass\s+flow/] },
  { key: "frontalVelocityMs", patterns: [/velocidade\s+frontal/, /frontal\s+velocity/] },
  {
    key: "airTempInC",
    patterns: [/temperatura\s+do?\s+ar\s+(?:na\s+)?entrada/, /ar\s+entrada/, /air\s+inlet/],
  },
  {
    key: "airTempOutC",
    patterns: [/temperatura\s+do?\s+ar\s+(?:na\s+)?saida/, /ar\s+saida/, /air\s+outlet/],
  },
  { key: "rhInPct", patterns: [/umidade\s+relativa\s+(?:de\s+)?entrada/, /rh\s+entrada/] },
  { key: "rhOutPct", patterns: [/umidade\s+relativa\s+(?:de\s+)?saida/, /rh\s+saida/] },
  {
    key: "evapTempC",
    patterns: [/temperatura\s+de\s+evaporacao/, /evaporacao\s*[:=]/, /evaporating\s+temperature/],
  },
  { key: "superheatK", patterns: [/superaquecimento/, /superheat/] },
  { key: "subcoolingK", patterns: [/subresfriamento/, /sub-?resfriamento/, /subcooling/] },
  { key: "surfaceAreaM2", patterns: [/area\s+de\s+troca/, /superficie\s+de\s+troca/, /heat\s+exchange\s+area/] },
  { key: "internalVolumeL", patterns: [/volume\s+interno/, /internal\s+volume/] },
  { key: "airPressureDropPa", patterns: [/perda\s+de\s+carga\s+(?:do\s+)?ar/, /air\s+pressure\s+drop/] },
  {
    key: "refrigerantPressureDropKpa",
    patterns: [/perda\s+de\s+carga\s+(?:do\s+)?refrigerante/, /refrigerant\s+pressure\s+drop/],
  },
  { key: "rows", patterns: [/numero\s+de\s+fileiras/, /n[º°.]?\s*de\s+fileiras/, /number\s+of\s+rows/] },
  { key: "tubesPerRow", patterns: [/tubos\s+por\s+fileira/, /tubes\s+per\s+row/] },
  { key: "circuits", patterns: [/numero\s+de\s+circuitos/, /circuitos/, /number\s+of\s+circuits/] },
  { key: "lengthMm", patterns: [/comprimento\s+(?:da\s+)?bateria/, /comprimento/, /length/] },
  { key: "finPitchMm", patterns: [/passo\s+(?:de\s+)?aleta/, /fin\s+pitch/] },
  { key: "tubeOdMm", patterns: [/diametro\s+externo\s+(?:do\s+)?tubo/, /tube\s+od/, /od\s+tubo/] },
  { key: "tubeIdMm", patterns: [/diametro\s+interno\s+(?:do\s+)?tubo/, /tube\s+id/, /id\s+tubo/] },
  {
    key: "refrigerant",
    patterns: [/fluido\s+refrigerante/, /refrigerante\s*[:=]/, /refrigerant\s*[:=]/],
    parse: (s) => {
      const m = s.match(/r[-\s]?\d{2,4}[a-z]?/i);
      return m ? m[0].toUpperCase().replace(/\s/g, "") : null;
    },
  },
];

export interface ParseEvaporatorResult {
  fields: UnilabEvaporatorFields;
  warnings: string[];
  rawPreview: string;
}

export async function parseUnilabEvaporator(file: File): Promise<ParseEvaporatorResult> {
  const { text } = await extractTextFromFile(file);
  const fields = extractFields(text, PATTERNS) as UnilabEvaporatorFields;
  const warnings: string[] = [];

  if (!fields.totalCapacityW) warnings.push("Capacidade total não identificada.");
  if (!fields.evapTempC) warnings.push("Temperatura de evaporação não identificada.");
  if (!fields.airTempInC) warnings.push("Temperatura do ar na entrada não identificada.");
  if (!fields.airflowM3h) warnings.push("Vazão de ar não identificada.");
  if (!fields.refrigerant) warnings.push("Fluido refrigerante não identificado.");

  return { fields, warnings, rawPreview: text.slice(0, 4000) };
}
