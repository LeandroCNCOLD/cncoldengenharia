/**
 * Parser Unilab — Condensador.
 * Referência: datasheet CN 1200 LT.
 */
import { extractTextFromFile, extractFields, type FieldPattern } from "./unilabExtractor";

export interface UnilabCondenserFields {
  capacityW?: number;
  airflowM3h?: number;
  frontalVelocityMs?: number;
  airTempInC?: number;
  airTempOutC?: number;
  condTempC?: number;
  subcoolingK?: number;
  desuperheatingK?: number;
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
    key: "capacityW",
    patterns: [/capacidade\s+(?:total|de\s+rejeicao|nominal)/, /potencia\s+rejeitada/, /heat\s+rejection/],
  },
  { key: "airflowM3h", patterns: [/vazao\s+de\s+ar/, /vazao\s+ar/, /airflow/] },
  { key: "frontalVelocityMs", patterns: [/velocidade\s+frontal/, /frontal\s+velocity/] },
  {
    key: "airTempInC",
    patterns: [/temperatura\s+do?\s+ar\s+(?:na\s+)?entrada/, /ar\s+entrada/, /air\s+inlet/, /temperatura\s+ambiente/],
  },
  {
    key: "airTempOutC",
    patterns: [/temperatura\s+do?\s+ar\s+(?:na\s+)?saida/, /ar\s+saida/, /air\s+outlet/],
  },
  { key: "condTempC", patterns: [/temperatura\s+de\s+condensacao/, /condensacao\s*[:=]/, /condensing\s+temperature/] },
  { key: "subcoolingK", patterns: [/subresfriamento/, /sub-?resfriamento/, /subcooling/] },
  { key: "desuperheatingK", patterns: [/dessuperaquecimento/, /desuperheat/] },
  { key: "surfaceAreaM2", patterns: [/area\s+de\s+troca/, /heat\s+exchange\s+area/] },
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
  { key: "tubeOdMm", patterns: [/diametro\s+externo\s+(?:do\s+)?tubo/, /tube\s+od/] },
  { key: "tubeIdMm", patterns: [/diametro\s+interno\s+(?:do\s+)?tubo/, /tube\s+id/] },
  {
    key: "refrigerant",
    patterns: [/fluido\s+refrigerante/, /refrigerante\s*[:=]/, /refrigerant\s*[:=]/],
    parse: (s) => {
      const m = s.match(/r[-\s]?\d{2,4}[a-z]?/i);
      return m ? m[0].toUpperCase().replace(/\s/g, "") : null;
    },
  },
];

export interface ParseCondenserResult {
  fields: UnilabCondenserFields;
  warnings: string[];
  rawPreview: string;
}

export async function parseUnilabCondenser(file: File): Promise<ParseCondenserResult> {
  const { text } = await extractTextFromFile(file);
  const fields = extractFields(text, PATTERNS) as UnilabCondenserFields;
  const warnings: string[] = [];

  if (!fields.capacityW) warnings.push("Capacidade não identificada.");
  if (!fields.condTempC) warnings.push("Temperatura de condensação não identificada.");
  if (!fields.airTempInC) warnings.push("Temperatura ambiente não identificada.");
  if (!fields.airflowM3h) warnings.push("Vazão de ar não identificada.");
  if (!fields.refrigerant) warnings.push("Fluido refrigerante não identificado.");

  return { fields, warnings, rawPreview: text.slice(0, 4000) };
}
