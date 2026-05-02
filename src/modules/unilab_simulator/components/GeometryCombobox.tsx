import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  filterCoilGeometries,
  TIPO_SERPENTINA_VALUES,
  type CoilGeometryItem,
  type TipoSerpentina,
} from "../services/coilGeometryCatalogService";

interface GeometryComboboxProps {
  geometries: CoilGeometryItem[];
  selectedId?: string;
  onChange: (geometry: CoilGeometryItem | undefined) => void;
  disabled?: boolean;
}

/**
 * Combobox pesquisável + virtualizado para as 753 geometrias UNILAB.
 *
 * - Busca com debounce de 300ms
 * - Filtro por tipo_serpentina
 * - Lista virtualizada (@tanstack/react-virtual) — sem travamento mesmo com 753 itens
 */
export function GeometryCombobox({
  geometries,
  selectedId,
  onChange,
  disabled,
}: GeometryComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [tipo, setTipo] = useState<TipoSerpentina | "">("");

  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Debounce 300ms
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  // Fecha ao clicar fora
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const filtered = useMemo(
    () => filterCoilGeometries(geometries, { search: debouncedSearch, tipo }),
    [geometries, debouncedSearch, tipo],
  );

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 52,
    overscan: 8,
  });

  const selected = useMemo(
    () => geometries.find((g) => g.id === selectedId),
    [geometries, selectedId],
  );

  const handleSelect = (g: CoilGeometryItem) => {
    onChange(g);
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(undefined);
    setSearchInput("");
  };

  return (
    <div className="space-y-2" ref={wrapperRef}>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-700">Tipo de serpentina</label>
          <select
            value={tipo}
            disabled={disabled}
            onChange={(e) => setTipo(e.target.value as TipoSerpentina | "")}
            className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 shadow-sm focus:border-[#1E6FD9] focus:outline-none focus:ring-1 focus:ring-[#1E6FD9] disabled:cursor-not-allowed disabled:bg-slate-50"
          >
            <option value="">Todos os tipos</option>
            {TIPO_SERPENTINA_VALUES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-700">
            Geometria ({filtered.length} de {geometries.length})
          </label>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-2 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-left text-sm text-slate-900 shadow-sm hover:border-slate-400 focus:border-[#1E6FD9] focus:outline-none focus:ring-1 focus:ring-[#1E6FD9] disabled:cursor-not-allowed disabled:bg-slate-50"
          >
            <span className="min-w-0 flex-1 truncate">
              {selected ? (
                <span>
                  <span className="font-mono text-[11px] text-slate-500">{selected.codigo}</span>{" "}
                  · {selected.descricao}
                </span>
              ) : (
                <span className="text-slate-400">Selecione uma geometria…</span>
              )}
            </span>
            {selected ? (
              <X
                className="h-3.5 w-3.5 shrink-0 text-slate-400 hover:text-slate-700"
                onClick={handleClear}
              />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            )}
          </button>
        </div>
      </div>

      {open && (
        <div className="relative">
          <div className="absolute z-20 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg">
            <div className="border-b border-slate-200 p-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  autoFocus
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Buscar por código, sigla ou descrição…"
                  className="w-full rounded-md border border-slate-200 bg-slate-50 py-1.5 pl-7 pr-2 text-xs outline-none focus:border-[#1E6FD9] focus:bg-white"
                />
              </div>
            </div>

            {filtered.length === 0 ? (
              <p className="p-4 text-center text-xs text-slate-400">
                Nenhuma geometria com esses filtros.
              </p>
            ) : (
              <div ref={listRef} className="max-h-[320px] overflow-y-auto">
                <div
                  style={{
                    height: `${virtualizer.getTotalSize()}px`,
                    width: "100%",
                    position: "relative",
                  }}
                >
                  {virtualizer.getVirtualItems().map((row) => {
                    const g = filtered[row.index];
                    const isSelected = g.id === selectedId;
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => handleSelect(g)}
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          height: `${row.size}px`,
                          transform: `translateY(${row.start}px)`,
                        }}
                        className={`flex flex-col justify-center gap-0.5 px-3 py-1 text-left text-xs transition-colors ${
                          isSelected
                            ? "bg-[#1E6FD9]/10 text-[#1E6FD9]"
                            : "text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <span className="truncate font-medium">{g.descricao}</span>
                        <span className="truncate text-[10px] text-slate-500">
                          <span className="font-mono">{g.codigo}</span>
                          {g.tipo_serpentina ? ` · ${g.tipo_serpentina}` : ""}
                          {g.diametro_externo_tubo_mm
                            ? ` · Ø ${g.diametro_externo_tubo_mm} mm`
                            : ""}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
