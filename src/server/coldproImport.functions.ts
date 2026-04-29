import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import JSZip from "jszip";
import * as XLSX from "xlsx";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Bancos/sub-pastas que devemos PULAR (backups, GUI, histórico, duplicados).
const SKIP_DATABASES = new Set([
  "06_C6Gui_Interface",
  "07_AggiornaWarnings",
  "09_C6Mru_HistoricoRecente",
  "10_C6Mru_Clean",
  "11_C6Warnings_Avisos",
  "12_C8Fluids_Agg",
  "13_C8Fluids_Agg_old",
  "15_HwList",
  "19_BackupDB_Coils6",
  "20_BackupDB_C6Gui",
  "21_Fluids_Coils6", // duplicata do 01
  "22_C6Fluids_C8",
]);

// Prefixos de aba do XLSX que devemos pular (backup/duplicata).
const SKIP_XLSX_PREFIXES = ["CoeffCorr_Backup", "Comp_Capacity_Backup", "Comp_Power_Backup"];

const BATCH_INSERT_ROWS = 500;

const InputSchema = z.object({
  batchId: z.string().uuid(),
  zipPath: z.string().min(1).optional(),
  xlsxPath: z.string().min(1).optional(),
});

type Summary = {
  filesIngested: number;
  rowsIngested: number;
  filesSkipped: number;
  errors: string[];
};

function detectDelimiter(headerLine: string): string {
  const semis = (headerLine.match(/;/g) || []).length;
  const commas = (headerLine.match(/,/g) || []).length;
  const tabs = (headerLine.match(/\t/g) || []).length;
  if (tabs >= semis && tabs >= commas) return "\t";
  if (semis >= commas) return ";";
  return ",";
}

function splitCsvLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (ch === delim && !quoted) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const clean = text.replace(/^\uFEFF/, "");
  const lines = clean.split(/\r?\n/);
  // Remove trailing empties
  while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
  if (lines.length === 0) return { headers: [], rows: [] };
  const delim = detectDelimiter(lines[0]);
  const headers = splitCsvLine(lines[0], delim).map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "") continue;
    const cells = splitCsvLine(lines[i], delim);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h || `col_${idx}`] = (cells[idx] ?? "").trim();
    });
    rows.push(row);
  }
  return { headers, rows };
}

async function downloadFromStorage(path: string): Promise<ArrayBuffer> {
  const { data, error } = await supabaseAdmin.storage.from("coldpro-imports").download(path);
  if (error || !data) throw new Error(`Storage download falhou (${path}): ${error?.message ?? "no data"}`);
  return await data.arrayBuffer();
}

async function ingestFile(
  batchId: string,
  meta: {
    sourceDatabase: string;
    sourceTable: string;
    sourcePath: string;
    fileKind: "csv" | "xlsx_sheet";
    sheetName: string | null;
    headers: string[];
    rows: Record<string, unknown>[];
  },
  summary: Summary,
): Promise<void> {
  // upsert source_files (unique on database+table+sheet)
  const { data: fileRow, error: fileErr } = await supabaseAdmin
    .from("unilab_source_files")
    .upsert(
      {
        import_batch_id: batchId,
        source_database: meta.sourceDatabase,
        source_table: meta.sourceTable,
        source_path: meta.sourcePath,
        file_kind: meta.fileKind,
        sheet_name: meta.sheetName,
        column_count: meta.headers.length,
        row_count: meta.rows.length,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        headers_json: meta.headers as any,
        status: "imported",
      },
      { onConflict: "source_database,source_table,sheet_name" },
    )
    .select("id")
    .single();

  if (fileErr || !fileRow) {
    summary.errors.push(`${meta.sourceDatabase}/${meta.sourceTable}: ${fileErr?.message ?? "no file row"}`);
    return;
  }

  // limpar linhas anteriores deste arquivo (re-import idempotente)
  await supabaseAdmin.from("unilab_source_rows").delete().eq("source_file_id", fileRow.id);

  if (meta.rows.length === 0) {
    summary.filesIngested++;
    return;
  }

  // Inserir em lotes
  for (let i = 0; i < meta.rows.length; i += BATCH_INSERT_ROWS) {
    const slice = meta.rows.slice(i, i + BATCH_INSERT_ROWS);
    const payload = slice.map((row, idx) => ({
      source_file_id: fileRow.id,
      row_index: i + idx,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      raw_json: row as any,
    }));
    const { error: rowErr } = await supabaseAdmin.from("unilab_source_rows").insert(payload);
    if (rowErr) {
      summary.errors.push(`${meta.sourceTable} rows ${i}: ${rowErr.message}`);
      return;
    }
  }

  summary.filesIngested++;
  summary.rowsIngested += meta.rows.length;
}

