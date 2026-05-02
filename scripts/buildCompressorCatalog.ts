#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import Papa from "papaparse";
import * as XLSX from "xlsx";

type Manufacturer = "BITZER" | "COPELAND" | "UNKNOWN";
type Classification = "simulation_ready" | "nominal_only";

type PlainRecord = Record<string, unknown>;

type SourceRecord = {
  manufacturer: Manufacturer;
  sourceFile: string;
  sourceTable?: string;
  raw: PlainRecord;
};

type CoefficientSet = {
  sourceFile: string;
  sourceSheet?: string;
  sourceTable?: string;
  rowNumber?: number;
  values: Record<string, number>;
  raw: PlainRecord;
};

type CatalogRecord = {
  manufacturer: Manufacturer;
  model: string;
  normalizedModel: string;
  classification: Classification;
  sourceFiles: string[];
  refrigerants?: string[];
  compressorTypes?: string[];
  nominal: PlainRecord;
  coefficients?: CoefficientSet[];
  rawSourceRows: PlainRecord[];
};

type IndexRow = {
  fabricante?: string;
  banco?: string;
  tabela?: string;
  arquivo?: string;
  linhas?: string;
  tipo?: string;
};

type CliOptions = {
  bitzerFiles: string[];
  copelandFiles: string[];
  coefficientFiles: string[];
  indexFile?: string;
  inputRoot: string;
  outFile: string;
  strict: boolean;
};

const MODEL_KEYS = [
  "model",
  "modelo",
  "compressor",
  "compressormodel",
  "compressor_model",
  "modelname",
  "model_name",
  "modelno",
  "model_no",
  "partnumber",
  "part_number",
  "product",
  "productname",
  "product_name",
  "name",
  "designation",
  "code",
  "codigo",
];

const REFRIGERANT_KEYS = [
  "refrigerant",
  "refrigerante",
  "fluid",
  "fluido",
  "gas",
  "ref",
  "refrigerantcode",
  "refrigerant_code",
];

const TYPE_KEYS = [
  "compressortype",
  "compressor_type",
  "tipo",
  "type",
  "application",
  "family",
  "series",
  "serie",
];

const NOMINAL_KEY_PATTERNS = [
  /capacity/i,
  /capacidade/i,
  /\bq\b/i,
  /power/i,
  /pot[eê]ncia/i,
  /\bp\b/i,
  /current/i,
  /corrente/i,
  /displacement/i,
  /deslocamento/i,
  /voltage/i,
  /tens[aã]o/i,
  /frequency/i,
  /frequ[eê]ncia/i,
  /cop/i,
  /eer/i,
  /mass/i,
  /massa/i,
];

const COEFFICIENT_KEY_PATTERNS = [
  /^c\d+$/i,
  /^coef/i,
  /^coeff/i,
  /coefficient/i,
  /coeficiente/i,
  /^a\d+$/i,
  /^b\d+$/i,
  /^m\d+$/i,
  /^p\d+$/i,
  /^q\d+$/i,
];

const COEFFICIENT_TABLE_PATTERNS = [
  /coeff/i,
  /coef/i,
  /rating/i,
  /polynomial/i,
  /power/i,
  /capacity/i,
  /current/i,
  /lambda/i,
];

const COMPRESSOR_TABLE_PATTERNS = [/compressor/i, /product/i, /model/i, /rating/i];

