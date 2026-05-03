/**
 * AssemblyWorkspacePage — simulador de arranjo de serpentinas (Tarefa 3).
 * Suporta single, series_air, parallel_air, parallel_refrigerant, vbank.
 */
import { useEffect, useMemo, useState } from "react";
import { Layers, Loader2 } from "lucide-react";
import { runAssemblySimulation } from "../engines/assembly/coilAssembly";
import { listAvailableRefrigerants } from "../engines/refrigerant/refrigerantProperties";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  AssemblyArrangement,
  CoilAssemblyConfig,
  CoilAssemblyResult,
  CoilAssemblyUnit,
} from "../engines/assembly/assemblyTypes";

const REFRIGERANT_GROUPS: Array<{ label: string; ids: string[] }> = [
  { label: "HFC Comuns", ids: ["R404A", "R410A", "R32", "R134a", "R507A"] },
  { label: "HFO / Low-GWP", ids: ["R448A", "R449A", "R454B", "R1234yf", "R513A"] },
  { label: "Hidrocarbonetos", ids: ["R290", "R600a", "R1270"] },
  { label: "Naturais", ids: ["R717", "R744"] },
];

const ARRANGEMENT_OPTIONS: Array<{
  id: AssemblyArrangement;
  label: string;
  description: string;
  defaultUnits: number;
}> = [
  { id: "single", label: "Única", description: "Uma serpentina", defaultUnits: 1 },
  {
    id: "series_air",
    label: "Série (ar)",
    description: "Ar passa em sequência",
    defaultUnits: 2,
  },
  {
    id: "parallel_air",
    label: "Paralelo (ar)",
    description: "Vazão de ar dividida",
    defaultUnits: 2,
  },
  {
    id: "parallel_refrigerant",
    label: "Paralelo (refrigerante)",
    description: "Fluido dividido em circuitos",
    defaultUnits: 2,
  },
  { id: "vbank", label: "V-Bank", description: "Duas serpentinas em V", defaultUnits: 2 },
];

interface CoilSpec {
  rows: number;
  finnedLengthMm: number;
  finnedHeightMm: number;
  finPitchMm: number;
  circuits: number;
}

const DEFAULT_SPEC: CoilSpec = {
  rows: 4,
  finnedLengthMm: 1250,
  finnedHeightMm: 400,
  finPitchMm: 6,
  circuits: 5,
};

function buildUnit(id: string, position: number, spec: CoilSpec): CoilAssemblyUnit {
  return {
    id,
    name: `Serpentina ${position + 1}`,
    position,
    coilInputs: {
      physical: {
        rows: spec.rows,
        finnedLengthMm: spec.finnedLengthMm,
        finnedHeightMm: spec.finnedHeightMm,
        finPitchMm: spec.finPitchMm,
        tubePitchTransversalMm: 38.1,
        tubePitchLongitudinalMm: 33,
        tubeExternalDiameterMm: 12.7,
        tubeInternalDiameterMm: 11.5,
        tubesPerRow: 10,
        circuits: spec.circuits,
        finThicknessMm: 0.15,
        finType: "plain",
      },
      airFlowM3H: 5000,
      htCatalog: {},
      tubeMaterialConductivity: 385,
    },
  };
}

const fmt = (v: number, d = 2) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

