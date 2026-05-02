/// <reference types="node" />

import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import JSZip from "jszip";
import * as XLSX from "xlsx";

type SourceRow = {
  source: string;
  sheet?: string;
  rowNumber: number;
  values: Record<string, unknown>;
  normalized: Record<string, unknown>;
};

type Poly = {
  type: "poly";
  coeffs: number[];
};

type FluidProperty =
  | "psat_pa"
  | "h_liq_kjkg"
  | "h_vap_kjkg"
  | "rho_liq_kgm3"
  | "rho_vap_kgm3"
  | "cp_kjkgk";

type FluidCandidate = {
  id: string;
  type: "pure";
  meta: {
    cas: string;
    name: string;
  };
  limits: {
    t_min_c: number;
    t_max_c: number;
  };
  propertyCandidates: Partial<Record<FluidProperty, Poly[]>>;
  sources: string[];
};

type PureFluid = {
  id: string;
  type: "pure";
  meta: {
    cas: string;
    name: string;
  };
  limits: {
    t_min_c: number;
    t_max_c: number;
  };
  properties: Record<FluidProperty, Poly>;
};

type Mixture = {
  id: string;
  type: "mixture";
  components: Array<{
    fluid: string;
    fraction: number;
  }>;
};

type Material = {
  id: string;
  conductivity_wmk: number;
  density_kgm3: number;
  roughness_m: number;
};

type Tube = {
  id: string;
  outer_diameter_mm: number;
  inner_diameter_mm: number;
  thickness_mm: number;
  material: string;
};

type AirsideCorrelation = {
  id: string;
  v_min: number;
  v_max: number;
  coeffs: number[];
};

type Report = {
  generatedAt: string;
  inputs: Array<{
    file: string;
    status: "processed" | "missing";
    rows: number;
  }>;
  totals: {
    processedRows: number;
    valid: {
      pureFluids: number;
      mixtures: number;
      materials: number;
      tubes: number;
      correlations: number;
    };
    discarded: number;
  };
  discarded: Array<{
    source: string;
    rowNumber?: number;
    id?: string;
    category: string;
    reason: string;
  }>;
};

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_DIR = path.join(ROOT_DIR, "public", "data", "thermo");

const INPUT_FILES = [
  "EQUACOES_POLINOMIAIS_COMPLETO.xlsx",
  "EQUACOES_POLINOMIAIS_VAPCYC_CD.xlsx",
  "00_INDICE_MESTRE.csv",
  "UNILAB_COILS6_COMPLETO.zip",
  "VAPCYC_CD_COMPLETO.zip",
  "thermalcalc_hybrid_package.zip",
];

const REQUIRED_PROPERTIES: FluidProperty[] = [
  "psat_pa",
  "h_liq_kjkg",
  "h_vap_kjkg",
  "rho_liq_kgm3",
  "rho_vap_kgm3",
  "cp_kjkgk",
];

const report: Report = {
  generatedAt: new Date().toISOString(),
  inputs: [],
  totals: {
    processedRows: 0,
    valid: {
      pureFluids: 0,
      mixtures: 0,
      materials: 0,
      tubes: 0,
      correlations: 0,
    },
    discarded: 0,
  },
  discarded: [],
};

async function main() {
  const rows = await readInputRows();
  report.totals.processedRows = rows.length;

  const pureFluids = buildPureFluids(rows);
  const pureIds = new Set(pureFluids.map((fluid) => fluid.id));
  const mixtures = buildMixtures(rows, pureIds);
  const materials = buildMaterials(rows);
  const materialIds = new Set(materials.map((material) => material.id));
  const tubes = buildTubes(rows, materialIds);
  const correlations = buildAirsideCorrelations(rows);

  report.totals.valid = {
    pureFluids: pureFluids.length,
    mixtures: mixtures.length,
    materials: materials.length,
    tubes: tubes.length,
    correlations: correlations.length,
  };

  await writeDatabase({
    pureFluids,
    mixtures,
    materials,
    tubes,
    correlations,
  });
}

