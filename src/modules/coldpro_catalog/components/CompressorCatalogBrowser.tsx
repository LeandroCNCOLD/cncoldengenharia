import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  loadCompressorIndex,
  getCompressorById,
  getCompressorCatalogStats,
} from "../data/compressorCatalog.service";
import type {
  CompressorIndexRow,
  CompressorApplication,
  CompressorManufacturer,
} from "../data/compressorCatalog.types";
import type {
  CatalogEquipmentRow,
  Refrigerant,
} from "../data/equipmentCatalog.types";

const W_TO_KCALH = 1 / 1.163;

const APP_LABEL: Record<CompressorApplication, string> = {
  LT: "LT (Congelados)",
  MT: "MT (Resfriados)",
  HT: "HT (Climatização)",
};

const KNOWN_REFRIGERANTS: Refrigerant[] = [
  "R404A",
  "R507A",
  "R134a",
  "R22",
  "R410A",
  "R448A",
  "R449A",
  "R452A",
  "R290",
];

function toRefrigerant(value: string): Refrigerant {
  return (KNOWN_REFRIGERANTS as readonly string[]).includes(value)
    ? (value as Refrigerant)
    : "unknown";
}

function rowToCatalogEquipment(
  row: Awaited<ReturnType<typeof getCompressorById>>,
): CatalogEquipmentRow | null {
  if (!row) return null;
  const capKcalH = row.nominal_cooling_capacity_w
    ? row.nominal_cooling_capacity_w * W_TO_KCALH
    : undefined;
  return {
    id: row.id,
    modelo: row.model,
    modeloUnico: row.id,
    family: "compressor",
    fabricante: row.manufacturer,
    refrigerante: toRefrigerant(row.refrigerant),
    capacidadeFrigorificaKcalH: capKcalH,
    capacidadeCompressorKcalH: capKcalH,
    potenciaEletricaKw: row.nominal_power_w
      ? row.nominal_power_w / 1000
      : undefined,
    potenciaCompressorKw: row.nominal_power_w
      ? row.nominal_power_w / 1000
      : undefined,
    tensaoV: row.voltage ? Number(row.voltage) || undefined : undefined,
    tempEvaporacaoC: row.nominal_evap_temp_c ?? undefined,
    tempCondensacaoC: row.nominal_cond_temp_c ?? undefined,
  } as CatalogEquipmentRow;
}

interface Props {
  onSelect: (item: CatalogEquipmentRow) => void;
  selectedId?: string;
}

