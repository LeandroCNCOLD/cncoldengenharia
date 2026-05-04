/**
 * drawingExport.ts
 * ----------------
 * Funções de exportação do desenho técnico:
 *  - exportToDXF: gera arquivo DXF importável no AutoCAD/SolidWorks
 *  - exportToPDF: gera prancha técnica A3 com vistas e tabela de dados
 */

import DxfWriter from "dxf-writer";
import type { CycleResult } from "../engines/cycle/cycleTypes";

export interface DrawingExportInputs {
  heightMm: number;
  widthMm: number;
  depthMm: number;
  rows: number;
  tubesPerRow: number;
  tubeOuterDiamMm: number;
  finPitchMm: number;
  finThicknessMm: number;
  circuits: number;
  staggered?: boolean;
  refrigerantId: string;
  projectName?: string;
}

// ── DXF Export ────────────────────────────────────────────────────────────────

export function exportToDXF(inputs: DrawingExportInputs, cycleResult?: CycleResult | null): void {
  const {
    heightMm: H, widthMm: W, depthMm: D,
    rows, tubesPerRow, tubeOuterDiamMm,
    finPitchMm, circuits, staggered = true,
    refrigerantId, projectName = "Evaporador DX",
  } = inputs;

  const d = new DxfWriter();

  // Layers
  d.addLayer("OUTLINE", DxfWriter.ACI.WHITE, "CONTINUOUS");
  d.addLayer("TUBES", DxfWriter.ACI.CYAN, "CONTINUOUS");
  d.addLayer("FINS", DxfWriter.ACI.BLUE, "CONTINUOUS");
  d.addLayer("DIMENSIONS", DxfWriter.ACI.RED, "CONTINUOUS");
  d.addLayer("CIRCUITS", DxfWriter.ACI.MAGENTA, "DASHED");
  d.addLayer("TEXT", DxfWriter.ACI.WHITE, "CONTINUOUS");

  // ── VISTA FRONTAL (face do ar) ─────────────────────────────────────────────
  // Origem: (0, 0) — canto inferior esquerdo
  d.setActiveLayer("OUTLINE");
  d.drawRect(0, 0, W, H);

  // Aletas (linhas verticais no passo de aleta)
  d.setActiveLayer("FINS");
  const numFins = Math.floor(W / finPitchMm);
  for (let i = 0; i <= numFins; i++) {
    const x = i * finPitchMm;
    if (x <= W) {
      d.drawLine(x, 0, x, H);
    }
  }

  // Tubos (círculos)
  d.setActiveLayer("TUBES");
  const rowPitchFront = rows > 1 ? W / (rows - 1) : W / 2;
  const tubePitchFront = tubesPerRow > 1 ? H / (tubesPerRow - 1) : H / 2;
  const r = tubeOuterDiamMm / 2;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < tubesPerRow; col++) {
      const x = rows > 1 ? row * rowPitchFront : W / 2;
      const staggerOff = staggered && row % 2 === 1 ? tubePitchFront / 2 : 0;
      const y = (tubesPerRow > 1 ? col * tubePitchFront : H / 2) + staggerOff;
      d.drawCircle(x, y, r);
    }
  }

  // Circuitos (linhas tracejadas de conexão)
  d.setActiveLayer("CIRCUITS");
  const circuitsPerRow = Math.max(1, Math.ceil(tubesPerRow / Math.max(1, circuits)));
  for (let ci = 0; ci < circuits; ci++) {
    const col = ci * circuitsPerRow;
    if (col < tubesPerRow) {
      const y = tubesPerRow > 1 ? col * tubePitchFront : H / 2;
      d.drawLine(0, y, W, y);
    }
  }

  // ── COTAS VISTA FRONTAL ────────────────────────────────────────────────────
  d.setActiveLayer("DIMENSIONS");
  const dimOffset = 15;

  // Cota largura (abaixo)
  d.drawLine(0, -dimOffset, W, -dimOffset);
  d.drawLine(0, 0, 0, -dimOffset);
  d.drawLine(W, 0, W, -dimOffset);

  // Cota altura (esquerda)
  d.drawLine(-dimOffset, 0, -dimOffset, H);
  d.drawLine(0, 0, -dimOffset, 0);
  d.drawLine(0, H, -dimOffset, H);

  // ── TEXTOS DE COTA ─────────────────────────────────────────────────────────
  d.setActiveLayer("TEXT");
  d.drawText(W / 2, -dimOffset - 8, 5, 0, `${W} mm`);
  d.drawText(-dimOffset - 12, H / 2, 5, 90, `${H} mm`);

  // ── VISTA LATERAL (deslocada para a direita) ───────────────────────────────
  const sideOffsetX = W + 50;

  d.setActiveLayer("OUTLINE");
  d.drawRect(sideOffsetX, 0, sideOffsetX + D, H);

  d.setActiveLayer("FINS");
  const numFinsSide = Math.floor(D / finPitchMm);
  for (let i = 0; i <= numFinsSide; i++) {
    const x = sideOffsetX + i * finPitchMm;
    if (x <= sideOffsetX + D) {
      d.drawLine(x, 0, x, H);
    }
  }

  d.setActiveLayer("TUBES");
  const rowPitchSide = rows > 1 ? D / (rows - 1) : D / 2;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < tubesPerRow; col++) {
      const x = sideOffsetX + (rows > 1 ? row * rowPitchSide : D / 2);
      const y = tubesPerRow > 1 ? col * tubePitchFront : H / 2;
      d.drawCircle(x, y, r);
    }
  }

  d.setActiveLayer("DIMENSIONS");
  d.drawLine(sideOffsetX, -dimOffset, sideOffsetX + D, -dimOffset);
  d.drawLine(sideOffsetX, 0, sideOffsetX, -dimOffset);
  d.drawLine(sideOffsetX + D, 0, sideOffsetX + D, -dimOffset);

  d.setActiveLayer("TEXT");
  d.drawText(sideOffsetX + D / 2, -dimOffset - 8, 5, 0, `${D} mm`);

  // ── CARIMBO TÉCNICO ────────────────────────────────────────────────────────
  d.setActiveLayer("TEXT");
  const stampY = -50;
  d.drawText(0, stampY, 6, 0, `PROJETO: ${projectName}`);
  d.drawText(0, stampY - 10, 5, 0, `REFRIGERANTE: ${refrigerantId}`);
  d.drawText(0, stampY - 20, 5, 0, `DIMENSÕES: ${W}x${H}x${D} mm`);
  d.drawText(0, stampY - 30, 5, 0, `FILAS: ${rows} | TUBOS/FILA: ${tubesPerRow} | Ø TUBO: ${tubeOuterDiamMm} mm`);
  d.drawText(0, stampY - 40, 5, 0, `PASSO ALETA: ${finPitchMm} mm | CIRCUITOS: ${circuits}`);
  if (cycleResult?.converged) {
    d.drawText(0, stampY - 50, 5, 0, `Q EVAP: ${(cycleResult.Q_evap_W / 1000).toFixed(2)} kW | COP: ${cycleResult.COP.toFixed(2)} | Te: ${cycleResult.Te_C.toFixed(1)} °C`);
  }
  d.drawText(0, stampY - 60, 4, 0, `CN COLD ENGENHARIA | Rev. A | ${new Date().toLocaleDateString("pt-BR")}`);

  // Download
  const blob = new Blob([d.toDxfString()], { type: "application/dxf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${projectName.replace(/\s+/g, "_")}_desenho_tecnico.dxf`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── PDF Export (usando jsPDF) ──────────────────────────────────────────────────

export async function exportToPDF(
  inputs: DrawingExportInputs,
  cycleResult?: CycleResult | null,
  canvasElement?: HTMLCanvasElement | null
): Promise<void> {
  // Import dinâmico para não aumentar o bundle inicial
  const { jsPDF } = await import("jspdf");

  const {
    heightMm: H, widthMm: W, depthMm: D,
    rows, tubesPerRow, tubeOuterDiamMm,
    finPitchMm, circuits, refrigerantId,
    projectName = "Evaporador DX",
  } = inputs;

  // Prancha A3 paisagem
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a3" });
  const pageW = 420;
  const pageH = 297;

  // ── Fundo ──────────────────────────────────────────────────────────────────
  doc.setFillColor(248, 250, 252);
  doc.rect(0, 0, pageW, pageH, "F");

  // ── Borda da prancha ───────────────────────────────────────────────────────
  doc.setDrawColor(30, 58, 95);
  doc.setLineWidth(0.8);
  doc.rect(5, 5, pageW - 10, pageH - 10);
  doc.setLineWidth(0.3);
  doc.rect(7, 7, pageW - 14, pageH - 14);

  // ── Cabeçalho ──────────────────────────────────────────────────────────────
  doc.setFillColor(30, 58, 95);
  doc.rect(5, 5, pageW - 10, 18, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("CN COLD ENGENHARIA", 12, 16);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`DESENHO TÉCNICO CONSTRUTIVO — ${projectName.toUpperCase()}`, pageW / 2, 16, { align: "center" });
  doc.text(`Rev. A | ${new Date().toLocaleDateString("pt-BR")}`, pageW - 12, 16, { align: "right" });

  // ── Se há canvas 3D, captura como imagem ──────────────────────────────────
  if (canvasElement) {
    try {
      const imgData = canvasElement.toDataURL("image/png");
      doc.addImage(imgData, "PNG", 10, 28, 130, 90);
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(7);
      doc.text("Vista 3D — Serpentina", 75, 122, { align: "center" });
    } catch {
      // Canvas pode não estar disponível (CORS/WebGL)
    }
  }

  // ── Vista Frontal SVG (desenhada com jsPDF) ────────────────────────────────
  const frontX = 150;
  const frontY = 30;
  const scale = Math.min(80 / W, 100 / H);
  const fW = W * scale;
  const fH = H * scale;

  // Borda
  doc.setDrawColor(30, 58, 95);
  doc.setLineWidth(0.5);
  doc.rect(frontX, frontY, fW, fH);

  // Aletas
  doc.setDrawColor(147, 197, 253);
  doc.setLineWidth(0.15);
  const numFins = Math.min(Math.floor(W / finPitchMm), 60);
  for (let i = 0; i <= numFins; i++) {
    const x = frontX + (i / numFins) * fW;
    doc.line(x, frontY, x, frontY + fH);
  }

  // Tubos
  doc.setDrawColor(30, 111, 217);
  doc.setLineWidth(0.3);
  const rowPitch = rows > 1 ? fW / (rows - 1) : fW / 2;
  const tubePitch = tubesPerRow > 1 ? fH / (tubesPerRow - 1) : fH / 2;
  const rPdf = Math.max(0.8, (tubeOuterDiamMm / 2) * scale);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < tubesPerRow; col++) {
      const x = frontX + (rows > 1 ? row * rowPitch : fW / 2);
      const y = frontY + (tubesPerRow > 1 ? col * tubePitch : fH / 2);
      doc.circle(x, y, rPdf);
    }
  }

  // Label vista frontal
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(7);
  doc.text("VISTA FRONTAL (face do ar)", frontX + fW / 2, frontY - 3, { align: "center" });

  // Cotas
  doc.setDrawColor(239, 68, 68);
  doc.setLineWidth(0.3);
  doc.setTextColor(239, 68, 68);
  doc.setFontSize(6);
  // Largura
  doc.line(frontX, frontY + fH + 5, frontX + fW, frontY + fH + 5);
  doc.text(`${W} mm`, frontX + fW / 2, frontY + fH + 9, { align: "center" });
  // Altura
  doc.line(frontX - 5, frontY, frontX - 5, frontY + fH);
  doc.text(`${H} mm`, frontX - 3, frontY + fH / 2, { angle: 90 });

  // ── Vista Lateral ──────────────────────────────────────────────────────────
  const sideX = frontX + fW + 20;
  const sideW = D * scale;
  doc.setDrawColor(30, 58, 95);
  doc.setLineWidth(0.5);
  doc.rect(sideX, frontY, sideW, fH);

  doc.setDrawColor(147, 197, 253);
  doc.setLineWidth(0.15);
  const numFinsSide = Math.min(Math.floor(D / finPitchMm), 30);
  for (let i = 0; i <= numFinsSide; i++) {
    const x = sideX + (i / numFinsSide) * sideW;
    doc.line(x, frontY, x, frontY + fH);
  }

  doc.setTextColor(100, 116, 139);
  doc.setFontSize(7);
  doc.text("VISTA LATERAL (profundidade)", sideX + sideW / 2, frontY - 3, { align: "center" });

  doc.setDrawColor(239, 68, 68);
  doc.setLineWidth(0.3);
  doc.setTextColor(239, 68, 68);
  doc.setFontSize(6);
  doc.line(sideX, frontY + fH + 5, sideX + sideW, frontY + fH + 5);
  doc.text(`${D} mm`, sideX + sideW / 2, frontY + fH + 9, { align: "center" });

  // ── Tabela de dados técnicos ───────────────────────────────────────────────
  const tableX = 10;
  const tableY = 140;
  const tableW = 130;

  doc.setFillColor(30, 58, 95);
  doc.rect(tableX, tableY, tableW, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("DADOS TÉCNICOS", tableX + 4, tableY + 5.5);

  const rows_data: [string, string][] = [
    ["Altura", `${H} mm`],
    ["Largura", `${W} mm`],
    ["Profundidade", `${D} mm`],
    ["Filas de tubos", `${rows}`],
    ["Tubos por fila", `${tubesPerRow}`],
    ["Ø externo do tubo", `${tubeOuterDiamMm} mm`],
    ["Passo de aleta", `${finPitchMm} mm`],
    ["Circuitos", `${circuits}`],
    ["Refrigerante", refrigerantId],
    ["Arranjo", inputs.staggered ? "Escalonado" : "Alinhado"],
  ];

  if (cycleResult?.converged) {
    rows_data.push(
      ["Te (evaporação)", `${cycleResult.Te_C.toFixed(1)} °C`],
      ["Tc (condensação)", `${cycleResult.Tc_C.toFixed(1)} °C`],
      ["Q evaporador", `${(cycleResult.Q_evap_W / 1000).toFixed(2)} kW`],
      ["Q condensador", `${(cycleResult.Q_cond_W / 1000).toFixed(2)} kW`],
      ["W compressor", `${(cycleResult.W_comp_W / 1000).toFixed(2)} kW`],
      ["COP", `${cycleResult.COP.toFixed(2)}`],
      ["EER", `${cycleResult.EER.toFixed(2)}`],
      ["U global", `${cycleResult.evaporatorResult?.overallU_WM2K?.toFixed(1) ?? "—"} W/m²K`],
    );
  }

  doc.setFont("helvetica", "normal");
  rows_data.forEach(([label, value], i) => {
    const y = tableY + 8 + (i + 1) * 7;
    const bg = i % 2 === 0 ? [248, 250, 252] : [255, 255, 255];
    doc.setFillColor(bg[0], bg[1], bg[2]);
    doc.rect(tableX, y - 5, tableW, 7, "F");
    doc.setTextColor(71, 85, 105);
    doc.setFontSize(7);
    doc.text(label, tableX + 3, y);
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.text(value, tableX + tableW - 3, y, { align: "right" });
    doc.setFont("helvetica", "normal");
  });

  // Borda da tabela
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.rect(tableX, tableY, tableW, 8 + rows_data.length * 7);

  // ── Carimbo inferior ───────────────────────────────────────────────────────
  doc.setFillColor(30, 58, 95);
  doc.rect(5, pageH - 20, pageW - 10, 15, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("CN COLD ENGENHARIA", 12, pageH - 10);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(`${projectName} | ${refrigerantId} | ${W}×${H}×${D} mm`, pageW / 2, pageH - 10, { align: "center" });
  doc.text(`Desenho Técnico Construtivo | Rev. A | ${new Date().toLocaleDateString("pt-BR")}`, pageW - 12, pageH - 10, { align: "right" });

  // Download
  doc.save(`${projectName.replace(/\s+/g, "_")}_prancha_tecnica_A3.pdf`);
}
