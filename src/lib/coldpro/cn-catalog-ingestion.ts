import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";

type UntypedSupabase = {
  from: (relation: string) => QueryBuilder;
};

type QueryResult<T = unknown> = Promise<{
  data: T | null;
  error: { message: string } | null;
  count?: number | null;
}>;

type QueryResponse<T = unknown> = {
  data: T | null;
  error: { message: string } | null;
  count?: number | null;
};

interface QueryBuilder {
  insert(payload: unknown): QueryBuilder;
  update(payload: unknown): QueryBuilder;
  delete(): QueryBuilder;
  select(columns?: string, options?: unknown): QueryBuilder;
  single<T = unknown>(): QueryResult<T>;
  eq(column: string, value: unknown): QueryBuilder;
  neq(column: string, value: unknown): QueryBuilder;
  order(column: string, options?: unknown): QueryBuilder;
  then<
    TResult1 = { data: unknown; error: { message: string } | null; count?: number | null },
    TResult2 = never,
  >(
    onfulfilled?: ((value: QueryResponse) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2>;
}

function cnDb(): UntypedSupabase {
  return injectedDb ?? (supabase as unknown as UntypedSupabase);
}

let injectedDb: UntypedSupabase | null = null;

export function setCnCatalogDb(client: UntypedSupabase | null) {
  injectedDb = client;
}

export type CnCatalogSourceType = "official" | "480" | "csv";
export type CnCatalogImportStatus = "pending" | "imported" | "failed";

export interface CnCatalogImportFile {
  fileName: string;
  sourceType: CnCatalogSourceType;
  data: ArrayBuffer | string;
}

export interface CnCatalogImportResult {
  batchIds: string[];
  totalRows: number;
  totalColumns: number;
  errors: string[];
}

export interface CatalogValidationReport {
  totalRowsImported: number;
  totalColumnsDetected: number;
  unmappedColumns: Array<{ columnName: string; sourceType: string }>;
  modelsWithoutEvaporator: string[];
  modelsWithoutCondenser: string[];
  modelsWithoutCompressor: string[];
  modelsWithoutCurve: string[];
  emptyCriticalFields: Array<{ model: string; field: string }>;
}

const SOURCE_PRIORITY: Record<CnCatalogSourceType, number> = {
  official: 1,
  "480": 2,
  csv: 3,
};

interface IdRow {
  id: string;
}

interface RawCatalogRow {
  id: string;
  source_type: CnCatalogSourceType;
  modelo: string | null;
  raw_json: Record<string, unknown>;
  batch_id?: string | null;
}

interface AuditColumnRow {
  column_name: string;
  source_type: string;
  mapped: boolean;
}

interface MasterRow {
  id: string;
  modelo: string | null;
}

interface ModelIdRow {
  model_id: string;
}

interface CompressorMasterRow {
  model_id: string;
  copeland: string | null;
  bitzer: string | null;
  danfoss: string | null;
  dorin: string | null;
  secondary: string | null;
}

const MAPPED_COLUMN_RULES: Array<{
  pattern: RegExp;
  targetTable: string;
  notes: string;
}> = [
  {
    pattern: /modelo|model/i,
    targetTable: "cn_equipment_master",
    notes: "Identificação do modelo",
  },
  { pattern: /\bhp\b|pot[eê]ncia/i, targetTable: "cn_equipment_master", notes: "Potência nominal" },
  {
    pattern: /refrigerante|refrigerant|fluido/i,
    targetTable: "cn_equipment_master",
    notes: "Fluido refrigerante",
  },
  {
    pattern: /evap|evaporador/i,
    targetTable: "cn_equipment_evaporator_master",
    notes: "Dados do evaporador",
  },
  {
    pattern: /cond|condensador/i,
    targetTable: "cn_equipment_condenser_master",
    notes: "Dados do condensador",
  },
  {
    pattern: /compress|copeland|bitzer|danfoss|dorin/i,
    targetTable: "cn_equipment_compressor_master",
    notes: "Dados de compressor",
  },
  {
    pattern: /capacidade|capacity|tcond|tevap|cop|power|potencia/i,
    targetTable: "cn_equipment_performance_master",
    notes: "Ponto de performance",
  },
  {
    pattern: /vaz[aã]o|airflow|m3.?h/i,
    targetTable: "cn_equipment_performance_master",
    notes: "Vazão de ar",
  },
  {
    pattern: /tubo|tube|aleta|fin|circuit|row|fileira/i,
    targetTable: "cn_equipment_evaporator_master",
    notes: "Geometria de coil",
  },
];

function normalizeHeader(value: unknown, index: number): string {
  const header = String(value ?? "").trim();
  return header || `col_${index + 1}`;
}

function normalizeCell(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  return value ?? "";
}

function detectValueType(values: unknown[]): string {
  const filled = values.filter((value) => value !== null && value !== undefined && value !== "");
  if (filled.length === 0) return "empty";
  if (
    filled.every(
      (value) =>
        typeof value === "number" ||
        (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))),
    )
  ) {
    return "number";
  }
  if (filled.every((value) => typeof value === "boolean")) return "boolean";
  if (filled.every((value) => !Number.isNaN(Date.parse(String(value))))) return "date_or_text";
  return "text";
}

