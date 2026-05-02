import type {
  AxialFanCoefficient,
  CentrifugalFanCoefficient,
  CoilCorrectionCoefficient,
  FanCoefficient,
  FanCurveEvaluation,
  SubcoolingCorrectionCoefficient,
  UnilabCorrelationReference,
  UnilabCoefficientsDatabase,
} from "../types/unilabCoefficients.types";

const COEFFICIENTS_URL = "/data/catalogs/unilabCoefficients.json";
const LOAD_ERROR_MESSAGE = "Não foi possível carregar os coeficientes UNILAB.";
const NO_COEFFICIENT_MESSAGE = "Nenhum coeficiente UNILAB encontrado para esta tipologia.";
const CLAMP_WARNING =
  "Velocidade frontal fora da faixa do coeficiente. Valor limitado à faixa válida.";
const FAN_CURVE_UNUSABLE_WARNING = "Ventilador sem curva utilizável para cálculo.";
const FAN_FLOW_CLAMP_WARNING =
  "Vazão fora da faixa da curva do ventilador. Valor limitado à faixa válida.";
const CENTRIFUGAL_NOT_PARSED_WARNING = "Curva centrífuga ainda não interpretada nesta etapa.";
const RANGE_ONLY_WARNING = "Ventilador possui apenas faixa de operação, sem curva calculável.";
const FAN_UNAVAILABLE_WARNING = "Ventilador sem dados suficientes para avaliação.";

let cachedDatabase: UnilabCoefficientsDatabase | null = null;
let inflightDatabase: Promise<UnilabCoefficientsDatabase> | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function assertNumber(value: unknown, field: string): asserts value is number {
  if (!isNumber(value)) {
    throw new Error(`${LOAD_ERROR_MESSAGE} Campo numérico inválido: ${field}.`);
  }
}

function assertString(value: unknown, field: string): asserts value is string {
  if (!isString(value)) {
    throw new Error(`${LOAD_ERROR_MESSAGE} Campo de texto inválido: ${field}.`);
  }
}

function assertNumberArray(value: unknown, field: string): asserts value is number[] {
  if (!Array.isArray(value) || !value.every(isNumber)) {
    throw new Error(`${LOAD_ERROR_MESSAGE} Lista numérica inválida: ${field}.`);
  }
}

function assertRecordArray(value: unknown, field: string): asserts value is Record<string, unknown>[] {
  if (!Array.isArray(value) || !value.every(isRecord)) {
    throw new Error(`${LOAD_ERROR_MESSAGE} Lista inválida: ${field}.`);
  }
}

function validateCoilCorrection(value: unknown, index: number): CoilCorrectionCoefficient {
  if (!isRecord(value)) {
    throw new Error(`${LOAD_ERROR_MESSAGE} Correção de serpentina inválida na posição ${index}.`);
  }
  assertString(value.id, `coilCorrections[${index}].id`);
  assertNumber(value.idCorr, `coilCorrections[${index}].idCorr`);
  assertNumber(value.idTipologia, `coilCorrections[${index}].idTipologia`);
  assertString(value.serie, `coilCorrections[${index}].serie`);
  if (!isRecord(value.velocityRange_m_s)) {
    throw new Error(`${LOAD_ERROR_MESSAGE} Faixa de velocidade inválida na posição ${index}.`);
  }
  assertNumber(value.velocityRange_m_s.min, `coilCorrections[${index}].velocityRange_m_s.min`);
  assertNumber(value.velocityRange_m_s.max, `coilCorrections[${index}].velocityRange_m_s.max`);
  assertNumberArray(value.coefficients, `coilCorrections[${index}].coefficients`);
  if (value.coefficients.length !== 8) {
    throw new Error(`${LOAD_ERROR_MESSAGE} Correção de serpentina sem 8 coeficientes na posição ${index}.`);
  }
  return value as unknown as CoilCorrectionCoefficient;
}

