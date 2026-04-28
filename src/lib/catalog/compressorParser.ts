import type { CompressorCatalogItem } from "./types";
import { CatalogValidationError } from "./types";

/** Detecta o separador mais provável de um CSV (vírgula, ponto-e-vírgula ou tab). */
export function detectSeparator(sample: string): string {
  const candidates = [",", ";", "\t", "|"];
  let best = ",";
  let bestCount = -1;
  for (const sep of candidates) {
    const count = (sample.match(new RegExp(`\\${sep}`, "g")) ?? []).length;
    if (count > bestCount) {
      bestCount = count;
      best = sep;
    }
  }
  return best;
}

/** Converte string para número aceitando vírgula decimal e notação científica. */
export function toNumber(raw: string): number {
  const cleaned = raw.trim().replace(/\s/g, "").replace(",", ".");
  const n = Number(cleaned);
  if (!Number.isFinite(n)) {
    throw new CatalogValidationError(`Não foi possível converter "${raw}" em número`);
  }
  return n;
}

export type ParsedCompressorCsv = {
  model: string;
  refrigerant: string;
  unitSystem: "SI" | "IP";
  /** Map de bloco -> 10 coeficientes (ex.: capacity, power, current...). */
  blocks: Record<string, number[]>;
};

/**
 * Extrai coeficientes polinomiais AHRI-540 de um CSV Copeland.
 * Aceita layouts variados: procura linhas com 10 valores numéricos sequenciais
 * ou linhas key=value para metadados (Model, Refrigerant, Units).
 */
export function parseCompressorCsv(csv: string, sourceFile: string): ParsedCompressorCsv {
  const sep = detectSeparator(csv.split(/\r?\n/).slice(0, 5).join("\n"));
  const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  let model = "";
  let refrigerant = "";
  let unitSystem: "SI" | "IP" = "SI";
  const blocks: Record<string, number[]> = {};
  let currentLabel = "";

  for (const line of lines) {
    const cells = line.split(sep).map((c) => c.trim());
    const lower = line.toLowerCase();

    // Metadados key:value
    if (lower.startsWith("model")) {
      model = cells[1] ?? cells[0].split(/[:=]/)[1]?.trim() ?? model;
      continue;
    }
    if (lower.startsWith("refrigerant") || lower.startsWith("fluid")) {
      refrigerant = cells[1] ?? "";
      continue;
    }
    if (lower.includes("unit")) {
      unitSystem = /ip|imperial|btu/.test(lower) ? "IP" : "SI";
      continue;
    }
    if (/capacity|power|current|mass\s*flow/.test(lower) && cells.filter(isNumeric).length < 10) {
      currentLabel = lower.replace(/[^a-z]/g, "_").replace(/^_+|_+$/g, "");
      continue;
    }

    // Linha com 10 coeficientes
    const numeric = cells.filter(isNumeric).map(toNumber);
    if (numeric.length >= 10) {
      const label = currentLabel || `block_${Object.keys(blocks).length + 1}`;
      blocks[label] = numeric.slice(0, 10);
      currentLabel = "";
    }
  }

  if (Object.keys(blocks).length === 0) {
    throw new CatalogValidationError(
      `Nenhum bloco de 10 coeficientes encontrado em ${sourceFile}`,
    );
  }

  return { model: model || "Unknown", refrigerant: refrigerant || "Unknown", unitSystem, blocks };
}

/** Cria um CompressorCatalogItem usando o bloco "capacity" (ou primeiro disponível). */
export function buildCompressorItem(
  parsed: ParsedCompressorCsv,
  sourceFile: string,
  preferred: "capacity" | "power" = "capacity",
): CompressorCatalogItem {
  const key =
    Object.keys(parsed.blocks).find((k) => k.includes(preferred)) ??
    Object.keys(parsed.blocks)[0];
  const coeffs = parsed.blocks[key];
  if (!coeffs || coeffs.length !== 10) {
    throw new CatalogValidationError(
      `Bloco "${preferred}" inválido em ${sourceFile}: ${coeffs?.length ?? 0} coef.`,
    );
  }
  return {
    id: `${parsed.model}-${preferred}`.replace(/\s+/g, "_"),
    model: parsed.model,
    refrigerant: parsed.refrigerant,
    polynomialCoefficients: coeffs,
    unitSystem: parsed.unitSystem,
    sourceFile,
  };
}

function isNumeric(s: string): boolean {
  if (!s) return false;
  return /^-?\d+([.,]\d+)?([eE][-+]?\d+)?$/.test(s.trim());
}
