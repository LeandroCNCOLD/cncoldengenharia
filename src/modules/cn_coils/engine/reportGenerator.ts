import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type {
  CnCoilsPhysicalInputs,
  CnCoilsSimulationResult,
} from "../types/unilab.types";

export interface ReportSnapshot {
  componentLabel: string;
  geometryName?: string;
  physical: Partial<CnCoilsPhysicalInputs>;
  air: {
    flowM3h: number;
    tempInC: number;
    rhInPct: number;
    foulingFactor: number;
    fanCount: number;
    fanRole: string;
  };
  fluid: {
    refrigerant: string;
    massFlowKgH: number;
    operatingTempC: number;
    superheatK: number;
    subcoolingK: number;
    foulingFactor: number;
    pairedTempC: number | null;
    dischargeSuperheatK: number | null;
    compressorCount: number;
    compressorId?: string;
  };
  cost: number;
  result?: CnCoilsSimulationResult;
  warnings: Array<{ code: string; message: string | null; severity: "warning" | "error" }>;
  meta: {
    project: string;
    client: string;
    contact: string;
    code: string;
    description: string;
    date: string;
  };
}

const fmt = (n: number | undefined | null, dec = 2): string => {
  if (n === undefined || n === null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
};

export function generateReportPdf(snap: ReportSnapshot): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();

  // Header bar
  doc.setFillColor(30, 111, 217);
  doc.rect(0, 0, W, 18, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("CN COLD — Relatório de Simulação", 10, 11);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("cncold.com.br", W - 10, 11, { align: "right" });

  // Meta block
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(8);
  let y = 22;
  const metaCol = (label: string, value: string, x: number) => {
    doc.setFont("helvetica", "bold");
    doc.text(label, x, y);
    doc.setFont("helvetica", "normal");
    doc.text(value || "—", x, y + 4);
  };
  metaCol("Cliente", snap.meta.client, 10);
  metaCol("Contato", snap.meta.contact, 60);
  metaCol("Código", snap.meta.code, 110);
  metaCol("Data", snap.meta.date, 160);
  y += 10;
  metaCol("Projeto", snap.meta.project, 10);
  metaCol("Aplicação", snap.componentLabel, 110);
  y += 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Descrição:", 10, y);
  doc.setFont("helvetica", "normal");
  doc.text(snap.meta.description || "—", 30, y, { maxWidth: W - 40 });
  y += 6;

  const r = snap.result;
  const p = snap.physical;

  // Section: Geometria
  autoTable(doc, {
    startY: y,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 1.2 },
    headStyles: { fillColor: [30, 111, 217], textColor: 255, fontStyle: "bold" },
    head: [[{ content: `Geometria — ${snap.geometryName ?? "—"}`, colSpan: 4 }]],
    body: [
      ["Comprimento da bateria", `${fmt(p.finnedLengthMm, 0)} mm`, "N° divisores", `${p.dividers ?? 0}`],
      ["Altura aletada", `${fmt(p.finnedHeightMm, 0)} mm`, "Passo das aletas", `${fmt(p.finPitchMm, 2)} mm`],
      ["N° tubos por fila", `${p.tubesPerRow ?? "—"}`, "N° de fileiras", `${p.rows ?? "—"}`],
      ["N° de circuitos", `${p.circuits ?? "—"}`, "N° tubos saltados", `${p.unusedTubes ?? 0}`],
      ["Diâmetro externo dos tubos", `${fmt(p.tubeOuterDiameterMm, 2)} mm`, "Diâmetro interno", `${fmt(p.tubeInnerDiameterMm, 2)} mm`],
      ["Espessura das aletas", `${fmt(p.finThicknessMm, 4)} mm`, "Posição coletor", `${p.headerPosition ?? "—"}`],
      ["Passo transversal", `${fmt(p.tubePitchTransverseMm, 2)} mm`, "Passo longitudinal", `${fmt(p.tubePitchLongitudinalMm, 2)} mm`],
    ],
  });

  // Section: Resultados
  autoTable(doc, {
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 1.2 },
    headStyles: { fillColor: [16, 134, 76], textColor: 255, fontStyle: "bold" },
    head: [[{ content: "Resultados — Capacidade & Troca Térmica", colSpan: 4 }]],
    body: [
      ["Capacidade total", `${fmt((r?.totalCapacityKw ?? 0) * 1000, 0)} W`, "Capacidade sensível", `${fmt((r?.sensibleCapacityKw ?? 0) * 1000, 0)} W`],
      ["Capacidade latente", `${fmt((r?.latentCapacityKw ?? 0) * 1000, 0)} W`, "SHF (sens./total)", `${fmt(r?.shf, 4)}`],
      ["Superfície de troca", `${fmt(r?.faceAreaM2, 4)} m²`, "Regime", `${r?.regime ?? "—"}`],
      ["LMTD", `${fmt(r?.lmtdK, 2)} K`, "NTU", `${fmt(r?.ntu, 3)}`],
      ["Efetividade ε", `${fmt(r?.effectiveness, 3)}`, "Fator de correção", `${fmt(r?.correctionFactor, 3)}`],
      ["Custo estimado", `R$ ${fmt(snap.cost, 2)}`, "", ""],
    ],
  });

  // Section: Lado Ventilação
  autoTable(doc, {
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 1.2 },
    headStyles: { fillColor: [30, 111, 217], textColor: 255, fontStyle: "bold" },
    head: [[{ content: "Lado Ventilação", colSpan: 4 }]],
    body: [
      ["Fluxo volumétrico de ar", `${fmt(snap.air.flowM3h, 0)} m³/h`, "Velocidade frontal", `${fmt(r?.faceVelocityMs, 2)} m/s`],
      ["Vazão mássica", `${fmt((r?.airMassFlowKgS ?? 0) * 3600, 0)} kg/h`, "Quantidade ventiladores", `${snap.air.fanCount} (${snap.air.fanRole})`],
      ["Temperatura de entrada", `${fmt(snap.air.tempInC, 1)} °C`, "Umidade rel. entrada", `${fmt(snap.air.rhInPct, 1)} %`],
      ["Temperatura de saída", `${fmt(r?.airOutletTempC, 1)} °C`, "Umidade rel. saída", `${fmt(r?.airOutletRhPercent, 1)} %`],
      ["Queda de pressão (ar)", `${fmt(r?.airPressureDropPa, 0)} Pa`, "Coef. sujidade ar", `${fmt(snap.air.foulingFactor, 6)} (m²·K)/W`],
    ],
  });

  // Section: Lado Refrigerante
  autoTable(doc, {
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 1.2 },
    headStyles: { fillColor: [217, 119, 6], textColor: 255, fontStyle: "bold" },
    head: [[{ content: "Lado Refrigerante / Fluido", colSpan: 4 }]],
    body: [
      ["Fluido", snap.fluid.refrigerant, "Vazão mássica", `${fmt(snap.fluid.massFlowKgH, 1)} kg/h`],
      ["Temp. operação", `${fmt(snap.fluid.operatingTempC, 1)} °C`, "Temp. emparelhada", snap.fluid.pairedTempC !== null ? `${fmt(snap.fluid.pairedTempC, 1)} °C` : "—"],
      ["Sobreaquecimento", `${fmt(snap.fluid.superheatK, 1)} K`, "Sub-resfriamento", `${fmt(snap.fluid.subcoolingK, 1)} K`],
      ["SH descarga", snap.fluid.dischargeSuperheatK !== null ? `${fmt(snap.fluid.dischargeSuperheatK, 1)} K` : "—", "Coef. sujidade fluido", `${fmt(snap.fluid.foulingFactor, 6)} (m²·K)/W`],
      ["Queda de pressão fluido", `${fmt(r?.fluidPressureDropKpa, 2)} kPa`, "Compressor", `${snap.fluid.compressorCount}× ${snap.fluid.compressorId ?? "— sem compressor —"}`],
    ],
  });

  // Warnings
  if (snap.warnings.length) {
    autoTable(doc, {
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 1.2, textColor: [120, 53, 15] },
      headStyles: { fillColor: [251, 191, 36], textColor: 30, fontStyle: "bold" },
      head: [["Avisos"]],
      body: snap.warnings.map((w) => [w.message ?? w.code]),
    });
  }

  // Footer on every page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.text(
      `CN Cold • cncold.com.br • Página ${i}/${pageCount}`,
      W / 2,
      doc.internal.pageSize.getHeight() - 6,
      { align: "center" },
    );
  }

  return doc;
}