function validateSubcoolingCorrection(
  value: unknown,
  index: number,
): SubcoolingCorrectionCoefficient {
  if (!isRecord(value)) {
    throw new Error(`${LOAD_ERROR_MESSAGE} Correção de subresfriamento inválida na posição ${index}.`);
  }
  assertString(value.id, `subcoolingCorrections[${index}].id`);
  assertNumber(value.idCoeffSotto, `subcoolingCorrections[${index}].idCoeffSotto`);
  assertString(value.serie, `subcoolingCorrections[${index}].serie`);
  assertNumber(value.fatCoeflattub, `subcoolingCorrections[${index}].fatCoeflattub`);
  assertNumber(value.securityFactor, `subcoolingCorrections[${index}].securityFactor`);
  return value as unknown as SubcoolingCorrectionCoefficient;
}

function validateAxialFan(value: unknown, index: number): AxialFanCoefficient {
  if (!isRecord(value)) {
    throw new Error(`${LOAD_ERROR_MESSAGE} Ventilador axial inválido na posição ${index}.`);
  }
  assertString(value.id, `fans.axial[${index}].id`);
  assertString(value.sourceType, `fans.axial[${index}].sourceType`);
  if (value.idFanModel !== undefined) assertNumber(value.idFanModel, `fans.axial[${index}].idFanModel`);
  assertString(value.model, `fans.axial[${index}].model`);
  assertNumber(value.voltage, `fans.axial[${index}].voltage`);
  assertNumber(value.frequency, `fans.axial[${index}].frequency`);
  assertNumber(value.rpm, `fans.axial[${index}].rpm`);
  assertNumber(value.power_W, `fans.axial[${index}].power_W`);
  assertNumber(value.current_A, `fans.axial[${index}].current_A`);
  if (!isRecord(value.airflowRange_m3h)) {
    throw new Error(`${LOAD_ERROR_MESSAGE} Faixa de vazão inválida em fans.axial[${index}].`);
  }
  assertNumber(value.airflowRange_m3h.min, `fans.axial[${index}].airflowRange_m3h.min`);
  assertNumber(value.airflowRange_m3h.max, `fans.axial[${index}].airflowRange_m3h.max`);
  if (!isRecord(value.curve)) {
    throw new Error(`${LOAD_ERROR_MESSAGE} Curva inválida em fans.axial[${index}].`);
  }
  assertNumberArray(value.curve.x, `fans.axial[${index}].curve.x`);
  assertNumberArray(value.curve.y, `fans.axial[${index}].curve.y`);
  if (!isRecord(value.polynomial)) {
    throw new Error(`${LOAD_ERROR_MESSAGE} Polinômio inválido em fans.axial[${index}].`);
  }
  assertNumberArray(value.polynomial.coefficients, `fans.axial[${index}].polynomial.coefficients`);
  return value as unknown as AxialFanCoefficient;
}

function validateCentrifugalFan(value: unknown, index: number): CentrifugalFanCoefficient {
  if (!isRecord(value)) {
    throw new Error(`${LOAD_ERROR_MESSAGE} Ventilador centrífugo inválido na posição ${index}.`);
  }
  assertString(value.id, `fans.centrifugal[${index}].id`);
  if (value.idFanModel !== undefined) {
    assertNumber(value.idFanModel, `fans.centrifugal[${index}].idFanModel`);
  }
  assertString(value.model, `fans.centrifugal[${index}].model`);
  assertNumber(value.areaBocca_m2, `fans.centrifugal[${index}].areaBocca_m2`);
  if (value.codVentRif !== undefined) assertNumber(value.codVentRif, `fans.centrifugal[${index}].codVentRif`);
  assertNumber(value.density_kg_m3, `fans.centrifugal[${index}].density_kg_m3`);
  for (const field of ["rpmRange", "pressureRange_Pa", "capacityRange_m3h"] as const) {
    const range = value[field];
    if (!isRecord(range)) {
      throw new Error(`${LOAD_ERROR_MESSAGE} Faixa inválida em fans.centrifugal[${index}].${field}.`);
    }
    assertNumber(range.min, `fans.centrifugal[${index}].${field}.min`);
    assertNumber(range.max, `fans.centrifugal[${index}].${field}.max`);
  }
  if (!isRecord(value.rawCurve) && !Array.isArray(value.rawCurve)) {
    throw new Error(`${LOAD_ERROR_MESSAGE} Curva bruta inválida em fans.centrifugal[${index}].`);
  }
  return value as unknown as CentrifugalFanCoefficient;
}

