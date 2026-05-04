import { PdfReportDocument } from "./PdfReportDocument";

export interface WorkspacePdfReportProps {
  componentType:
    | "evaporator"
    | "condenser_air"
    | "compressor"
    | "evaporative_condenser"
    | "water_condenser"
    | "heating_coil";
  title: string;
  inputs: Record<string, string | number>;
  results: Record<string, string | number>;
  warnings?: string[];
}

function rowsFromRecord(record: Record<string, string | number>) {
  return Object.entries(record).map(([label, value]) => ({
    label,
    value: typeof value === "number" ? value.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : value,
  }));
}

export function WorkspacePdfReport({
  componentType,
  title,
  inputs,
  results,
  warnings = [],
}: WorkspacePdfReportProps) {
  return (
    <PdfReportDocument
      title={title}
      subtitle={`Componente: ${componentType}`}
      date={new Date().toLocaleString("pt-BR")}
      sections={[
        { title: "Inputs", rows: rowsFromRecord(inputs) },
        { title: "Resultados", rows: rowsFromRecord(results) },
      ]}
      warnings={warnings}
    />
  );
}
