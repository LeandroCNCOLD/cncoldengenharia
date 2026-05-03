import { useEffect, useMemo, useState } from "react";
import { Search, Zap, X } from "lucide-react";
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
import { loadCompressorIndex } from "@/modules/coldpro_catalog/data/compressorCatalog.service";
import type { CompressorIndexRow } from "@/modules/coldpro_catalog/data/compressorCatalog.types";

export interface CompressorItem {
  id: string;
  model: string;
  series?: string;
  type?: string;
  refrigerantCode?: string;
  brand?: string;
  nominalCapacityW?: number | null;
  nominalPowerW?: number | null;
  nominalHp?: number | null;
}

const applicationLabels: Record<string, string> = {
  LT: "LT — Congelados",
  MT: "MT — Resfriados",
  HT: "HT — Climatizados",
};

function formatKw(w?: number | null): string {
  if (w == null || !Number.isFinite(w)) return "—";
  return `${(w / 1000).toFixed(2)} kW`;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Modal de seleção de Compressor com busca, filtros e quantidade.
 *
 * A capacidade/vazão mássica total = unitária × quantidade
 * (replicado pelo motor de cálculo).
 */
export function CompressorPickerModal({ open, onClose }: Props) {
  const selectedCompressorId = useCnCoilsSimulationStore((s) => s.selectedCompressorId);
  const compressorCount = useCnCoilsSimulationStore((s) => s.compressorCount);
  const setSelectedCompressor = useCnCoilsSimulationStore((s) => s.setSelectedCompressor);
  const setCompressorCount = useCnCoilsSimulationStore((s) => s.setCompressorCount);

  const [items, setItems] = useState<CompressorItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [seriesFilter, setSeriesFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [draftId, setDraftId] = useState<string | undefined>(selectedCompressorId);
  const [draftCount, setDraftCount] = useState<number>(compressorCount);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setTypeFilter("");
    setSeriesFilter("");
    setBrandFilter("");
    setDraftId(selectedCompressorId);
    setDraftCount(compressorCount);
    setLoading(true);
    loadCompressorIndex()
      .then((index) => {
        const mapped: CompressorItem[] = index.map((r: CompressorIndexRow) => ({
          id: r.id,
          model: r.model,
          series: r.compressor_type ?? undefined,
          type: r.application,
          refrigerantCode: r.refrigerant,
          brand: r.manufacturer,
          nominalCapacityW: r.nominal_cooling_capacity_w,
          nominalPowerW: r.nominal_power_w,
          nominalHp: r.nominal_hp,
        }));
        setItems(mapped);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [open, selectedCompressorId, compressorCount]);

  const types = useMemo(() => {
    const s = new Set<string>();
    items.forEach((i) => i.type && s.add(i.type));
    return Array.from(s).sort();
  }, [items]);

  const brands = useMemo(() => {
    const s = new Set<string>();
    items.forEach((i) => i.brand && s.add(i.brand));
    return Array.from(s).sort();
  }, [items]);

  const seriesList = useMemo(() => {
    const s = new Set<string>();
    items.forEach((i) => {
      if (!i.series) return;
      if (brandFilter && i.brand !== brandFilter) return;
      s.add(i.series);
    });
    return Array.from(s).sort();
  }, [items, brandFilter]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => {
      if (brandFilter && i.brand !== brandFilter) return false;
      if (typeFilter && i.type !== typeFilter) return false;
      if (seriesFilter && i.series !== seriesFilter) return false;
      if (!q) return true;
      return [i.model, i.id, i.series, i.type, i.refrigerantCode, i.brand]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [items, query, typeFilter, seriesFilter, brandFilter]);

  const draft = items.find((i) => i.id === draftId);

  const handleConfirm = () => {
    if (!draft) return;
    setSelectedCompressor(draft.id);
    setCompressorCount(draftCount);
    onClose();
  };

  const handleClear = () => {
    setSelectedCompressor(undefined);
    setCompressorCount(1);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            Selecionar Compressor
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Busca + filtros */}
          <div className="grid grid-cols-6 gap-2">
            <div className="relative col-span-3">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                autoFocus
                placeholder="Buscar por modelo, marca, série…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            <select
              value={brandFilter}
              onChange={(e) => {
                setBrandFilter(e.target.value);
                setSeriesFilter("");
              }}
              className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs"
            >
              <option value="">Fabricante</option>
              {brands.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs"
            >
              <option value="">Aplicação</option>
              {types.map((t) => (
                <option key={t} value={t}>{applicationLabels[t] ?? t}</option>
              ))}
            </select>
            <select
              value={seriesFilter}
              onChange={(e) => setSeriesFilter(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs"
            >
              <option value="">Série</option>
              {seriesList.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Lista */}
          <div className="max-h-72 overflow-auto rounded-lg border border-slate-200">
            {loading ? (
              <div className="p-4 text-center text-xs text-slate-500">Carregando 12.251 compressores…</div>
            ) : filtered.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500">
                Nenhum compressor encontrado ({items.length} no catálogo).
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 text-xs">
                {filtered.slice(0, 200).map((c) => {
                  const active = c.id === draftId;
                  const meta = [c.brand, c.type, c.series, c.refrigerantCode]
                    .filter(Boolean)
                    .join(" • ");
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => setDraftId(c.id)}
                        className={`flex w-full flex-col gap-0.5 px-3 py-2 text-left transition ${
                          active
                            ? "bg-amber-100 text-amber-900"
                            : "hover:bg-slate-50 text-slate-700"
                        }`}
                      >
                        <span className="font-medium">{c.model}</span>
                        {meta && (
                          <span className="text-[10px] text-slate-500">{meta}</span>
                        )}
                      </button>
                    </li>
                  );
                })}
                {filtered.length > 200 && (
                  <li className="px-3 py-2 text-center text-[10px] text-slate-400">
                    Mostrando 200 de {filtered.length}. Refine a busca.
                  </li>
                )}
              </ul>
            )}
          </div>

          {/* Quantidade */}
          <div className="grid grid-cols-2 gap-3">
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
            {draft && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs">
                <div className="font-semibold text-amber-900">{draft.model}</div>
                <div className="text-[10px] text-amber-800">
                  {draftCount}× compressor — capacidade total = unitária × {draftCount}
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="sm:justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="text-xs text-slate-600"
          >
            <X className="mr-1 h-3.5 w-3.5" />
            Sem compressor
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleConfirm} disabled={!draft}>Aplicar</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
