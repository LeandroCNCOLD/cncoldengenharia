/**
 * Extrator de texto comum a PDF / XLS / XLSX para datasheets Unilab.
 * Roda 100% no browser.
 */
import * as XLSX from "xlsx";

export type UnilabRawText = { text: string; source: "pdf" | "xls" | "xlsx" | "txt" };

export async function extractTextFromFile(file: File): Promise<UnilabRawText> {
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (ext === "pdf") return { text: await extractPdfText(file), source: "pdf" };
  if (ext === "xls" || ext === "xlsx") {
    return { text: await extractXlsxText(file), source: ext as "xls" | "xlsx" };
  }
  // fallback texto simples
  return { text: await file.text(), source: "txt" };
}

async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  // worker via CDN (compatível com Vite/SSR)
  (pdfjs.GlobalWorkerOptions as { workerSrc: string }).workerSrc =
    `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const lines: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageLines: Record<number, string[]> = {};
    for (const item of content.items as Array<{ str: string; transform: number[] }>) {
      const y = Math.round(item.transform[5]);
      pageLines[y] = pageLines[y] || [];
      pageLines[y].push(item.str);
    }
    const sorted = Object.keys(pageLines)
      .map(Number)
      .sort((a, b) => b - a);
    for (const y of sorted) lines.push(pageLines[y].join(" "));
  }
  return lines.join("\n");
}

async function extractXlsxText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const lines: string[] = [];
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false });
    lines.push(`# ${sheetName}`);
    for (const row of rows) {
      if (!row || row.length === 0) continue;
      lines.push(row.map((c) => (c == null ? "" : String(c))).join(" | "));
    }
  }
  return lines.join("\n");
}

/** Normaliza texto: remove acentos, lowercases, colapsa espaços. */
export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Tenta extrair o primeiro número (aceitando vírgula ou ponto, milhar com . ou ,). */
export function parseNumber(s: string): number | null {
  if (!s) return null;
  // Remove separadores de milhar e troca vírgula decimal por ponto
  // Heurística: se há vírgula seguida por 1-3 dígitos no fim, é decimal
  let cleaned = s.replace(/\u00a0/g, " ").trim();
  // Captura número completo: dígitos com possíveis separadores de milhar (.,) e decimal opcional.
  // IMPORTANTE: usar \d+ na base e ancorar o fim em borda não-dígito para evitar truncar
  // ex.: "13312" não deve virar "133" por causa de quantificador 1-3 dígitos.
  const m = cleaned.match(/-?\d+(?:[.,]\d+)*/);
  if (!m) return null;
  let raw = m[0];
  const lastComma = raw.lastIndexOf(",");
  const lastDot = raw.lastIndexOf(".");
  if (lastComma > lastDot) {
    // vírgula é decimal
    raw = raw.replace(/\./g, "").replace(",", ".");
  } else {
    // ponto decimal (ou ausente); remove vírgulas de milhar
    raw = raw.replace(/,/g, "");
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export interface FieldPattern {
  /** chave de saída */
  key: string;
  /** sinônimos a procurar (já normalizados, sem acento) */
  patterns: RegExp[];
  /** parser do valor; default = parseNumber */
  parse?: (raw: string) => unknown;
}

/** Procura, linha-a-linha, padrões label → valor. */
export function extractFields(rawText: string, patterns: FieldPattern[]) {
  const lines = rawText.split(/\n+/);
  const result: Record<string, unknown> = {};
  for (const line of lines) {
    const norm = normalize(line);
    for (const p of patterns) {
      if (result[p.key] !== undefined) continue;
      for (const re of p.patterns) {
        const m = norm.match(re);
        if (m) {
          // remove o trecho casado e tenta parsear o resto
          const tail = norm.slice(m.index! + m[0].length);
          const value = (p.parse ?? parseNumber)(tail);
          if (value !== null && value !== undefined && value !== "") {
            result[p.key] = value;
            break;
          }
        }
      }
    }
  }
  return result;
}
