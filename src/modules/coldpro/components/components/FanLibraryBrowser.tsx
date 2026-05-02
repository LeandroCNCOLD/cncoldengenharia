import { useMemo, useState } from "react";
import { Search, ChevronRight, Plus, AlertCircle, Loader2 } from "lucide-react";
import {
  useFanLibrary,
  groupByManufacturer,
  type LibraryFan,
} from "../../hooks/useEquipmentLibrary";
import { useComponentStore } from "../../stores/useComponentStore";

/**
 * Estima vazão nominal (m³/h) a partir do polinômio SPH(Q) ≈ a0 + a1·Q + …
 * resolvendo SPH(Q) = 0 numericamente. Retorna 0 se não encontrar raiz física.
 */
function estimateMaxAirflow(sphCoeffs: number[]): number {
  const sph = (q: number) => sphCoeffs.reduce((acc, c, i) => acc + c * q ** i, 0);
  // Bisseção entre 0 e 30000 m³/h (faixa razoável)
  let lo = 0;
  let hi = 30000;
  if (sph(lo) <= 0) return 0;
  if (sph(hi) > 0) return hi;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (sph(mid) > 0) lo = mid;
    else hi = mid;
  }
  return Math.round((lo + hi) / 2);
}

export function FanLibraryBrowser() {
  const { loading, error, data } = useFanLibrary();
  const addFan = useComponentStore((s) => s.addFan);
  const [search, setSearch] = useState("");
  const [selectedManufacturer, setSelectedManufacturer] = useState<string | null>(null);
  const [selected, setSelected] = useState<LibraryFan | null>(null);
  const [role, setRole] = useState<"evaporator_fan" | "condenser_fan">("evaporator_fan");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter(
      (f) => f.model.toLowerCase().includes(q) || f.manufacturer.toLowerCase().includes(q),
    );
  }, [data, search]);

  const grouped = useMemo(() => groupByManufacturer(filtered), [filtered]);
  const manufacturers = useMemo(() => [...grouped.keys()], [grouped]);
  const models = selectedManufacturer ? grouped.get(selectedManufacturer) ?? [] : [];

  const maxAirflow = useMemo(
    () => (selected ? estimateMaxAirflow(selected.sph_coefficients) : 0),
    [selected],
  );

  const handleImport = () => {
    if (!selected) return;
    addFan(`${selected.manufacturer} ${selected.model}`, role, {
      airflow_m3_h: maxAirflow > 0 ? maxAirflow : 1000,
      available_static_pressure_pa: selected.sph_coefficients[0] ?? 0,
    });
    setSelected(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white p-8 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando biblioteca de ventiladores…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-medium">Não foi possível carregar a biblioteca de ventiladores.</p>
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
            Biblioteca de ventiladores ({data.length} modelos)
          </h3>
          <p className="text-xs text-slate-500">
            Selecione fabricante → modelo → importe com a função desejada.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "evaporator_fan" | "condenser_fan")}
            className="rounded-md border border-slate-200 bg-white py-1.5 px-2 text-xs"
          >
            <option value="evaporator_fan">Evaporador</option>
            <option value="condenser_fan">Condensador</option>
          </select>
          <div className="relative w-full sm:w-60">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar modelo, fabricante…"
              className="w-full rounded-md border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-[#1E6FD9] focus:bg-white"
            />
          </div>
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
              <span className="truncate font-medium">{m.model}</span>
              <ChevronRight className="h-3 w-3 shrink-0 text-slate-400" />
            </button>
          ))}
        </div>

        {/* Coluna 3 — Detalhes */}
        <div className="max-h-[420px] overflow-y-auto p-4">
          {selected ? (
            <FanDetail item={selected} maxAirflow={maxAirflow} onImport={handleImport} />
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

function FanDetail({
  item,
  maxAirflow,
  onImport,
}: {
  item: LibraryFan;
  maxAirflow: number;
  onImport: () => void;
}) {
  const sphAt0 = item.sph_coefficients[0] ?? 0;
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">
            {item.manufacturer} {item.model}
          </h4>
          <p className="text-xs text-slate-500">{item.source}</p>
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

      <Section title="Curva característica (estimada)">
        <Row label="Pressão estática @ Q=0" value={`${sphAt0.toFixed(1)} Pa`} />
        <Row
          label="Vazão livre (SPH=0)"
          value={maxAirflow > 0 ? `${maxAirflow.toLocaleString()} m³/h` : "—"}
        />
      </Section>

      <Section title="Coeficientes polinomiais">
        <p className="text-[10px] text-slate-500">
          {item.coefficient_count} coef. · SPH(Q) e Power(Q)
        </p>
        <details className="mt-1.5" open>
          <summary className="cursor-pointer text-xs text-[#1E6FD9] hover:underline">
            Ver pressão estática SPH(Q)
          </summary>
          <pre className="mt-1.5 max-h-32 overflow-auto rounded bg-slate-50 p-2 text-[10px] text-slate-700">
            {item.sph_coefficients.map((c, i) => `a${i}: ${c.toExponential(4)}`).join("\n")}
          </pre>
        </details>
        <details className="mt-1.5">
          <summary className="cursor-pointer text-xs text-[#1E6FD9] hover:underline">
            Ver potência absorvida Power(Q)
          </summary>
          <pre className="mt-1.5 max-h-32 overflow-auto rounded bg-slate-50 p-2 text-[10px] text-slate-700">
            {item.power_coefficients.map((c, i) => `p${i}: ${c.toExponential(4)}`).join("\n")}
          </pre>
        </details>
      </Section>

      <p className="text-[10px] text-slate-400">
        Qualidade: {item.data_quality ?? "—"}
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