function validateCorrelation(value: unknown, index: number, field: string): UnilabCorrelationReference {
  if (!isRecord(value)) {
    throw new Error(`${LOAD_ERROR_MESSAGE} Correlação inválida em ${field}[${index}].`);
  }
  assertString(value.tag, `${field}[${index}].tag`);
  assertString(value.name, `${field}[${index}].name`);
  assertString(value.value, `${field}[${index}].value`);
  return value as unknown as UnilabCorrelationReference;
}

function validateDatabase(raw: unknown): UnilabCoefficientsDatabase {
  if (!isRecord(raw)) {
    throw new Error(LOAD_ERROR_MESSAGE);
  }

  assertString(raw.generatedAt, "generatedAt");
  assertString(raw.source, "source");
  assertRecordArray(raw.coilCorrections, "coilCorrections");
  assertRecordArray(raw.subcoolingCorrections, "subcoolingCorrections");
  if (!isRecord(raw.fans)) {
    throw new Error(`${LOAD_ERROR_MESSAGE} Bloco de ventiladores inválido.`);
  }
  assertRecordArray(raw.fans.axial, "fans.axial");
  assertRecordArray(raw.fans.centrifugal, "fans.centrifugal");
  if (!isRecord(raw.correlations)) {
    throw new Error(`${LOAD_ERROR_MESSAGE} Bloco de correlações inválido.`);
  }
  assertRecordArray(raw.correlations.coilDesigner, "correlations.coilDesigner");
  assertRecordArray(raw.correlations.heatExchanger, "correlations.heatExchanger");

  raw.coilCorrections.forEach(validateCoilCorrection);
  raw.subcoolingCorrections.forEach(validateSubcoolingCorrection);
  raw.fans.axial.forEach(validateAxialFan);
  raw.fans.centrifugal.forEach(validateCentrifugalFan);
  raw.correlations.coilDesigner.forEach((item, index) =>
    validateCorrelation(item, index, "correlations.coilDesigner"),
  );
  raw.correlations.heatExchanger.forEach((item, index) =>
    validateCorrelation(item, index, "correlations.heatExchanger"),
  );

  return raw as unknown as UnilabCoefficientsDatabase;
}

export async function loadUnilabCoefficients(): Promise<UnilabCoefficientsDatabase> {
  if (cachedDatabase) return cachedDatabase;
  if (inflightDatabase) return inflightDatabase;

  inflightDatabase = (async () => {
    try {
      const response = await fetch(COEFFICIENTS_URL, { cache: "no-cache" });
      if (!response.ok) {
        throw new Error(LOAD_ERROR_MESSAGE);
      }
      const data = validateDatabase(await response.json());
      cachedDatabase = data;
      return data;
    } catch (error) {
      if (error instanceof Error && error.message.startsWith(LOAD_ERROR_MESSAGE)) {
        throw error;
      }
      throw new Error(LOAD_ERROR_MESSAGE);
    }
  })();

  try {
    return await inflightDatabase;
  } finally {
    inflightDatabase = null;
  }
}

export async function getCoilCorrectionsByTipologia(
  idTipologia: number,
): Promise<CoilCorrectionCoefficient[]> {
  const database = await loadUnilabCoefficients();
  return database.coilCorrections.filter((coefficient) => coefficient.idTipologia === idTipologia);
}

function containsVelocity(coefficient: CoilCorrectionCoefficient, velocity: number): boolean {
  return (
    velocity >= coefficient.velocityRange_m_s.min &&
    velocity <= coefficient.velocityRange_m_s.max
  );
}

