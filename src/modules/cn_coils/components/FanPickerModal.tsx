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
import { useCnCoilsSimulationStore } from "../store/useCnCoilsSimulationStore";
import { fmtBR } from "../utils/unitConversions";
import type { FanFunction } from "../services/cncoilsCoefficientsService";

export type FanPickerFamily =
  | "axial"
  | "centrifugal_forward"
  | "centrifugal_backward"
  | "centrifugal_radial"
  | "mixed_flow"
  | "tangential"
  | "ec_plug"
  | "unknown";

const FAMILY_LABELS: Record<FanPickerFamily, string> = {
  axial: "Axial",
  centrifugal_forward: "Centrífugo (frente)",
  centrifugal_backward: "Centrífugo (trás)",
  centrifugal_radial: "Centrífugo (radial)",
  mixed_flow: "Fluxo misto",
  tangential: "Tangencial",
  ec_plug: "Plug EC",
  unknown: "Não classificado",
};

const FUNCTION_LABELS: Record<FanFunction | "all", string> = {
  all: "Todas as funções",
  soprador: "Soprador",
  exaustor: "Exaustor",
  livre: "Livre (sem carcaça)",
  universal: "Universal (reversível)",
};

const CATEGORY_LABELS: Record<string, string> = {
  "": "Todos os tipos",
  axial: "Axial",
  centrifugal: "Centrífugo",
};

export interface FanPickerItem {
  id: string;
  manufacturer?: string;
  model?: string;
  airflow_m3h?: number;
  /** Família construtiva (axial, centrífugo, etc.). */
  family?: FanPickerFamily;
  /** Série/linha do fabricante (ex.: TLI, FN, RDH). */
  series?: string;
  seriesDescription?: string;
  /** Tipo: axial ou centrifugal */
  fanCategory?: "axial" | "centrifugal";
  /** Função: soprador, exaustor, livre, universal */
  fanFunction?: FanFunction;
  /** Diâmetro do rotor (mm). */
  diameter_mm?: number;
  /** Rotação (rpm). */
  rpm?: number;
  /** Potência absorvida (W). */
  motor_power_w?: number;
  /** Corrente nominal (A). */
  motor_current_a?: number;
  /** Frequência (Hz). */
  frequency_hz?: number;
  /** Tensão (V). */
  voltage_v?: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  fans: FanPickerItem[];
  /** Chamado quando o usuário confirma — recebe o ventilador escolhido. */
  onConfirm?: (item: FanPickerItem) => void;
}

/**
 * Modal de seleção de ventilador com busca e filtros por:
 * - Tipo (axial / centrífugo)
 * - Fabricante
 * - Série
 * - Função (soprador / exaustor / livre / universal)
 */
