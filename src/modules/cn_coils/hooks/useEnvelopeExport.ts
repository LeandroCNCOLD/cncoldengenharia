/**
 * Feature F — Exportação CSV/Excel dos Envelopes
 * Exporta envelopes de evaporador e compressor para CSV (pt-BR) e Excel (SheetJS).
 */

import * as XLSX from "xlsx";
import type { CoilEnvelope } from "../store/useCoilEnvelopeStore";
import type { CompressorEnvelopePoint } from "./useCompressorEnvelopeGenerator";

// ── Utilitários ───────────────────────────────────────────────────────────────

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function triggerXlsxDownload(wb: XLSX.WorkBook, filename: string): void {
  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  triggerDownload(blob, filename);
}

// ── CSV com BOM UTF-8 ─────────────────────────────────────────────────────────

/**
 * Exporta envelope de evaporador para CSV com BOM (compatível com Excel pt-BR).
 * Colunas: Te_C, Q_kcalh, Q_kW, W_kW
 */
export function exportEnvelopeToCsv(envelope: CoilEnvelope, filename: string): void {
  const BOM = "\uFEFF";
  const header = "Te_C;Q_kcalh;Q_kW;W_kW\n";
  const rows = envelope.envelope
    .map((p) => {
      const Q_kW = (p.Q_kcalh / 0.86).toFixed(3);
      const W_kW = p.W_kW !== undefined ? p.W_kW.toFixed(3) : "";
      return `${p.Te};${p.Q_kcalh.toFixed(2)};${Q_kW};${W_kW}`;
    })
    .join("\n");

  const csv = BOM + header + rows;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, filename);
}

// ── Excel — Envelope de Evaporador ───────────────────────────────────────────

/** Constrói o workbook do envelope de evaporador (testável sem I/O). */
export function buildEvaporatorWorkbook(envelope: CoilEnvelope): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  const rows = envelope.envelope.map((p) => ({
    Te_C: p.Te,
    Q_kcalh: p.Q_kcalh,
    Q_kW: parseFloat((p.Q_kcalh / 0.86).toFixed(3)),
    W_kW: p.W_kW ?? "",
    COP: p.COP ?? "",
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Envelope");

  const nomCond = envelope.nominalConditions;
  const maxQ = Math.max(...envelope.envelope.map((p) => p.Q_kcalh));
  const maxCOP = Math.max(...envelope.envelope.map((p) => p.COP ?? 0));
  const summaryRows = [
    { Parâmetro: "Refrigerante", Valor: envelope.refrigerant },
    { Parâmetro: "Te nominal (°C)", Valor: nomCond.Te },
    { Parâmetro: "Tc nominal (°C)", Valor: nomCond.Tc },
    { Parâmetro: "T_ar (°C)", Valor: nomCond.T_ar },
    { Parâmetro: "UR (%)", Valor: (nomCond.UR * 100).toFixed(0) },
    { Parâmetro: "Q máx (kcal/h)", Valor: maxQ.toFixed(0) },
    { Parâmetro: "COP máx", Valor: maxCOP.toFixed(2) },
  ];
  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, "Resumo");

  return wb;
}

/**
 * Exporta envelope de evaporador para Excel (.xlsx).
 */
export function exportEnvelopeToExcel(envelope: CoilEnvelope, filename: string): void {
  triggerXlsxDownload(buildEvaporatorWorkbook(envelope), filename);
}

// ── Excel — Envelope de Compressor ───────────────────────────────────────────

/** Constrói o workbook do envelope de compressor (testável sem I/O). */
export function buildCompressorWorkbook(envelope: CompressorEnvelopePoint[]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  const tcValues = [...new Set(envelope.map((p) => p.Tc_C))].sort((a, b) => a - b);
  for (const tc of tcValues) {
    const points = envelope.filter((p) => p.Tc_C === tc);
    const rows = points.map((p) => ({
      Te_C: p.Te_C,
      Q_kW: parseFloat((p.Q_W / 1000).toFixed(3)),
      W_kW: parseFloat((p.W_W / 1000).toFixed(3)),
      COP: parseFloat(p.COP.toFixed(3)),
      T_descarga_C: parseFloat(p.dischargeTemp_C.toFixed(1)),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, `Tc=${tc}C`);
  }

  const allQ = envelope.map((p) => p.Q_W / 1000);
  const allW = envelope.map((p) => p.W_W / 1000);
  const allCOP = envelope.map((p) => p.COP);
  const summaryRows = [
    { Parâmetro: "Q máx (kW)", Valor: Math.max(...allQ).toFixed(3) },
    { Parâmetro: "Q mín (kW)", Valor: Math.min(...allQ).toFixed(3) },
    { Parâmetro: "W máx (kW)", Valor: Math.max(...allW).toFixed(3) },
    { Parâmetro: "W mín (kW)", Valor: Math.min(...allW).toFixed(3) },
    { Parâmetro: "COP máx", Valor: Math.max(...allCOP).toFixed(3) },
    { Parâmetro: "COP mín", Valor: Math.min(...allCOP).toFixed(3) },
    { Parâmetro: "Pontos totais", Valor: envelope.length },
  ];
  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, "Resumo");

  return wb;
}

/**
 * Exporta envelope de compressor para Excel (.xlsx).
 */
export function exportCompressorEnvelopeToExcel(
  envelope: CompressorEnvelopePoint[],
  filename: string,
): void {
  triggerXlsxDownload(buildCompressorWorkbook(envelope), filename);
}
