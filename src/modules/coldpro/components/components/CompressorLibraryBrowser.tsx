import { useMemo, useState } from "react";
import { Search, ChevronRight, Plus, AlertCircle, Loader2 } from "lucide-react";
import {
  useCompressorLibrary,
  groupByManufacturer,
  type LibraryCompressor,
} from "../../hooks/useEquipmentLibrary";
import { useComponentStore } from "../../stores/useComponentStore";

export function CompressorLibraryBrowser() {
  const { loading, error, data } = useCompressorLibrary();
  const addCompressor = useComponentStore((s) => s.addCompressor);
  const [search, setSearch] = useState("");
  const [selectedManufacturer, setSelectedManufacturer] = useState<string | null>(null);
  const [selected, setSelected] = useState<LibraryCompressor | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter(
      (c) =>
        c.model.toLowerCase().includes(q) ||
        c.manufacturer.toLowerCase().includes(q) ||
        c.refrigerant.some((r) => r.toLowerCase().includes(q)),
    );
  }, [data, search]);

  const grouped = useMemo(() => groupByManufacturer(filtered), [filtered]);
  const manufacturers = useMemo(() => [...grouped.keys()], [grouped]);
  const models = selectedManufacturer ? grouped.get(selectedManufacturer) ?? [] : [];

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
      <header className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Biblioteca de compressores ({data.length} modelos)
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
      </header>

      <div className="grid grid-cols-1 md:grid-cols-[200px_240px_1fr]">
        {/* Coluna 1 — Fabricantes */}
        <div className="max-h-[420px] overflow-y-auto border-b border-slate-200 md:border-b-0 md:border-r">
          <p className="sticky top-0 bg-slate-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Fabricantes ({manufacturers.length})
          </p>
          {manufacturers.map((m) => (
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
                {grouped.get(m)?.length ?? 0}
              </span>
            </button>
          ))}
        </div>

        {/* Coluna 2 — Modelos */}
        <div className="max-h-[420px] overflow-y-auto border-b border-slate-200 md:border-b-0 md:border-r">
          <p className="sticky top-0 bg-slate-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            {selectedManufacturer ? `Modelos (${models.length})` : "Selecione um fabricante"}
          </p>
          {models.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelected(m)}
              className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs transition-colors ${
                selected?.id === m.id
                  ? "bg-[#1E6FD9]/10 font-medium text-[#1E6FD9]"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{m.model}</p>
                <p className="truncate text-[10px] text-slate-500">
                  {m.refrigerant.join(", ")} · {m.cooling_capacity_kw.toFixed(2)} kW
                </p>
              </div>
              <ChevronRight className="h-3 w-3 shrink-0 text-slate-400" />
            </button>
          ))}
        </div>

        {/* Coluna 3 — Detalhes */}
        <div className="max-h-[420px] overflow-y-auto p-4">
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
