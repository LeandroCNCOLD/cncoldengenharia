// Formata valores numéricos para exibição técnica

export function formatCapacity(w: number): string {
  if (w >= 1000) return `${(w / 1000).toFixed(2)} kW`;
  return `${w.toFixed(0)} W`;
}

export function formatCOP(cop: number): string {
  return cop.toFixed(2);
}

export function formatTemp(tempC: number): string {
  return `${tempC.toFixed(1)} °C`;
}

export function formatPercent(pct: number): string {
  return `${pct.toFixed(1)}%`;
}

export function formatDeviation(pct: number): string {
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}