async function readInputRows(): Promise<SourceRow[]> {
  const rows: SourceRow[] = [];

  for (const file of INPUT_FILES) {
    const filePath = await findInputFile(file);

    try {
      if (!filePath) {
        report.inputs.push({ file, status: "missing", rows: 0 });
        discard({ source: file, category: "input", reason: "missing_input" });
        continue;
      }

      const buffer = await readFile(filePath);
      const fileRows = await parseBuffer(file, buffer);
      rows.push(...fileRows);
      report.inputs.push({ file, status: "processed", rows: fileRows.length });
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        report.inputs.push({ file, status: "missing", rows: 0 });
        discard({ source: file, category: "input", reason: "missing_input" });
        continue;
      }

      throw error;
    }
  }

  return rows;
}

async function findInputFile(fileName: string): Promise<string | undefined> {
  const directPath = path.join(ROOT_DIR, fileName);

  try {
    await readFile(directPath);
    return directPath;
  } catch (error) {
    if (!isNodeError(error) || error.code !== "ENOENT") throw error;
  }

  const ignoredDirectories = new Set([
    ".git",
    "node_modules",
    ".tanstack",
    "dist",
    "build",
    "public/data/thermo",
  ]);

  async function walk(directory: string): Promise<string | undefined> {
    const entries = await readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(directory, entry.name);
      const relativePath = path.relative(ROOT_DIR, entryPath);

      if (entry.isDirectory()) {
        if (ignoredDirectories.has(relativePath) || ignoredDirectories.has(entry.name)) continue;
        const found = await walk(entryPath);
        if (found) return found;
        continue;
      }

      if (entry.isFile() && entry.name === fileName) return entryPath;
    }

    return undefined;
  }

  return walk(ROOT_DIR);
}

async function parseBuffer(source: string, buffer: Buffer): Promise<SourceRow[]> {
  const ext = path.extname(source).toLowerCase();

  if (ext === ".zip") {
    return parseZip(source, buffer);
  }

  if (ext === ".xlsx" || ext === ".xls" || ext === ".csv") {
    return parseWorkbook(source, buffer);
  }

  if (ext === ".json") {
    return parseJson(source, buffer);
  }

  return [];
}

async function parseZip(source: string, buffer: Buffer): Promise<SourceRow[]> {
  const zip = await JSZip.loadAsync(buffer);
  const rows: SourceRow[] = [];

  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue;

    const ext = path.extname(entry.name).toLowerCase();
    if (![".xlsx", ".xls", ".csv", ".json"].includes(ext)) continue;

    const entryBuffer = await entry.async("nodebuffer");
    const nestedSource = `${source}:${entry.name}`;
    rows.push(...(await parseBuffer(nestedSource, entryBuffer)));
  }

  return rows;
}

function parseWorkbook(source: string, buffer: Buffer): SourceRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer", raw: true });
  const rows: SourceRow[] = [];

  for (const sheet of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheet];
    const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
      defval: undefined,
      raw: true,
    });

    jsonRows.forEach((values, index) => {
      if (isEmptyObject(values)) return;
      rows.push(toSourceRow(source, values, index + 2, sheet));
    });
  }

  return rows;
}

function parseJson(source: string, buffer: Buffer): SourceRow[] {
  const parsed = JSON.parse(buffer.toString("utf8")) as unknown;
  const records = Array.isArray(parsed) ? parsed : [parsed];

  return records
    .filter((record): record is Record<string, unknown> => isRecord(record))
    .map((values, index) => toSourceRow(source, values, index + 1));
}

function toSourceRow(
  source: string,
  values: Record<string, unknown>,
  rowNumber: number,
  sheet?: string,
): SourceRow {
  return {
    source,
    sheet,
    rowNumber,
    values,
    normalized: normalizeRecord(values),
  };
}