function parseCli(argv: string[]): CliOptions {
  const options: CliOptions = {
    bitzerFiles: [],
    copelandFiles: [],
    coefficientFiles: [],
    inputRoot: process.cwd(),
    outFile: path.resolve(process.cwd(), "compressorCatalog.final.json"),
    strict: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--bitzer" && next) {
      options.bitzerFiles.push(path.resolve(next));
      index += 1;
    } else if (arg === "--copeland" && next) {
      options.copelandFiles.push(path.resolve(next));
      index += 1;
    } else if (arg === "--coefficients" && next) {
      options.coefficientFiles.push(path.resolve(next));
      index += 1;
    } else if (arg === "--index" && next) {
      options.indexFile = path.resolve(next);
      index += 1;
    } else if (arg === "--input-root" && next) {
      options.inputRoot = path.resolve(next);
      index += 1;
    } else if (arg === "--out" && next) {
      options.outFile = path.resolve(next);
      index += 1;
    } else if (arg === "--strict") {
      options.strict = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Argumento desconhecido ou incompleto: ${arg}`);
    }
  }

  return options;
}

function printHelp(): void {
  console.log(`Uso:
  node --experimental-strip-types scripts/buildCompressorCatalog.ts \\
    --bitzer dados/bitzer.json \\
    --copeland dados/copeland.json \\
    --coefficients dados/coeficientes.xlsx \\
    --out compressorCatalog.final.json

Opcoes:
  --index <csv>          Manifesto CSV com colunas fabricante,tabela,arquivo.
  --input-root <dir>     Raiz usada para resolver caminhos do --index.
  --bitzer <arquivo>     JSON/CSV de entrada BITZER. Pode repetir.
  --copeland <arquivo>   JSON/CSV de entrada COPELAND. Pode repetir.
  --coefficients <file>  Excel/CSV/JSON com coeficientes. Pode repetir.
  --out <arquivo>        Saida final. Padrao: compressorCatalog.final.json.
  --strict               Falha se caminhos do indice estiverem ausentes.
`);
}

function normalizeModel(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\bCOPELAND\b|\bBITZER\b|\bEMERSON\b/g, "")
    .replace(/[^A-Z0-9]/g, "");
}

function normalizeHeader(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function uniqueStrings(values: Array<string | undefined>): string[] | undefined {
  const unique = [...new Set(values.filter((value): value is string => Boolean(value)))];
  return unique.length > 0 ? unique.sort((a, b) => a.localeCompare(b)) : undefined;
}

function isPlainRecord(value: unknown): value is PlainRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function flattenJsonRows(value: unknown): PlainRecord[] {
  if (Array.isArray(value)) {
    return value.flatMap(flattenJsonRows);
  }

  if (!isPlainRecord(value)) {
    return [];
  }

  const arrayEntries = Object.values(value).filter(Array.isArray);
  if (arrayEntries.length === 0) {
    return [value];
  }

  const nestedRows = arrayEntries.flatMap(flattenJsonRows);
  return nestedRows.length > 0 ? nestedRows : [value];
}

function parseCsv(filePath: string): PlainRecord[] {
  const text = readFileSync(filePath, "utf8");
  const result = Papa.parse<PlainRecord>(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
    transformHeader: (header) => header.trim(),
  });

  if (result.errors.length > 0) {
    throw new Error(
      `Falha ao ler CSV ${filePath}: ${result.errors.map((error) => error.message).join("; ")}`,
    );
  }

  return result.data;
}

function parseStructuredFile(filePath: string): PlainRecord[] {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".json") {
    return flattenJsonRows(JSON.parse(readFileSync(filePath, "utf8")));
  }

  if (ext === ".csv") {
    return parseCsv(filePath);
  }

  if (ext === ".xlsx" || ext === ".xls") {
    const workbook = XLSX.readFile(filePath, { cellDates: false });
    return workbook.SheetNames.flatMap((sheetName) =>
      XLSX.utils
        .sheet_to_json<PlainRecord>(workbook.Sheets[sheetName], { defval: undefined })
        .map((row) => ({ ...row, __sheet: sheetName })),
    );
  }

  throw new Error(`Formato nao suportado: ${filePath}`);
}

function readIndex(indexFile: string): IndexRow[] {
  return parseCsv(indexFile).map((row) => ({
    fabricante: stringValue(row.fabricante),
    banco: stringValue(row.banco),
    tabela: stringValue(row.tabela),
    arquivo: stringValue(row.arquivo),
    linhas: stringValue(row.linhas),
    tipo: stringValue(row.tipo),
  }));
}

function stringValue(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  const text = String(value).trim();
  return text.length > 0 ? text : undefined;
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().replace(",", ".");
  if (!/^-?\d+(\.\d+)?([eE]-?\d+)?$/.test(normalized)) {
    return undefined;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getByNormalizedKey(row: PlainRecord, keys: string[]): unknown {
  const normalizedTargets = new Set(keys.map(normalizeHeader));
  for (const [key, value] of Object.entries(row)) {
    if (normalizedTargets.has(normalizeHeader(key))) {
      return value;
    }
  }

  return undefined;
}

function findModel(row: PlainRecord): string | undefined {
  const direct = stringValue(getByNormalizedKey(row, MODEL_KEYS));
  if (direct) {
    return direct;
  }

  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = normalizeHeader(key);
    if (normalizedKey.includes("model") || normalizedKey.includes("compressor")) {
      const text = stringValue(value);
      if (text && normalizeModel(text).length >= 3) {
        return text;
      }
    }
  }

  return undefined;
}

function findRefrigerant(row: PlainRecord): string | undefined {
  return stringValue(getByNormalizedKey(row, REFRIGERANT_KEYS));
}

function findCompressorType(row: PlainRecord): string | undefined {
  return stringValue(getByNormalizedKey(row, TYPE_KEYS));
}

function pickNominal(row: PlainRecord): PlainRecord {
  return Object.fromEntries(
    Object.entries(row).filter(([key, value]) => {
      if (key.startsWith("__")) {
        return false;
      }

      return (
        stringValue(value) !== undefined &&
        NOMINAL_KEY_PATTERNS.some((pattern) => pattern.test(key))
      );
    }),
  );
}

function extractCoefficientValues(row: PlainRecord): Record<string, number> {
  return Object.fromEntries(
    Object.entries(row).flatMap(([key, value]) => {
      if (!COEFFICIENT_KEY_PATTERNS.some((pattern) => pattern.test(key))) {
        return [];
      }

      const numeric = numberValue(value);
      return numeric === undefined ? [] : [[key, numeric]];
    }),
  );
}

function inferManufacturer(filePath: string, fallback?: string): Manufacturer {
  const text = `${fallback ?? ""} ${filePath}`.toUpperCase();
  if (text.includes("BITZER")) {
    return "BITZER";
  }

  if (text.includes("COPELAND") || text.includes("EMERSON")) {
    return "COPELAND";
  }

  return "UNKNOWN";
}

function shouldTreatAsCoefficientFile(filePath: string, tableName?: string): boolean {
  const label = `${filePath} ${tableName ?? ""}`;
  return COEFFICIENT_TABLE_PATTERNS.some((pattern) => pattern.test(label));
}

function shouldTreatAsCompressorFile(filePath: string, tableName?: string): boolean {
  const label = `${filePath} ${tableName ?? ""}`;
  return COMPRESSOR_TABLE_PATTERNS.some((pattern) => pattern.test(label));
}

function discoverFromIndex(options: CliOptions): {
  sourceFiles: Array<{ filePath: string; manufacturer: Manufacturer; sourceTable?: string }>;
  coefficientFiles: Array<{ filePath: string; sourceTable?: string }>;
  warnings: string[];
} {
  if (!options.indexFile) {
    return { sourceFiles: [], coefficientFiles: [], warnings: [] };
  }

  const sourceFiles = new Map<
    string,
    { filePath: string; manufacturer: Manufacturer; sourceTable?: string }
  >();
  const coefficientFiles = new Map<string, { filePath: string; sourceTable?: string }>();
  const warnings: string[] = [];

  for (const row of readIndex(options.indexFile)) {
    if (!row.arquivo) {
      continue;
    }

    const filePath = path.resolve(options.inputRoot, row.arquivo);
    if (!existsSync(filePath)) {
      const message = `Arquivo listado no indice nao encontrado: ${row.arquivo}`;
      if (options.strict) {
        throw new Error(message);
      }

      warnings.push(message);
      continue;
    }

    if (!statSync(filePath).isFile()) {
      continue;
    }

    const manufacturer = inferManufacturer(filePath, row.fabricante);
    const key = `${filePath}::${row.tabela ?? ""}`;

    if (shouldTreatAsCoefficientFile(filePath, row.tabela)) {
      coefficientFiles.set(key, { filePath, sourceTable: row.tabela });
    }

    if (shouldTreatAsCompressorFile(filePath, row.tabela)) {
      sourceFiles.set(key, { filePath, manufacturer, sourceTable: row.tabela });
    }
  }

  return {
    sourceFiles: [...sourceFiles.values()],
    coefficientFiles: [...coefficientFiles.values()],
    warnings,
  };
}

function loadSourceRecords(options: CliOptions): { rows: SourceRecord[]; warnings: string[] } {
  const discovered = discoverFromIndex(options);
  const explicitFiles: Array<{
    filePath: string;
    manufacturer: Manufacturer;
    sourceTable?: string;
  }> = [
    ...options.bitzerFiles.map((filePath) => ({
      filePath,
      manufacturer: "BITZER" as Manufacturer,
    })),
    ...options.copelandFiles.map((filePath) => ({
      filePath,
      manufacturer: "COPELAND" as Manufacturer,
    })),
  ];
  const sourceFiles = [...discovered.sourceFiles, ...explicitFiles];
  const rows: SourceRecord[] = [];

  for (const sourceFile of sourceFiles) {
    for (const row of parseStructuredFile(sourceFile.filePath)) {
      const model = findModel(row);
      if (!model || normalizeModel(model).length < 3) {
        continue;
      }

      rows.push({
        manufacturer: sourceFile.manufacturer,
        sourceFile: sourceFile.filePath,
        sourceTable: sourceFile.sourceTable,
        raw: row,
      });
    }
  }

  return { rows, warnings: discovered.warnings };
}

function loadCoefficients(options: CliOptions): Map<string, CoefficientSet[]> {
  const discovered = discoverFromIndex(options);
  const coefficientFiles: Array<{ filePath: string; sourceTable?: string }> = [
    ...discovered.coefficientFiles,
    ...options.coefficientFiles.map((filePath) => ({ filePath })),
  ];
  const coefficientsByModel = new Map<string, CoefficientSet[]>();

  for (const coefficientFile of coefficientFiles) {
    parseStructuredFile(coefficientFile.filePath).forEach((row, index) => {
      const model = findModel(row);
      if (!model) {
        return;
      }

      const normalizedModel = normalizeModel(model);
      const values = extractCoefficientValues(row);
      if (normalizedModel.length < 3 || Object.keys(values).length === 0) {
        return;
      }

      const coefficient: CoefficientSet = {
        sourceFile: coefficientFile.filePath,
        sourceSheet: stringValue(row.__sheet),
        sourceTable: coefficientFile.sourceTable,
        rowNumber: index + 1,
        values,
        raw: row,
      };

      const current = coefficientsByModel.get(normalizedModel) ?? [];
      current.push(coefficient);
      coefficientsByModel.set(normalizedModel, current);
    });
  }

  return coefficientsByModel;
}

function dedupeAndClassify(
  sourceRows: SourceRecord[],
  coefficientsByModel: Map<string, CoefficientSet[]>,
): CatalogRecord[] {
  const grouped = new Map<string, SourceRecord[]>();

  for (const sourceRow of sourceRows) {
    const model = findModel(sourceRow.raw);
    if (!model) {
      continue;
    }

    const normalizedModel = normalizeModel(model);
    const key = `${sourceRow.manufacturer}:${normalizedModel}`;
    const current = grouped.get(key) ?? [];
    current.push(sourceRow);
    grouped.set(key, current);
  }

  return [...grouped.entries()]
    .map(([key, rows]) => {
      const [, normalizedModel] = key.split(":");
      const model = chooseDisplayModel(rows);
      const coefficients = coefficientsByModel.get(normalizedModel);
      const classification: Classification =
        coefficients && coefficients.length > 0 ? "simulation_ready" : "nominal_only";

      return {
        manufacturer: rows[0].manufacturer,
        model,
        normalizedModel,
        classification,
        sourceFiles: [...new Set(rows.map((row) => row.sourceFile))].sort((a, b) =>
          a.localeCompare(b),
        ),
        refrigerants: uniqueStrings(rows.map((row) => findRefrigerant(row.raw))),
        compressorTypes: uniqueStrings(rows.map((row) => findCompressorType(row.raw))),
        nominal: mergeNominalRows(rows.map((row) => pickNominal(row.raw))),
        coefficients,
        rawSourceRows: rows.map((row) => row.raw),
      } satisfies CatalogRecord;
    })
    .sort((a, b) =>
      `${a.manufacturer}:${a.normalizedModel}`.localeCompare(
        `${b.manufacturer}:${b.normalizedModel}`,
      ),
    );
}

function chooseDisplayModel(rows: SourceRecord[]): string {
  const models = rows
    .map((row) => findModel(row.raw))
    .filter((model): model is string => Boolean(model));
  return models.sort((a, b) => a.length - b.length || a.localeCompare(b))[0];
}

function mergeNominalRows(rows: PlainRecord[]): PlainRecord {
  const merged: PlainRecord = {};

  for (const row of rows) {
    for (const [key, value] of Object.entries(row)) {
      const existing = merged[key];
      if (existing === undefined) {
        merged[key] = value;
      } else if (JSON.stringify(existing) !== JSON.stringify(value)) {
        const values = Array.isArray(existing) ? existing : [existing];
        if (!values.some((item) => JSON.stringify(item) === JSON.stringify(value))) {
          merged[key] = [...values, value];
        }
      }
    }
  }

  return merged;
}

function buildCatalog(options: CliOptions): { catalog: CatalogRecord[]; warnings: string[] } {
  const { rows, warnings } = loadSourceRecords(options);
  const coefficientsByModel = loadCoefficients(options);
  return { catalog: dedupeAndClassify(rows, coefficientsByModel), warnings };
}

function main(): void {
  const options = parseCli(process.argv.slice(2));
  const { catalog, warnings } = buildCatalog(options);
  const payload = {
    generatedAt: new Date().toISOString(),
    rules: {
      modelNormalization:
        "uppercase ASCII alphanumeric, without manufacturer tokens and punctuation",
      matching: "exact normalized model match between source rows and coefficient rows",
      duplicates: "deduplicated by manufacturer + normalizedModel",
      classification: {
        simulation_ready: "record has at least one coefficient row with numeric coefficient values",
        nominal_only: "record has source data but no matched coefficient rows",
      },
      dataPolicy: "fields are copied from inputs only; missing values are omitted",
    },
    stats: {
      total: catalog.length,
      simulation_ready: catalog.filter((row) => row.classification === "simulation_ready").length,
      nominal_only: catalog.filter((row) => row.classification === "nominal_only").length,
      warnings: warnings.length,
    },
    warnings,
    records: catalog,
  };

  mkdirSync(path.dirname(options.outFile), { recursive: true });
  writeFileSync(options.outFile, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Catalogo gerado: ${options.outFile}`);
  console.log(`Registros: ${payload.stats.total}`);
  console.log(`simulation_ready: ${payload.stats.simulation_ready}`);
  console.log(`nominal_only: ${payload.stats.nominal_only}`);
  if (warnings.length > 0) {
    console.warn(`Avisos: ${warnings.length}`);
  }
}

main();
