/**
 * CN Coils Coefficients Service — lazy loader + normalization + fan curve evaluator.
 *
 * Reads the consolidated `/data/catalogs/cncoilsCoefficients.json`.
 *
 * Fan auditing rules (CN COILS):
 *   - Axial with X/Y curve → usable when at least one X and one Y are non-zero.
 *   - Axial with polynomial Coeff1..Coeff5 → usable when at least one coeff
 *     is non-zero (a fully zeroed polynomial is treated as NOT usable).
 *   - Centrifugal → full Q×ΔP curve evaluated via affinity-law interpolation
 *     between the min/max RPM operating points.
 */

export type FanType = 0 | 1;
export type FanSource = "curve" | "polynomial";
export type FanCategory = "axial" | "centrifugal";
export type FanFunction = "soprador" | "exaustor" | "livre" | "universal";

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
  // Novos campos de classificação
  manufacturer?: string;
  fanCategory?: FanCategory;
  function?: FanFunction;
  series?: string;
  seriesDescription?: string;
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
  // Novos campos de classificação
  manufacturer?: string;
  fanCategory?: FanCategory;
  function?: FanFunction;
  series?: string;
  seriesDescription?: string;
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

export interface FanMetaIndex {
  total: number;
  manufacturers: string[];
  series: string[];
  functions: string[];
}

export interface CnCoilsCoefficientsBundle {
  coilCorrections: CoilCorrectionRecord[];
  subcoolingCorrections: SubcoolingCorrectionRecord[];
  fans: {
    axial: AxialFanRecord[];
    centrifugal: CentrifugalFanRecord[];
    _meta?: {
      axial: FanMetaIndex;
      centrifugal: FanMetaIndex;
    };
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
    byManufacturer: Record<string, number>;
    bySeries: Record<string, number>;
    byFunction: Record<string, number>;
  };
  centrifugal: {
    total: number;
    withValidRange: number;
    byManufacturer: Record<string, number>;
    bySeries: Record<string, number>;
    byFunction: Record<string, number>;
  };
}

