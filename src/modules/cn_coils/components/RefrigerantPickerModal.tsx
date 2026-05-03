import { useEffect, useMemo, useState } from "react";
import { Search, Droplet } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCnCoilsSimulationStore } from "../store/useUnilabSimulationStore";
import {
  loadRefrigerants,
  type RefrigerantOption,
} from "../services/refrigerantCatalogService";

interface Props {
  open: boolean;
  onClose: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  pure: "Puros",
  mixture: "Misturas",
};

/** Heurística: refrigerantes "comerciais" começam com R + dígito. */
function isCommercial(r: RefrigerantOption): boolean {
  const s = r.shortName ?? r.name ?? r.id;
  return /^R-?\d/i.test(s);
}

export function RefrigerantPickerModal({ open, onClose }: Props) {
  const fluid = useCnCoilsSimulationStore((s) => s.fluid);
  const setFluid = useCnCoilsSimulationStore((s) => s.setFluid);

  const [items, setItems] = useState<RefrigerantOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [onlyCommercial, setOnlyCommercial] = useState(true);
  const [draftId, setDraftId] = useState<string>(fluid);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setDraftId(fluid);
    setLoading(true);
    loadRefrigerants()
      .then((list) => setItems(list))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [open, fluid]);

  const types = useMemo(() => {
    const s = new Set<string>();
    items.forEach((i) => i.type && s.add(i.type));
    return Array.from(s).sort();
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const arr = items.filter((r) => {
      if (typeFilter && r.type !== typeFilter) return false;
      if (onlyCommercial && !q && !isCommercial(r)) return false;
      if (!q) return true;
      return [r.id, r.name, r.shortName, r.commercialName]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
    // Comerciais primeiro, depois alfabético natural
    return arr.sort((a, b) => {
      const ca = isCommercial(a);
      const cb = isCommercial(b);
      if (ca !== cb) return ca ? -1 : 1;
      const la = a.shortName ?? a.name ?? a.id;
      const lb = b.shortName ?? b.name ?? b.id;
      return la.localeCompare(lb, undefined, { numeric: true });
    });
  }, [items, query, typeFilter, onlyCommercial]);

  const draft = items.find((i) => i.id === draftId);

  const handleConfirm = () => {
    if (!draft) return;
    setFluid(draft.id);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Droplet className="h-4 w-4 text-sky-500" />
            Selecionar Fluido Refrigerante
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Busca + filtros */}
          <div className="grid grid-cols-4 gap-2">
            <div className="relative col-span-2">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                autoFocus
                placeholder="Buscar (R404A, R32, R134a, propano…)"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs"
            >
              <option value="">Todos os tipos</option>
              {types.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t] ?? t}
                </option>
              ))}
            </select>
            <label className="flex items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={onlyCommercial}
                onChange={(e) => setOnlyCommercial(e.target.checked)}
              />
              Só comerciais
            </label>
          </div>

          {/* Lista */}
          <div className="max-h-72 overflow-auto rounded-lg border border-slate-200">
            {loading ? (
              <div className="p-4 text-center text-xs text-slate-500">Carregando…</div>
            ) : filtered.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500">
                Nenhum fluido encontrado ({items.length} no catálogo).
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 text-xs">
                {filtered.slice(0, 200).map((r) => {
                  const active = r.id === draftId;
                  const label = r.shortName ?? r.name ?? r.id;
                  const sub =
                    r.name && r.name !== label
                      ? r.name
                      : r.commercialName && r.commercialName !== label
                        ? r.commercialName
                        : "";
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => setDraftId(r.id)}
                        className={`flex w-full flex-col gap-0.5 px-3 py-2 text-left transition ${
                          active
                            ? "bg-sky-100 text-sky-900"
                            : "hover:bg-slate-50 text-slate-700"
                        }`}
                      >
                        <div className="flex w-full items-center justify-between">
                          <span className="font-medium">{label}</span>
                          {r.type && (
                            <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[9px] font-bold uppercase text-slate-700">
                              {r.type === "mixture" ? "mist." : "puro"}
                            </span>
                          )}
                        </div>
                        {sub && (
                          <span className="text-[10px] text-slate-500">{sub}</span>
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!draft}>Aplicar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
