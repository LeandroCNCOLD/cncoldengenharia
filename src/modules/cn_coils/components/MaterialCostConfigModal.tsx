import { useEffect, useState, useMemo } from "react";
import { X } from "lucide-react";
import { useCnCoilsSimulationStore } from "../store/useCnCoilsSimulationStore";
import {
  MATERIAL_LABELS,
  formatBRL,
  type MaterialKey,
} from "../engine/costCalculator";

interface MaterialCostConfigModalProps {
  open: boolean;
  onClose: () => void;
}

const MATERIAL_KEYS: MaterialKey[] = [
  "copper_kg",
  "aluminum_kg",
  "stainless_steel_kg",
  "carbon_steel_kg",
];

/**
 * Modal de configuração de preços de materiais (Etapa 3.6).
 * Atualiza `materialPrices` no Zustand. O custo é recalculado a cada mudança.
 */
export function MaterialCostConfigModal({ open, onClose }: MaterialCostConfigModalProps) {
  const prices = useCnCoilsSimulationStore((s) => s.materialPrices);
  const setPrice = useCnCoilsSimulationStore((s) => s.setMaterialPrice);
  const tubeKey = useCnCoilsSimulationStore((s) => s.tubeMaterialKey);
  const finKey = useCnCoilsSimulationStore((s) => s.finMaterialKey);
  const setTubeKey = useCnCoilsSimulationStore((s) => s.setTubeMaterialKey);
  const setFinKey = useCnCoilsSimulationStore((s) => s.setFinMaterialKey);
  const cost = useCnCoilsSimulationStore((s) => s.calculatedCost);

  const [laborCost, setLaborCost] = useState<number>(0);
  const [bdiPct, setBdiPct] = useState<number>(25);

  const totalCost = useMemo(() => cost + (Number.isFinite(laborCost) ? laborCost : 0), [cost, laborCost]);
  const salePrice = useMemo(() => {
    const bdi = Number.isFinite(bdiPct) ? bdiPct : 0;
    if (bdi >= 100) return Infinity;
    return totalCost / (1 - bdi / 100);
  }, [totalCost, bdiPct]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg border border-slate-300 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 bg-[#1E6FD9] px-4 py-2 text-white">
          <h2 className="text-sm font-semibold uppercase tracking-wider">
            Configuração de Preços de Materiais
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 hover:bg-white/20"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 p-4">
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Material do Tubo"
              value={tubeKey}
              onChange={setTubeKey}
            />
            <Select
              label="Material da Aleta"
              value={finKey}
              onChange={setFinKey}
            />
          </div>

          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Preço por kg (R$)
            </div>
            <div className="space-y-2">
              {MATERIAL_KEYS.map((key) => (
                <div
                  key={key}
                  className="grid grid-cols-[1fr_120px] items-center gap-2"
                >
                  <label className="text-xs text-slate-700">
                    {MATERIAL_LABELS[key]}
                  </label>
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-slate-500">R$</span>
                    <input
                      type="text" inputMode="decimal" onFocus={(e) => e.target.select()}
                      value={prices[key]}
                      step={0.01}
                      min={0}
                      onChange={(e) => {
                        const n = parseFloat(e.target.value);
                        setPrice(key, Number.isFinite(n) ? n : 0);
                      }}
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-right text-xs text-slate-900 focus:border-[#1E6FD9] focus:outline-none focus:ring-1 focus:ring-[#1E6FD9]"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Mão de Obra & BDI
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_140px] items-center gap-2">
                <label className="text-xs text-slate-700">Mão de Obra</label>
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-slate-500">R$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    onFocus={(e) => e.target.select()}
                    value={laborCost}
                    onChange={(e) => {
                      const n = parseFloat(e.target.value);
                      setLaborCost(Number.isFinite(n) ? n : 0);
                    }}
                    className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-right text-xs text-slate-900 focus:border-[#1E6FD9] focus:outline-none focus:ring-1 focus:ring-[#1E6FD9]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-[1fr_140px] items-center gap-2">
                <label className="text-xs text-slate-700">BDI</label>
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    inputMode="decimal"
                    onFocus={(e) => e.target.select()}
                    value={bdiPct}
                    onChange={(e) => {
                      const n = parseFloat(e.target.value);
                      setBdiPct(Number.isFinite(n) ? n : 0);
                    }}
                    className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-right text-xs text-slate-900 focus:border-[#1E6FD9] focus:outline-none focus:ring-1 focus:ring-[#1E6FD9]"
                  />
                  <span className="text-[11px] text-slate-500">%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="rounded-md border border-slate-300 bg-white px-3 py-2">
              <div className="flex items-center justify-between text-[11px] text-slate-600">
                <span>Materiais</span>
                <span className="font-mono">{formatBRL(cost)}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-600">
                <span>Mão de Obra</span>
                <span className="font-mono">{formatBRL(laborCost)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between border-t border-slate-200 pt-1 text-xs font-semibold text-slate-800">
                <span>Custo Total</span>
                <span className="font-mono">{formatBRL(totalCost)}</span>
              </div>
            </div>
            <div className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                  Preço de Venda (BDI {bdiPct}%)
                </div>
                <div className="font-mono text-base font-bold text-emerald-900">
                  {Number.isFinite(salePrice) ? formatBRL(salePrice) : "—"}
                </div>
              </div>
              <div className="mt-1 text-[10px] text-emerald-700/80">
                PV = Custo Total / (1 − BDI/100)
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-4 py-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-[#1E6FD9] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#1759b3]"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
}: {
  label: string;
  value: MaterialKey;
  onChange: (v: MaterialKey) => void;
}) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[11px] font-medium text-slate-700">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as MaterialKey)}
        className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 focus:border-[#1E6FD9] focus:outline-none"
      >
        {MATERIAL_KEYS.map((k) => (
          <option key={k} value={k}>
            {MATERIAL_LABELS[k]}
          </option>
        ))}
      </select>
    </label>
  );
}
