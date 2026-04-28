/**
 * Detecta automaticamente o tipo de bateria de um datasheet Unilab
 * (evaporador DX, condensador ou outro).
 */
import { extractTextFromFile, normalize } from "./unilabExtractor";

export type UnilabCoilType = "evaporator" | "condenser" | "unknown";

export interface SniffResult {
  type: UnilabCoilType;
  rawText: string;
  reason: string;
}

export async function sniffUnilabCoilType(file: File): Promise<SniffResult> {
  const { text } = await extractTextFromFile(file);
  const norm = normalize(text);

  // sinais explícitos de cabeçalho da Unilab
  if (/bateria\s+de\s+expansao/.test(norm) || /direct\s+expansion\s+coil/.test(norm)) {
    return { type: "evaporator", rawText: text, reason: "Cabeçalho 'Bateria de expansão'" };
  }
  if (/bateria\s+de\s+condensacao/.test(norm) || /condensing\s+coil/.test(norm)) {
    return { type: "condenser", rawText: text, reason: "Cabeçalho 'Bateria de condensação'" };
  }

  // sinais por campos típicos
  const evapSignals = [
    /temperatura\s+de\s+evaporacao/,
    /potencialidade\s+sensivel/,
    /potencialidade\s+latente/,
    /quantidade\s+de\s+agua\s+produzida/,
    /sub-?arrefecimento/,
  ];
  const condSignals = [
    /temperatura\s+de\s+condensacao/,
    /dessuperaquecimento/,
    /condensing\s+temperature/,
  ];

  const evapHits = evapSignals.filter((r) => r.test(norm)).length;
  const condHits = condSignals.filter((r) => r.test(norm)).length;

  if (evapHits > condHits && evapHits >= 1) {
    return { type: "evaporator", rawText: text, reason: `${evapHits} marcadores típicos de evaporador` };
  }
  if (condHits > evapHits && condHits >= 1) {
    return { type: "condenser", rawText: text, reason: `${condHits} marcadores típicos de condensador` };
  }

  return { type: "unknown", rawText: text, reason: "Sem marcadores claros de tipo" };
}
