import { PdfReportDocument } from "./PdfReportDocument";
import type { ColdRoomInputs, ColdRoomLoadResult } from "../../hooks/useColdRoomLoad";
import type { SystemEquilibriumResult } from "../../hooks/useSystemEquilibrium";

const fmt = (value: number, maximumFractionDigits = 2) =>
  value.toLocaleString("pt-BR", { maximumFractionDigits });

interface ColdRoomPdfReportProps {
  inputs: ColdRoomInputs;
  loadResult: ColdRoomLoadResult;
  equilibriumResult: SystemEquilibriumResult;
  compressorModel: string;
}

export function ColdRoomPdfReport({
  inputs,
  loadResult,
  equilibriumResult,
  compressorModel,
}: ColdRoomPdfReportProps) {
  const volume = inputs.width_m * inputs.depth_m * inputs.height_m;
  return (
    <PdfReportDocument
      title="Câmara Fria — Relatório de Dimensionamento"
      subtitle={`Projeto: Câmara de Congelados ${fmt(volume, 1)} m³`}
      date={new Date().toLocaleString("pt-BR")}
      sections={[
        {
          title: "Dados do Projeto",
          rows: [
            { label: "Dimensões", value: `${fmt(inputs.width_m, 1)} × ${fmt(inputs.depth_m, 1)} × ${fmt(inputs.height_m, 1)}`, unit: "m" },
            { label: "Volume", value: fmt(volume, 1), unit: "m³" },
            { label: "Temperatura interna", value: fmt(inputs.Troom_C, 1), unit: "°C" },
            { label: "Temperatura externa", value: fmt(inputs.Tamb_C, 1), unit: "°C" },
            { label: "ΔT", value: fmt(inputs.Tamb_C - inputs.Troom_C, 1), unit: "K" },
          ],
        },
        {
          title: "Carga Térmica",
          rows: [
            { label: "Carga total", value: fmt(loadResult.Q_total_W, 0), unit: "W" },
            ...loadResult.breakdown.map((item) => ({
              label: item.name,
              value: `${fmt(item.value, 0)} (${fmt(item.percentage, 0)}%)`,
              unit: "W",
            })),
          ],
        },
        {
          title: "Componentes Selecionados",
          rows: [
            { label: "Compressor", value: compressorModel || "Não informado" },
            { label: "Evaporador", value: "Envelope salvo na bancada" },
            { label: "Condensador", value: "Envelope salvo na bancada" },
          ],
        },
        {
          title: "Ponto de Operação",
          rows: [
            { label: "Te_eq", value: fmt(equilibriumResult.Te_eq_C, 1), unit: "°C" },
            { label: "Tc_eq", value: fmt(equilibriumResult.Tc_eq_C, 1), unit: "°C" },
            { label: "Capacidade real", value: fmt(equilibriumResult.Q_evap_W / 1000), unit: "kW" },
            { label: "COP real", value: fmt(equilibriumResult.COP_real) },
            { label: "Potência", value: fmt(equilibriumResult.W_comp_W / 1000), unit: "kW" },
          ],
        },
        {
          title: "Diagnóstico",
          rows: [
            { label: "Gargalo", value: equilibriumResult.bottleneck },
            { label: "Descrição", value: equilibriumResult.bottleneckReason },
          ],
        },
      ]}
      warnings={equilibriumResult.warnings}
    />
  );
}