export function CompressorCatalogBrowser({ onSelect, selectedId }: Props) {
  const [index, setIndex] = useState<CompressorIndexRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{ total: number; byManufacturer: Record<string, number> } | null>(null);

  const [manufacturer, setManufacturer] = useState<CompressorManufacturer | "all">("all");
  const [application, setApplication] = useState<CompressorApplication | "all">("all");
  const [refrigerant, setRefrigerant] = useState<string>("all");
  const [minHp, setMinHp] = useState<string>("");
  const [maxHp, setMaxHp] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadCompressorIndex()
      .then((data) => {
        if (cancelled) return;
        setIndex(data);
        return getCompressorCatalogStats();
      })
      .then((s) => {
        if (cancelled || !s) return;
        setStats({ total: s.total, byManufacturer: s.byManufacturer });
      })
      .catch((err) => !cancelled && setError(String(err)));
    return () => {
      cancelled = true;
    };
  }, []);

  const refrigerantOptions = useMemo(() => {
    if (!index) return [] as string[];
    const set = new Set<string>();
    index.forEach((r) => r.all_refrigerants.forEach((x) => set.add(x)));
    return [...set].sort();
  }, [index]);

  const filtered = useMemo(() => {
    if (!index) return [] as CompressorIndexRow[];
    const q = search.trim().toLowerCase();
    const minHpN = minHp ? Number(minHp) : null;
    const maxHpN = maxHp ? Number(maxHp) : null;
    return index.filter((r) => {
      if (manufacturer !== "all" && r.manufacturer !== manufacturer) return false;
      if (application !== "all" && r.application !== application) return false;
      if (refrigerant !== "all" && !r.all_refrigerants.includes(refrigerant)) return false;
      if (minHpN != null && (r.nominal_hp ?? 0) < minHpN) return false;
      if (maxHpN != null && (r.nominal_hp ?? Infinity) > maxHpN) return false;
      if (q && !r.model.toLowerCase().includes(q) && !r.manufacturer.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [index, manufacturer, application, refrigerant, minHp, maxHp, search]);

  const parentRef = useRef<HTMLDivElement | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 12,
  });

  function clearFilters() {
    setManufacturer("all");
    setApplication("all");
    setRefrigerant("all");
    setMinHp("");
    setMaxHp("");
    setSearch("");
  }

  async function handlePick(row: CompressorIndexRow) {
    try {
      setLoadingId(row.id);
      const full = await getCompressorById(row.id);
      const eq = rowToCatalogEquipment(full);
      if (eq) onSelect(eq);
    } finally {
      setLoadingId(null);
    }
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        Falha ao carregar catálogo: {error}
      </div>
    );
  }

  if (!index) {
    return (
      <div className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        Carregando catálogo de compressores (12 mil modelos)...
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-border bg-card p-4">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            Catálogo Geral de Compressores
          </h3>
          <p className="text-xs text-muted-foreground">
            {stats
              ? `${stats.total.toLocaleString("pt-BR")} modelos · ${Object.entries(stats.byManufacturer)
                  .map(([m, n]) => `${m}: ${n.toLocaleString("pt-BR")}`)
                  .join(" · ")}`
              : "Carregando estatísticas..."}
          </p>
        </div>
        <span className="text-xs font-medium text-muted-foreground">
          {filtered.length.toLocaleString("pt-BR")} resultado(s)
        </span>
      </header>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
        <select
          value={manufacturer}
          onChange={(e) => setManufacturer(e.target.value as CompressorManufacturer | "all")}
          className="rounded-md border border-border bg-background px-2 py-1 text-sm"
        >
          <option value="all">Todos fabricantes</option>
          <option value="Copeland">Copeland</option>
          <option value="Bitzer">Bitzer</option>
        </select>
        <select
          value={application}
          onChange={(e) => setApplication(e.target.value as CompressorApplication | "all")}
          className="rounded-md border border-border bg-background px-2 py-1 text-sm"
        >
          <option value="all">Todas aplicações</option>
          <option value="LT">LT (Congelados)</option>
          <option value="MT">MT (Resfriados)</option>
          <option value="HT">HT (Climatização)</option>
        </select>
        <select
          value={refrigerant}
          onChange={(e) => setRefrigerant(e.target.value)}
          className="rounded-md border border-border bg-background px-2 py-1 text-sm"
        >
          <option value="all">Todos refrigerantes</option>
          {refrigerantOptions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <input
          type="number"
          placeholder="HP mín."
          value={minHp}
          onChange={(e) => setMinHp(e.target.value)}
          className="rounded-md border border-border bg-background px-2 py-1 text-sm"
        />
        <input
          type="number"
          placeholder="HP máx."
          value={maxHp}
          onChange={(e) => setMaxHp(e.target.value)}
          className="rounded-md border border-border bg-background px-2 py-1 text-sm"
        />
        <input
          type="text"
          placeholder="Buscar modelo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-md border border-border bg-background px-2 py-1 text-sm"
        />
      </div>

      <div className="flex justify-end">
        <button
          onClick={clearFilters}
          className="text-xs text-muted-foreground hover:text-foreground underline"
        >
          Limpar filtros
        </button>
      </div>

      <div
        ref={parentRef}
        className="h-[480px] overflow-auto rounded-md border border-border bg-background"
      >
        {filtered.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Nenhum modelo corresponde aos filtros.</p>
        ) : (
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              position: "relative",
              width: "100%",
            }}
          >
            {rowVirtualizer.getVirtualItems().map((vi) => {
              const r = filtered[vi.index];
              const isSelected = r.id === selectedId;
              const isLoading = r.id === loadingId;
              return (
                <button
                  key={r.id}
                  onClick={() => handlePick(r)}
                  disabled={isLoading}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: `${vi.size}px`,
                    transform: `translateY(${vi.start}px)`,
                  }}
                  className={`flex items-center justify-between gap-3 border-b border-border px-3 py-2 text-left text-sm hover:bg-muted/50 ${
                    isSelected ? "bg-primary/10" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{r.model}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {r.manufacturer} · {APP_LABEL[r.application]} · {r.refrigerant}
                      {r.compressor_type ? ` · ${r.compressor_type}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end text-xs text-muted-foreground">
                    {r.nominal_hp != null && <span>{r.nominal_hp} HP</span>}
                    {r.nominal_cooling_capacity_w != null && (
                      <span>
                        {(r.nominal_cooling_capacity_w / 1000).toFixed(1)} kW
                      </span>
                    )}
                    {r.frequency_hz && <span>{r.frequency_hz} Hz</span>}
                  </div>
                  {isLoading && (
                    <span className="text-xs text-muted-foreground">...</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