function distanceToRange(coefficient: CoilCorrectionCoefficient, velocity: number): number {
  if (containsVelocity(coefficient, velocity)) return 0;
  if (velocity < coefficient.velocityRange_m_s.min) {
    return coefficient.velocityRange_m_s.min - velocity;
  }
  return velocity - coefficient.velocityRange_m_s.max;
}

function chooseClosest(
  coefficients: CoilCorrectionCoefficient[],
  velocity: number,
): CoilCorrectionCoefficient | null {
  return (
    [...coefficients].sort(
      (a, b) => distanceToRange(a, velocity) - distanceToRange(b, velocity),
    )[0] ?? null
  );
}

export async function getBestCoilCorrection(params: {
  idTipologia: number;
  airVelocity_m_s: number;
  serie?: string;
}): Promise<CoilCorrectionCoefficient | null> {
  const coefficients = await getCoilCorrectionsByTipologia(params.idTipologia);
  if (coefficients.length === 0) return null;

  const exactSerie = params.serie
    ? coefficients.filter((coefficient) => coefficient.serie === params.serie)
    : [];
  const candidates = exactSerie.length > 0 ? exactSerie : coefficients;
  const inRange = candidates.find((coefficient) =>
    containsVelocity(coefficient, params.airVelocity_m_s),
  );

  return inRange ?? chooseClosest(candidates, params.airVelocity_m_s);
}

function clampVelocity(coefficient: CoilCorrectionCoefficient, velocity: number) {
  if (velocity < coefficient.velocityRange_m_s.min) {
    return {
      value: coefficient.velocityRange_m_s.min,
      warning: CLAMP_WARNING,
    };
  }
  if (velocity > coefficient.velocityRange_m_s.max) {
    return {
      value: coefficient.velocityRange_m_s.max,
      warning: CLAMP_WARNING,
    };
  }
  return { value: velocity };
}

function evaluatePolynomial(coefficients: number[], velocity: number): number {
  return coefficients.reduce(
    (factor, coefficient, index) => factor + coefficient * velocity ** index,
    0,
  );
}

function hasUsableRange(range: { min: number; max: number }): boolean {
  return Number.isFinite(range.min) && Number.isFinite(range.max) && range.max > range.min;
}

function isAllZero(values: number[]): boolean {
  return values.every((value) => value === 0);
}

function hasValidCurve(fan: AxialFanCoefficient): boolean {
  const { x, y } = fan.curve;
  return (
    x.length > 1 &&
    x.length === y.length &&
    !isAllZero(x) &&
    !isAllZero(y)
  );
}

function hasValidPolynomial(fan: AxialFanCoefficient): boolean {
  return fan.polynomial.coefficients.some((coefficient) => coefficient !== 0);
}

function clampToRange(value: number, min: number, max: number): { value: number; warning?: string } {
  if (value < min) return { value: min, warning: FAN_FLOW_CLAMP_WARNING };
  if (value > max) return { value: max, warning: FAN_FLOW_CLAMP_WARNING };
  return { value };
}

export function interpolateLinear(xs: number[], ys: number[], targetX: number): number {
  const pairs = xs
    .map((x, index) => ({ x, y: ys[index] }))
    .filter((pair) => Number.isFinite(pair.x) && Number.isFinite(pair.y))
    .sort((a, b) => a.x - b.x);

  if (pairs.length === 0) return NaN;
  if (targetX <= pairs[0].x) return pairs[0].y;
  if (targetX >= pairs[pairs.length - 1].x) return pairs[pairs.length - 1].y;

  for (let index = 0; index < pairs.length - 1; index += 1) {
    const current = pairs[index];
    const next = pairs[index + 1];
    if (targetX >= current.x && targetX <= next.x) {
      const ratio = (targetX - current.x) / (next.x - current.x);
      return current.y + ratio * (next.y - current.y);
    }
  }

  return pairs[pairs.length - 1].y;
}

function evaluateFanPolynomial(coefficients: number[], airflowM3H: number): number {
  return coefficients
    .slice(0, 5)
    .reduce((pressure, coefficient, index) => pressure + coefficient * airflowM3H ** index, 0);
}