async function importZip(batchId: string, zipPath: string, summary: Summary): Promise<void> {
  const buf = await downloadFromStorage(zipPath);
  const zip = await JSZip.loadAsync(buf);

  const csvEntries = Object.values(zip.files).filter(
    (f) => !f.dir && f.name.toLowerCase().endsWith(".csv"),
  );

  for (const entry of csvEntries) {
    // Caminho típico: UNILAB_EXPORT/01_Coils6_Principal/Tbl_X.csv
    const parts = entry.name.split("/").filter(Boolean);
    if (parts.length < 2) continue;
    const fileName = parts[parts.length - 1];
    const databaseFolder = parts[parts.length - 2];

    if (SKIP_DATABASES.has(databaseFolder)) {
      summary.filesSkipped++;
      continue;
    }
    // Pular o índice mestre — ele só lista arquivos
    if (fileName === "00_INDICE_MESTRE.csv") {
      summary.filesSkipped++;
      continue;
    }

    const text = await entry.async("string");
    const { headers, rows } = parseCsv(text);
    const tableName = fileName.replace(/\.csv$/i, "");

    await ingestFile(
      batchId,
      {
        sourceDatabase: databaseFolder,
        sourceTable: tableName,
        sourcePath: entry.name,
        fileKind: "csv",
        sheetName: null,
        headers,
        rows,
      },
      summary,
    );
  }
}

async function importXlsx(batchId: string, xlsxPath: string, summary: Summary): Promise<void> {
  const buf = await downloadFromStorage(xlsxPath);
  const wb = XLSX.read(buf, { type: "array" });

  for (const sheetName of wb.SheetNames) {
    if (SKIP_XLSX_PREFIXES.some((p) => sheetName.startsWith(p))) {
      summary.filesSkipped++;
      continue;
    }
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;

    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
      defval: "",
      raw: true,
    });
    const headers = json.length > 0 ? Object.keys(json[0]) : [];

    await ingestFile(
      batchId,
      {
        sourceDatabase: "EQUACOES_POLINOMIAIS",
        sourceTable: sheetName,
        sourcePath: xlsxPath,
        fileKind: "xlsx_sheet",
        sheetName,
        headers,
        rows: json,
      },
      summary,
    );
  }
}

export const importColdproPackage = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    if (!data.zipPath && !data.xlsxPath) {
      throw new Error("Informe ao menos um arquivo (zipPath ou xlsxPath).");
    }

    const summary: Summary = { filesIngested: 0, rowsIngested: 0, filesSkipped: 0, errors: [] };

    // Marcar batch como em processamento
    await supabaseAdmin
      .from("unilab_import_batches_v2")
      .update({ status: "processing", started_at: new Date().toISOString() })
      .eq("id", data.batchId);

    try {
      if (data.zipPath) await importZip(data.batchId, data.zipPath, summary);
      if (data.xlsxPath) await importXlsx(data.batchId, data.xlsxPath, summary);

      const finalStatus = summary.errors.length > 0 ? "completed_with_errors" : "completed";
      await supabaseAdmin
        .from("unilab_import_batches_v2")
        .update({
          status: finalStatus,
          finished_at: new Date().toISOString(),
          total_tables: summary.filesIngested,
          total_rows: summary.rowsIngested,
          summary_json: {
            filesIngested: summary.filesIngested,
            rowsIngested: summary.rowsIngested,
            filesSkipped: summary.filesSkipped,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          errors_json: summary.errors as any,
        })
        .eq("id", data.batchId);

      return { ok: true, ...summary };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await supabaseAdmin
        .from("unilab_import_batches_v2")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          errors_json: [...summary.errors, msg] as any,
          summary_json: {
            filesIngested: summary.filesIngested,
            rowsIngested: summary.rowsIngested,
            filesSkipped: summary.filesSkipped,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any,
        })
        .eq("id", data.batchId);
      throw new Error(msg);
    }
  });
