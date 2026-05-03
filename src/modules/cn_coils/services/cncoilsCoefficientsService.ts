/**
 * CN Coils Coefficients Service — lazy loader + normalization + fan curve evaluator.
 *
 * Reads the consolidated `/data/catalogs/cncoilsCoefficients.json` produced
 * from COEFF_COMPLETO_CNCOILS_VAPCYC.zip. Does NOT touch:
 *   - src/modules/coldpro_v2 (intact)
 *   - src/modules/cn_coils/engine (intact, old engine)
 *
 * Fan auditing rules (CN COILS):
 *   - Axial with X/Y curve → usable when at least one X and one Y are non-zero.
 *   - Axial with polynomial Coeff1..Coeff5 → usable when at least one coeff
 *     is non-zero (a fully zeroed polynomial is treated as NOT usable).
 *   - Centrifugal → in this stage we only validate operational range
 *     (MinRound/MaxRound). Full curve evaluation is deferred.
 */

export type FanType = 0 | 1;
export type FanSource = "curve" | "polynomial";

export interface AxialFanRecord {
  fanType: FanType;
  idFanModel: number;
  model: string;
  voltage: number;
  frequency: number;
  link?: number | null;
  rpm: number;
  powerW: number;
  currentA: number;
  xMin: number;
  xMax: number;
  soundPower: number;
  soundPressure: number;
  source: FanSource;
  curve?: { x: number[]; y: number[] };
  polyCoefficients?: number[]; // length 5
}

export interface CentrifugalFanRecord {
  idFanModel: number;
  model: string;
  codVentRif?: number | null;
  areaBocca?: number | null;
  dg?: number | null;
  iCur?: number | null;
  iBin?: number | null;
  density?: number | null;
  minRound?: number | null;
  maxRound?: number | null;
  pressMin?: number | null;
  pressMax?: number | null;
  capMin?: number | null;
  capMax?: number | null;
  xCapMin?: number | null;
  yCapMin?: number | null;
  xCapMax?: number | null;
  yCapMax?: number | null;
  xPressMin?: number | null;
  yPressMin?: number | null;
  xPressMax?: number | null;
  yPressMax?: number | null;
}

export interface CoilCorrectionRecord {
  idCorr: number;
  idTipologia: number;
  serie: string;
  vMin: number;
  vMax: number;
  coefficients: number[]; // length 8
}

export interface SubcoolingCorrectionRecord {
  idCoeffSotto: number;
  fatCoeflattub: number;
  securityFactor: number;
  serie: string;
}

export interface CorrelationRecord {
  tag: string;
  name: string;
  value: string;
  cref?: string;
}

export interface CnCoilsCoefficientsBundle {
  coilCorrections: CoilCorrectionRecord[];
  subcoolingCorrections: SubcoolingCorrectionRecord[];
  fans: {
    axial: AxialFanRecord[];
    centrifugal: CentrifugalFanRecord[];
  };
  correlations: {
    coilDesigner: CorrelationRecord[];
    heatExchanger: CorrelationRecord[];
  };
}

export interface FanAuditSummary {
  axial: {
    total: number;
    withCurve: number;
    withCurveUsable: number;
    withPolynomial: number;
    withPolynomialUsable: number;
    unusablePolynomial: number;
  };
  centrifugal: {
    total: number;
    withValidRange: number;
  };
}

const URL = "/data/catalogs/cncoilsCoefficients.json";

let _cache: CnCoilsCoefficientsBundle | null = null;
let _inflight: Promise<CnCoilsCoefficientsBundle> | null = null;

export async function loadCnCoilsCoefficients(): Promise<CnCoilsCoefficientsBundle> {
  if (_cache) return _cache;
  if (_inflight) return _inflight;
  _inflight = (async () => {
    const res = await fetch(URL);
    if (!res.ok) {
      throw new Error(
        `Falha ao carregar cncoilsCoefficients.json (HTTP ${res.status})`,
      );
    }
    const data = (await res.json()) as CnCoilsCoefficientsBundle;
    _cache = data;
    return data;
  })();
  try {
    return await _inflight;
  } finally {
    _inflight = null;
  }
}

// ---------- Usability checks ----------

