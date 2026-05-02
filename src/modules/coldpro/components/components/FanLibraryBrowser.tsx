import { useMemo, useState } from "react";
import { Search, ChevronRight, Plus, AlertCircle, Loader2, Fan as FanIcon } from "lucide-react";
import {
  useFanLibrary,
  groupByManufacturer,
  type LibraryFan,
} from "../../hooks/useEquipmentLibrary";
import { useComponentStore } from "../../stores/useComponentStore";

/**
 * Estima vazão livre (m³/h) a partir do polinômio SPH(Q) ≈ a0 + a1·Q + …
 * resolvendo SPH(Q) = 0 numericamente. Retorna 0 se SPH(0) ≤ 0.
 */
function estimateMaxAirflow(sphCoeffs: number[]): number {
  const sph = (q: number) => sphCoeffs.reduce((acc, c, i) => acc + c * q ** i, 0);
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

// EBM-Papst — decodificação do código de modelo:
//   [Série A-Z][dígito][Tipo motor A-Z][Tamanho 3-4 dígitos]…
const MODEL_REGEX = /^([A-Z])(\d)([A-Z])(\d{3,4})/;

const MOTOR_TYPE_LABEL: Record<string, string> = {
  D: "DC",
  E: "AC capacitor",
  G: "EC (electronic)",
  H: "EC HyBlade",
  M: "AC",
  N: "EC backward",
  S: "EC RadiPac",
};

interface FanFacets {
  series: string | null;
  motorCode: string | null;
  motorLabel: string;
  sizeMm: number | null;
}

function decodeModel(model: string): FanFacets {
  const m = MODEL_REGEX.exec(model);
  if (!m) {
    return { series: null, motorCode: null, motorLabel: "Outros", sizeMm: null };
  }
  const [, series, , motor, size] = m;
  return {
    series,
    motorCode: motor,
    motorLabel: MOTOR_TYPE_LABEL[motor] ?? motor,
    sizeMm: Number(size),
  };
}

interface EnrichedFan extends LibraryFan {
  facets: FanFacets;
  freeFlowM3h: number;
  sphAt0Pa: number;
}

export function FanLibraryBrowser() {
  const { loading, error, data } = useFanLibrary();
  const addFan = useComponentStore((s) => s.addFan);

  const [search, setSearch] = useState("");
  const [seriesFilter, setSeriesFilter] = useState<string>("ALL");
  const [motorFilter, setMotorFilter] = useState<string>("ALL");
  const [sizeFilter, setSizeFilter] = useState<string>("ALL");
  const [minFlow, setMinFlow] = useState<number>(0);
  const [minPressure, setMinPressure] = useState<number>(0);

  const [selectedManufacturer, setSelectedManufacturer] = useState<string | null>(null);
  const [selected, setSelected] = useState<EnrichedFan | null>(null);
  const [role, setRole] = useState<"evaporator_fan" | "condenser_fan">("evaporator_fan");

  // Enriquecer todos os ventiladores com facets + vazão livre + SPH@0.
  const enriched: EnrichedFan[] = useMemo(
    () =>
      data.map((f) => ({
        ...f,
        facets: decodeModel(f.model),
        freeFlowM3h: estimateMaxAirflow(f.sph_coefficients),
        sphAt0Pa: f.sph_coefficients[0] ?? 0,
      })),
    [data],
  );

  // Listas únicas para os selects (sempre baseadas no dataset bruto).
  const allSeries = useMemo(
    () =>
      [...new Set(enriched.map((f) => f.facets.series).filter((s): s is string => !!s))].sort(),
    [enriched],
  );
  const allMotors = useMemo(() => {
    const set = new Set<string>();
    for (const f of enriched) if (f.facets.motorCode) set.add(f.facets.motorCode);
    return [...set].sort();
  }, [enriched]);
  const allSizes = useMemo(
    () =>
      [...new Set(enriched.map((f) => f.facets.sizeMm).filter((s): s is number => s !== null))].sort(
        (a, b) => a - b,
      ),
    [enriched],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched.filter((f) => {
      if (seriesFilter !== "ALL" && f.facets.series !== seriesFilter) return false;
      if (motorFilter !== "ALL" && f.facets.motorCode !== motorFilter) return false;
      if (sizeFilter !== "ALL" && String(f.facets.sizeMm) !== sizeFilter) return false;
      if (minFlow > 0 && f.freeFlowM3h < minFlow) return false;
      if (minPressure > 0 && f.sphAt0Pa < minPressure) return false;
      if (!q) return true;
      return (
        f.model.toLowerCase().includes(q) ||
        f.manufacturer.toLowerCase().includes(q) ||
        f.facets.motorLabel.toLowerCase().includes(q)
      );
    });
  }, [enriched, search, seriesFilter, motorFilter, sizeFilter, minFlow, minPressure]);

  const grouped = useMemo(() => groupByManufacturer(filtered), [filtered]);
  const manufacturers = useMemo(() => [...grouped.keys()], [grouped]);
  const models = selectedManufacturer ? grouped.get(selectedManufacturer) ?? [] : [];

  const resetFilters = () => {
    setSearch("");
    setSeriesFilter("ALL");
    setMotorFilter("ALL");
    setSizeFilter("ALL");
    setMinFlow(0);
    setMinPressure(0);
  };

  const handleImport = () => {
    if (!selected) return;
    addFan(`${selected.manufacturer} ${selected.model}`, role, {
      airflow_m3_h: selected.freeFlowM3h > 0 ? selected.freeFlowM3h : 1000,
      available_static_pressure_pa: selected.sphAt0Pa,
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

  const filtersActive =
    search.trim() !== "" ||
    seriesFilter !== "ALL" ||
    motorFilter !== "ALL" ||
    sizeFilter !== "ALL" ||
    minFlow > 0 ||
    minPressure > 0;

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <header className="flex flex-col gap-3 border-b border-slate-200 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <FanIcon className="h-4 w-4 text-[#1E6FD9]" />
              Biblioteca de ventiladores · {data.length} modelos · {allSizes.length} tamanhos
            </h3>
            <p className="text-xs text-slate-500">
              Filtre por série, tipo de motor, diâmetro, vazão e pressão · selecione função e
              importe.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={role}
              onChange={(e) =>
                setRole(e.target.value as "evaporator_fan" | "condenser_fan")
              }
              className="rounded-md border border-slate-200 bg-white py-1.5 px-2 text-xs"
            >
              <option value="evaporator_fan">Função: Evaporador</option>
              <option value="condenser_fan">Função: Condensador</option>
            </select>
            {filtersActive && (
              <button
                type="button"
                onClick={resetFilters}
                className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
              >
                Limpar filtros
              </button>
            )}
          </div>
        </div>

        {/* Linha 1 — busca textual */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar modelo (ex.: A3G300, R6G500…), motor ou fabricante"
            className="w-full rounded-md border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-[#1E6FD9] focus:bg-white"
          />
        </div>

        {/* Linha 2 — facets categóricos */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <FilterSelect
            label="Série"
            value={seriesFilter}
            onChange={setSeriesFilter}
            options={[
              { value: "ALL", label: "Todas as séries" },
              ...allSeries.map((s) => ({ value: s, label: `Série ${s}` })),
            ]}
          />
          <FilterSelect
            label="Motor"
            value={motorFilter}
            onChange={setMotorFilter}
            options={[
              { value: "ALL", label: "Todos os motores" },
              ...allMotors.map((code) => ({
                value: code,
                label: `${code} — ${MOTOR_TYPE_LABEL[code] ?? code}`,
              })),
            ]}
          />
          <FilterSelect
            label="Diâmetro (mm)"
            value={sizeFilter}
            onChange={setSizeFilter}
            options={[
              { value: "ALL", label: "Todos os diâmetros" },
              ...allSizes.map((s) => ({ value: String(s), label: `${s} mm` })),
            ]}
          />
          <FilterNumber
            label="Vazão mín. (m³/h)"
            value={minFlow}
            onChange={setMinFlow}
            placeholder="0"
            step={500}
          />
          <FilterNumber
            label="Pressão mín. @Q=0 (Pa)"
            value={minPressure}
            onChange={setMinPressure}
            placeholder="0"
            step={50}
          />
        </div>

        <p className="text-[11px] text-slate-500">
          {filtered.length} ventilador{filtered.length === 1 ? "" : "es"} correspond
          {filtered.length === 1 ? "e" : "em"} aos filtros
          {filtersActive ? "" : " (nenhum filtro aplicado)"}.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-[200px_260px_1fr]">
        {/* Coluna 1 — Fabricantes */}
        <div className="max-h-[480px] overflow-y-auto border-b border-slate-200 md:border-b-0 md:border-r">
          <p className="sticky top-0 bg-slate-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Fabricantes ({manufacturers.length})
          </p>
          {manufacturers.length === 0 && (
            <p className="px-3 py-4 text-xs text-slate-400">
              Nenhum ventilador com esses filtros.
            </p>
          )}
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
        <div className="max-h-[480px] overflow-y-auto border-b border-slate-200 md:border-b-0 md:border-r">
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
                  {m.facets.motorLabel}
                  {m.facets.sizeMm ? ` · Ø${m.facets.sizeMm} mm` : ""} ·{" "}
                  {m.freeFlowM3h > 0 ? `${m.freeFlowM3h.toLocaleString()} m³/h` : "—"}
                </p>
              </div>
              <ChevronRight className="h-3 w-3 shrink-0 text-slate-400" />
            </button>
          ))}
        </div>

        {/* Coluna 3 — Detalhes */}
        <div className="max-h-[480px] overflow-y-auto p-4">
          {selected ? (
            <FanDetail item={selected} onImport={handleImport} />
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

function FanDetail({ item, onImport }: { item: EnrichedFan; onImport: () => void }) {
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

      <Section title="Identificação">
        <Row label="Série" value={item.facets.series ?? "—"} />
        <Row label="Tipo de motor" value={`${item.facets.motorCode ?? "—"} (${item.facets.motorLabel})`} />
        <Row label="Diâmetro nominal" value={item.facets.sizeMm ? `${item.facets.sizeMm} mm` : "—"} />
      </Section>

      <Section title="Curva característica (estimada)">
        <Row label="Pressão estática @ Q=0" value={`${item.sphAt0Pa.toFixed(1)} Pa`} />
        <Row
          label="Vazão livre (SPH=0)"
          value={item.freeFlowM3h > 0 ? `${item.freeFlowM3h.toLocaleString()} m³/h` : "—"}
        />
      </Section>

      <Section title="Coeficientes polinomiais">
        <p className="text-[10px] text-slate-500">
          {item.coefficient_count} coef. · SPH(Q) e Power(Q)
        </p>
        <details className="mt-1.5">
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

      <p className="text-[10px] text-slate-400">Qualidade: {item.data_quality ?? "—"}</p>
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

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="block text-[10px] font-medium uppercase tracking-wider text-slate-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-0.5 w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs outline-none focus:border-[#1E6FD9] focus:bg-white"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function FilterNumber({
  label,
  value,
  onChange,
  placeholder,
  step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  placeholder?: string;
  step?: number;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] font-medium uppercase tracking-wider text-slate-500">
        {label}
      </span>
      <input
        type="number"
        min={0}
        step={step ?? 1}
        value={value === 0 ? "" : value}
        placeholder={placeholder}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="mt-0.5 w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs outline-none focus:border-[#1E6FD9] focus:bg-white"
      />
    </label>
  );
}