function getColumnMapping(columnName: string) {
  const rule = MAPPED_COLUMN_RULES.find((candidate) => candidate.pattern.test(columnName));
  return {
    mapped: Boolean(rule),
    targetTable: rule?.targetTable ?? null,
    notes: rule?.notes ?? "Coluna preservada somente no RAW; revisar mapeamento.",
  };
}

function parseCsv(
  text: string,
): { sheetName: string; headers: string[]; rows: Record<string, unknown>[] }[] {
  const clean = text.replace(/^\uFEFF/, "");
  const lines = clean.split(/\r?\n/);
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop();
  if (lines.length === 0) return [{ sheetName: "csv", headers: [], rows: [] }];
  const delimiter = detectDelimiter(lines[0]);
  const headers = splitDelimitedLine(lines[0], delimiter).map(normalizeHeader);
  const rows = lines.slice(1).map((line) => {
    const cells = splitDelimitedLine(line, delimiter);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
  });
  return [{ sheetName: "csv", headers, rows }];
}

function detectDelimiter(headerLine: string): string {
  const options = [",", ";", "\t"];
  return options
    .map((delimiter) => ({
      delimiter,
      count: (headerLine.match(new RegExp(delimiter === "\t" ? "\\t" : delimiter, "g")) ?? [])
        .length,
    }))
    .sort((a, b) => b.count - a.count)[0].delimiter;
}

function splitDelimitedLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
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
      out.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  out.push(current.trim());
  return out;
}

function parseWorkbook(file: CnCatalogImportFile) {
  if (file.sourceType === "csv" || typeof file.data === "string") {
    return parseCsv(
      typeof file.data === "string" ? file.data : new TextDecoder().decode(file.data),
    );
  }

  const workbook = XLSX.read(file.data, { type: "array", cellDates: true, raw: true });
  return workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: true,
      defval: "",
      blankrows: false,
    });
    const firstNonEmptyIndex = matrix.findIndex((row) =>
      row.some((cell) => String(cell ?? "").trim() !== ""),
    );
    if (firstNonEmptyIndex < 0) return { sheetName, headers: [], rows: [] };
    const headers = matrix[firstNonEmptyIndex].map(normalizeHeader);
    const rows = matrix
      .slice(firstNonEmptyIndex + 1)
      .map((row) =>
        Object.fromEntries(headers.map((header, index) => [header, normalizeCell(row[index])])),
      );
    return { sheetName, headers, rows };
  });
}

function modelFromRow(row: Record<string, unknown>): string | null {
  const key = Object.keys(row).find((column) => /modelo|model/i.test(column));
  const value = key ? row[key] : null;
  return value == null || value === "" ? null : String(value).trim();
}

export function generateModelFingerprint(row: Record<string, unknown>): string {
  const pick = (pattern: RegExp) => {
    const key = Object.keys(row).find((column) => pattern.test(column));
    return key
      ? String(row[key] ?? "")
          .trim()
          .toUpperCase()
      : "";
  };
  return [
    pick(/modelo|model/i),
    pick(/\bhp\b|pot/i),
    pick(/evap|evaporador/i),
    pick(/cond|condensador/i),
  ]
    .join("|")
    .replace(/\s+/g, " ");
}

