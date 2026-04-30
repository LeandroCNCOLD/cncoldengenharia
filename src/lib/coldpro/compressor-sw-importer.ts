import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";

type QueryResult<T = unknown> = Promise<{
  data: T | null;
  error: { message: string } | null;
  count?: number | null;
}>;

type QueryResponse = {
  data: unknown;
  error: { message: string } | null;
  count?: number | null;
};

interface QueryBuilder {
  insert(payload: unknown): QueryBuilder;
  update(payload: unknown): QueryBuilder;
  select(columns?: string, options?: unknown): QueryBuilder;
  eq(column: string, value: unknown): QueryBuilder;
  maybeSingle<T = unknown>(): QueryResult<T>;
  single<T = unknown>(): QueryResult<T>;
  then<TResult1 = QueryResponse, TResult2 = never>(
    onfulfilled?: ((value: QueryResponse) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2>;
}

type UntypedSupabase = {
  from: (relation: string) => QueryBuilder;
};

function db(): UntypedSupabase {
  return supabase as unknown as UntypedSupabase;
}

export interface CompressorImportFile {
  path: string;
  data: ArrayBuffer | string;
}

export interface CompressorImportSummary {
  batchId: string;
  totalFiles: number;
  totalRows: number;
  manufacturersDetected: string[];
  errors: string[];
}

type DetectedType = "model" | "refrigerant" | "polynomial" | "envelope" | "oil" | "unknown";
type CurveType = "capacity" | "power" | "current" | "mass_flow";

const KNOWN_MANUFACTURERS = [
  "bitzer",
  "copeland",
  "danfoss",
  "dorin",
  "tecumseh",
  "embraco",
  "maneurop",
  "bristol",
  "panasonic",
  "lg",
  "sanyo",
  "hitachi",
  "frascold",
  "bock",
];

const MODEL_PREFIX_MANUFACTURER: Array<[RegExp, string]> = [
  [/^4[DEFGH]/i, "Bitzer"],
  [/^(ZR|ZF|ZB|ZP|CR|CS|Scroll)/i, "Copeland"],
  [/^(MT|MTZ|NTZ|MLZ|SH|SY|SZ)/i, "Danfoss"],
  [/^H[0-9]|^CD/i, "Dorin"],
  [/^AE|^AJ|^FH/i, "Tecumseh"],
];

function normalizeHeader(value: unknown, index: number) {
  const text = String(value ?? "").trim();
  return text || `col_${index + 1}`;
}

function parseCsv(text: string) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
  if (lines.length === 0) return [{ sheetName: "csv", rows: [] as Record<string, unknown>[] }];
  const delimiter = detectDelimiter(lines[0]);
  const headers = splitLine(lines[0], delimiter).map(normalizeHeader);
  return [
    {
      sheetName: "csv",
      rows: lines.slice(1).map((line) => {
        const cells = splitLine(line, delimiter);
        return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
      }),
    },
  ];
}

function detectDelimiter(line: string) {
  const choices = [",", ";", "\t"];
  return choices
    .map((delimiter) => ({
      delimiter,
      count: (line.match(new RegExp(delimiter === "\t" ? "\\t" : delimiter, "g")) ?? []).length,
    }))
    .sort((a, b) => b.count - a.count)[0].delimiter;
}

function splitLine(line: string, delimiter: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function parseWorkbook(file: CompressorImportFile) {
  if (typeof file.data === "string" || file.path.toLowerCase().endsWith(".csv")) {
    return parseCsv(
      typeof file.data === "string" ? file.data : new TextDecoder().decode(file.data),
    );
  }
  const workbook = XLSX.read(file.data, { type: "array", raw: true, cellDates: true });
  return workbook.SheetNames.map((sheetName) => {
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
      header: 1,
      raw: true,
      defval: "",
      blankrows: false,
    });
    const headerIndex = matrix.findIndex((row) => row.some((cell) => String(cell).trim()));
    if (headerIndex < 0) return { sheetName, rows: [] as Record<string, unknown>[] };
    const headers = matrix[headerIndex].map(normalizeHeader);
    const rows = matrix
      .slice(headerIndex + 1)
      .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
    return { sheetName, rows };
  });
}

function getValue(row: Record<string, unknown>, patterns: RegExp[]) {
  const key = Object.keys(row).find((column) => patterns.some((pattern) => pattern.test(column)));
  return key ? row[key] : null;
}

function text(value: unknown): string | null {
  if (value == null || value === "") return null;
  const out = String(value).trim();
  return out ? out : null;
}

