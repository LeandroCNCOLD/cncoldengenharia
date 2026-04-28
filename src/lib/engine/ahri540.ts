// CN Cold Engineering — Avaliação de polinômio AHRI 540 (10 coeficientes).
// Polinômio de 3ª ordem em (T_evap, T_cond), em °C.
//
// X = c0 + c1·S + c2·D + c3·S² + c4·S·D + c5·D² + c6·S³ + c7·D·S² + c8·S·D² + c9·D³
//
// onde S = T_evap (sucção) e D = T_cond (descarga).

export interface AhriCoefficients {
  capacity: number[]; // 10 coeficientes — capacidade [W]
  power: number[];    // 10 coeficientes — potência    [W]
}

export interface OperationalRange {
  t_evap_min: number;
  t_evap_max: number;
  t_cond_min: number;
  t_cond_max: number;
}

export function evaluateAhri540(coeffs: number[], tEvap: number, tCond: number): number {
  if (!Array.isArray(coeffs) || coeffs.length < 10) {
    throw new Error("Coeficientes AHRI 540 devem ter 10 valores");
  }
  const s = tEvap;
  const d = tCond;
  return (
    coeffs[0] +
    coeffs[1] * s +
    coeffs[2] * d +
    coeffs[3] * s * s +
    coeffs[4] * s * d +
    coeffs[5] * d * d +
    coeffs[6] * s * s * s +
    coeffs[7] * d * s * s +
    coeffs[8] * s * d * d +
    coeffs[9] * d * d * d
  );
}

export function compressorCapacity(c: AhriCoefficients, tEvap: number, tCond: number): number {
  return evaluateAhri540(c.capacity, tEvap, tCond);
}

export function compressorPower(c: AhriCoefficients, tEvap: number, tCond: number): number {
  return evaluateAhri540(c.power, tEvap, tCond);
}

/** Tenta extrair coeficientes do JSON do componente em diferentes formatos comuns. */
export function parseAhriCoefficients(raw: unknown): AhriCoefficients | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  const cap =
    (obj.capacity as number[]) ??
    (obj.capacidade as number[]) ??
    (obj.cap as number[]) ??
    (obj.c_cap as number[]);
  const pow =
    (obj.power as number[]) ??
    (obj.potencia as number[]) ??
    (obj.pot as number[]) ??
    (obj.c_pot as number[]);

  if (Array.isArray(cap) && Array.isArray(pow) && cap.length >= 10 && pow.length >= 10) {
    return { capacity: cap.slice(0, 10).map(Number), power: pow.slice(0, 10).map(Number) };
  }
  return null;
}

export function parseOperationalRange(raw: unknown): OperationalRange | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const get = (...keys: string[]): number | undefined => {
    for (const k of keys) {
      const v = o[k];
      if (typeof v === "number" && !Number.isNaN(v)) return v;
      if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
    }
    return undefined;
  };
  const t_evap_min = get("t_evap_min", "tevap_min", "evap_min");
  const t_evap_max = get("t_evap_max", "tevap_max", "evap_max");
  const t_cond_min = get("t_cond_min", "tcond_min", "cond_min");
  const t_cond_max = get("t_cond_max", "tcond_max", "cond_max");
  if (
    t_evap_min === undefined ||
    t_evap_max === undefined ||
    t_cond_min === undefined ||
    t_cond_max === undefined
  ) {
    return null;
  }
  return { t_evap_min, t_evap_max, t_cond_min, t_cond_max };
}
