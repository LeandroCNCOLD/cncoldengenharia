import { supabase } from "@/integrations/supabase/client";
import type { TechnicalComponent, TechnicalEntityType } from "@/modules/coldpro/library/types";
import { defaultGeometryFromCode } from "@/modules/thermalcalc/engines/system/systemGeometryDefaults";
import type {
  CoilMode,
  GeometryInput,
  UnilabFactors,
  UnilabSource,
} from "@/modules/thermalcalc/engines/coil/internals/types";
import type { SystemResolvedCompressorData } from "@/modules/thermalcalc/engines/system/systemTypes";
import type {
  VapcycCompressorRecord,
  VapcycCurveType,
  VapcycPolynomialRecord,
} from "@/modules/thermalcalc/engines/system/vapcycCompressorEngine";

type TechnicalStatus =
  | "raw_imported"
  | "approved"
  | "validated"
  | "mapped"
  | "needs_review"
  | "rejected"
  | "unmapped"
  | "archived";

const BLOCKED_STATUSES = new Set<string>(["rejected", "archived"]);
const USABLE_COMPONENT_STATUSES: Array<TechnicalComponent["status"]> = [
  "approved",
  "validated",
  "mapped",
  "needs_review",
];
const USABLE_APPROVAL_STATUSES: Array<Exclude<TechnicalStatus, "archived">> = [
  "approved",
  "validated",
  "mapped",
  "needs_review",
];
const USABLE_STATUSES = USABLE_APPROVAL_STATUSES;
const USABLE_COMPONENT_STATUS_VALUES = USABLE_COMPONENT_STATUSES;

interface ResolverBase<TKind extends string, TData> {
  kind: TKind;
  component: TechnicalComponent;
  data: TData | null;
  warnings: string[];
}

interface CompressorModelRow extends VapcycCompressorRecord {
  approval_status: TechnicalStatus;
}

interface FanModelRow {
  id: string;
  manufacturer: string | null;
  model: string;
  fan_type: string | null;
  diameter_mm: number | null;
  nominal_airflow_m3h: number | null;
  nominal_pressure_pa: number | null;
  nominal_power_w: number | null;
  approval_status: TechnicalStatus;
}

interface FanCurveRow {
  id: string;
  fan_id: string | null;
  curve_type: string;
  coefficients_json: unknown;
  table_data_json: unknown;
}

interface UnilabGeometryRow {
  id: string;
  mode: string;
  geometry_code: string;
  description: string | null;
  fin_type: string | null;
  tube_type: string | null;
  tube_outer_diameter_mm: number | null;
  tube_inner_diameter_mm: number | null;
  tube_pitch_mm: number | null;
  row_pitch_mm: number | null;
  fin_pitch_mm: number | null;
  fin_thickness_mm: number | null;
  rows: number | null;
  circuits: number | null;
  approval_status: TechnicalStatus;
}

interface CoilGeometryFactorRow {
  id: string;
  mode: string;
  geometry_code: string;
  sigla: string | null;
  description: string | null;
  tube_spacing_mm: number | null;
  row_spacing_mm: number | null;
  tube_outer_diameter_mm: number | null;
  tube_thickness_mm: number | null;
  fin_thickness_mm: number | null;
  fin_height_mm: number | null;
  fat_cor_al: number | null;
  fat_coef_lato_tubo: number | null;
  fat_rid_aum_sup: number | null;
  fattore_attr_aria: number | null;
  fattore_attr_aria_latente: number | null;
  fat_corr_fat_attr: number | null;
  slope_fat_cor_al: number | null;
  slope_fat_coef_lato_tubo: number | null;
  slope_fattore_attr_aria: number | null;
  security_factor: number | null;
}

interface UnilabGeometryFactorRow {
  id: string;
  mode: string;
  geometry_code: string;
  fat_cor_al: number | null;
  fat_coef_lattub: number | null;
  fat_rid_aum_sup: number | null;
  fattore_attr_aria: number | null;
  fattore_attr_aria_latente: number | null;
  fat_corr_fat_attr: number | null;
  slope_fat_cor_al: number | null;
  slope_fat_coef_lattub: number | null;
  slope_fattore_attr_aria: number | null;
  security_factor: number | null;
  approval_status: TechnicalStatus;
}

