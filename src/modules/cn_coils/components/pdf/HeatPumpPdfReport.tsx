import { PdfReportDocument } from "./PdfReportDocument";
import type { HeatPumpInputs, HeatPumpResult } from "../../hooks/useHeatPumpLoad";
import type { SystemEquilibriumResult } from "../../hooks/useSystemEquilibrium";

interface HeatPumpPdfReportProps {
  inputs: HeatPumpInputs;
  loadResult: HeatPumpResult;
  equilibriumResult: SystemEquilibriumResult | null;
  compressorModel?: string | null;
}

const fmt = (value: number, maximumFractionDigits = 2) =>
  value.toLocaleString("pt-BR", { maximumFractionDigits });

export function HeatPumpPdfReport({
  inputs,
  loadResult,
  equilibriumResult,
  compressorModel,
}: HeatPumpPdfReportProps) {
  return (
    <PdfReportDocument
      title="Bomba de Calor — Relatório de Dimensionamento"
      subtitle={`Modo ${inputs.mode} · Fonte ${inputs.sourceType}`}
      date={new Date().toLocaleString("pt-BR")}
      warnings={equilibriumResult?.warnings}
      sections={[
        {
          title: "Dados do Sistema",
          rows: [
            { label: "Modo", value: inputs.mode },
            { label: "Fonte", value: inputs.sourceType },
            { label: "T fonte", value: fmt(inputs.Tsource_C), unit: "°C" },
            { label: "T supply aquecimento", value: fmt(inputs.Tsupply_heating_C), unit: "°C" },
          ],
        },
        {
          title: "Cargas",
          rows: [
            { label: "Carga aquecimento", value: fmt(inputs.Q_heating_W / 1000), unit: "kW" },
            { label: "Carga resfriamento", value: fmt(inputs.Q_cooling_W / 1000), unit: "kW" },
            { label: "COP aquecimento", value: fmt(loadResult.COP_heating) },
            { label: "COP resfriamento", value: fmt(loadResult.COP_cooling) },
          ],
        },
        {
          title: "Componentes Selecionados",
          rows: [
            { label: "Compressor", value: compressorModel || "Envelope salvo" },
            { label: "Tensão", value: fmt(inputs.voltage_V, 0), unit: "V" },
            { label: "Frequência", value: fmt(inputs.frequency_Hz, 0), unit: "Hz" },
          ],
        },
        {
          title: "Ponto de Operação",
          rows: equilibriumResult
            ? [
                { label: "Te_eq", value: fmt(equilibriumResult.Te_eq_C), unit: "°C" },
                { label: "Tc_eq", value: fmt(equilibriumResult.Tc_eq_C), unit: "°C" },
                { label: "COP real", value: fmt(equilibriumResult.COP_real) },
                { label: "W compressor", value: fmt(equilibriumResult.W_comp_W / 1000), unit: "kW" },
              ]
            : [{ label: "Equilíbrio", value: "Não executado" }],
        },
        {
          title: "Comparativo",
          rows: [
            { label: "Economia vs resistência elétrica", value: fmt(loadResult.savingsVsElectric_pct), unit: "%" },
            { label: "Calor absorvido da fonte", value: fmt(loadResult.Q_source_W / 1000), unit: "kW" },
          ],
        },
      ]}
    />
  );
}