export function isAxialCurveUsable(fan: AxialFanRecord): boolean {
  if (fan.source !== "curve" || !fan.curve) return false;
  const { x, y } = fan.curve;
  if (!x?.length || !y?.length) return false;
  const xOk = x.some((v) => Number.isFinite(v) && v !== 0);
  const yOk = y.some((v) => Number.isFinite(v) && v !== 0);
  return xOk && yOk;
}

export function isAxialPolynomialUsable(fan: AxialFanRecord): boolean {
  if (fan.source !== "polynomial" || !fan.polyCoefficients) return false;
  return fan.polyCoefficients.some((c) => Number.isFinite(c) && c !== 0);
}

export function isAxialFanUsable(fan: AxialFanRecord): boolean {
  return isAxialCurveUsable(fan) || isAxialPolynomialUsable(fan);
}

export function hasCentrifugalValidRange(fan: CentrifugalFanRecord): boolean {
  const a = fan.minRound ?? 0;
  const b = fan.maxRound ?? 0;
  return a > 0 && b > a;
}

// ---------- Curve evaluation ----------

/**
 * Evaluate the static pressure (Y) for a given airflow (X, m³/h) on an axial fan.
 *
 * - Curve fans: piecewise-linear interpolation between (X_i, Y_i).
 *   Returns null if X is outside [Xmin, Xmax].
 * - Polynomial fans: Y = Coeff1 + Coeff2·x + Coeff3·x² + Coeff4·x³ + Coeff5·x⁴.
 *   Returns null if X is outside [Xmin, Xmax] OR polynomial is zeroed.
 *
 * Returns null when the fan is not usable (no data or out of range).
 */
export function evaluateFanCurve(
  fan: AxialFanRecord,
  airflow_m3h: number,
): number | null {
  if (!Number.isFinite(airflow_m3h)) return null;

  const within =
    airflow_m3h >= (fan.xMin ?? -Infinity) &&
    airflow_m3h <= (fan.xMax ?? Infinity);
  if (!within) return null;

  if (fan.source === "curve" && isAxialCurveUsable(fan)) {
    const { x, y } = fan.curve!;
    // assume sorted ascending in X
    if (airflow_m3h <= x[0]) return y[0];
    if (airflow_m3h >= x[x.length - 1]) return y[y.length - 1];
    for (let i = 0; i < x.length - 1; i++) {
      const x0 = x[i];
      const x1 = x[i + 1];
      if (airflow_m3h >= x0 && airflow_m3h <= x1) {
        const t = x1 === x0 ? 0 : (airflow_m3h - x0) / (x1 - x0);
        return y[i] + t * (y[i + 1] - y[i]);
      }
    }
    return null;
  }

  if (fan.source === "polynomial" && isAxialPolynomialUsable(fan)) {
    const c = fan.polyCoefficients!;
    let result = 0;
    let xp = 1;
    for (let i = 0; i < c.length; i++) {
      result += (c[i] ?? 0) * xp;
      xp *= airflow_m3h;
    }
    return result;
  }

  return null;
}

// ---------- Audit summary ----------

export function buildFanAudit(bundle: CnCoilsCoefficientsBundle): FanAuditSummary {
  const axial = bundle.fans.axial;
  const cent = bundle.fans.centrifugal;
  const withCurve = axial.filter((f) => f.source === "curve");
  const withPoly = axial.filter((f) => f.source === "polynomial");
  return {
    axial: {
      total: axial.length,
      withCurve: withCurve.length,
      withCurveUsable: withCurve.filter(isAxialCurveUsable).length,
      withPolynomial: withPoly.length,
      withPolynomialUsable: withPoly.filter(isAxialPolynomialUsable).length,
      unusablePolynomial:
        withPoly.length - withPoly.filter(isAxialPolynomialUsable).length,
    },
    centrifugal: {
      total: cent.length,
      withValidRange: cent.filter(hasCentrifugalValidRange).length,
    },
  };
}

// ---------- Convenience selectors ----------

export function listUsableAxialFans(
  bundle: CnCoilsCoefficientsBundle,
): AxialFanRecord[] {
  return bundle.fans.axial.filter(isAxialFanUsable);
}

export function listUsableCentrifugalFans(
  bundle: CnCoilsCoefficientsBundle,
): CentrifugalFanRecord[] {
  return bundle.fans.centrifugal.filter(hasCentrifugalValidRange);
}