export async function evaluateCoilCorrection(params: {
  idTipologia: number;
  airVelocity_m_s: number;
  serie?: string;
}): Promise<{
  factor: number;
  coefficient: CoilCorrectionCoefficient | null;
  clampedVelocity_m_s: number;
  warning?: string;
}> {
  const coefficient = await getBestCoilCorrection(params);
  if (!coefficient) {
    return {
      factor: 1,
      coefficient: null,
      clampedVelocity_m_s: params.airVelocity_m_s,
      warning: NO_COEFFICIENT_MESSAGE,
    };
  }

  const clamped = clampVelocity(coefficient, params.airVelocity_m_s);
  const factor = evaluatePolynomial(coefficient.coefficients, clamped.value);

  return {
    factor,
    coefficient,
    clampedVelocity_m_s: clamped.value,
    warning: clamped.warning,
  };
}

export async function getAxialFans(): Promise<AxialFanCoefficient[]> {
  const database = await loadUnilabCoefficients();
  return database.fans.axial;
}

export async function getCentrifugalFans(): Promise<CentrifugalFanCoefficient[]> {
  const database = await loadUnilabCoefficients();
  return database.fans.centrifugal;
}

export async function getFanById(id: string): Promise<FanCoefficient | null> {
  const database = await loadUnilabCoefficients();
  return (
    database.fans.axial.find((fan) => fan.id === id) ??
    database.fans.centrifugal.find((fan) => fan.id === id) ??
    null
  );
}

export async function evaluateFanCurve(params: {
  fanId: string;
  airflow_m3h: number;
}): Promise<FanCurveEvaluation> {
  const fan = await getFanById(params.fanId);
  if (!fan) {
    return {
      pressure_Pa: null,
      warning: FAN_UNAVAILABLE_WARNING,
      method: "unavailable",
    };
  }

  if ("curve" in fan) {
    if (hasValidCurve(fan)) {
      const min = Math.min(...fan.curve.x);
      const max = Math.max(...fan.curve.x);
      const clamped = clampToRange(params.airflow_m3h, min, max);
      const pressure = interpolateLinear(fan.curve.x, fan.curve.y, clamped.value);
      return {
        pressure_Pa: Number.isFinite(pressure) ? pressure : null,
        power_W: fan.power_W,
        current_A: fan.current_A,
        rpm: fan.rpm,
        warning: clamped.warning,
        method: "curve",
      };
    }

    if (hasValidPolynomial(fan)) {
      const range = fan.airflowRange_m3h;
      const clamped = hasUsableRange(range)
        ? clampToRange(params.airflow_m3h, range.min, range.max)
        : { value: params.airflow_m3h };
      const pressure = evaluateFanPolynomial(fan.polynomial.coefficients, clamped.value);
      return {
        pressure_Pa: Number.isFinite(pressure) ? pressure : null,
        power_W: fan.power_W,
        current_A: fan.current_A,
        rpm: fan.rpm,
        warning: clamped.warning,
        method: "polynomial",
      };
    }

    if (hasUsableRange(fan.airflowRange_m3h)) {
      return {
        pressure_Pa: null,
        power_W: fan.power_W,
        current_A: fan.current_A,
        rpm: fan.rpm,
        warning: RANGE_ONLY_WARNING,
        method: "range_only",
      };
    }

    return {
      pressure_Pa: null,
      power_W: fan.power_W,
      current_A: fan.current_A,
      rpm: fan.rpm,
      warning: FAN_CURVE_UNUSABLE_WARNING,
      method: "unavailable",
    };
  }

  if (hasUsableRange(fan.capacityRange_m3h) && fan.pressureRange_Pa.max > 0) {
    return {
      pressure_Pa: null,
      warning: CENTRIFUGAL_NOT_PARSED_WARNING,
      method: "range_only",
    };
  }

  return {
    pressure_Pa: null,
    warning: FAN_UNAVAILABLE_WARNING,
    method: "unavailable",
  };
}