function buildPureFluids(rows: SourceRow[]): PureFluid[] {
  const candidates = new Map<string, FluidCandidate>();

  for (const row of rows) {
    const id = getFluidId(row);
    if (!id || isMixtureId(id)) continue;

    const property = getFluidProperty(row);
    const coeffs = getCoefficients(row);
    const limits = getTemperatureLimits(row);

    if (!property || coeffs.length === 0) continue;

    if (!limits) {
      discard({
        source: row.source,
        rowNumber: row.rowNumber,
        id,
        category: "pure_fluid",
        reason: "missing_temperature_limits",
      });
      continue;
    }

    const candidate = candidates.get(id) ?? {
      id,
      type: "pure",
      meta: {
        cas: stringValue(row.normalized.cas) ?? "",
        name: stringValue(row.normalized.name) ?? id,
      },
      limits,
      propertyCandidates: {},
      sources: [],
    };

    candidate.meta.cas ||= stringValue(row.normalized.cas) ?? "";
    candidate.meta.name ||= stringValue(row.normalized.name) ?? id;
    candidate.limits = mergeLimits(candidate.limits, limits);
    candidate.sources.push(row.source);
    candidate.propertyCandidates[property] = [
      ...(candidate.propertyCandidates[property] ?? []),
      { type: "poly", coeffs: convertCoefficients(property, coeffs, row) },
    ];

    candidates.set(id, candidate);
  }

  const fluids: PureFluid[] = [];

  for (const candidate of candidates.values()) {
    const properties = selectFluidProperties(candidate);

    if (!properties.psat_pa) {
      discard({
        source: candidate.sources.join(", "),
        id: candidate.id,
        category: "pure_fluid",
        reason: "missing_psat",
      });
      continue;
    }

    if (!hasCompleteLimits(candidate.limits)) {
      discard({
        source: candidate.sources.join(", "),
        id: candidate.id,
        category: "pure_fluid",
        reason: "missing_temperature_limits",
      });
      continue;
    }

    const missingProperties = REQUIRED_PROPERTIES.filter((property) => !properties[property]);
    if (missingProperties.length > 0) {
      discard({
        source: candidate.sources.join(", "),
        id: candidate.id,
        category: "pure_fluid",
        reason: `missing_properties:${missingProperties.join(",")}`,
      });
      continue;
    }

    fluids.push({
      id: candidate.id,
      type: "pure",
      meta: candidate.meta,
      limits: candidate.limits,
      properties: properties as Record<FluidProperty, Poly>,
    });
  }

  return fluids.sort((a, b) => a.id.localeCompare(b.id));
}

function buildMixtures(rows: SourceRow[], pureIds: Set<string>): Mixture[] {
  const mixtures: Mixture[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const id = getFluidId(row);
    if (!id || !isMixtureId(id) || seen.has(id)) continue;

    const components = getMixtureComponents(row);
    if (components.length === 0) continue;

    const missingComponent = components.find((component) => !pureIds.has(component.fluid));
    if (missingComponent) {
      discard({
        source: row.source,
        rowNumber: row.rowNumber,
        id,
        category: "mixture",
        reason: `component_not_found:${missingComponent.fluid}`,
      });
      continue;
    }

    const fractionSum = components.reduce((sum, component) => sum + component.fraction, 0);
    if (!Number.isFinite(fractionSum) || fractionSum <= 0) {
      discard({
        source: row.source,
        rowNumber: row.rowNumber,
        id,
        category: "mixture",
        reason: "invalid_fraction_sum",
      });
      continue;
    }

    mixtures.push({
      id,
      type: "mixture",
      components: components.map((component) => ({
        fluid: component.fluid,
        fraction: round(component.fraction / fractionSum),
      })),
    });
    seen.add(id);
  }

  return mixtures.sort((a, b) => a.id.localeCompare(b.id));
}