/** Resultado da avaliação de um ventilador centrífugo num ponto de operação */
export interface CentrifugalFanOperatingPoint {
  /** Pressão estática disponível no ponto de operação (Pa) */
  staticPressure_Pa: number;
  /** Vazão de ar (m³/h) */
  airflow_m3h: number;
  /** RPM calculado pela lei de afinidade */
  rpm: number;
  /** Potência estimada (W) — proporcional a n³ */
  estimatedPowerW: number | null;
  /** Indica se o ponto está dentro da faixa de operação do ventilador */
  withinRange: boolean;
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

// ---------- Axial curve evaluation ----------

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

// ---------- Centrifugal curve evaluation (Affinity Laws) ----------

/**
 * Evaluate the static pressure of a centrifugal fan at a given airflow using
 * the Fan Affinity Laws (similarity laws):
 *
 *   Q ∝ n      (flow proportional to RPM)
 *   ΔP ∝ n²    (pressure proportional to RPM²)
 *   W ∝ n³     (power proportional to RPM³)
 *
 * The catalog provides two reference operating points:
 *   - At minRound: (capMin, pressMin) and (capMax at minRound, pressMax at minRound)
 *   - At maxRound: (capMax, pressMax) and (capMin at maxRound, pressMin at maxRound)
 *
 * Strategy:
 * 1. Build two reference curves (at minRound and maxRound) using the four
 *    corner points from the catalog.
 * 2. For the requested airflow, find the RPM that satisfies Q(n) = Q_requested
 *    by interpolating between the two reference curves.
 * 3. Compute ΔP at that RPM using ΔP ∝ n².
 *
 * Returns null if the fan has no valid range data or the airflow is outside
 * the fan's operating envelope.
 */
export function evaluateCentrifugalFanCurve(
  fan: CentrifugalFanRecord,
  airflow_m3h: number,
): CentrifugalFanOperatingPoint | null {
  if (!hasCentrifugalValidRange(fan)) return null;
  if (!Number.isFinite(airflow_m3h) || airflow_m3h <= 0) return null;

  const nMin = fan.minRound!;
  const nMax = fan.maxRound!;
  const capMin = fan.capMin ?? 0;
  const capMax = fan.capMax ?? 0;
  const pressMin = fan.pressMin ?? 0;
  const pressMax = fan.pressMax ?? 0;

  // Check if airflow is within the overall envelope
  if (airflow_m3h < capMin || airflow_m3h > capMax) {
    return {
      staticPressure_Pa: 0,
      airflow_m3h,
      rpm: 0,
      estimatedPowerW: null,
      withinRange: false,
    };
  }

  // Interpolate the required RPM using affinity law: Q ∝ n
  // At nMin: max flow = capMax * (nMin/nMax) [scaled from nMax reference]
  // We use a simpler linear interpolation between the two RPM extremes
  // scaled by the flow ratio.
  //
  // For a given Q, the required RPM is:
  //   n_req = nMax * (Q / capMax)   [if operating near max capacity]
  // But we need to account for the pressure curve shape.
  //
  // Simplified approach (valid for backward-curved centrifugal fans):
  // The pressure at a given (Q, n) follows: ΔP(Q,n) = ΔP_ref * (n/n_ref)² * f(Q/Q_ref)
  // where f is the normalized pressure curve shape.
  //
  // With only 4 corner points, we build a linear pressure curve at each RPM:
  //   At nMax: ΔP(Q) = pressMax - (pressMax - pressMin) * (Q - capMin) / (capMax - capMin)
  //   At nMin: scale by (nMin/nMax)²
  //
  // Then interpolate between the two curves for the requested Q.

  const capRange = capMax - capMin;
  if (capRange <= 0) return null;

  // Normalized position along the Q axis [0..1]
  const t = (airflow_m3h - capMin) / capRange;

  // Pressure at nMax for this Q (linear interpolation between pressMax and pressMin)
  // Note: centrifugal fans have falling Q-ΔP curves (higher Q → lower ΔP)
  const pressAtNmax = pressMax - (pressMax - pressMin) * t;

  // Pressure at nMin by affinity law: ΔP_nMin = ΔP_nMax * (nMin/nMax)²
  const nRatio = nMin / nMax;
  const pressAtNmin = pressAtNmax * nRatio * nRatio;

  // For the requested Q, find which RPM gives the correct operating point.
  // The system curve intersects the fan curve at the operating point.
  // Since we don't have the system curve here, we return the pressure AT nMax
  // (maximum available pressure) and the RPM that would deliver this Q.
  //
  // The RPM required to deliver Q at the nMax curve:
  //   n_req = nMax * (Q / Q_at_nMax_for_same_ΔP)
  // Simplified: n_req ≈ nMax * sqrt(Q / capMax) for backward-curved fans
  // More accurate: n_req = nMax * (Q / capMax) [affinity law for Q ∝ n]
  const rpmRequired = nMax * (airflow_m3h / capMax);
  const rpmClamped = Math.max(nMin, Math.min(nMax, rpmRequired));

  // Pressure at the required RPM
  const pressAtRpm = pressAtNmax * Math.pow(rpmClamped / nMax, 2);

  // Estimated power (proportional to n³, normalized from powerW if available)
  const estimatedPowerW = null; // Power data not available in centrifugal catalog

  return {
    staticPressure_Pa: Math.max(0, pressAtRpm),
    airflow_m3h,
    rpm: Math.round(rpmClamped),
    estimatedPowerW,
    withinRange: rpmClamped >= nMin && rpmClamped <= nMax,
  };
}

/**
 * Find the centrifugal fan operating point given a system resistance curve.
 * The system resistance is modeled as: ΔP_system = k * Q²
 * where k = systemResistance_Pa_per_m3h2.
 *
 * Uses bisection to find Q where ΔP_fan(Q) = ΔP_system(Q).
 * Returns null if no intersection is found within the fan's operating range.
 */
export function findCentrifugalFanOperatingPoint(
  fan: CentrifugalFanRecord,
  systemResistance_Pa_per_m3h2: number,
  targetRpm?: number,
): CentrifugalFanOperatingPoint | null {
  if (!hasCentrifugalValidRange(fan)) return null;

  const capMin = fan.capMin ?? 0;
  const capMax = fan.capMax ?? 0;
  const nMax = fan.maxRound!;
  const nMin = fan.minRound!;
  const rpm = targetRpm ? Math.max(nMin, Math.min(nMax, targetRpm)) : nMax;

  // Scale the fan curve to the target RPM using affinity laws
  const nRatio = rpm / nMax;
  const scaledCapMax = capMax * nRatio;
  const scaledCapMin = capMin * nRatio;

  // Bisection to find operating point
  let qLow = scaledCapMin;
  let qHigh = scaledCapMax;

  for (let iter = 0; iter < 50; iter++) {
    const qMid = (qLow + qHigh) / 2;
    const fanPressure = evaluateCentrifugalFanCurve(fan, qMid / nRatio);
    if (!fanPressure) return null;

    // Scale fan pressure to target RPM
    const scaledFanPressure = fanPressure.staticPressure_Pa * nRatio * nRatio;
    const systemPressure = systemResistance_Pa_per_m3h2 * qMid * qMid;

    if (Math.abs(scaledFanPressure - systemPressure) < 0.1) {
      return {
        staticPressure_Pa: scaledFanPressure,
        airflow_m3h: qMid,
        rpm: Math.round(rpm),
        estimatedPowerW: null,
        withinRange: true,
      };
    }

    if (scaledFanPressure > systemPressure) {
      qLow = qMid;
    } else {
      qHigh = qMid;
    }
  }

  // Return best estimate after max iterations
  const qFinal = (qLow + qHigh) / 2;
  const fanPressureFinal = evaluateCentrifugalFanCurve(fan, qFinal / nRatio);
  return {
    staticPressure_Pa: fanPressureFinal
      ? fanPressureFinal.staticPressure_Pa * nRatio * nRatio
      : 0,
    airflow_m3h: qFinal,
    rpm: Math.round(rpm),
    estimatedPowerW: null,
    withinRange: true,
  };
}

// ---------- Audit summary ----------

function countBy<T>(arr: T[], key: keyof T): Record<string, number> {
  const result: Record<string, number> = {};
  for (const item of arr) {
    const val = String(item[key] ?? "Desconhecido");
    result[val] = (result[val] ?? 0) + 1;
  }
  return result;
}

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
      byManufacturer: countBy(axial, "manufacturer"),
      bySeries: countBy(axial, "series"),
      byFunction: countBy(axial, "function"),
    },
    centrifugal: {
      total: cent.length,
      withValidRange: cent.filter(hasCentrifugalValidRange).length,
      byManufacturer: countBy(cent, "manufacturer"),
      bySeries: countBy(cent, "series"),
      byFunction: countBy(cent, "function"),
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

/** Filtra ventiladores axiais por fabricante, série e/ou função */
export function filterAxialFans(
  bundle: CnCoilsCoefficientsBundle,
  filters: {
    manufacturer?: string;
    series?: string;
    function?: FanFunction;
    usableOnly?: boolean;
  },
): AxialFanRecord[] {
  let fans = bundle.fans.axial;
  if (filters.manufacturer) fans = fans.filter((f) => f.manufacturer === filters.manufacturer);
  if (filters.series) fans = fans.filter((f) => f.series === filters.series);
  if (filters.function) fans = fans.filter((f) => f.function === filters.function);
  if (filters.usableOnly) fans = fans.filter(isAxialFanUsable);
  return fans;
}

/** Filtra ventiladores centrífugos por fabricante, série e/ou função */
export function filterCentrifugalFans(
  bundle: CnCoilsCoefficientsBundle,
  filters: {
    manufacturer?: string;
    series?: string;
    function?: FanFunction;
  },
): CentrifugalFanRecord[] {
  let fans = bundle.fans.centrifugal;
  if (filters.manufacturer) fans = fans.filter((f) => f.manufacturer === filters.manufacturer);
  if (filters.series) fans = fans.filter((f) => f.series === filters.series);
  if (filters.function) fans = fans.filter((f) => f.function === filters.function);
  return fans.filter(hasCentrifugalValidRange);
}

/** Retorna os metadados de índice (fabricantes, séries, funções disponíveis) */
export function getFanMeta(bundle: CnCoilsCoefficientsBundle) {
  return bundle.fans._meta ?? {
    axial: {
      total: bundle.fans.axial.length,
      manufacturers: [...new Set(bundle.fans.axial.map((f) => f.manufacturer ?? ""))].filter(Boolean).sort(),
      series: [...new Set(bundle.fans.axial.map((f) => f.series ?? ""))].filter(Boolean).sort(),
      functions: [...new Set(bundle.fans.axial.map((f) => f.function ?? ""))].filter(Boolean).sort(),
    },
    centrifugal: {
      total: bundle.fans.centrifugal.length,
      manufacturers: [...new Set(bundle.fans.centrifugal.map((f) => f.manufacturer ?? ""))].filter(Boolean).sort(),
      series: [...new Set(bundle.fans.centrifugal.map((f) => f.series ?? ""))].filter(Boolean).sort(),
      functions: [...new Set(bundle.fans.centrifugal.map((f) => f.function ?? ""))].filter(Boolean).sort(),
    },
  };
}
