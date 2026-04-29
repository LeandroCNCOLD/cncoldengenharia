export function parseUnilabNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value == null) return fallback;
  const cleaned = String(value)
    .trim()
    .replace(/\s+/g, '')
    .replace(/,/g, '.');
  if (!cleaned) return fallback;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];
  const delimiter = detectDelimiter(lines[0]);
  const headers = splitCsvLine(lines[0], delimiter).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line, delimiter);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = cells[i] ?? ''));
    return row;
  });
}

function detectDelimiter(header: string): ',' | ';' | '\t' {
  const candidates: Array<',' | ';' | '\t'> = [',', ';', '\t'];
  return candidates.reduce((best, d) => count(header, d) > count(header, best) ? d : best, ',');
}

function count(str: string, token: string): number {
  return str.split(token).length - 1;
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (ch === delimiter && !quoted) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((v) => v.trim());
}
