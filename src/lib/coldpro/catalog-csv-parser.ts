/**
 * Parser do CSV catalogo-coldpro-2026-04-30.csv.
 * 1369 linhas × 177 colunas. Cada linha = 1 curva.
 *
 * Mapeamento (conforme spec):
 *   geral_modelo            → modelo
 *   geral_linha             → linha
 *   geral_designacao_hp     → hp
 *   geral_gabinete          → gabinete
 *   curva_refrigerant       → refrigerante
 *   curva_indice            → curva_indice
 *   curva_total_pontos      → total_pontos
 *   curva_raw               → curva_json (JSON-string ou stringificado)
 *   curva_estimated_current_a → corrente_estimada
 *   curva_starting_current_a  → corrente_partida
 *   curva_fluid_charge_kg     → carga_fluido
 *   curva_source_sheet        → origem
 *   geral_tipo              → tipo (best-effort, opcional)
 */

export interface ParsedCatalogRow {
  modelo: string;
  linha: string | null;
  hp: string | null;
  gabinete: string | null;
  tipo: string | null;
  refrigerante: string | null;
  curva_indice: number | null;
  total_pontos: number | null;
  curva_json: unknown;
  corrente_estimada: number | null;
  corrente_partida: number | null;
  carga_fluido: number | null;
  origem: string | null;
  raw_json: Record<string, string>;
}

export interface ParseResult {
  rows: ParsedCatalogRow[];
  skipped: number;
  totalLines: number;
}

/* ---------- CSV split robusto (suporta aspas, vírgulas e \n internos) ---------- */
function parseCsvLine(line: string, delim = ","): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === delim) {
        out.push(cur);
        cur = "";
      } else cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function splitCsvRecords(text: string, delim = ","): string[][] {
  // suporta quebras de linha dentro de aspas
  const records: string[][] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '""';
        i++;
      } else {
        inQuotes = !inQuotes;
        cur += ch;
      }
    } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      if (cur.length > 0) {
        records.push(parseCsvLine(cur, delim));
        cur = "";
      }
    } else {
      cur += ch;
    }
  }
  if (cur.length > 0) records.push(parseCsvLine(cur, delim));
  return records;
}

function detectDelimiter(headerLine: string): "," | ";" | "\t" {
  const counts = {
    ",": (headerLine.match(/,/g) ?? []).length,
    ";": (headerLine.match(/;/g) ?? []).length,
    "\t": (headerLine.match(/\t/g) ?? []).length,
  };
  let best: "," | ";" | "\t" = ",";
  let bestCount = counts[","];
  for (const d of [";", "\t"] as const) {
    if (counts[d] > bestCount) {
      bestCount = counts[d];
      best = d;
    }
  }
  return best;
}

function num(v: string | undefined | null): number | null {
  if (v == null) return null;
  const s = String(v).trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function str(v: string | undefined | null): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}

function parseCurveRaw(raw: string | null): unknown {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    return parsed;
  } catch {
    // fallback: alguns CSVs vêm como JSON com aspas simples ou `None`
    const fixed = trimmed
      .replace(/'/g, '"')
      .replace(/\bNone\b/g, "null")
      .replace(/\bTrue\b/g, "true")
      .replace(/\bFalse\b/g, "false");
    try {
      return JSON.parse(fixed);
    } catch {
      return { raw: trimmed };
    }
  }
}

export function parseCatalogCsv(text: string): ParseResult {
  // remove BOM
  const cleaned = text.replace(/^\uFEFF/, "");
  // Detecta delimitador a partir da 1ª linha (sem aspas)
  const firstNL = cleaned.indexOf("\n");
  const headerSample = (firstNL >= 0 ? cleaned.slice(0, firstNL) : cleaned).slice(0, 4000);
  const delim = detectDelimiter(headerSample);

  const records = splitCsvRecords(cleaned, delim);
  if (records.length === 0) return { rows: [], skipped: 0, totalLines: 0 };

  const header = records[0].map((h) => h.trim());
  const idx = (name: string) => header.indexOf(name);

  const iModelo = idx("geral_modelo");
  const iLinha = idx("geral_linha");
  const iHp = idx("geral_designacao_hp");
  const iGab = idx("geral_gabinete");
  const iTipo = idx("geral_tipo");
  const iRef = idx("curva_refrigerant");
  const iCurvaIdx = idx("curva_indice");
  const iTotalPontos = idx("curva_total_pontos");
  const iCurvaRaw = idx("curva_raw");
  const iCorrEst = idx("curva_estimated_current_a");
  const iCorrPart = idx("curva_starting_current_a");
  const iCarga = idx("curva_fluid_charge_kg");
  const iOrigem = idx("curva_source_sheet");

  const rows: ParsedCatalogRow[] = [];
  let skipped = 0;

  for (let r = 1; r < records.length; r++) {
    const cols = records[r];
    if (!cols || cols.every((c) => !c?.trim())) {
      skipped++;
      continue;
    }
    const modelo = str(cols[iModelo]);
    if (!modelo) {
      skipped++;
      continue;
    }

    const raw_json: Record<string, string> = {};
    for (let c = 0; c < header.length; c++) {
      const k = header[c];
      const v = cols[c];
      if (k && v != null && String(v).trim() !== "") raw_json[k] = String(v);
    }

    rows.push({
      modelo,
      linha: iLinha >= 0 ? str(cols[iLinha]) : null,
      hp: iHp >= 0 ? str(cols[iHp]) : null,
      gabinete: iGab >= 0 ? str(cols[iGab]) : null,
      tipo: iTipo >= 0 ? str(cols[iTipo]) : null,
      refrigerante: iRef >= 0 ? str(cols[iRef]) : null,
      curva_indice: iCurvaIdx >= 0 ? num(cols[iCurvaIdx]) : null,
      total_pontos: iTotalPontos >= 0 ? num(cols[iTotalPontos]) : null,
      curva_json: iCurvaRaw >= 0 ? parseCurveRaw(cols[iCurvaRaw]) : [],
      corrente_estimada: iCorrEst >= 0 ? num(cols[iCorrEst]) : null,
      corrente_partida: iCorrPart >= 0 ? num(cols[iCorrPart]) : null,
      carga_fluido: iCarga >= 0 ? num(cols[iCarga]) : null,
      origem: iOrigem >= 0 ? str(cols[iOrigem]) : null,
      raw_json,
    });
  }

  return { rows, skipped, totalLines: records.length - 1 };
}
