// CN Cold Engineering — Parser de CSV (compressores).
import Papa from "papaparse";
import { resolveFieldKey } from "./aliases";
import type { ComponentType } from "@/lib/component-schema";

export interface ParsedFile {
  fields: Record<string, unknown>;
  rawRowCount: number;
  unmappedHeaders: string[];
}

/**
 * Estratégia: lê o CSV como objetos.
 * - Se houver colunas claras (ex.: "campo,valor"), trata como par chave/valor.
 * - Caso contrário, pega a primeira linha como representativa e mapeia colunas
 *   reconhecidas no dicionário de aliases.
 * - Coeficientes AHRI540: se houver 10 colunas numéricas chamadas C1..C10,
 *   serializa como array em "coeficientes".
 */
export async function parseCsv(
  file: File,
  type: ComponentType,
): Promise<ParsedFile> {
  const text = await file.text();
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  const rows = result.data ?? [];
  const headers = result.meta.fields ?? [];
  const fields: Record<string, unknown> = {};
  const unmapped: string[] = [];

  // Caso 1: par chave/valor (campo,valor)
  const lower = headers.map((h) => h.toLowerCase());
  if (
    headers.length === 2 &&
    (lower.includes("campo") || lower.includes("field") || lower.includes("parametro") || lower.includes("parâmetro")) &&
    (lower.includes("valor") || lower.includes("value"))
  ) {
    const keyCol = headers[lower.findIndex((h) => ["campo","field","parametro","parâmetro"].includes(h))];
    const valCol = headers[lower.findIndex((h) => ["valor","value"].includes(h))];
    for (const row of rows) {
      const k = row[keyCol];
      const v = row[valCol];
      if (!k) continue;
      const internal = resolveFieldKey(type, k);
      if (internal) fields[internal] = coerce(v);
      else unmapped.push(k);
    }
    return { fields, rawRowCount: rows.length, unmappedHeaders: unmapped };
  }

  // Caso 2: AHRI540 (compressor) — colunas C1..C10
  if (type === "compressor") {
    const cCols = headers.filter((h) => /^c\s*\d+$/i.test(h));
    if (cCols.length >= 10 && rows.length > 0) {
      const first = rows[0];
      const coefs = cCols.slice(0, 10).map((c) => Number(first[c])).filter((n) => !Number.isNaN(n));
      if (coefs.length === 10) fields.coeficientes = coefs;
    }
  }

  // Caso 3: cabeçalhos clássicos — usa primeira linha
  if (rows.length > 0) {
    const first = rows[0];
    for (const h of headers) {
      const internal = resolveFieldKey(type, h);
      if (internal && first[h] != null && first[h] !== "") {
        fields[internal] = coerce(first[h]);
      } else if (!internal) {
        unmapped.push(h);
      }
    }
  }

  return { fields, rawRowCount: rows.length, unmappedHeaders: unmapped };
}

function coerce(v: unknown): unknown {
  if (typeof v !== "string") return v;
  const trimmed = v.trim();
  if (trimmed === "") return null;
  // Tenta número (aceita vírgula decimal)
  const n = Number(trimmed.replace(",", "."));
  if (!Number.isNaN(n) && /^-?\d+([.,]\d+)?$/.test(trimmed)) return n;
  return trimmed;
}