type CoilFactor = CoilGeometryFactorRow | UnilabGeometryFactorRow;

interface RefrigerantRow {
  id: string;
  code: string;
  name: string | null;
  type: string | null;
  family: string | null;
  safety_class: string | null;
  gwp: number | null;
  odp: number | null;
  approval_status: TechnicalStatus;
}

interface RefrigerantPolynomialRow {
  id: string;
  refrigerant_id: string | null;
  refrigerant_code: string | null;
  property_id: string | null;
  property_name: string;
  phase: string | null;
  temp_min_c: number | null;
  temp_max_c: number | null;
  c0: number | null;
  c1: number | null;
  c2: number | null;
  c3: number | null;
  c4: number | null;
  c5: number | null;
  c6: number | null;
  unit: string | null;
}

export interface ResolvedCompressorData {
  model: CompressorModelRow;
  polynomials: VapcycPolynomialRecord[];
  hasCapacityPolynomial: boolean;
  hasPowerPolynomial: boolean;
  thermalcalc: {
    vapcycModel: VapcycCompressorRecord;
    vapcycPolynomials: VapcycPolynomialRecord[];
    systemCompressor: SystemResolvedCompressorData;
    compressorId: string;
    sourceTableKey: string | null;
  };
}

export interface ResolvedFanData {
  model: FanModelRow;
  curves: Array<{
    id: string;
    curveType: string;
    coefficients: number[];
    tableData: unknown[];
  }>;
  thermalcalc: {
    fanId: string;
    nominalAirflowM3h: number | null;
    nominalPressurePa: number | null;
    nominalPowerW: number | null;
  };
}

export interface ResolvedCoilData {
  geometry: UnilabGeometryRow | null;
  factor: CoilFactor | null;
  thermalcalc: {
    geometry: GeometryInput;
    factors?: UnilabFactors;
    unilabSource: UnilabSource;
  };
}

export interface ResolvedRefrigerantData {
  refrigerant: RefrigerantRow;
  polynomials: RefrigerantPolynomialRow[];
  thermalcalc: {
    code: string;
    polynomials: Array<{
      propertyName: string;
      phase: string | null;
      tempMinC: number | null;
      tempMaxC: number | null;
      coefficients: [number, number, number, number, number, number, number];
      unit: string | null;
    }>;
  };
}

export interface ResolvedValveData {
  entityType: TechnicalEntityType;
  manufacturer: string | null;
  model: string | null;
  code: string | null;
  source: string | null;
  context: string;
  thermalcalc: {
    valveType: TechnicalEntityType;
    componentId: string;
  };
}

export type ResolvedCompressorComponent = ResolverBase<"compressor", ResolvedCompressorData>;
export type ResolvedFanComponent = ResolverBase<"fan", ResolvedFanData>;
export type ResolvedCoilComponent = ResolverBase<"coil", ResolvedCoilData>;
export type ResolvedRefrigerantComponent = ResolverBase<"refrigerant", ResolvedRefrigerantData>;
export type ResolvedValveComponent = ResolverBase<"valve", ResolvedValveData>;

async function loadComponent(componentId: string): Promise<TechnicalComponent> {
  const { data, error } = await supabase
    .from("technical_components")
    .select("*")
    .eq("id", componentId)
    .single();
  if (error) throw new Error(`technical_components: ${error.message}`);
  return data as TechnicalComponent;
}

function assertUsable(component: TechnicalComponent) {
  if (BLOCKED_STATUSES.has(String(component.status))) {
    throw new Error(`Componente ${component.id} bloqueado por status ${component.status}.`);
  }
}

async function preferCnStandard(component: TechnicalComponent): Promise<{
  component: TechnicalComponent;
  warnings: string[];
}> {
  assertUsable(component);
  if (component.context === "cn_standard") return { component, warnings: [] };

  let query = supabase
    .from("technical_components")
    .select("*")
    .eq("entity_type", component.entity_type)
    .eq("context", "cn_standard")
    .in("status", USABLE_STATUSES)
    .limit(1);

  if (component.source_raw_id) {
    query = query.eq("source_raw_id", component.source_raw_id);
  } else if (component.model) {
    query = query.eq("model", component.model);
  } else if (component.code) {
    query = query.eq("code", component.code);
  } else {
    return { component, warnings: [] };
  }

  const { data } = await query;
  const preferred = data?.[0] as TechnicalComponent | undefined;
  if (!preferred || preferred.id === component.id) return { component, warnings: [] };
  return {
    component: preferred,
    warnings: [
      `Usando componente cn_standard ${preferred.id} no lugar do contexto ${component.context}.`,
    ],
  };
}

