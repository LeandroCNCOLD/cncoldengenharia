import { PdfReportDocument } from "./PdfReportDocument";
import type { DXSystemInputs, DXSystemLoadResult } from "../../hooks/useDXSystemLoad";
import type { SystemEquilibriumResult } from "../../hooks/useSystemEquilibrium";

interface DXSystemPdfReportProps {
  inputs: DXSystemInputs;
  loadResult: DXSystemLoadResult;
  equilibriumResult: SystemEquilibriumResult;
  compressorModel: string;
}

const fmt = (value: number, maximumFractionDigits = 2) =>
  value.toLocaleString("pt-BR", { maximumFractionDigits });

export function DXSystemPdfReport({
  inputs,
  loadResult,
  equilibriumResult,
  compressorModel,
}: DXSystemPdfReportProps) {
  const eer = equilibriumResult.COP_real * 3.412;
  const efficiencyClass = eer >= 11 ? "A" : eer >= 9 ? "B" : eer >= 7 ? "C" : "D";
  return (
    <PdfReportDocument
      title="DX Completo — Relatório de Dimensionamento"
      subtitle={`Ambiente ${fmt(inputs.area_m2)} m² · ${fmt(inputs.height_m)} m`}
      date={new Date().toLocaleString("pt-BR")}
      warnings={equilibriumResult.warnings}
      sections={[
        {
          title: "Dados do Ambiente",
          rows: [
            { label: "Área", value: fmt(inputs.area_m2), unit: "m²" },
            { label: "Pé-direito", value: fmt(inputs.height_m), unit: "m" },
            { label: "Ocupação", value: fmt(inputs.occupancy), unit: "pessoas" },
            { label: "Temperatura interna", value: fmt(inputs.Troom_C), unit: "°C" },
            { label: "Umidade alvo", value: fmt(inputs.RH_target * 100), unit: "%" },
          ],
        },
        {
          title: "Carga Térmica",
          rows: [
            { label: "Carga sensível", value: fmt(loadResult.Q_sensible_total_W / 1000), unit: "kW" },
            { label: "Carga latente", value: fmt(loadResult.Q_latent_total_W / 1000), unit: "kW" },
            { label: "Carga total", value: fmt(loadResult.Q_total_W / 1000), unit: "kW" },
            { label: "Capacidade", value: fmt(loadResult.Q_total_W / 3517), unit: "TR" },
            { label: "SHR", value: fmt(loadResult.SHR), unit: "" },
          ],
        },
        {
          title: "Componentes Selecionados",
          rows: [
            { label: "Compressor", value: compressorModel || "Envelope salvo", unit: "" },
            { label: "Evaporador", value: "Envelope salvo", unit: "" },
            { label: "Condensador", value: "Envelope salvo", unit: "" },
          ],
        },
        {
          title: "Ponto de Operação",
          rows: [
            { label: "Te_eq", value: fmt(equilibriumResult.Te_eq_C), unit: "°C" },
            { label: "Tc_eq", value: fmt(equilibriumResult.Tc_eq_C), unit: "°C" },
            { label: "Q real", value: fmt(equilibriumResult.Q_evap_W / 1000), unit: "kW" },
            { label: "COP real", value: fmt(equilibriumResult.COP_real), unit: "" },
            { label: "EER", value: fmt(eer), unit: "BTU/Wh" },
            { label: "Classe estimada", value: efficiencyClass, unit: "" },
          ],
        },
        {
          title: "Diagnóstico",
          rows: [
            { label: "Gargalo", value: equilibriumResult.bottleneck, unit: "" },
            { label: "Descrição", value: equilibriumResult.bottleneckReason, unit: "" },
          ],
        },
      ]}
    />
  );
}
