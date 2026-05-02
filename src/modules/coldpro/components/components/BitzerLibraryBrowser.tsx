import { useMemo, useState } from "react";
import { Search, ChevronRight, Plus, AlertCircle, Loader2, Cpu } from "lucide-react";
import {
  useBitzerLibrary,
  groupBitzerByModel,
  bitzerPolynomial9,
  type BitzerCompressor,
} from "../../hooks/useBitzerLibrary";
import { useComponentStore } from "../../stores/useComponentStore";

/**
 * Browser do catálogo BITZER (4062 entradas, 712 modelos × refrigerante × RPM).
 * Hierarquia: Modelo → (Refrigerante + RPM) → detalhe + importação.
 *
 * Importação: o usuário escolhe Te / Tc no painel; calculamos λ via polinômio
 * Bitzer 9-coef e estimamos a capacidade frigorífica de forma simplificada
 * (Q ≈ λ · Vh · ρ_ref · Δh). Como ρ·Δh depende do refrigerante e exigiria
 * tabela termodinâmica completa, gravamos a capacidade nominal Bitzer típica
 * apenas como referência — o motor termodinâmico real recalcula com base nos
 * coeficientes ao rodar a simulação.
 */
export function BitzerLibraryBrowser() {
  const { loading, error, data, meta } = useBitzerLibrary();
  const addCompressor = useComponentStore((s) => s.addCompressor);

  const [search, setSearch] = useState("");
  const [refrigFilter, setRefrigFilter] = useState<string>("ALL");
  const [rpmFilter, setRpmFilter] = useState<string>("ALL");

  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [selected, setSelected] = useState<BitzerCompressor | null>(null);

  const [te, setTe] = useState<number>(-10);
  const [tc, setTc] = useState<number>(35);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((c) => {
      if (refrigFilter !== "ALL" && c.refrigerant !== refrigFilter) return false;
      if (rpmFilter !== "ALL" && String(c.rpm) !== rpmFilter) return false;
      if (!q) return true;
      return (
        c.model.toLowerCase().includes(q) ||
        c.refrigerant.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q)
      );
    });
  }, [data, search, refrigFilter, rpmFilter]);

  const groupedByModel = useMemo(() => groupBitzerByModel(filtered), [filtered]);
  const models = useMemo(() => [...groupedByModel.keys()], [groupedByModel]);
  const variants = selectedModel ? groupedByModel.get(selectedModel) ?? [] : [];

  const lambda =
    selected?.coeff_lambda && selected.coeff_lambda.length >= 9
      ? bitzerPolynomial9(selected.coeff_lambda, te, tc)
      : null;
  const specPower =
    selected?.coeff_specific_power && selected.coeff_specific_power.length >= 9
      ? bitzerPolynomial9(selected.coeff_specific_power, te, tc)
      : null;
  const current =
    selected?.coeff_current && selected.coeff_current.length >= 9
      ? bitzerPolynomial9(selected.coeff_current, te, tc)
      : null;

  const handleImport = () => {
    if (!selected) return;
    // Capacidade frigorífica nominal aproximada usando λ · Vh com fator
    // genérico de densidade·entalpia (~120 kJ/m³ no aspirador para faixa típica).
    // Cada refrigerante tem valores diferentes — esta é apenas uma estimativa
    // para alimentar CompressorSpec.
    const Vh = selected.C10_displacement ?? 0; // m³/h
    const lambdaVal = lambda ?? 0.85;
    const capacityKw = lambdaVal * Vh * 0.034; // fator empírico (~kW por m³/h·λ)
    const powerKw = specPower != null && specPower > 0 ? capacityKw / specPower : capacityKw / 2.5;

    addCompressor(
      `BITZER ${selected.model} · ${selected.refrigerant}${selected.rpm ? ` · ${selected.rpm} rpm` : ""}`,
      {
        cooling_capacity_w: Math.max(1, capacityKw * 1000),
        power_w: Math.max(1, powerKw * 1000),
        refrigerant: selected.refrigerant,
        evap_temp_c: te,
        cond_temp_c: tc,
      },
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white p-8 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando catálogo BITZER (≈ 4.000 entradas)…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-medium">Não foi possível carregar o catálogo BITZER.</p>
          <p className="mt-1 text-xs">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <header className="flex flex-col gap-3 border-b border-slate-200 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Cpu className="h-4 w-4 text-[#1E6FD9]" />
              Catálogo BITZER · {meta?.models_count ?? 0} modelos · {data.length} entradas
            </h3>
            <p className="text-xs text-slate-500">
              Polinômios nativos BITZER (λ + corrente + potência específica) ·
              {" "}{meta?.refrigerants.length ?? 0} refrigerantes · {meta?.rpms.length ?? 0} rotações.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar modelo (ex.: 4DES-7, CSH8553)…"
              className="w-full rounded-md border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-[#1E6FD9] focus:bg-white"
            />
          </div>
          <select
            value={refrigFilter}
            onChange={(e) => setRefrigFilter(e.target.value)}
            className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs outline-none focus:border-[#1E6FD9] focus:bg-white"
          >
            <option value="ALL">Todos os refrigerantes</option>
            {meta?.refrigerants.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <select
            value={rpmFilter}
            onChange={(e) => setRpmFilter(e.target.value)}
            className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs outline-none focus:border-[#1E6FD9] focus:bg-white"
          >
            <option value="ALL">Todas as rotações</option>
            {meta?.rpms.map((r) => (
              <option key={r} value={String(r)}>
                {r} rpm
              </option>
            ))}
          </select>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-[220px_240px_1fr]">
        {/* Coluna 1 — Modelos */}
        <div className="max-h-[480px] overflow-y-auto border-b border-slate-200 md:border-b-0 md:border-r">
          <p className="sticky top-0 bg-slate-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Modelos ({models.length})
          </p>
          {models.length === 0 && (
            <p className="px-3 py-4 text-xs text-slate-400">Nenhum modelo com esses filtros.</p>
          )}
          {models.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setSelectedModel(m);
                setSelected(null);
              }}
              className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs transition-colors ${
                selectedModel === m
                  ? "bg-[#1E6FD9]/10 font-medium text-[#1E6FD9]"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span className="truncate">{m}</span>
              <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                {groupedByModel.get(m)?.length ?? 0}
              </span>
            </button>
          ))}
        </div>

        {/* Coluna 2 — Variantes (refrig × rpm) */}
        <div className="max-h-[480px] overflow-y-auto border-b border-slate-200 md:border-b-0 md:border-r">
          <p className="sticky top-0 bg-slate-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            {selectedModel ? `Variantes (${variants.length})` : "Selecione um modelo"}
          </p>
          {variants.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setSelected(v)}
              className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs transition-colors ${
                selected?.id === v.id
                  ? "bg-[#1E6FD9]/10 font-medium text-[#1E6FD9]"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{v.refrigerant}</p>
                <p className="truncate text-[10px] text-slate-500">
                  {v.rpm ? `${v.rpm} rpm` : "—"} · Vh = {v.C10_displacement?.toFixed(2) ?? "—"} m³/h
                </p>
              </div>
              <ChevronRight className="h-3 w-3 shrink-0 text-slate-400" />
            </button>
          ))}
        </div>

        {/* Coluna 3 — Detalhe + import */}
        <div className="max-h-[480px] overflow-y-auto p-4">
          {selected ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">
                    BITZER {selected.model}
                  </h4>
                  <p className="text-xs text-slate-500">
                    {selected.refrigerant} · {selected.rpm ? `${selected.rpm} rpm` : "rpm n/d"} ·{" "}
                    {selected.equation_type}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleImport}
                  className="flex shrink-0 items-center gap-1.5 rounded-md bg-[#1E6FD9] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1558b0]"
                >
                  <Plus className="h-3 w-3" />
                  Importar
                </button>
              </div>

              <Section title="Características técnicas">
                <Row
                  label="Deslocamento volumétrico (Vh)"
                  value={`${selected.C10_displacement?.toFixed(3) ?? "—"} m³/h`}
                />
                <Row label="Refrigerante" value={selected.refrigerant} />
                <Row label="Rotação" value={selected.rpm ? `${selected.rpm} rpm` : "—"} />
                <Row label="Tipo de equação" value={selected.equation_type} />
              </Section>

              <Section title="Ponto de operação">
                <div className="grid grid-cols-2 gap-2">
                  <NumberInput label="Te (°C)" value={te} onChange={setTe} />
                  <NumberInput label="Tc (°C)" value={tc} onChange={setTc} />
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                  <Stat label="λ" value={lambda != null ? lambda.toFixed(4) : "—"} />
                  <Stat
                    label="Pot. específica"
                    value={specPower != null ? specPower.toFixed(4) : "—"}
                  />
                  <Stat label="Corrente" value={current != null ? current.toFixed(2) : "—"} />
                </div>
              </Section>

              <Section title="Coeficientes polinomiais (Bitzer)">
                <p className="text-[10px] text-slate-500">{selected.formula}</p>
                <details className="mt-1.5">
                  <summary className="cursor-pointer text-xs text-[#1E6FD9] hover:underline">
                    Ver coeficientes
                  </summary>
                  <pre className="mt-1.5 max-h-40 overflow-auto rounded bg-slate-50 p-2 text-[10px] text-slate-700">
                    {`λ        : ${selected.coeff_lambda?.map((c) => c.toExponential(4)).join(", ") ?? "—"}
Corrente : ${selected.coeff_current?.map((c) => c.toExponential(4)).join(", ") ?? "—"}
Pot.esp. : ${selected.coeff_specific_power?.map((c) => c.toExponential(4)).join(", ") ?? "—"}
C10 (Vh) : ${selected.C10_displacement?.toFixed(4) ?? "—"} m³/h`}
                  </pre>
                </details>
              </Section>

              <p className="text-[10px] text-slate-400">
                Fonte: BitzerPlatform.db · ID interno: {selected.id} ·{" "}
                {selected.variants_count > 1
                  ? `${selected.variants_count} conjuntos de coef. disponíveis`
                  : "1 conjunto de coef."}
              </p>
            </div>
          ) : (
            <p className="flex h-full items-center justify-center text-xs text-slate-400">
              Selecione um modelo e variante para ver as características técnicas.
            </p>
          )}
        </div>
      </div>
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

function NumberInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] font-medium uppercase tracking-wider text-slate-500">
        {label}
      </span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-0.5 w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs outline-none focus:border-[#1E6FD9] focus:bg-white"
      />
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-50 px-2 py-1.5">
      <p className="text-[9px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className="font-mono text-xs font-semibold text-slate-900">{value}</p>
    </div>
  );
}
