import { useMemo, useRef, useState } from "react";
import { Search, ChevronRight, Plus, AlertCircle, Loader2, X } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  useCompressorLibrary,
  groupByManufacturer,
  type LibraryCompressor,
} from "../../hooks/useEquipmentLibrary";
import { useComponentStore } from "../../stores/useComponentStore";

export function CompressorLibraryBrowser() {
  const { loading, error, data } = useCompressorLibrary();
  const addCompressor = useComponentStore((s) => s.addCompressor);

  // Filtros
  const [search, setSearch] = useState("");
  const [refrigerantFilter, setRefrigerantFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [applicationFilter, setApplicationFilter] = useState<string>("");
  const [minKw, setMinKw] = useState<string>("");
  const [maxKw, setMaxKw] = useState<string>("");

  const [selectedManufacturer, setSelectedManufacturer] = useState<string | null>(null);
  const [selected, setSelected] = useState<LibraryCompressor | null>(null);

  // Facets
  const facets = useMemo(() => {
    const refrigerants = new Set<string>();
    const types = new Set<string>();
    const applications = new Set<string>();
    for (const c of data) {
      c.refrigerant.forEach((r) => r && refrigerants.add(r));
      if (c.type) types.add(c.type);
      if (c.application_type) applications.add(c.application_type);
    }
    return {
      refrigerants: [...refrigerants].sort(),
      types: [...types].sort(),
      applications: [...applications].sort(),
    };
  }, [data]);

  // Aplicar filtros
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const min = minKw ? parseFloat(minKw) : null;
    const max = maxKw ? parseFloat(maxKw) : null;
    return data.filter((c) => {
      if (q) {
        const hit =
          c.model.toLowerCase().includes(q) ||
          c.manufacturer.toLowerCase().includes(q) ||
          c.refrigerant.some((r) => r.toLowerCase().includes(q));
        if (!hit) return false;
      }
      if (refrigerantFilter && !c.refrigerant.includes(refrigerantFilter)) return false;
      if (typeFilter && c.type !== typeFilter) return false;
      if (applicationFilter && c.application_type !== applicationFilter) return false;
      if (min !== null && c.cooling_capacity_kw < min) return false;
      if (max !== null && c.cooling_capacity_kw > max) return false;
      return true;
    });
  }, [data, search, refrigerantFilter, typeFilter, applicationFilter, minKw, maxKw]);

  const grouped = useMemo(() => groupByManufacturer(filtered), [filtered]);
  const manufacturers = useMemo(() => [...grouped.keys()], [grouped]);
  const models = selectedManufacturer ? grouped.get(selectedManufacturer) ?? [] : [];

  // Virtualização da lista de modelos
  const modelsParentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: models.length,
    getScrollElement: () => modelsParentRef.current,
    estimateSize: () => 48,
    overscan: 10,
  });

  const handleImport = () => {
    if (!selected) return;
    const nominal = selected.nominal_conditions ?? {};
    addCompressor(`${selected.manufacturer} ${selected.model}`, {
      cooling_capacity_w: selected.cooling_capacity_kw * 1000,
      power_w: selected.power_input_kw * 1000,
      refrigerant: selected.refrigerant[0] ?? "unknown",
      evap_temp_c: nominal.te_c ?? -10,
      cond_temp_c: nominal.tc_c ?? 35,
    });
    setSelected(null);
  };

  const resetFilters = () => {
    setSearch("");
    setRefrigerantFilter("");
    setTypeFilter("");
    setApplicationFilter("");
    setMinKw("");
    setMaxKw("");
  };

  const hasActiveFilters =
    search || refrigerantFilter || typeFilter || applicationFilter || minKw || maxKw;

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white p-8 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando biblioteca de compressores…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-medium">Não foi possível carregar a biblioteca de compressores.</p>
          <p className="mt-1 text-xs">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <header className="border-b border-slate-200 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Biblioteca de compressores ({filtered.length.toLocaleString("pt-BR")} de{" "}
              {data.length.toLocaleString("pt-BR")} modelos)
            </h3>
            <p className="text-xs text-slate-500">
              Selecione fabricante → modelo → importe para o cadastro.
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar modelo, fabricante, refrigerante…"
              className="w-full rounded-md border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-[#1E6FD9] focus:bg-white"
            />
          </div>
        </div>

        {/* Filtros faceted */}
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <FilterSelect
            label="Refrigerante"
            value={refrigerantFilter}
            onChange={setRefrigerantFilter}
            options={facets.refrigerants}
          />
          <FilterSelect
            label="Tipo"
            value={typeFilter}
            onChange={setTypeFilter}
            options={facets.types}
          />
          <FilterSelect
            label="Aplicação"
            value={applicationFilter}
            onChange={setApplicationFilter}
            options={facets.applications}
          />
          <FilterNumber
            label="Cap. mín. (kW)"
            value={minKw}
            onChange={setMinKw}
            placeholder="0"
          />
          <FilterNumber
            label="Cap. máx. (kW)"
            value={maxKw}
            onChange={setMaxKw}
            placeholder="∞"
          />
          <div className="flex items-end">
            <button
              type="button"
              onClick={resetFilters}
              disabled={!hasActiveFilters}
              className="flex w-full items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <X className="h-3 w-3" />
              Limpar
            </button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-[200px_280px_1fr]">
        {/* Coluna 1 — Fabricantes */}
        <div className="max-h-[460px] overflow-y-auto border-b border-slate-200 md:border-b-0 md:border-r">
          <p className="sticky top-0 bg-slate-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Fabricantes ({manufacturers.length})
          </p>
          {manufacturers.length === 0 ? (
            <p className="px-3 py-4 text-xs text-slate-400">
              Nenhum resultado com esses filtros.
            </p>
          ) : (
            manufacturers.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setSelectedManufacturer(m);
                  setSelected(null);
                }}
                className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs transition-colors ${
                  selectedManufacturer === m
                    ? "bg-[#1E6FD9]/10 font-medium text-[#1E6FD9]"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span className="truncate">{m}</span>
                <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                  {(grouped.get(m)?.length ?? 0).toLocaleString("pt-BR")}
                </span>
              </button>
            ))
          )}
        </div>

        {/* Coluna 2 — Modelos (virtualizado) */}
        <div
          ref={modelsParentRef}
          className="max-h-[460px] overflow-y-auto border-b border-slate-200 md:border-b-0 md:border-r"
        >
          <p className="sticky top-0 z-10 bg-slate-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            {selectedManufacturer
              ? `Modelos (${models.length.toLocaleString("pt-BR")})`
              : "Selecione um fabricante"}
          </p>
          {selectedManufacturer && models.length > 0 && (
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: "100%",
                position: "relative",
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const m = models[virtualRow.index];
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelected(m)}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    className={`flex items-center justify-between gap-2 px-3 py-2 text-left text-xs transition-colors ${
                      selected?.id === m.id
                        ? "bg-[#1E6FD9]/10 font-medium text-[#1E6FD9]"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{m.model}</p>
                      <p className="truncate text-[10px] text-slate-500">
                        {m.refrigerant.join(", ")} · {m.cooling_capacity_kw.toFixed(2)} kW
                        {m.type ? ` · ${m.type}` : ""}
                      </p>
                    </div>
                    <ChevronRight className="h-3 w-3 shrink-0 text-slate-400" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Coluna 3 — Detalhes */}
        <div className="max-h-[460px] overflow-y-auto p-4">
          {selected ? (
            <CompressorDetail item={selected} onImport={handleImport} />
          ) : (
            <p className="flex h-full items-center justify-center text-xs text-slate-400">
              Selecione um modelo para ver as características técnicas.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div>
      <label className="block text-[10px] font-medium uppercase tracking-wider text-slate-500">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-0.5 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-[#1E6FD9]"
      >
        <option value="">Todos</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

function FilterNumber({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-[10px] font-medium uppercase tracking-wider text-slate-500">
        {label}
      </label>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-0.5 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-[#1E6FD9]"
      />
    </div>
  );
}

function CompressorDetail({
  item,
  onImport,
}: {
  item: LibraryCompressor;
  onImport: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">
            {item.manufacturer} {item.model}
          </h4>
          <p className="text-xs text-slate-500">
            {item.type ?? "—"} · {item.application_type ?? "—"} · {item.standard ?? "—"}
          </p>
        </div>
        <button
          type="button"
          onClick={onImport}
          className="flex shrink-0 items-center gap-1.5 rounded-md bg-[#1E6FD9] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1558b0]"
        >
          <Plus className="h-3 w-3" />
          Importar
        </button>
      </div>

      <Section title="Capacidade nominal">
        <Row label="Capacidade frigorífica" value={`${item.cooling_capacity_kw.toFixed(3)} kW`} />
        {item.cooling_capacity_kcal_h && (
          <Row label="Capacidade (kcal/h)" value={item.cooling_capacity_kcal_h.toFixed(0)} />
        )}
        <Row label="Potência elétrica" value={`${item.power_input_kw.toFixed(3)} kW`} />
        <Row label="COP" value={item.cop?.toFixed(2) ?? "—"} />
      </Section>

      <Section title="Refrigerantes">
        <p className="text-xs text-slate-700">{item.refrigerant.join(", ")}</p>
      </Section>

      <Section title="Envelope operacional">
        <Row
          label="T evaporação (°C)"
          value={`${item.min_evap_temp_c ?? "—"} a ${item.max_evap_temp_c ?? "—"}`}
        />
        <Row
          label="T condensação (°C)"
          value={`${item.min_cond_temp_c ?? "—"} a ${item.max_cond_temp_c ?? "—"}`}
        />
      </Section>

      {item.nominal_conditions && (
        <Section title="Condições nominais">
          <Row label="Te" value={`${item.nominal_conditions.te_c ?? "—"} °C`} />
          <Row label="Tc" value={`${item.nominal_conditions.tc_c ?? "—"} °C`} />
          <Row label="Subresfriamento" value={`${item.nominal_conditions.subcooling_k ?? "—"} K`} />
          <Row label="Superaquecimento" value={`${item.nominal_conditions.superheat_k ?? "—"} K`} />
        </Section>
      )}

      {item.capacity_coefficients && item.capacity_coefficients.length > 0 && (
        <Section title="Coeficientes polinomiais">
          <p className="text-[10px] text-slate-500">
            Padrão: {item.standard ?? "—"} · Unidades: {item.coefficient_units ?? "—"}
          </p>
          <details className="mt-1.5">
            <summary className="cursor-pointer text-xs text-[#1E6FD9] hover:underline">
              Ver capacidade ({item.capacity_coefficients.length} coef.)
            </summary>
            <pre className="mt-1.5 max-h-32 overflow-auto rounded bg-slate-50 p-2 text-[10px] text-slate-700">
              {item.capacity_coefficients.map((c, i) => `c${i}: ${c.toExponential(4)}`).join("\n")}
            </pre>
          </details>
          {item.power_coefficients && item.power_coefficients.length > 0 && (
            <details className="mt-1.5">
              <summary className="cursor-pointer text-xs text-[#1E6FD9] hover:underline">
                Ver potência ({item.power_coefficients.length} coef.)
              </summary>
              <pre className="mt-1.5 max-h-32 overflow-auto rounded bg-slate-50 p-2 text-[10px] text-slate-700">
                {item.power_coefficients.map((c, i) => `p${i}: ${c.toExponential(4)}`).join("\n")}
              </pre>
            </details>
          )}
        </Section>
      )}

      <p className="text-[10px] text-slate-400">
        Fonte: {item.source} · Qualidade: {item.data_quality ?? "—"}
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {title}
      </p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-xs">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  );
}