function buildMaterials(rows: SourceRow[]): Material[] {
  const materials = new Map<string, Material>();

  for (const row of rows) {
    const id = normalizeId(firstString(row.normalized, ["material", "material_id", "mat", "name"]));
    const conductivity = firstNumber(row.normalized, [
      "conductivity_wmk",
      "thermal_conductivity_wmk",
      "k_wmk",
      "conductivity",
      "k",
    ]);
    const density = firstNumber(row.normalized, ["density_kgm3", "rho_kgm3", "density", "rho"]);
    const roughness = toMeters(
      firstNumber(row.normalized, ["roughness_m", "roughness", "epsilon", "epsilon_m"]),
      getUnit(row, "roughness"),
    );

    if (!id || conductivity === undefined || density === undefined || roughness === undefined) {
      if (id || conductivity !== undefined || density !== undefined || roughness !== undefined) {
        discard({
          source: row.source,
          rowNumber: row.rowNumber,
          id,
          category: "material",
          reason: "missing_required_material_field",
        });
      }
      continue;
    }

    materials.set(id, {
      id,
      conductivity_wmk: conductivity,
      density_kgm3: toDensityKgM3(density, getUnit(row, "density")),
      roughness_m: roughness,
    });
  }

  return [...materials.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function buildTubes(rows: SourceRow[], materialIds: Set<string>): Tube[] {
  const tubes = new Map<string, Tube>();

  for (const row of rows) {
    const outerDiameter = toMillimeters(
      firstNumber(row.normalized, ["outer_diameter_mm", "od_mm", "outer_diameter", "od"]),
      getUnit(row, "diameter"),
    );
    const innerDiameter = toMillimeters(
      firstNumber(row.normalized, ["inner_diameter_mm", "id_mm", "inner_diameter"]),
      getUnit(row, "diameter"),
    );
    const thickness = toMillimeters(
      firstNumber(row.normalized, ["thickness_mm", "wall_thickness_mm", "thickness", "wall"]),
      getUnit(row, "thickness"),
    );
    const material = normalizeId(
      firstString(row.normalized, ["material", "material_id", "tube_material"]),
    );

    if (
      outerDiameter === undefined ||
      innerDiameter === undefined ||
      thickness === undefined ||
      !material
    ) {
      if (
        outerDiameter !== undefined ||
        innerDiameter !== undefined ||
        thickness !== undefined ||
        material
      ) {
        discard({
          source: row.source,
          rowNumber: row.rowNumber,
          category: "tube",
          reason: "missing_required_tube_field",
        });
      }
      continue;
    }

    if (materialIds.size > 0 && !materialIds.has(material)) {
      discard({
        source: row.source,
        rowNumber: row.rowNumber,
        category: "tube",
        reason: `material_not_found:${material}`,
      });
      continue;
    }

    const id =
      normalizeId(firstString(row.normalized, ["id", "tube_id"])) ?? `tube_${tubes.size + 1}`;
    tubes.set(id, {
      id,
      outer_diameter_mm: outerDiameter,
      inner_diameter_mm: innerDiameter,
      thickness_mm: thickness,
      material,
    });
  }

  return [...tubes.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function buildAirsideCorrelations(rows: SourceRow[]): AirsideCorrelation[] {
  const correlations = new Map<string, AirsideCorrelation>();

  for (const row of rows) {
    const coeffs = getCoefficients(row);
    const vMin = firstNumber(row.normalized, ["v_min", "velocity_min", "air_velocity_min"]);
    const vMax = firstNumber(row.normalized, ["v_max", "velocity_max", "air_velocity_max"]);
    const correlationName = firstString(row.normalized, [
      "correlation",
      "correlation_id",
      "airside_correlation",
      "airside_htc",
    ]);

    if (!correlationName || coeffs.length === 0 || vMin === undefined || vMax === undefined) {
      if (correlationName || coeffs.length > 0 || vMin !== undefined || vMax !== undefined) {
        discard({
          source: row.source,
          rowNumber: row.rowNumber,
          category: "correlation",
          reason: "missing_required_correlation_field",
        });
      }
      continue;
    }

    const id = normalizeId(correlationName) ?? `correlation_${correlations.size + 1}`;
    correlations.set(id, {
      id,
      v_min: vMin,
      v_max: vMax,
      coeffs,
    });
  }

  return [...correlations.values()].sort((a, b) => a.id.localeCompare(b.id));
}

async function writeDatabase(data: {
  pureFluids: PureFluid[];
  mixtures: Mixture[];
  materials: Material[];
  tubes: Tube[];
  correlations: AirsideCorrelation[];
}) {
  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(path.join(OUTPUT_DIR, "fluids", "pure"), { recursive: true });
  await mkdir(path.join(OUTPUT_DIR, "fluids", "mixtures"), { recursive: true });
  await mkdir(path.join(OUTPUT_DIR, "materials"), { recursive: true });
  await mkdir(path.join(OUTPUT_DIR, "tubes"), { recursive: true });
  await mkdir(path.join(OUTPUT_DIR, "correlations"), { recursive: true });

  await Promise.all(
    data.pureFluids.map((fluid) =>
      writeJson(path.join(OUTPUT_DIR, "fluids", "pure", `${fileSafeId(fluid.id)}.json`), fluid),
    ),
  );
  await Promise.all(
    data.mixtures.map((mixture) =>
      writeJson(
        path.join(OUTPUT_DIR, "fluids", "mixtures", `${fileSafeId(mixture.id)}.json`),
        mixture,
      ),
    ),
  );
  await writeJson(path.join(OUTPUT_DIR, "materials", "materials.json"), data.materials);
  await writeJson(path.join(OUTPUT_DIR, "tubes", "tubes.json"), data.tubes);
  await writeJson(path.join(OUTPUT_DIR, "correlations", "airside_htc.json"), data.correlations);
  await writeJson(path.join(OUTPUT_DIR, "report.json"), report);
}

async function writeJson(filePath: string, data: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function selectFluidProperties(candidate: FluidCandidate): Partial<Record<FluidProperty, Poly>> {
  const selected: Partial<Record<FluidProperty, Poly>> = {};

  for (const property of REQUIRED_PROPERTIES) {
    const candidates = candidate.propertyCandidates[property] ?? [];
    if (candidates.length === 0) continue;

    selected[property] = candidates
      .filter((poly) => poly.coeffs.length > 0)
      .sort((a, b) => b.coeffs.length - a.coeffs.length)[0];

    if (candidates.length > 1) {
      discard({
        source: candidate.sources.join(", "),
        id: candidate.id,
        category: "pure_fluid",
        reason: `duplicate_property_selected_most_complete:${property}`,
      });
    }
  }

  return selected;
}

function getFluidProperty(row: SourceRow): FluidProperty | undefined {
  const propertyText = [
    firstString(row.normalized, ["property", "prop", "variable", "output", "parameter"]),
    firstString(row.normalized, ["field", "name", "description", "descricao"]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/psat|p_sat|press.*sat|sat.*press|vapor.*press/.test(propertyText)) return "psat_pa";
  if (/h.*liq|liq.*h|enthalpy.*liq|liquid.*enthalpy/.test(propertyText)) return "h_liq_kjkg";
  if (/h.*vap|vap.*h|enthalpy.*vap|vapor.*enthalpy/.test(propertyText)) return "h_vap_kjkg";
  if (/rho.*liq|liq.*rho|density.*liq|liquid.*density/.test(propertyText)) return "rho_liq_kgm3";
  if (/rho.*vap|vap.*rho|density.*vap|vapor.*density/.test(propertyText)) return "rho_vap_kgm3";
  if (/\bcp\b|heat.*capacity|specific.*heat/.test(propertyText)) return "cp_kjkgk";

  for (const property of REQUIRED_PROPERTIES) {
    if (row.normalized[property] !== undefined) return property;
  }

  return undefined;
}

function getFluidId(row: SourceRow): string | undefined {
  const id = firstString(row.normalized, [
    "fluid",
    "fluid_id",
    "refrigerant",
    "refrigerant_id",
    "id",
    "codigo",
    "code",
  ]);

  if (!id) return undefined;

  return normalizeFluidId(id);
}

function getTemperatureLimits(row: SourceRow): { t_min_c: number; t_max_c: number } | undefined {
  const tMin =
    firstNumber(row.normalized, ["t_min_c", "tmin_c", "temperature_min_c"]) ??
    convertTemperature(
      firstNumber(row.normalized, ["t_min", "tmin", "temperature_min"]),
      getUnit(row, "temperature"),
    );
  const tMax =
    firstNumber(row.normalized, ["t_max_c", "tmax_c", "temperature_max_c"]) ??
    convertTemperature(
      firstNumber(row.normalized, ["t_max", "tmax", "temperature_max"]),
      getUnit(row, "temperature"),
    );

  if (tMin === undefined || tMax === undefined || tMax <= tMin) return undefined;

  return { t_min_c: tMin, t_max_c: tMax };
}

function getMixtureComponents(row: SourceRow) {
  const components: Array<{ fluid: string; fraction: number }> = [];

  for (let index = 1; index <= 12; index += 1) {
    const fluid = firstString(row.normalized, [
      `cl${index}`,
      `component${index}`,
      `component_${index}`,
      `fluid${index}`,
      `fluid_${index}`,
    ]);
    const fraction = firstNumber(row.normalized, [
      `pe${index}`,
      `fraction${index}`,
      `fraction_${index}`,
      `mass_fraction${index}`,
      `mole_fraction${index}`,
    ]);

    if (!fluid || fraction === undefined) continue;
    components.push({ fluid: normalizeFluidId(fluid), fraction: normalizeFraction(fraction) });
  }

  return components;
}

function getCoefficients(row: SourceRow): number[] {
  const direct = firstString(row.normalized, ["coeffs", "coefficients", "coeficientes"]);
  if (direct) {
    const parsed = direct
      .replace(/\[|\]/g, "")
      .split(/[;,|\s]+/)
      .map(Number)
      .filter(Number.isFinite);
    if (parsed.length > 0) return parsed;
  }

  return Object.entries(row.normalized)
    .map(([key, value]) => {
      const match = key.match(/^(?:c|a|b|coef|coeff|coefficient)_?(\d+)$/);
      if (!match) return undefined;
      const number = numericValue(value);
      if (number === undefined) return undefined;
      return { index: Number(match[1]), value: number };
    })
    .filter((item): item is { index: number; value: number } => item !== undefined)
    .sort((a, b) => a.index - b.index)
    .map((item) => item.value);
}

function convertCoefficients(property: FluidProperty, coeffs: number[], row: SourceRow): number[] {
  const unit = getUnit(row, property);
  const factor = getPropertyFactor(property, unit);
  return coeffs.map((coeff) => round(coeff * factor));
}

function getPropertyFactor(property: FluidProperty, unit: string | undefined): number {
  if (!unit) return 1;
  const normalizedUnit = unit.toLowerCase();

  if (property === "psat_pa") {
    if (normalizedUnit.includes("mpa")) return 1_000_000;
    if (normalizedUnit.includes("kpa")) return 1_000;
    if (normalizedUnit.includes("bar")) return 100_000;
    if (normalizedUnit.includes("psi")) return 6_894.757293;
  }

  if (property === "h_liq_kjkg" || property === "h_vap_kjkg") {
    if (normalizedUnit.includes("j/kg") && !normalizedUnit.includes("kj")) return 0.001;
    if (normalizedUnit.includes("kcal/kg")) return 4.1868;
  }

  if (property === "rho_liq_kgm3" || property === "rho_vap_kgm3") {
    if (normalizedUnit.includes("g/cm3") || normalizedUnit.includes("g/ml")) return 1_000;
  }

  if (property === "cp_kjkgk") {
    if (normalizedUnit.includes("j/kg") && !normalizedUnit.includes("kj")) return 0.001;
    if (normalizedUnit.includes("kcal/kg")) return 4.1868;
  }

  return 1;
}

function normalizeRecord(record: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [normalizeKey(key), normalizeValue(value)]),
  );
}

function normalizeKey(key: string) {
  return key
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeValue(value: unknown) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (trimmed === "") return undefined;

  const decimal = Number(trimmed.replace(",", "."));
  return Number.isFinite(decimal) && /^[-+]?\d+(?:[,.]\d+)?(?:e[-+]?\d+)?$/i.test(trimmed)
    ? decimal
    : trimmed;
}

function firstString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = stringValue(record[key]);
    if (value) return value;
  }

  return undefined;
}

function firstNumber(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = numericValue(record[key]);
    if (value !== undefined) return value;
  }

  return undefined;
}

function numericValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;

  const number = Number(value.trim().replace(",", "."));
  return Number.isFinite(number) ? number : undefined;
}