export async function importCnCatalog(file: CnCatalogImportFile): Promise<CnCatalogImportResult> {
  const parsedSheets = parseWorkbook(file);
  const batchIds: string[] = [];
  const errors: string[] = [];
  let totalRows = 0;
  let totalColumns = 0;

  for (const sheet of parsedSheets) {
    const { data: batch, error: batchError } = await cnDb()
      .from("cn_catalog_import_batches")
      .insert({
        file_name: file.fileName,
        source_type: file.sourceType,
        sheet_name: sheet.sheetName,
        total_rows: sheet.rows.length,
        total_columns: sheet.headers.length,
        imported_rows: 0,
        status: "pending",
        errors_json: [],
      } as never)
      .select("id")
      .single();
    const batchRow = batch as { id: string } | null;
    if (batchError || !batchRow) {
      errors.push(
        `${file.fileName}/${sheet.sheetName}: ${batchError?.message ?? "batch not created"}`,
      );
      continue;
    }
    batchIds.push(batchRow.id);
    totalRows += sheet.rows.length;
    totalColumns += sheet.headers.length;

    const auditRows = sheet.headers.map((columnName) => {
      const mapping = getColumnMapping(columnName);
      return {
        batch_id: batchRow.id,
        column_name: columnName,
        source_type: file.sourceType,
        detected_type: detectValueType(sheet.rows.map((row) => row[columnName])),
        mapped: mapping.mapped,
        target_table: mapping.targetTable,
        notes: mapping.notes,
      };
    });
    if (auditRows.length > 0) {
      const { error } = await cnDb().from("cn_catalog_columns_audit").insert(auditRows);
      if (error) errors.push(`${file.fileName}/${sheet.sheetName} audit: ${error.message}`);
    }

    for (let index = 0; index < sheet.rows.length; index += 500) {
      const slice = sheet.rows.slice(index, index + 500);
      const payload = slice.map((row, offset) => ({
        batch_id: batchRow.id,
        source_type: file.sourceType,
        row_number: index + offset + 1,
        modelo: modelFromRow(row),
        raw_json: row,
      }));
      const { error } = await cnDb().from("cn_catalog_raw_rows").insert(payload);
      if (error) errors.push(`${file.fileName}/${sheet.sheetName} rows ${index}: ${error.message}`);
    }

    const { error: updateError } = await cnDb()
      .from("cn_catalog_import_batches")
      .update({
        imported_rows: sheet.rows.length,
        status: errors.length > 0 ? "failed" : "imported",
        errors_json: errors,
      } as never)
      .eq("id", batchRow.id);
    if (updateError)
      errors.push(`${file.fileName}/${sheet.sheetName} batch update: ${updateError.message}`);
  }

  return { batchIds, totalRows, totalColumns, errors };
}

function valueByPatterns(row: Record<string, unknown>, patterns: RegExp[]): unknown {
  const key = Object.keys(row).find((column) => patterns.some((pattern) => pattern.test(column)));
  return key ? row[key] : null;
}

function stringValue(value: unknown): string | null {
  if (value == null || value === "") return null;
  return String(value).trim();
}

