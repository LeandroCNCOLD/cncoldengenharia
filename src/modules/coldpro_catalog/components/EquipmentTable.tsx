import { useState } from "react";
import { Link } from "@tanstack/react-router";
import type { CatalogEquipmentRow, TemperatureApplication } from "../data/equipmentCatalog.types";
import { EquipmentDetailModal } from "./EquipmentDetailModal";

interface Props {
  rows: CatalogEquipmentRow[];
  onSelect: (row: CatalogEquipmentRow) => void;
  selectedIds?: string[];
}

function fmt(value?: number, decimals = 0): string {
  if (value === undefined || value === null) return "—";
  return value.toLocaleString("pt-BR", { maximumFractionDigits: decimals });
}

const APPLICATION_LABEL: Record<TemperatureApplication, string> = {
  LT: "LT",
  MT: "MT",
  HT: "HT",
  AGRO: "AGRO",
  freezing: "FRZ",
  cooling: "COOL",
  unknown: "—",
};

const APPLICATION_COLOR: Record<TemperatureApplication, string> = {
  LT: "bg-blue-100 text-blue-800",
  MT: "bg-green-100 text-green-800",
  HT: "bg-orange-100 text-orange-800",
  AGRO: "bg-amber-100 text-amber-800",
  freezing: "bg-blue-100 text-blue-800",
  cooling: "bg-green-100 text-green-800",
  unknown: "bg-slate-100 text-slate-600",
};

export function EquipmentTable({ rows, onSelect, selectedIds = [] }: Props) {
  const [detailRow, setDetailRow] = useState<CatalogEquipmentRow | null>(null);
  return (
    <div className="overflow-auto rounded-lg border border-gray-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-xs uppercase text-gray-600">
          <tr>
            <th className="px-3 py-2 text-left">Modelo</th>
            <th className="px-3 py-2 text-left">Aplic.</th>
            <th className="px-3 py-2 text-left">Fluido</th>
            <th className="px-3 py-2 text-right">Cap. kcal/h</th>
            <th className="px-3 py-2 text-right">Pot. kW</th>
            <th className="px-3 py-2 text-right">COP</th>
            <th className="px-3 py-2 text-left">Elétrica</th>
            <th className="px-3 py-2 text-right">T_evap °C</th>
            <th className="px-3 py-2 text-right">T_cond °C</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isSelected = selectedIds.includes(row.id);
            const capacity = row.capacidadeFrigorificaKcalH ?? row.capacidadeCompressorKcalH;
            return (
              <tr
                key={row.id}
                className={`border-t border-gray-100 hover:bg-gray-50 ${
                  isSelected ? "bg-blue-50/50" : ""
                }`}
              >
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setDetailRow(row)}
                    className="text-left hover:underline focus:outline-none focus:ring-2 focus:ring-[#1E6FD9]/40"
                    title="Ver detalhes técnicos"
                  >
                    <p className="font-medium text-[#1E6FD9]">
                      {row.modeloBaseReferencia ?? row.modelo}
                    </p>
                    <p className="text-xs text-gray-500">{row.compressorModelo ?? "—"}</p>
                  </button>
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                      APPLICATION_COLOR[row.application] ?? APPLICATION_COLOR.unknown
                    }`}
                  >
                    {APPLICATION_LABEL[row.application] ?? row.application}
                  </span>
                </td>
                <td className="px-3 py-2">{row.refrigerante}</td>
                <td className="px-3 py-2 text-right">{fmt(capacity)}</td>
                <td className="px-3 py-2 text-right">{fmt(row.potenciaEletricaKw, 2)}</td>
                <td className="px-3 py-2 text-right">{fmt(row.cop, 2)}</td>
                <td className="px-3 py-2 text-xs">
                  {row.tensaoV ? `${row.tensaoV}V` : "—"}{" "}
                  {row.numeroFases ? `${row.numeroFases}F` : ""}
                </td>
                <td className="px-3 py-2 text-right">{fmt(row.tempEvaporacaoC, 1)}</td>
                <td className="px-3 py-2 text-right">{fmt(row.tempCondensacaoC, 1)}</td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => onSelect(row)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                      isSelected
                        ? "bg-[#1E6FD9] text-white"
                        : "border border-[#1E6FD9] text-[#1E6FD9] hover:bg-[#1E6FD9]/10"
                    }`}
                  >
                    {isSelected ? "✓ Selecionado" : "Selecionar"}
                  </button>
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={10} className="px-3 py-8 text-center text-sm text-gray-500">
                Nenhum equipamento encontrado com os filtros aplicados.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <EquipmentDetailModal equipment={detailRow} onClose={() => setDetailRow(null)} />
    </div>
  );
}
