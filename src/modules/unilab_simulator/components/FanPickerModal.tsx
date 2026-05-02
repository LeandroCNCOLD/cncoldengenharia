import { useEffect, useMemo, useState } from "react";
import { Search, Fan as FanIcon, Plus } from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUnilabSimulationStore } from "../store/useUnilabSimulationStore";

export interface FanPickerItem {
  id: string;
  manufacturer?: string;
  model?: string;
  airflow_m3h?: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  fans: FanPickerItem[];
  /** Chamado quando o usuário confirma — recebe o ventilador escolhido. */
  onConfirm?: (item: FanPickerItem) => void;
}

/**
 * Modal de seleção de ventilador com busca, definição do papel
 * (Soprador / Exaustor) e quantidade aplicada.
 *
 * A vazão de ar do sistema = vazão_unitária × quantidade.
 */
export function FanPickerModal({ open, onClose, fans, onConfirm }: Props) {
  const selectedFanId = useUnilabSimulationStore((s) => s.selectedFanId);
  const fanCount = useUnilabSimulationStore((s) => s.fanCount);
  const fanRole = useUnilabSimulationStore((s) => s.fanRole);
  const setSelectedFan = useUnilabSimulationStore((s) => s.setSelectedFan);
  const setFanCount = useUnilabSimulationStore((s) => s.setFanCount);
  const setFanRole = useUnilabSimulationStore((s) => s.setFanRole);
  const setAirFlow = useUnilabSimulationStore((s) => s.setAirFlow);

  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState<string>("");
  const [draftId, setDraftId] = useState<string | undefined>(selectedFanId);
  const [draftCount, setDraftCount] = useState<number>(fanCount);
  const [draftRole, setDraftRole] = useState<"blower" | "exhaust">(fanRole);

  useEffect(() => {
    if (open) {
      setQuery("");
      setBrand("");
      setDraftId(selectedFanId);
      setDraftCount(fanCount);
      setDraftRole(fanRole);
    }
  }, [open, selectedFanId, fanCount, fanRole]);

  const brands = useMemo(() => {
    const set = new Set<string>();
    for (const f of fans) {
      if (f.manufacturer) set.add(f.manufacturer);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [fans]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return fans.filter((f) => {
      if (brand && f.manufacturer !== brand) return false;
      if (!q) return true;
      return [f.manufacturer, f.model, f.id]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [fans, query, brand]);

  const draft = fans.find((f) => f.id === draftId);
  const totalAirflow =
    draft?.airflow_m3h && draftCount > 0
      ? draft.airflow_m3h * draftCount
      : undefined;

  const handleConfirm = () => {
    if (!draft) return;
    setSelectedFan(draft.id);
    setFanCount(draftCount);
    setFanRole(draftRole);
    if (totalAirflow && totalAirflow > 0) setAirFlow(totalAirflow);
    onConfirm?.(draft);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FanIcon className="h-4 w-4" />
            Selecionar Ventilador
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Busca + Filtro por marca */}
          <div className="grid grid-cols-3 gap-2">
            <div className="relative col-span-2">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                autoFocus
                placeholder="Buscar por modelo…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            <select
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-[#1E6FD9] focus:outline-none"
            >
              <option value="">Todas as marcas</option>
              {brands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          {/* Lista */}
          <div className="max-h-64 overflow-auto rounded-lg border border-slate-200">
            {filtered.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500">
                Nenhum ventilador encontrado.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 text-xs">
                {filtered.map((f) => {
                  const active = f.id === draftId;
                  return (
                    <li key={f.id}>
                      <button
                        type="button"
                        onClick={() => setDraftId(f.id)}
                        className={`flex w-full items-center justify-between px-3 py-2 text-left transition ${
                          active
                            ? "bg-[#1E6FD9]/10 text-[#1E6FD9]"
                            : "hover:bg-slate-50 text-slate-700"
                        }`}
                      >
                        <span className="font-medium">
                          {[f.manufacturer, f.model].filter(Boolean).join(" ") ||
                            f.id}
                        </span>
                        <span className="text-slate-500">
                          {f.airflow_m3h
                            ? `${f.airflow_m3h.toFixed(0)} m³/h`
                            : "—"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Configuração */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Tipo
              </label>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setDraftRole("blower")}
                  className={`flex-1 rounded border px-2 py-1.5 text-xs font-medium transition ${
                    draftRole === "blower"
                      ? "border-[#1E6FD9] bg-[#1E6FD9] text-white"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  Soprador
                </button>
                <button
                  type="button"
                  onClick={() => setDraftRole("exhaust")}
                  className={`flex-1 rounded border px-2 py-1.5 text-xs font-medium transition ${
                    draftRole === "exhaust"
                      ? "border-[#1E6FD9] bg-[#1E6FD9] text-white"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  Exaustor
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Quantidade
              </label>
              <Input
                type="number"
                min={1}
                step={1}
                value={draftCount}
                onChange={(e) =>
                  setDraftCount(Math.max(1, parseInt(e.target.value, 10) || 1))
                }
              />
            </div>
          </div>

          {/* Resumo */}
          {draft && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Vazão unitária:</span>
                <span className="font-semibold text-slate-900">
                  {draft.airflow_m3h
                    ? `${draft.airflow_m3h.toFixed(0)} m³/h`
                    : "—"}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-slate-600">
                  Vazão total ({draftCount}× {draftRole === "blower" ? "soprador" : "exaustor"}):
                </span>
                <span className="font-bold text-[#1E6FD9]">
                  {totalAirflow ? `${totalAirflow.toFixed(0)} m³/h` : "—"}
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!draft}>
            Aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