function numberValue(value: unknown): number | null {
  if (value == null || value === "") return null;
  const normalized = typeof value === "string" ? value.replace(",", ".") : value;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function getRawValue(raw: Record<string, unknown>, aliases: readonly string[]): unknown {
  const byKey = new Map(Object.keys(raw).map((key) => [normalizeKey(key), key]));
  for (const alias of aliases) {
    const key = byKey.get(normalizeKey(alias));
    if (key && isMeaningful(raw[key])) return raw[key];
  }
  return null;
}

const ALIASES = {
  model: ["MODELO", "MODELO_UNICO", "MODELO_CATALOGO_ORIGINAL", "modelo", "model"],
  baseModel: ["MODELO_BASE_REFERENCIA", "MODELO_CATALOGO_ORIGINAL"],
  line: ["LINHA"],
  hp: ['DESIGNAÇÃO COMERCIAL EM "HP"', "HP", "DESIGNACAO COMERCIAL EM HP"],
  cabinet: ["GABINETE"],
  cabinetType: ["TIPO DE GABINETE"],
  refrigerant: ["REFRIGERANTE", "refrigerante", "refrigerant"],
  defrost: ["TIPO DE DEGELO"],
  evapGeometry: ["Geometria evaporador", "GEOMETRIA EVAPORADOR"],
  evapModel: ["MODELO EVAPORADOR (Circuito pincipal)", "MODELO EVAPORADOR", "EVAPORADOR"],
  evapTubeDiameter: ["Ø Tubo_EVAP [mm]", "TUBO_EVAP_MM", "DIAMETRO TUBO EVAP"],
  evapTubeThickness: ["ESP. Tubo_EVAP [mm]", "ESP TUBO EVAP"],
  evapTubesPerRow: ["MODELO EVAPORADOR (Circuito pincipal)"],
  evapRows: ["MODELO EVAPORADOR (Circuito pincipal)"],
  evapCircuits: ["MODELO EVAPORADOR (Circuito pincipal)"],
  evapFinSpacing: ["MODELO EVAPORADOR (Circuito pincipal)"],
  evapAirflow: ["VAZÃO VENTILADOR EVAPORADOR (m³/h)", "VAZAO VENTILADOR EVAPORADOR"],
  evapVolume: ["VOLUME INTERNO EVAPORADOR [dm³ = L]", "VOLUME INTERNO EVAPORADOR"],
  evapArea: [
    "ÁREA DA SUPERFICIE DE TROCA EVAPORADOR [m²]",
    "AREA DA SUPERFICIE DE TROCA EVAPORADOR",
  ],
  condGeometry: ["GEOMETRIA CONDENSADOR", "Geometria condensador"],
  condModel: ["MODELO CONDENSADOR", "CONDENSADOR"],
  condTubeDiameter: ["Ø Tubo_cond [mm]", "TUBO_COND_MM", "DIAMETRO TUBO COND"],
  condTubeThickness: ["ESP. Tubo_cond [mm]", "ESP TUBO COND"],
  condTubesPerRow: ["MODELO CONDENSADOR"],
  condRows: ["MODELO CONDENSADOR"],
  condCircuits: ["MODELO CONDENSADOR"],
  condFinSpacing: ["MODELO CONDENSADOR"],
  condAirflow: ["VAZÃO VENTILADOR CONDENSADOR (m³/h)", "VAZAO VENTILADOR CONDENSADOR"],
  condVolume: ["VOLUME INTERNO CONDENSADOR [dm³ = L]", "VOLUME INTERNO CONDENSADOR"],
  compressor: ["COMPRESSOR", "COMPRESSOR_CODIGO"],
  copeland: ["COMPRESSOR", "COMPRESSOR_CODIGO"],
  bitzer: ["COMPRESSOR", "COMPRESSOR_CODIGO"],
  danfoss: ["COMPRESSOR", "COMPRESSOR_CODIGO"],
  dorin: ["COMPRESSOR", "COMPRESSOR_CODIGO"],
  manufacturer: ["FABRICANTE", "FABRICANTE_ORIGEM"],
  secondaryCompressor: ["COMPRESSOR SECUNDÁRIO", "COMPRESSOR_SECUNDARIO"],
  tevap: ["TEMPERATURA DE EVAPORAÇÃO  (°C)", "TEMPERATURA DE EVAPORAÇÃO (°C)", "TEVAP"],
  tcond: ["TEMPERATURA DE CONDENSAÇÃO  (°C)", "TEMPERATURA DE CONDENSAÇÃO (°C)", "TCOND"],
  capacityEvap: [
    "CAPACIDADE FRIGORÍFICA (Kcal/h) [Capacidade do evaporador]",
    "CAPACIDADE FRIGORIFICA [CAPACIDADE DO EVAPORADOR]",
  ],
  capacityCond: [
    "CALOR REJEITADO (Kcal/h) [Capacidade do condensador]",
    "CALOR REJEITADO [CAPACIDADE DO CONDENSADOR]",
  ],
  power: [
    "POTÊNCIA ELÉTRICA REQUERIDA TOTAL [CIRCUITO COMPLETO] (kW)",
    "POTÊNCIA ELÉTRICA REQUERIDA TOTAL (kW)",
  ],
  cop: ["COP (kW/kW)", "COP global (kW/kW)"],
  airflow: ["VAZÃO VENTILADOR EVAPORADOR (m³/h)", "VAZÃO VENTILADOR CONDENSADOR (m³/h)"],
} as const;

function parseCoilModelField(value: unknown): {
  rows: number | null;
  tubesPerRow: number | null;
  circuits: number | null;
  finSpacing: number | null;
  lengthMm: number | null;
} {
  const text = stringValue(value) ?? "";
  const first = text.match(/(\d+(?:[,.]\d+)?)\s*x\s*(\d+(?:[,.]\d+)?)/i);
  const circuits = text.match(/(\d+(?:[,.]\d+)?)\s*CIRCUITOS?/i);
  const spacing = text.match(/ESPA[ÇC]AMENTO\s*(\d+(?:[,.]\d+)?)/i);
  const length = text.match(/-\s*(\d+(?:[,.]\d+)?)\s*mm/i);
  return {
    rows: first ? numberValue(first[1]) : null,
    tubesPerRow: first ? numberValue(first[2]) : null,
    circuits: circuits ? numberValue(circuits[1]) : null,
    finSpacing: spacing ? numberValue(spacing[1]) : null,
    lengthMm: length ? numberValue(length[1]) : null,
  };
}

function kcalhToW(value: unknown): number | null {
  const kcalh = numberValue(value);
  return kcalh == null ? null : kcalh * 1.163;
}

function parseGeometryCount(value: unknown, position: "rows" | "tubesPerRow"): number | null {
  const parsed = parseCoilModelField(value);
  return position === "rows" ? parsed.rows : parsed.tubesPerRow;
}

function parseCircuits(value: unknown): number | null {
  return parseCoilModelField(value).circuits;
}

function parseFinSpacing(value: unknown): number | null {
  return parseCoilModelField(value).finSpacing;
}

function compressorForManufacturer(
  raw: Record<string, unknown>,
  manufacturer: string,
): string | null {
  const detected = stringValue(getRawValue(raw, ALIASES.manufacturer))?.toUpperCase() ?? "";
  const compressor = stringValue(getRawValue(raw, ALIASES.compressor));
  return detected.includes(manufacturer.toUpperCase()) ? compressor : null;
}

export async function mergeCnCatalogs() {
  const { data: rawRows, error } = await cnDb()
    .from("cn_catalog_raw_rows")
    .select("id, source_type, modelo, raw_json, batch_id")
    .order("created_at", { ascending: true });
  if (error) throw error;

  const groups = new Map<
    string,
    Array<{
      id: string;
      source_type: CnCatalogSourceType;
      modelo: string | null;
      raw_json: Record<string, unknown>;
    }>
  >();
  for (const row of (rawRows ?? []) as Array<{
    id: string;
    source_type: CnCatalogSourceType;
    modelo: string | null;
    raw_json: Record<string, unknown>;
  }>) {
    const raw = row.raw_json as Record<string, unknown>;
    const fingerprint = generateModelFingerprint(raw);
    const key = fingerprint || row.modelo || row.id;
    const list = groups.get(key) ?? [];
    list.push({
      id: row.id,
      source_type: row.source_type as CnCatalogSourceType,
      modelo: row.modelo,
      raw_json: raw,
    });
    groups.set(key, list);
  }

  await Promise.all([
    cnDb()
      .from("cn_equipment_performance_master")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000"),
    cnDb()
      .from("cn_equipment_compressor_master")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000"),
    cnDb()
      .from("cn_equipment_evaporator_master")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000"),
    cnDb()
      .from("cn_equipment_condenser_master")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000"),
    cnDb().from("cn_equipment_master").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
  ]);

  const conflicts: Array<{ fingerprint: string; field: string; values: unknown[] }> = [];
  let inserted = 0;

  for (const [fingerprint, rows] of groups) {
    const sorted = rows.sort(
      (a, b) => SOURCE_PRIORITY[a.source_type] - SOURCE_PRIORITY[b.source_type],
    );
    const chosen = sorted[0].raw_json;
    const model =
      stringValue(valueByPatterns(chosen, [/modelo|model/i])) ?? sorted[0].modelo ?? fingerprint;
    const sourceTypes = Array.from(new Set(sorted.map((row) => row.source_type)));

    for (const fieldPattern of [/refrigerante|refrigerant/i, /\bhp\b|pot/i]) {
      const values = Array.from(
        new Set(
          sorted.map((row) => valueByPatterns(row.raw_json, [fieldPattern])).filter(isMeaningful),
        ),
      );
      if (values.length > 1) conflicts.push({ fingerprint, field: String(fieldPattern), values });
    }

    const { data: masterData, error: masterError } = await cnDb()
      .from("cn_equipment_master")
      .insert({
        modelo: model,
        linha: stringValue(valueByPatterns(chosen, [/linha|family/i])),
        hp: numberValue(valueByPatterns(chosen, [/\bhp\b/i])),
        gabinete: stringValue(valueByPatterns(chosen, [/gabinete/i])),
        tipo_gabinete: stringValue(valueByPatterns(chosen, [/tipo.*gabinete/i])),
        refrigerante: stringValue(valueByPatterns(chosen, [/refrigerante|refrigerant/i])),
        tipo_degelo: stringValue(valueByPatterns(chosen, [/degelo|defrost/i])),
        origem_dados: sourceTypes.length > 1 ? "combinado" : sorted[0].source_type,
        confianca: sourceTypes.includes("official")
          ? 0.95
          : sourceTypes.includes("480")
            ? 0.85
            : 0.75,
        raw_sources_json: {
          fingerprint,
          sources: sorted.map((row) => ({
            rawRowId: row.id,
            sourceType: row.source_type,
            raw: row.raw_json,
          })),
        },
      } as never)
      .select("id")
      .single();
    const master = masterData as { id: string } | null;
    if (masterError || !master)
      throw new Error(masterError?.message ?? "cn_equipment_master insert failed");

    const rawPayload = { fingerprint, rows: sorted.map((row) => row.raw_json) };
    await cnDb()
      .from("cn_equipment_evaporator_master")
      .insert({
        model_id: master.id,
        geometry: stringValue(getRawValue(chosen, ALIASES.evapGeometry)),
        tube_diameter: numberValue(getRawValue(chosen, ALIASES.evapTubeDiameter)),
        tube_thickness: numberValue(getRawValue(chosen, ALIASES.evapTubeThickness)),
        tubes_per_row: parseGeometryCount(getRawValue(chosen, ALIASES.evapModel), "tubesPerRow"),
        rows: parseGeometryCount(getRawValue(chosen, ALIASES.evapModel), "rows"),
        circuits: parseCircuits(getRawValue(chosen, ALIASES.evapModel)),
        fin_spacing: parseFinSpacing(getRawValue(chosen, ALIASES.evapModel)),
        airflow: numberValue(getRawValue(chosen, ALIASES.evapAirflow)),
        internal_volume: numberValue(getRawValue(chosen, ALIASES.evapVolume)),
        exchange_area: numberValue(getRawValue(chosen, ALIASES.evapArea)),
        source_priority: sorted[0].source_type,
        raw_json: rawPayload,
      } as never);
    await cnDb()
      .from("cn_equipment_condenser_master")
      .insert({
        model_id: master.id,
        geometry: stringValue(getRawValue(chosen, ALIASES.condGeometry)),
        tube_diameter: numberValue(getRawValue(chosen, ALIASES.condTubeDiameter)),
        tube_thickness: numberValue(getRawValue(chosen, ALIASES.condTubeThickness)),
        tubes_per_row: parseGeometryCount(getRawValue(chosen, ALIASES.condModel), "tubesPerRow"),
        rows: parseGeometryCount(getRawValue(chosen, ALIASES.condModel), "rows"),
        circuits: parseCircuits(getRawValue(chosen, ALIASES.condModel)),
        fin_spacing: parseFinSpacing(getRawValue(chosen, ALIASES.condModel)),
        airflow: numberValue(getRawValue(chosen, ALIASES.condAirflow)),
        internal_volume: numberValue(getRawValue(chosen, ALIASES.condVolume)),
        source_priority: sorted[0].source_type,
        raw_json: rawPayload,
      } as never);
    await cnDb()
      .from("cn_equipment_compressor_master")
      .insert({
        model_id: master.id,
        copeland: compressorForManufacturer(chosen, "COPELAND"),
        bitzer: compressorForManufacturer(chosen, "BITZER"),
        danfoss:
          compressorForManufacturer(chosen, "DANFOSS") ?? compressorForManufacturer(chosen, "BOCK"),
        dorin: compressorForManufacturer(chosen, "DORIN"),
        secondary: stringValue(
          getRawValue(chosen, ["COMPRESSOR SECUNDÁRIO", "COMPRESSOR_CODIGO_SECUNDARIO"]),
        ),
        raw_json: rawPayload,
      } as never);

    const performancePoint = {
      model_id: master.id,
      point_index: 0,
      tevap: numberValue(
        getRawValue(chosen, ["TEMPERATURA DE EVAPORAÇÃO  (°C)", "TEMPERATURA DE EVAPORAÇÃO"]),
      ),
      tcond: numberValue(
        getRawValue(chosen, ["TEMPERATURA DE CONDENSAÇÃO  (°C)", "TEMPERATURA DE CONDENSAÇÃO"]),
      ),
      capacity_evap: kcalhToW(
        getRawValue(chosen, ["CAPACIDADE FRIGORÍFICA (Kcal/h) [Capacidade do evaporador]"]),
      ),
      capacity_cond: kcalhToW(
        getRawValue(chosen, ["CALOR REJEITADO (Kcal/h) [Capacidade do condensador]"]),
      ),
      power: numberValue(
        getRawValue(chosen, [
          "POTÊNCIA ELÉTRICA REQUERIDA TOTAL [CIRCUITO COMPLETO] (kW)",
          "POTÊNCIA ELÉTRICA REQUERIDA TOTAL (kW)",
        ]),
      ),
      cop: numberValue(getRawValue(chosen, ["COP global (kW/kW)", "COP (kW/kW)"])),
      airflow: numberValue(getRawValue(chosen, ["VAZÃO VENTILADOR EVAPORADOR (m³/h)"])),
      source: sorted[0].source_type,
      raw_json: rawPayload,
    };
    if (
      performancePoint.tevap != null ||
      performancePoint.tcond != null ||
      performancePoint.capacity_evap != null ||
      performancePoint.capacity_cond != null
    ) {
      await cnDb()
        .from("cn_equipment_performance_master")
        .insert(performancePoint as never);
    }

    inserted += 1;
  }

  return {
    uniqueModels: inserted,
    duplicateGroups: Array.from(groups.values()).filter((rows) => rows.length > 1).length,
    conflicts,
  };
}

function isMeaningful(value: unknown): boolean {
  return value !== null && value !== undefined && value !== "";
}

export async function validateCatalogImport(): Promise<CatalogValidationReport> {
  const [
    { count: totalRowsImported },
    { data: columns },
    { data: master },
    { data: evap },
    { data: cond },
    { data: comp },
    { data: perf },
  ] = await Promise.all([
    cnDb().from("cn_catalog_raw_rows").select("id", { count: "exact", head: true }),
    cnDb().from("cn_catalog_columns_audit").select("column_name, source_type, mapped"),
    cnDb().from("cn_equipment_master").select("id, modelo"),
    cnDb().from("cn_equipment_evaporator_master").select("model_id"),
    cnDb().from("cn_equipment_condenser_master").select("model_id"),
    cnDb()
      .from("cn_equipment_compressor_master")
      .select("model_id, copeland, bitzer, danfoss, dorin, secondary"),
    cnDb().from("cn_equipment_performance_master").select("model_id"),
  ]);
  const evapRows = (evap ?? []) as Array<{ model_id: string }>;
  const condRows = (cond ?? []) as Array<{ model_id: string }>;
  const perfRows = (perf ?? []) as Array<{ model_id: string }>;
  const columnRows = (columns ?? []) as Array<{
    column_name: string;
    source_type: string;
    mapped: boolean;
  }>;
  const compRows = (comp ?? []) as Array<{
    model_id: string;
    copeland: string | null;
    bitzer: string | null;
    danfoss: string | null;
    dorin: string | null;
    secondary: string | null;
  }>;
  const models = (master ?? []) as Array<{ id: string; modelo: string | null }>;
  const evapSet = new Set(evapRows.map((row) => row.model_id));
  const condSet = new Set(condRows.map((row) => row.model_id));
  const perfSet = new Set(perfRows.map((row) => row.model_id));
  return {
    totalRowsImported: totalRowsImported ?? 0,
    totalColumnsDetected: columnRows.length,
    unmappedColumns: columnRows
      .filter((column) => !column.mapped)
      .map((column) => ({ columnName: column.column_name, sourceType: column.source_type })),
    modelsWithoutEvaporator: models
      .filter((model) => !evapSet.has(model.id))
      .map((model) => model.modelo ?? model.id),
    modelsWithoutCondenser: models
      .filter((model) => !condSet.has(model.id))
      .map((model) => model.modelo ?? model.id),
    modelsWithoutCompressor: models
      .filter((model) => {
        const row = compRows.find((candidate) => candidate.model_id === model.id);
        return (
          !row ||
          ![row.copeland, row.bitzer, row.danfoss, row.dorin, row.secondary].some(isMeaningful)
        );
      })
      .map((model) => model.modelo ?? model.id),
    modelsWithoutCurve: models
      .filter((model) => !perfSet.has(model.id))
      .map((model) => model.modelo ?? model.id),
    emptyCriticalFields: models.flatMap((model) => {
      const empty: Array<{ model: string; field: string }> = [];
      if (!model.modelo) empty.push({ model: model.id, field: "modelo" });
      return empty;
    }),
  };
}