function stringHint(component: TechnicalComponent, ...keys: string[]): string | null {
  const normalized = component.normalized_json ?? {};
  for (const key of keys) {
    const value = normalized[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function numericArray(value: unknown): number[] {
  return Array.isArray(value) ? value.map(Number).filter(Number.isFinite) : [];
}

function unknownArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function firstNumber(...values: Array<number | null | undefined>): number | undefined {
  return values.find(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
}

async function resolveComponent(componentId: string) {
  return preferCnStandard(await loadComponent(componentId));
}

async function findCompressorModel(
  component: TechnicalComponent,
): Promise<CompressorModelRow | null> {
  const explicitId = component.source_raw_id ?? stringHint(component, "compressor_model_id", "id");
  if (explicitId) {
    const { data } = await supabase
      .from("compressor_models")
      .select(
        "id, manufacturer, model, refrigerant, application_type, units_system, motor_efficiency, massflow_correction, power_correction, voltage_v, frequency_hz, rpm, temp_evap_min_c, temp_evap_max_c, temp_cond_min_c, temp_cond_max_c, source_db, source_table_key, approval_status",
      )
      .eq("id", explicitId)
      .maybeSingle();
    if (data) return data as CompressorModelRow;
  }

  const sourceKey = stringHint(component, "source_table_key", "sourceTableKey");
  if (sourceKey) {
    const { data } = await supabase
      .from("compressor_models")
      .select(
        "id, manufacturer, model, refrigerant, application_type, units_system, motor_efficiency, massflow_correction, power_correction, voltage_v, frequency_hz, rpm, temp_evap_min_c, temp_evap_max_c, temp_cond_min_c, temp_cond_max_c, source_db, source_table_key, approval_status",
      )
      .eq("source_table_key", sourceKey)
      .maybeSingle();
    if (data) return data as CompressorModelRow;
  }

  const model = component.model ?? component.code;
  if (!model) return null;
  const { data } = await supabase
    .from("compressor_models")
    .select(
      "id, manufacturer, model, refrigerant, application_type, units_system, motor_efficiency, massflow_correction, power_correction, voltage_v, frequency_hz, rpm, temp_evap_min_c, temp_evap_max_c, temp_cond_min_c, temp_cond_max_c, source_db, source_table_key, approval_status",
    )
    .eq("model", model)
    .in("approval_status", USABLE_STATUSES)
    .limit(1);
  return (data?.[0] as CompressorModelRow | undefined) ?? null;
}

export async function resolveCompressorComponent(
  componentId: string,
): Promise<ResolvedCompressorComponent> {
  const { component, warnings } = await resolveComponent(componentId);
  if (component.entity_type !== "compressor") {
    throw new Error(`Componente ${componentId} não é compressor.`);
  }

  const model = await findCompressorModel(component);
  if (!model) {
    return {
      kind: "compressor",
      component,
      data: null,
      warnings: [...warnings, "Nenhum registro correspondente em compressor_models."],
    };
  }
  if (BLOCKED_STATUSES.has(String(model.approval_status))) {
    throw new Error(`Compressor ${model.id} bloqueado por status ${model.approval_status}.`);
  }

  const { data: polynomialRows, error } = await supabase
    .from("compressor_polynomials")
    .select("curve_type, unit_system, coefficients_json")
    .eq("compressor_id", model.id);
  if (error) throw new Error(`compressor_polynomials: ${error.message}`);

  const polynomials: VapcycPolynomialRecord[] = (polynomialRows ?? []).map((row) => ({
    curve_type: row.curve_type as VapcycCurveType,
    unit_system: row.unit_system ?? "",
    coefficients_json: numericArray(row.coefficients_json),
  }));
  const hasCapacityPolynomial = polynomials.some(
    (poly) => poly.curve_type === "capacity" && poly.coefficients_json.length === 10,
  );
  const hasPowerPolynomial = polynomials.some(
    (poly) => poly.curve_type === "power" && poly.coefficients_json.length === 10,
  );
  if (!hasCapacityPolynomial) warnings.push("Compressor sem polinômio de capacidade.");
  if (!hasPowerPolynomial) warnings.push("Compressor sem polinômio de potência.");

  return {
    kind: "compressor",
    component,
    data: {
      model,
      polynomials,
      hasCapacityPolynomial,
      hasPowerPolynomial,
      thermalcalc: {
        vapcycModel: model,
        vapcycPolynomials: polynomials,
        systemCompressor: {
          vapcycModel: model,
          vapcycPolynomials: polynomials,
          warnings,
        },
        compressorId: model.id,
        sourceTableKey: model.source_table_key,
      },
    },
    warnings,
  };
}

async function findFanModel(component: TechnicalComponent): Promise<FanModelRow | null> {
  const explicitId = component.source_raw_id ?? stringHint(component, "fan_model_id", "id");
  if (explicitId) {
    const { data } = await supabase
      .from("fan_models")
      .select(
        "id, manufacturer, model, fan_type, diameter_mm, nominal_airflow_m3h, nominal_pressure_pa, nominal_power_w, approval_status",
      )
      .eq("id", explicitId)
      .maybeSingle();
    if (data) return data as FanModelRow;
  }

  const model = component.model ?? component.code;
  if (!model) return null;
  const { data } = await supabase
    .from("fan_models")
    .select(
      "id, manufacturer, model, fan_type, diameter_mm, nominal_airflow_m3h, nominal_pressure_pa, nominal_power_w, approval_status",
    )
    .eq("model", model)
    .in("approval_status", USABLE_STATUSES)
    .limit(1);
  return (data?.[0] as FanModelRow | undefined) ?? null;
}

export async function resolveFanComponent(componentId: string): Promise<ResolvedFanComponent> {
  const { component, warnings } = await resolveComponent(componentId);
  if (component.entity_type !== "fan") throw new Error(`Componente ${componentId} não é fan.`);

  const model = await findFanModel(component);
  if (!model) {
    return {
      kind: "fan",
      component,
      data: null,
      warnings: [...warnings, "Nenhum registro correspondente em fan_models."],
    };
  }
  if (BLOCKED_STATUSES.has(String(model.approval_status))) {
    throw new Error(`Ventilador ${model.id} bloqueado por status ${model.approval_status}.`);
  }

  const { data: curveRows, error } = await supabase
    .from("fan_curves")
    .select("id, fan_id, curve_type, coefficients_json, table_data_json")
    .eq("fan_id", model.id);
  if (error) throw new Error(`fan_curves: ${error.message}`);

  const curves = ((curveRows ?? []) as FanCurveRow[]).map((curve) => ({
    id: curve.id,
    curveType: curve.curve_type,
    coefficients: numericArray(curve.coefficients_json),
    tableData: unknownArray(curve.table_data_json),
  }));
  if (curves.length === 0) warnings.push("Ventilador sem curva em fan_curves.");
  if (model.nominal_airflow_m3h == null) warnings.push("Ventilador sem vazão nominal.");
  if (model.nominal_pressure_pa == null) warnings.push("Ventilador sem pressão nominal.");

  return {
    kind: "fan",
    component,
    data: {
      model,
      curves,
      thermalcalc: {
        fanId: model.id,
        nominalAirflowM3h: model.nominal_airflow_m3h,
        nominalPressurePa: model.nominal_pressure_pa,
        nominalPowerW: model.nominal_power_w,
      },
    },
    warnings,
  };
}

function coilModeFor(component: TechnicalComponent): CoilMode {
  return component.entity_type === "condenser_coil" ? "condensation" : "direct_expansion";
}

function factorModeFor(mode: CoilMode): string[] {
  return mode === "condensation" ? ["condensation", "condensing"] : ["direct_expansion", "cooling"];
}

async function findUnilabGeometry(
  component: TechnicalComponent,
  mode: CoilMode,
): Promise<UnilabGeometryRow | null> {
  const codeCandidates = [
    component.code,
    component.model,
    stringHint(component, "geometry_code", "geometryCode", "sigla"),
  ].filter(Boolean) as string[];

  const explicitId = component.source_raw_id;
  if (explicitId) {
    const { data } = await supabase
      .from("unilab_geometries")
      .select(
        "id, mode, geometry_code, description, fin_type, tube_type, tube_outer_diameter_mm, tube_inner_diameter_mm, tube_pitch_mm, row_pitch_mm, fin_pitch_mm, fin_thickness_mm, rows, circuits, approval_status",
      )
      .eq("id", explicitId)
      .maybeSingle();
    if (data) return data as UnilabGeometryRow;
  }

  if (codeCandidates.length === 0) return null;
  const { data } = await supabase
    .from("unilab_geometries")
    .select(
      "id, mode, geometry_code, description, fin_type, tube_type, tube_outer_diameter_mm, tube_inner_diameter_mm, tube_pitch_mm, row_pitch_mm, fin_pitch_mm, fin_thickness_mm, rows, circuits, approval_status",
    )
    .in("geometry_code", codeCandidates)
    .in("mode", factorModeFor(mode))
    .in("approval_status", USABLE_STATUSES)
    .limit(1);
  return (data?.[0] as UnilabGeometryRow | undefined) ?? null;
}

async function findCoilFactor(
  component: TechnicalComponent,
  geometry: UnilabGeometryRow | null,
  mode: CoilMode,
): Promise<CoilFactor | null> {
  const codeCandidates = [
    geometry?.geometry_code,
    component.code,
    component.model,
    stringHint(component, "geometry_code", "geometryCode", "sigla"),
  ].filter(Boolean) as string[];
  if (codeCandidates.length === 0) return null;

  const { data: unilabFactors } = await supabase
    .from("unilab_geometries_factors")
    .select(
      "id, mode, geometry_code, fat_cor_al, fat_coef_lattub, fat_rid_aum_sup, fattore_attr_aria, fattore_attr_aria_latente, fat_corr_fat_attr, slope_fat_cor_al, slope_fat_coef_lattub, slope_fattore_attr_aria, security_factor, approval_status",
    )
    .in("mode", factorModeFor(mode))
    .in("geometry_code", codeCandidates)
    .in("approval_status", USABLE_STATUSES)
    .limit(1);
  if (unilabFactors?.[0]) return unilabFactors[0] as UnilabGeometryFactorRow;

  const orValues = codeCandidates.map((value) => `"${value.replace(/"/g, '\\"')}"`).join(",");
  const { data } = await supabase
    .from("coil_geometry_factors")
    .select(
      "id, mode, geometry_code, sigla, description, tube_spacing_mm, row_spacing_mm, tube_outer_diameter_mm, tube_thickness_mm, fin_thickness_mm, fin_height_mm, fat_cor_al, fat_coef_lato_tubo, fat_rid_aum_sup, fattore_attr_aria, fattore_attr_aria_latente, fat_corr_fat_attr, slope_fat_cor_al, slope_fat_coef_lato_tubo, slope_fattore_attr_aria, security_factor",
    )
    .in("mode", factorModeFor(mode))
    .or(`geometry_code.in.(${orValues}),sigla.in.(${orValues})`)
    .limit(1);
  return (data?.[0] as CoilGeometryFactorRow | undefined) ?? null;
}

function normalizeFinType(value: string | null | undefined): GeometryInput["finType"] {
  if (value === "plain" || value === "wavy" || value === "louver" || value === "herringbone") {
    return value;
  }
  return "unknown";
}

function normalizeTubeType(value: string | null | undefined): GeometryInput["tubeType"] {
  if (value === "smooth" || value === "microfin" || value === "grooved") return value;
  return "unknown";
}

function hasLegacyFactorName(factor: CoilFactor): factor is CoilGeometryFactorRow {
  return "fat_coef_lato_tubo" in factor;
}

function mapFactors(factor: CoilFactor | null): UnilabFactors | undefined {
  if (!factor) return undefined;
  return {
    fatCorAl: factor.fat_cor_al ?? undefined,
    fatCoeflattub: hasLegacyFactorName(factor)
      ? (factor.fat_coef_lato_tubo ?? undefined)
      : (factor.fat_coef_lattub ?? undefined),
    fatRidAumSup: factor.fat_rid_aum_sup ?? undefined,
    fattoreAttrAria: factor.fattore_attr_aria ?? undefined,
    fattoreAttrAriaLatente: factor.fattore_attr_aria_latente ?? undefined,
    fatCorrFatAttr: factor.fat_corr_fat_attr ?? undefined,
    slopeFatCorAl: factor.slope_fat_cor_al ?? undefined,
    slopeFatCoeflattub: hasLegacyFactorName(factor)
      ? (factor.slope_fat_coef_lato_tubo ?? undefined)
      : (factor.slope_fat_coef_lattub ?? undefined),
    slopeFattoreAttrAria: factor.slope_fattore_attr_aria ?? undefined,
    securityFactor: factor.security_factor ?? undefined,
  };
}

function buildGeometry(
  component: TechnicalComponent,
  mode: CoilMode,
  geometry: UnilabGeometryRow | null,
  factor: CoilFactor | null,
  warnings: string[],
): GeometryInput {
  const code =
    geometry?.geometry_code ?? factor?.geometry_code ?? component.code ?? component.model ?? "";
  const fallback = defaultGeometryFromCode(code, mode);
  const legacyFactor = factor && hasLegacyFactorName(factor) ? factor : null;
  const tubeOuter = firstNumber(
    geometry?.tube_outer_diameter_mm,
    legacyFactor?.tube_outer_diameter_mm,
  );
  const tubeThickness = legacyFactor?.tube_thickness_mm;
  const tubeInner = firstNumber(
    geometry?.tube_inner_diameter_mm,
    tubeOuter != null && tubeThickness != null ? tubeOuter - 2 * tubeThickness : undefined,
  );
  const tubePitch = firstNumber(geometry?.tube_pitch_mm, legacyFactor?.tube_spacing_mm);
  const rowPitch = firstNumber(geometry?.row_pitch_mm, legacyFactor?.row_spacing_mm);
  const finPitch = firstNumber(geometry?.fin_pitch_mm);
  const finThickness = firstNumber(geometry?.fin_thickness_mm, legacyFactor?.fin_thickness_mm);
  const rows = firstNumber(geometry?.rows);
  const circuits = firstNumber(geometry?.circuits);

  if (!geometry)
    warnings.push("Sem registro em unilab_geometries; geometria usa defaults por código.");
  if (!factor) warnings.push("Sem fator em coil_geometry_factors.");
  if (tubeOuter == null || tubeInner == null || tubePitch == null || rowPitch == null) {
    warnings.push("Geometria incompleta; campos ausentes foram preenchidos com defaults do motor.");
  }

  return {
    ...fallback,
    code: code || fallback.code,
    finType: normalizeFinType(geometry?.fin_type ?? legacyFactor?.description),
    tubeType: normalizeTubeType(geometry?.tube_type),
    tubeOuterDiameterMm: tubeOuter ?? fallback.tubeOuterDiameterMm,
    tubeInnerDiameterMm: tubeInner ?? fallback.tubeInnerDiameterMm,
    tubePitchMm: tubePitch ?? fallback.tubePitchMm,
    rowPitchMm: rowPitch ?? fallback.rowPitchMm,
    finPitchMm: finPitch ?? fallback.finPitchMm,
    finThicknessMm: finThickness ?? fallback.finThicknessMm,
    coilHeightMm: legacyFactor?.fin_height_mm ?? fallback.coilHeightMm,
    rows: rows ?? fallback.rows,
    circuits: circuits ?? fallback.circuits,
  };
}

export async function resolveCoilComponent(componentId: string): Promise<ResolvedCoilComponent> {
  const { component, warnings } = await resolveComponent(componentId);
  if (component.entity_type !== "evaporator_coil" && component.entity_type !== "condenser_coil") {
    throw new Error(`Componente ${componentId} não é bobina.`);
  }

  const mode = coilModeFor(component);
  const geometry = await findUnilabGeometry(component, mode);
  if (geometry && BLOCKED_STATUSES.has(String(geometry.approval_status))) {
    throw new Error(`Geometria ${geometry.id} bloqueada por status ${geometry.approval_status}.`);
  }
  const factor = await findCoilFactor(component, geometry, mode);
  const thermalcalcGeometry = buildGeometry(component, mode, geometry, factor, warnings);

  return {
    kind: "coil",
    component,
    data: {
      geometry,
      factor,
      thermalcalc: {
        geometry: thermalcalcGeometry,
        factors: mapFactors(factor),
        unilabSource: geometry || factor ? "unilab" : "fallback",
      },
    },
    warnings,
  };
}

async function findRefrigerant(component: TechnicalComponent): Promise<RefrigerantRow | null> {
  const explicitId = component.source_raw_id ?? stringHint(component, "refrigerant_id", "id");
  if (explicitId) {
    const { data } = await supabase
      .from("refrigerants")
      .select("id, code, name, type, family, safety_class, gwp, odp, approval_status")
      .eq("id", explicitId)
      .maybeSingle();
    if (data) return data as RefrigerantRow;
  }

  const code = component.code ?? component.model;
  if (!code) return null;
  const { data } = await supabase
    .from("refrigerants")
    .select("id, code, name, type, family, safety_class, gwp, odp, approval_status")
    .eq("code", code)
    .in("approval_status", USABLE_STATUSES)
    .limit(1);
  return (data?.[0] as RefrigerantRow | undefined) ?? null;
}

export async function resolveRefrigerantComponent(
  componentId: string,
): Promise<ResolvedRefrigerantComponent> {
  const { component, warnings } = await resolveComponent(componentId);
  if (component.entity_type !== "refrigerant" && component.entity_type !== "fluid") {
    throw new Error(`Componente ${componentId} não é refrigerante/fluido.`);
  }

  const refrigerant = await findRefrigerant(component);
  if (!refrigerant) {
    return {
      kind: "refrigerant",
      component,
      data: null,
      warnings: [...warnings, "Nenhum registro correspondente em refrigerants."],
    };
  }
  if (BLOCKED_STATUSES.has(String(refrigerant.approval_status))) {
    throw new Error(
      `Refrigerante ${refrigerant.id} bloqueado por status ${refrigerant.approval_status}.`,
    );
  }

  const { data: polynomialRows, error } = await supabase
    .from("refrigerant_polynomials")
    .select(
      "id, refrigerant_id, refrigerant_code, property_id, property_name, phase, temp_min_c, temp_max_c, c0, c1, c2, c3, c4, c5, c6, unit",
    )
    .or(`refrigerant_id.eq.${refrigerant.id},refrigerant_code.eq.${refrigerant.code}`);
  if (error) throw new Error(`refrigerant_polynomials: ${error.message}`);

  const polynomials = (polynomialRows ?? []) as RefrigerantPolynomialRow[];
  if (polynomials.length === 0) warnings.push("Refrigerante sem polinômios termofísicos.");

  return {
    kind: "refrigerant",
    component,
    data: {
      refrigerant,
      polynomials,
      thermalcalc: {
        code: refrigerant.code,
        polynomials: polynomials.map((poly) => ({
          propertyName: poly.property_name,
          phase: poly.phase,
          tempMinC: poly.temp_min_c,
          tempMaxC: poly.temp_max_c,
          coefficients: [
            poly.c0 ?? 0,
            poly.c1 ?? 0,
            poly.c2 ?? 0,
            poly.c3 ?? 0,
            poly.c4 ?? 0,
            poly.c5 ?? 0,
            poly.c6 ?? 0,
          ],
          unit: poly.unit,
        })),
      },
    },
    warnings,
  };
}

export async function resolveValveComponent(componentId: string): Promise<ResolvedValveComponent> {
  const { component, warnings } = await resolveComponent(componentId);
  if (
    component.entity_type !== "expansion_valve" &&
    component.entity_type !== "solenoid_valve" &&
    component.entity_type !== "hot_gas_valve"
  ) {
    throw new Error(`Componente ${componentId} não é válvula.`);
  }

  warnings.push(
    "Válvula validada na Biblioteca Técnica, mas ainda não há tabela técnica dedicada para curvas/orifícios.",
  );
  return {
    kind: "valve",
    component,
    data: {
      entityType: component.entity_type,
      manufacturer: component.manufacturer,
      model: component.model,
      code: component.code,
      source: component.source,
      context: component.context,
      thermalcalc: {
        valveType: component.entity_type,
        componentId: component.id,
      },
    },
    warnings,
  };
}