export function AssemblyWorkspacePage() {
  const [arrangement, setArrangement] = useState<AssemblyArrangement>("series_air");
  const [unitCount, setUnitCount] = useState(2);
  const [spec, setSpec] = useState<CoilSpec>(DEFAULT_SPEC);
  const [refrigerantId, setRefrigerantId] = useState("R404A");
  const [te, setTe] = useState(-10);
  const [tc, setTc] = useState(40);
  const [airTotalM3H, setAirTotalM3H] = useState(10000);
  const [airTempC, setAirTempC] = useState(5);
  const [airRH, setAirRH] = useState(85);
  const [refrigerantsMeta, setRefrigerantsMeta] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [result, setResult] = useState<CoilAssemblyResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listAvailableRefrigerants()
      .then((list) => setRefrigerantsMeta(list.map((r) => ({ id: r.id, name: r.name }))))
      .catch(() => setRefrigerantsMeta([]));
  }, []);

  const config = useMemo<CoilAssemblyConfig>(() => {
    const effectiveCount =
      arrangement === "single" ? 1 : arrangement === "vbank" ? 2 : unitCount;
    const units = Array.from({ length: effectiveCount }, (_, i) =>
      buildUnit(`coil-${i}`, i, spec),
    );
    return {
      id: "assembly-workspace",
      name: "Arranjo",
      arrangement,
      coils: units,
      airInlet: {
        tempC: airTempC,
        relativeHumidity: airRH / 100,
        totalFlowM3H: airTotalM3H,
      },
      refrigerant: {
        id: refrigerantId,
        evaporatingTempC: te,
        condensingTempC: tc,
        totalMassFlowKgS: 0.05,
        superheatK: 5,
        subcoolingK: 5,
      },
      componentType: "evaporator",
    };
  }, [arrangement, unitCount, spec, airTempC, airRH, airTotalM3H, refrigerantId, te, tc]);

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await runAssemblySimulation(config);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setResult(null);
    } finally {
      setRunning(false);
    }
  };

  const meta = refrigerantsMeta.find((r) => r.id === refrigerantId);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="border-b border-gray-800 px-6 py-3">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-violet-400" />
          <h1 className="text-lg font-bold">Arranjo de Serpentinas</h1>
        </div>
        <p className="text-xs text-gray-400">
          CoilAssembly · {arrangement} · {refrigerantId}
        </p>
      </div>

      <div className="grid grid-cols-12 gap-0 h-[calc(100vh-65px)]">
        {/* Configuração */}
        <aside className="col-span-12 md:col-span-3 overflow-y-auto border-r border-gray-800 bg-gray-900/50 p-4 space-y-4">
          <section className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-gray-300">
              Tipo de Arranjo
            </Label>
            <div className="grid grid-cols-1 gap-1">
              {ARRANGEMENT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setArrangement(opt.id);
                    setUnitCount(opt.defaultUnits);
                  }}
                  className={`rounded border px-2 py-1.5 text-left text-xs ${
                    arrangement === opt.id
                      ? "border-violet-500 bg-violet-950/40 text-violet-200"
                      : "border-gray-800 bg-gray-900 text-gray-300 hover:border-gray-700"
                  }`}
                >
                  <p className="font-semibold">{opt.label}</p>
                  <p className="text-[10px] text-gray-400">{opt.description}</p>
                </button>
              ))}
            </div>
          </section>

          {arrangement !== "single" && arrangement !== "vbank" && (
            <section className="space-y-2">
              <Label className="text-xs text-gray-300">
                Nº de serpentinas:{" "}
                <span className="font-mono text-violet-400">{unitCount}</span>
              </Label>
              <Slider
                min={2}
                max={4}
                step={1}
                value={[unitCount]}
                onValueChange={(v) => setUnitCount(v[0])}
              />
            </section>
          )}

          <section className="space-y-2 rounded border border-gray-800 bg-gray-900 p-3">
            <Label className="text-xs uppercase tracking-wide text-gray-300">
              Geometria por Serpentina
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <NumField
                label="Filas"
                value={spec.rows}
                onChange={(v) => setSpec({ ...spec, rows: v })}
              />
              <NumField
                label="Circuitos"
                value={spec.circuits}
                onChange={(v) => setSpec({ ...spec, circuits: v })}
              />
              <NumField
                label="Altura (mm)"
                value={spec.finnedHeightMm}
                onChange={(v) => setSpec({ ...spec, finnedHeightMm: v })}
              />
              <NumField
                label="Largura (mm)"
                value={spec.finnedLengthMm}
                onChange={(v) => setSpec({ ...spec, finnedLengthMm: v })}
              />
              <NumField
                label="Aleta (mm)"
                value={spec.finPitchMm}
                step={0.1}
                onChange={(v) => setSpec({ ...spec, finPitchMm: v })}
              />
            </div>
          </section>

          <section className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-gray-300">
              Refrigerante
            </Label>
            <Select value={refrigerantId} onValueChange={setRefrigerantId}>
              <SelectTrigger className="bg-gray-800 border-gray-700 text-white text-xs h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                {REFRIGERANT_GROUPS.map((g) => (
                  <SelectGroup key={g.label}>
                    <SelectLabel>{g.label}</SelectLabel>
                    {g.ids.map((id) => (
                      <SelectItem key={id} value={id}>
                        {id}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
            {meta && <p className="text-[10px] text-gray-400">{meta.name}</p>}
          </section>

          <section className="space-y-2">
            <Label className="text-xs text-gray-300">
              Te (°C): <span className="font-mono text-violet-400">{te}</span>
            </Label>
            <Slider min={-40} max={15} step={1} value={[te]} onValueChange={(v) => setTe(v[0])} />
          </section>

          <section className="space-y-2">
            <Label className="text-xs text-gray-300">
              Tc (°C): <span className="font-mono text-violet-400">{tc}</span>
            </Label>
            <Slider min={20} max={70} step={1} value={[tc]} onValueChange={(v) => setTc(v[0])} />
          </section>

          <section className="space-y-2">
            <Label className="text-xs text-gray-300">
              Vazão de ar total (m³/h):
            </Label>
            <Input
              type="number"
              min={500}
              step={500}
              value={airTotalM3H}
              onChange={(e) => setAirTotalM3H(Number(e.target.value))}
              className="bg-gray-800 border-gray-700 text-white text-xs h-8"
            />
          </section>

          <section className="grid grid-cols-2 gap-2">
            <NumField
              label="Tar (°C)"
              value={airTempC}
              onChange={setAirTempC}
              step={1}
            />
            <NumField label="UR (%)" value={airRH} onChange={setAirRH} step={1} />
          </section>

          <Button
            onClick={handleRun}
            disabled={running}
            className="w-full bg-violet-600 hover:bg-violet-500"
          >
            {running ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Calculando…
              </>
            ) : (
              "Calcular arranjo"
            )}
          </Button>
        </aside>

        {/* Resultados */}
        <main className="col-span-12 md:col-span-9 overflow-y-auto p-6 bg-gray-950 space-y-4">
          {!result && !running && !error && (
            <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-6 text-sm text-gray-400">
              Configure o arranjo e clique em <strong>Calcular arranjo</strong>.
            </div>
          )}
          {error && (
            <div className="rounded-lg border border-red-900/50 bg-red-950/20 p-6 text-sm text-red-300">
              {error}
            </div>
          )}
          {result && (
            <>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={
                    result.converged
                      ? "border-emerald-700 text-emerald-300"
                      : "border-amber-700 text-amber-300"
                  }
                >
                  {result.converged ? "🟢 Convergido" : "🟡 Estimativa"}
                </Badge>
                <span className="text-xs text-gray-400">
                  {result.units.length} serpentina(s) · {result.arrangement}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Kpi label="Q total" value={`${fmt(result.totals.totalCapacityW / 1000, 2)} kW`} accent />
                <Kpi label="Q sensível" value={`${fmt(result.totals.sensibleCapacityW / 1000, 2)} kW`} />
                <Kpi label="ΔP ar total" value={`${fmt(result.totals.totalAirPressureDropPa, 0)} Pa`} />
                <Kpi label="U médio" value={`${fmt(result.totals.weightedOverallU_WM2K, 1)} W/m²K`} />
              </div>

              <div className="rounded-lg border border-gray-800 bg-gray-900/50 overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-900 text-gray-400">
                    <tr>
                      <th className="px-3 py-2 text-left">Serpentina</th>
                      <th className="px-3 py-2 text-right">Q (kW)</th>
                      <th className="px-3 py-2 text-right">ΔP ar (Pa)</th>
                      <th className="px-3 py-2 text-right">ΔP fluido (kPa)</th>
                      <th className="px-3 py-2 text-right">Tar saída (°C)</th>
                      <th className="px-3 py-2 text-right">Fração ar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.units.map((u) => (
                      <tr key={u.unitId} className="border-t border-gray-800 text-gray-200">
                        <td className="px-3 py-2">{u.unitName}</td>
                        <td className="px-3 py-2 text-right font-mono">
                          {fmt(u.coilResult.totalCapacityW / 1000, 2)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {fmt(u.coilResult.airPressureDropPa ?? 0, 0)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {fmt(u.coilResult.fluidPressureDropKPa ?? 0, 1)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {fmt(u.airOutletTempC, 1)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {fmt(u.airFlowFraction * 100, 0)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {result.warnings.length > 0 && (
                <div className="rounded border border-amber-900/40 bg-amber-950/20 p-3 text-xs text-amber-200 space-y-1">
                  <p className="font-semibold">Avisos</p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {result.warnings.slice(0, 5).map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] text-gray-400">{label}</Label>
      <Input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="bg-gray-800 border-gray-700 text-white text-xs h-7"
      />
    </div>
  );
}

function Kpi({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        accent
          ? "border-violet-800/50 bg-violet-950/30"
          : "border-gray-800 bg-gray-900/50"
      }`}
    >
      <p className="text-[10px] uppercase tracking-wide text-gray-400">{label}</p>
      <p
        className={`mt-1 text-lg font-bold ${
          accent ? "text-violet-300" : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
