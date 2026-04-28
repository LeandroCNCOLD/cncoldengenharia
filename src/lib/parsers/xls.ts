// CN Cold Engineering — Parser de XLS/XLSX (evaporadores e condensadores).
import * as XLSX from "xlsx";
import { resolveFieldKey } from "./aliases";
import type { ComponentType } from "@/lib/component-schema";
import type { ParsedFile } from "./csv";

export async function parseXls(
  file: File,
  type: ComponentType,
): Promise<ParsedFile> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
    raw: true,
  });

  const fields: Record<string, unknown> = {};
  const unmapped: string[] = [];
  if (!rows.length) return { fields, rawRowCount: 0, unmappedHeaders: [] };

  const headers = Object.keys(rows[0]);

  // Padrão "campo,valor"
  const lower = headers.map((h) => h.toLowerCase());
  if (
    headers.length === 2 &&
    lower.some((h) => ["campo", "field", "parametro", "parâmetro"].includes(h)) &&
    lower.some((h) => ["valor", "value"].includes(h))
  ) {
    const keyCol = headers[lower.findIndex((h) => ["campo","field","parametro","parâmetro"].includes(h))];
    const valCol = headers[lower.findIndex((h) => ["valor","value"].includes(h))];
    for (const row of rows) {
      const k = row[keyCol];
      const v = row[valCol];
      if (!k) continue;
      const internal = resolveFieldKey(type, String(k));
      if (internal) fields[internal] = v;
      else unmapped.push(String(k));
    }
    return { fields, rawRowCount: rows.length, unmappedHeaders: unmapped };
  }

  // Padrão tabular — primeira linha representa o componente
  const first = rows[0];
  for (const h of headers) {
    const internal = resolveFieldKey(type, h);
    if (internal && first[h] != null && first[h] !== "") {
      fields[internal] = first[h];
    } else if (!internal) {
      unmapped.push(h);
    }
  }

  return { fields, rawRowCount: rows.length, unmappedHeaders: unmapped };
}