function numberValue(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(typeof value === "string" ? value.replace(",", ".") : value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function detectManufacturer(
  row: Record<string, unknown>,
  sourceFile: string,
  folderName: string,
): string {
  const explicit = text(getValue(row, [/manufacturer|brand|make|fabricante|marca/i]));
  if (explicit) return titleCase(explicit);

  const haystack = `${sourceFile} ${folderName}`.toLowerCase();
  const fromPath = KNOWN_MANUFACTURERS.find((manufacturer) => haystack.includes(manufacturer));
  if (fromPath) return titleCase(fromPath);

  const model = detectModel(row);
  if (model) {
    const mapped = MODEL_PREFIX_MANUFACTURER.find(([pattern]) => pattern.test(model));
    if (mapped) return mapped[1];
  }
  return "UNKNOWN";
}

function titleCase(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function detectModel(row: Record<string, unknown>) {
  return text(getValue(row, [/^model$|modelo|model_name|modelname|compressor/i]));
}

function detectRefrigerant(row: Record<string, unknown>) {
  return text(getValue(row, [/refrigerant|refrigerante|fluid|freon|gas/i]));
}

function detectType(
  row: Record<string, unknown>,
  sourceFile: string,
  sheetName: string,
): DetectedType {
  const keys = Object.keys(row).join(" ");
  const haystack = `${sourceFile} ${sheetName} ${keys}`.toLowerCase();
  if (/oil|oleo|óleo|viscos/i.test(haystack)) return "oil";
  if (/envelope|limit|limite|region/i.test(haystack)) return "envelope";
  if (/coeff|coef|polynomial|capcoeff|powcoeff|ampscoeff|mfcoeff/i.test(haystack))
    return "polynomial";
  if (/refrigerant|refrigerante|application_type|freon/i.test(haystack)) return "refrigerant";
  if (/model|modelo|displacement|voltage|frequency/i.test(haystack)) return "model";
  return "unknown";
}

function curveType(
  row: Record<string, unknown>,
  sourceFile: string,
  sheetName: string,
): CurveType | null {
  const haystack = `${sourceFile} ${sheetName} ${Object.keys(row).join(" ")}`.toLowerCase();
  if (/capacity|capacidade|capcoeff|q\b/.test(haystack)) return "capacity";
  if (/power|potencia|potência|powcoeff/.test(haystack)) return "power";
  if (/current|amps|ampere|ampscoeff/.test(haystack)) return "current";
  if (/mass.?flow|mfc|mfcoeff|vaz[aã]o.*massa/.test(haystack)) return "mass_flow";
  return null;
}

function coefficients(row: Record<string, unknown>) {
  const direct = getValue(row, [/coefficients|coeficientes|coeffs/i]);
  if (Array.isArray(direct)) return direct.map(Number).filter(Number.isFinite);
  if (typeof direct === "string") {
    const parsed = direct
      .split(/[;,|\s]+/)
      .map(Number)
      .filter(Number.isFinite);
    if (parsed.length > 0) return parsed;
  }
  const out: number[] = [];
  for (let index = 1; index <= 10; index += 1) {
    const value = numberValue(
      getValue(row, [new RegExp(`(^|_)c${index}$`, "i"), new RegExp(`coeff${index}`, "i")]),
    );
    if (value == null) return [];
    out.push(value);
  }
  return out;
}

async function getOrCreateModel(input: {
  manufacturer: string;
  model: string;
  sourceFile: string;
  raw: Record<string, unknown>;
}) {
  const { data: existing } = await db()
    .from("compressor_models")
    .select("id")
    .eq("manufacturer", input.manufacturer)
    .eq("model", input.model)
    .maybeSingle<{ id: string }>();
  if (existing?.id) return existing.id;

  const { data, error } = await db()
    .from("compressor_models")
    .insert({
      manufacturer: input.manufacturer,
      model: input.model,
      series: text(getValue(input.raw, [/series|serie|linha/i])),
      displacement: numberValue(getValue(input.raw, [/displacement|deslocamento/i])),
      motor_type: text(getValue(input.raw, [/motor_type|motor/i])),
      voltage: text(getValue(input.raw, [/voltage|tens[aã]o/i])),
      frequency: text(getValue(input.raw, [/frequency|frequ[eê]ncia|hz/i])),
      application_range: text(getValue(input.raw, [/application|range|aplica/i])),
      source_file: input.sourceFile,
      raw_json: input.raw,
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !data) throw new Error(error?.message ?? "compressor_models insert failed");
  return data.id;
}

export async function importCompressorsSwFolder(
  files: CompressorImportFile[],
  folderName = "COMPRESSORES_SW_COMPLETO",
): Promise<CompressorImportSummary> {
  const errors: string[] = [];
  const manufacturers = new Set<string>();
  let totalRows = 0;
  const { data: batch, error: batchError } = await db()
    .from("compressor_import_batches")
    .insert({
      folder_name: folderName,
      total_files: files.length,
      total_rows: 0,
      manufacturers_detected: [],
      status: "processing",
      errors_json: [],
    })
    .select("id")
    .single<{ id: string }>();
  if (batchError || !batch) throw new Error(batchError?.message ?? "batch not created");

  for (const file of files) {
    let rowsRead = 0;
    let rowsImported = 0;
    const fileErrors: string[] = [];
    for (const sheet of parseWorkbook(file)) {
      for (const row of sheet.rows) {
        rowsRead += 1;
        totalRows += 1;
        const manufacturer = detectManufacturer(row, file.path, folderName);
        const model = detectModel(row);
        const refrigerant = detectRefrigerant(row);
        const detectedType = detectType(row, file.path, sheet.sheetName);
        manufacturers.add(manufacturer);
        if (!model) {
          fileErrors.push(`${file.path}/${sheet.sheetName}/${rowsRead}: modelo ausente`);
          continue;
        }
        try {
          const compressorId = await getOrCreateModel({
            manufacturer,
            model,
            sourceFile: file.path,
            raw: row,
          });
          if (refrigerant) {
            await db()
              .from("compressor_refrigerants")
              .insert({
                compressor_id: compressorId,
                manufacturer,
                model,
                refrigerant,
                application_type: text(getValue(row, [/application|aplica/i])),
                raw_json: row,
              });
          }
          if (detectedType === "polynomial") {
            await db()
              .from("compressor_polynomials")
              .insert({
                compressor_id: compressorId,
                manufacturer,
                model,
                refrigerant,
                curve_type: curveType(row, file.path, sheet.sheetName) ?? "capacity",
                unit_system: text(getValue(row, [/unit|unidade/i])) ?? "unknown",
                coefficients_json: coefficients(row),
                evap_temp_min: numberValue(getValue(row, [/evap.*min|te.*min/i])),
                evap_temp_max: numberValue(getValue(row, [/evap.*max|te.*max/i])),
                cond_temp_min: numberValue(getValue(row, [/cond.*min|tc.*min/i])),
                cond_temp_max: numberValue(getValue(row, [/cond.*max|tc.*max/i])),
                source_file: file.path,
                raw_json: row,
              });
          }
          if (detectedType === "envelope") {
            await db()
              .from("compressor_envelopes")
              .insert({
                compressor_id: compressorId,
                manufacturer,
                model,
                refrigerant,
                evap_temp_min: numberValue(getValue(row, [/evap.*min|te.*min/i])),
                evap_temp_max: numberValue(getValue(row, [/evap.*max|te.*max/i])),
                cond_temp_min: numberValue(getValue(row, [/cond.*min|tc.*min/i])),
                cond_temp_max: numberValue(getValue(row, [/cond.*max|tc.*max/i])),
                region_type: text(getValue(row, [/region|regi[aã]o|type/i])),
                raw_json: row,
              });
          }
          if (detectedType === "oil") {
            await db()
              .from("compressor_oils")
              .insert({
                compressor_id: compressorId,
                manufacturer,
                model,
                oil_type: text(getValue(row, [/oil|oleo|óleo/i])),
                viscosity: text(getValue(row, [/viscos/i])),
                raw_json: row,
              });
          }
          rowsImported += 1;
        } catch (error) {
          fileErrors.push(
            `${file.path}/${sheet.sheetName}/${rowsRead}: ${(error as Error).message}`,
          );
        }
      }
    }
    errors.push(...fileErrors);
    await db()
      .from("compressor_import_audit")
      .insert({
        batch_id: batch.id,
        source_file: file.path,
        detected_manufacturer: Array.from(manufacturers).join(", "),
        detected_type: "mixed",
        rows_read: rowsRead,
        rows_imported: rowsImported,
        errors_json: fileErrors,
      });
  }

  const manufacturersDetected = Array.from(manufacturers).sort();
  await db()
    .from("compressor_import_batches")
    .update({
      total_rows: totalRows,
      manufacturers_detected: manufacturersDetected,
      status: errors.length ? "completed_with_errors" : "completed",
      errors_json: errors,
    })
    .eq("id", batch.id);

  return { batchId: batch.id, totalFiles: files.length, totalRows, manufacturersDetected, errors };
}
