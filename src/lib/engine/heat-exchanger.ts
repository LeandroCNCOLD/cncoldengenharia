// CN Cold Engineering — Modelo simplificado de trocadores de calor.
//
// Para evaporador e condensador, derivamos um coeficiente UA equivalente a
// partir da capacidade nominal e do ΔT de referência declarados no catálogo.
//
//   UA = Q_nominal / |T_ar_ref - T_ref|
//
// E aplicamos linearmente na condição operacional:
//
//   Q_evap(T_evap, T_air) = UA_evap · (T_air - T_evap)        [W]
//   Q_cond(T_cond, T_air) = UA_cond · (T_cond - T_air)        [W]
//
// Esse é um modelo de 1ª ordem suficiente para o ponto de equilíbrio.
// Modelos mais sofisticados (NTU-ε, geometria) entram nas próximas fases.

export interface HxParams {
  /** Capacidade nominal em Watts. */
  capacityNominalW: number;
  /** Temperatura de referência do refrigerante (evaporação ou condensação). */
  tRefrigerantC: number;
  /** Temperatura de referência do ar. */
  tAirC: number;
}

export function uaFromNominal(p: HxParams): number {
  const dt = Math.abs(p.tAirC - p.tRefrigerantC);
  if (dt < 0.5) return p.capacityNominalW / 0.5; // evita divisão por zero
  return p.capacityNominalW / dt;
}

export function evaporatorCapacity(ua: number, tAirEvap: number, tEvap: number): number {
  return Math.max(0, ua * (tAirEvap - tEvap));
}

export function condenserCapacity(ua: number, tCond: number, tAirCond: number): number {
  return Math.max(0, ua * (tCond - tAirCond));
}

/** Lê capacidade nominal (kW) e temperaturas de referência do JSON do componente. */
export function parseHxFromFields(
  fields: Record<string, unknown>,
  kind: "evaporador" | "condensador",
): HxParams | null {
  const capKw = numberFrom(fields["capacidade_nominal"]);
  const tAir = numberFrom(fields["temp_entrada_ar"]);
  const tRef =
    kind === "evaporador"
      ? numberFrom(fields["temp_evaporacao_ref"])
      : numberFrom(fields["temp_condensacao_ref"]);

  if (capKw === null || tAir === null || tRef === null) return null;

  return {
    capacityNominalW: capKw * 1000, // kW → W
    tRefrigerantC: tRef,
    tAirC: tAir,
  };
}

function numberFrom(v: unknown): number | null {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  return null;
}