function stringValue(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function getUnit(row: SourceRow, hint: string): string | undefined {
  const unitKeys = Object.keys(row.normalized).filter((key) => key.includes("unit"));

  for (const key of unitKeys) {
    if (key.includes(hint) || hint.includes(key.replace("_unit", ""))) {
      return stringValue(row.normalized[key]);
    }
  }

  return firstString(row.normalized, ["unit", "units", "unidade", "unidades"]);
}

function convertTemperature(value: number | undefined, unit: string | undefined) {
  if (value === undefined) return undefined;
  if (!unit) return value;

  const normalizedUnit = unit.toLowerCase();
  if (normalizedUnit.includes("k") && !normalizedUnit.includes("kg")) return value - 273.15;
  if (normalizedUnit.includes("f")) return (value - 32) / 1.8;
  return value;
}

function toMeters(value: number | undefined, unit: string | undefined) {
  if (value === undefined) return undefined;
  if (!unit) return value;

  const normalizedUnit = unit.toLowerCase();
  if (normalizedUnit.includes("mm")) return value / 1_000;
  if (normalizedUnit.includes("um") || normalizedUnit.includes("µm")) return value / 1_000_000;
  return value;
}

function toMillimeters(value: number | undefined, unit: string | undefined) {
  if (value === undefined) return undefined;
  if (!unit) return value;

  const normalizedUnit = unit.toLowerCase();
  if (normalizedUnit.includes(" m") || normalizedUnit === "m") return value * 1_000;
  if (normalizedUnit.includes("in")) return value * 25.4;
  return value;
}

function toDensityKgM3(value: number, unit: string | undefined) {
  if (!unit) return value;

  const normalizedUnit = unit.toLowerCase();
  if (normalizedUnit.includes("g/cm3") || normalizedUnit.includes("g/ml")) return value * 1_000;
  return value;
}

function normalizeFluidId(id: string) {
  const normalized = id.trim().toUpperCase().replace(/\s+/g, "");
  return normalized.startsWith("R") ? normalized : `R${normalized.replace(/^R/, "")}`;
}

function normalizeId(id: string | undefined) {
  if (!id) return undefined;
  return id
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeFraction(fraction: number) {
  return fraction > 1 ? fraction / 100 : fraction;
}

function isMixtureId(id: string) {
  return /[A-Z]$/.test(id);
}

function mergeLimits(
  current: { t_min_c: number; t_max_c: number },
  next: { t_min_c: number; t_max_c: number },
) {
  return {
    t_min_c: Math.min(current.t_min_c, next.t_min_c),
    t_max_c: Math.max(current.t_max_c, next.t_max_c),
  };
}

function hasCompleteLimits(limits: { t_min_c: number; t_max_c: number }) {
  return (
    Number.isFinite(limits.t_min_c) &&
    Number.isFinite(limits.t_max_c) &&
    limits.t_max_c > limits.t_min_c
  );
}

function isEmptyObject(record: Record<string, unknown>) {
  return Object.values(record).every(
    (value) => value === undefined || value === null || value === "",
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function discard(entry: Omit<Report["discarded"][number], "reason"> & { reason: string }) {
  report.discarded.push(entry);
  report.totals.discarded = report.discarded.length;
}

function fileSafeId(id: string) {
  return id.toLowerCase().replace(/[^a-z0-9_-]+/gi, "_");
}

function round(value: number) {
  return Number(value.toPrecision(12));
}

await main();
