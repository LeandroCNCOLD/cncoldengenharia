export type PowerUnit = "W" | "kW" | "kcal/h" | "BTU/h" | "TR";

export function convertPower(W: number, unit: PowerUnit): number {
  const factors: Record<PowerUnit, number> = {
    W: 1,
    kW: 0.001,
    "kcal/h": 0.86,
    "BTU/h": 3.412,
    TR: 1 / 3517.2,
  };
  return W * factors[unit];
}

export function fmtBR(n: number | undefined | null, digits = 2): string {
  if (n === undefined || n === null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}
