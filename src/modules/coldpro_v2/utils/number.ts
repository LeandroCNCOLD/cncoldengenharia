export function parseNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;

  const str = String(value).trim();
  if (str === "" || str === "-") return null;

  const normalized = str.replace(",", ".");
  const num = Number(normalized);

  return Number.isFinite(num) ? num : null;
}

export function normalizeString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export function isFilled(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed !== "" && trimmed !== "-";
  }
  if (typeof value === "number") return Number.isFinite(value);
  return true;
}
