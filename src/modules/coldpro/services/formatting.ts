// Formatadores de exibição da UI ColdPro.
// Pura camada de apresentação — não toca em lógica termodinâmica.

const NUMBER_LOCALE = "pt-BR";

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function formatNumber(value: number | null | undefined, fractionDigits = 2): string {
  if (!isFiniteNumber(value)) {
    return "—";
  }
  return value.toLocaleString(NUMBER_LOCALE, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

export function formatTemperatureC(value: number | null | undefined): string {
  if (!isFiniteNumber(value)) return "—";
  return `${formatNumber(value, 1)} °C`;
}

export function formatPowerW(value: number | null | undefined): string {
  if (!isFiniteNumber(value)) return "—";
  if (Math.abs(value) >= 1000) {
    return `${formatNumber(value / 1000, 2)} kW`;
  }
  return `${formatNumber(value, 0)} W`;
}

export function formatPercent(value: number | null | undefined, fractionDigits = 1): string {
  if (!isFiniteNumber(value)) return "—";
  return `${formatNumber(value * 100, fractionDigits)} %`;
}

export function formatPressureKPa(value: number | null | undefined): string {
  if (!isFiniteNumber(value)) return "—";
  return `${formatNumber(value, 1)} kPa`;
}

export function formatFlowKgS(value: number | null | undefined): string {
  if (!isFiniteNumber(value)) return "—";
  return `${formatNumber(value, 4)} kg/s`;
}

export function formatDateTime(input: string | number | Date): string {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(NUMBER_LOCALE, {
    dateStyle: "short",
    timeStyle: "short",
  });
}