export function FanPickerModal({ open, onClose, fans, onConfirm }: Props) {
  const selectedFanId = useCnCoilsSimulationStore((s) => s.selectedFanId);
  const fanCount = useCnCoilsSimulationStore((s) => s.fanCount);
  const fanRole = useCnCoilsSimulationStore((s) => s.fanRole);
  const setSelectedFan = useCnCoilsSimulationStore((s) => s.setSelectedFan);
  const setFanCount = useCnCoilsSimulationStore((s) => s.setFanCount);
  const setFanRole = useCnCoilsSimulationStore((s) => s.setFanRole);
  const setAirFlow = useCnCoilsSimulationStore((s) => s.setAirFlow);

  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [seriesFilter, setSeriesFilter] = useState<string>("");
  const [functionFilter, setFunctionFilter] = useState<string>("");
  const [draftId, setDraftId] = useState<string | undefined>(selectedFanId);
  const [draftCount, setDraftCount] = useState<number>(fanCount);
  const [draftRole, setDraftRole] = useState<"blower" | "exhaust">(fanRole);

  useEffect(() => {
    if (open) {
      setQuery("");
      setBrand("");
      setCategoryFilter("");
      setSeriesFilter("");
      setFunctionFilter("");
      setDraftId(selectedFanId);
      setDraftCount(fanCount);
      setDraftRole(fanRole);
    }
  }, [open, selectedFanId, fanCount, fanRole]);

  // Opções de filtro derivadas dos dados disponíveis
  const brands = useMemo(() => {
    const set = new Set<string>();
    for (const f of fans) {
      if (f.manufacturer) set.add(f.manufacturer);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [fans]);

  // Séries disponíveis com base no filtro de categoria e fabricante
  const seriesOptions = useMemo(() => {
    const set = new Set<string>();
    for (const f of fans) {
      if (brand && f.manufacturer !== brand) continue;
      if (categoryFilter && f.fanCategory !== categoryFilter) continue;
      if (f.series) set.add(f.series);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [fans, brand, categoryFilter]);

  // Funções disponíveis com base nos filtros aplicados
  const functionOptions = useMemo(() => {
    const set = new Set<FanFunction>();
    for (const f of fans) {
      if (brand && f.manufacturer !== brand) continue;
      if (categoryFilter && f.fanCategory !== categoryFilter) continue;
      if (seriesFilter && f.series !== seriesFilter) continue;
      if (f.fanFunction) set.add(f.fanFunction);
    }
    return Array.from(set).sort();
  }, [fans, brand, categoryFilter, seriesFilter]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return fans.filter((f) => {
      if (brand && f.manufacturer !== brand) return false;
      if (categoryFilter && f.fanCategory !== categoryFilter) return false;
      if (seriesFilter && f.series !== seriesFilter) return false;
      if (functionFilter && f.fanFunction !== functionFilter) return false;
      if (!q) return true;
      return [f.manufacturer, f.model, f.id, f.series, f.seriesDescription]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [fans, query, brand, categoryFilter, seriesFilter, functionFilter]);

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

  // Auto-selecionar função no draftRole quando o usuário seleciona um ventilador
  // com função definida (soprador → blower, exaustor → exhaust)
  const handleSelectFan = (id: string) => {
    setDraftId(id);
    const fan = fans.find((f) => f.id === id);
    if (fan?.fanFunction === "soprador") setDraftRole("blower");
    else if (fan?.fanFunction === "exaustor") setDraftRole("exhaust");
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

        <div className="space-y-3">
          {/* Linha 1: Busca + Tipo + Fabricante */}
          <div className="grid grid-cols-3 gap-2">
            <div className="relative col-span-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                autoFocus
                placeholder="Buscar modelo, série…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setSeriesFilter("");
                setFunctionFilter("");
              }}
              className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-[#1E6FD9] focus:outline-none"
            >
              {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
            <select
              value={brand}
              onChange={(e) => {
                setBrand(e.target.value);
                setSeriesFilter("");
              }}
              className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-[#1E6FD9] focus:outline-none"
            >
              <option value="">Todas as marcas</option>
              {brands.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* Linha 2: Série + Função */}
          <div className="grid grid-cols-2 gap-2">
            <select
              value={seriesFilter}
              onChange={(e) => setSeriesFilter(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-[#1E6FD9] focus:outline-none"
            >
              <option value="">Todas as séries</option>
              {seriesOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select
              value={functionFilter}
              onChange={(e) => setFunctionFilter(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-[#1E6FD9] focus:outline-none"
            >
              <option value="">Todas as funções</option>
              {functionOptions.map((fn) => (
                <option key={fn} value={fn}>{FUNCTION_LABELS[fn]}</option>
              ))}
            </select>
          </div>

          {/* Contador de resultados */}
          <div className="text-[10px] text-slate-500">
            {filtered.length} ventilador{filtered.length !== 1 ? "es" : ""} encontrado{filtered.length !== 1 ? "s" : ""}
            {(brand || categoryFilter || seriesFilter || functionFilter || query) && (
              <button
                type="button"
                onClick={() => { setBrand(""); setCategoryFilter(""); setSeriesFilter(""); setFunctionFilter(""); setQuery(""); }}
                className="ml-2 text-[#1E6FD9] underline hover:no-underline"
              >
                Limpar filtros
              </button>
            )}
          </div>

          {/* Lista */}
          <div className="max-h-60 overflow-auto rounded-lg border border-slate-200">
            {filtered.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500">
                Nenhum ventilador encontrado com os filtros selecionados.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 text-xs">
                {filtered.map((f) => {
                  const active = f.id === draftId;
                  const meta: string[] = [];
                  if (f.fanCategory) meta.push(CATEGORY_LABELS[f.fanCategory] ?? f.fanCategory);
                  if (f.series) meta.push(f.series);
                  if (f.fanFunction) meta.push(FUNCTION_LABELS[f.fanFunction] ?? f.fanFunction);
                  if (f.diameter_mm) meta.push(`Ø${f.diameter_mm.toFixed(0)} mm`);
                  if (f.rpm) meta.push(`${f.rpm.toFixed(0)} rpm`);
                  if (f.motor_power_w) meta.push(`${f.motor_power_w.toFixed(0)} W`);
                  if (f.frequency_hz) meta.push(`${f.frequency_hz} Hz`);
                  if (f.voltage_v) meta.push(`${f.voltage_v} V`);
                  return (
                    <li key={f.id}>
                      <button
                        type="button"
                        onClick={() => handleSelectFan(f.id)}
                        className={`flex w-full flex-col gap-0.5 px-3 py-2 text-left transition ${
                          active
                            ? "bg-[#1E6FD9]/10 text-[#1E6FD9]"
                            : "hover:bg-slate-50 text-slate-700"
                        }`}
                      >
                        <div className="flex w-full items-center justify-between">
                          <span className="font-medium">
                            {[f.manufacturer, f.model]
                              .filter(Boolean)
                              .join(" ") || f.id}
                          </span>
                          <span className="text-slate-500">
                            {f.airflow_m3h
                              ? `${fmtBR(f.airflow_m3h, 0)} m³/h`
                              : "—"}
                          </span>
                        </div>
                        {meta.length > 0 && (
                          <div className="text-[10px] text-slate-500">
                            {meta.join(" • ")}
                          </div>
                        )}
                        {f.seriesDescription && (
                          <div className="text-[10px] italic text-slate-400">
                            {f.seriesDescription}
                          </div>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Configuração: Soprador/Exaustor + Quantidade */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Função no sistema
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

          {/* Resumo do ventilador selecionado */}
          {draft && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
              <div className="mb-1 font-semibold text-slate-800">
                {[draft.manufacturer, draft.model].filter(Boolean).join(" ")}
                {draft.series && (
                  <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-600">
                    {draft.series}
                  </span>
                )}
                {draft.fanFunction && (
                  <span className={`ml-1 rounded px-1.5 py-0.5 text-[10px] ${
                    draft.fanFunction === "soprador" ? "bg-blue-100 text-blue-700" :
                    draft.fanFunction === "exaustor" ? "bg-orange-100 text-orange-700" :
                    "bg-slate-200 text-slate-600"
                  }`}>
                    {FUNCTION_LABELS[draft.fanFunction]}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Vazão unitária:</span>
                <span className="font-semibold text-slate-900">
                  {draft.airflow_m3h
                    ? `${fmtBR(draft.airflow_m3h, 0)} m³/h`
                    : "—"}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-slate-600">
                  Vazão total ({draftCount}× {draftRole === "blower" ? "soprador" : "exaustor"}):
                </span>
                <span className="font-bold text-[#1E6FD9]">
                  {totalAirflow ? `${fmtBR(totalAirflow, 0)} m³/h` : "—"}
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          <Button variant="ghost" size="sm" asChild onClick={onClose}>
            <Link
              to="/coldpro/components"
              className="inline-flex items-center gap-1 text-xs text-[#1E6FD9]"
            >
              <Plus className="h-3.5 w-3.5" />
              Cadastrar novo ventilador
            </Link>
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={handleConfirm} disabled={!draft}>
              Aplicar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
