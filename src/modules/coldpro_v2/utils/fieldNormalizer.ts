const ACCENT_MAP: Record<string, string> = {
  á: "a",
  à: "a",
  ã: "a",
  â: "a",
  ä: "a",
  é: "e",
  è: "e",
  ê: "e",
  ë: "e",
  í: "i",
  ì: "i",
  î: "i",
  ï: "i",
  ó: "o",
  ò: "o",
  õ: "o",
  ô: "o",
  ö: "o",
  ú: "u",
  ù: "u",
  û: "u",
  ü: "u",
  ç: "c",
  ñ: "n",
};

function removeAccents(str: string): string {
  return str.replace(/[áàãâäéèêëíìîïóòõôöúùûüçñ]/g, (ch) => ACCENT_MAP[ch] ?? ch);
}

export function normalizeFieldName(field: string): string {
  let result = field.toLowerCase();
  result = removeAccents(result);
  result = result.replace(/[^a-z0-9_]/g, "_");
  result = result.replace(/_+/g, "_");
  result = result.replace(/^_|_$/g, "");
  return result;
}

export function resolveField(
  row: Record<string, unknown>,
  target: string,
  aliasesMap: Record<string, string[]>,
): unknown {
  const normalizedTarget = normalizeFieldName(target);
  const aliases = aliasesMap[normalizedTarget];

  if (!aliases) return null;

  const normalizedAliases = aliases.map(normalizeFieldName);

  const normalizedRow = new Map<string, unknown>();
  for (const key of Object.keys(row)) {
    normalizedRow.set(normalizeFieldName(key), row[key]);
  }

  for (const alias of normalizedAliases) {
    const value = normalizedRow.get(alias);
    if (value !== undefined) return value;
  }

  return null;
}

export function resolveFieldWithKey(
  row: Record<string, unknown>,
  target: string,
  aliasesMap: Record<string, string[]>,
): { value: unknown; matchedKey: string | null } {
  const normalizedTarget = normalizeFieldName(target);
  const aliases = aliasesMap[normalizedTarget];

  if (!aliases) return { value: null, matchedKey: null };

  const normalizedAliases = aliases.map(normalizeFieldName);

  const entries: { normalizedKey: string; originalKey: string; value: unknown }[] = [];
  for (const key of Object.keys(row)) {
    entries.push({ normalizedKey: normalizeFieldName(key), originalKey: key, value: row[key] });
  }

  for (const alias of normalizedAliases) {
    const entry = entries.find((e) => e.normalizedKey === alias);
    if (entry !== undefined) {
      return { value: entry.value, matchedKey: entry.originalKey };
    }
  }

  return { value: null, matchedKey: null };
}
