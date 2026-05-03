/**
 * OptimizationPage — página dedicada de otimização multi-objetivo (Tarefa 5).
 * Reusa OptimizationPanel + CoilCycleInputs base.
 */
import { useEffect, useMemo, useState } from "react";
import { Target } from "lucide-react";
import { OptimizationPanel } from "../components/OptimizationPanel";
import { listAvailableRefrigerants } from "../engines/refrigerant/refrigerantProperties";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CoilCycleInputs } from "../engines/coil/coilCycleAdapter";

const REFRIGERANT_GROUPS: Array<{ label: string; ids: string[] }> = [
  { label: "HFC Comuns", ids: ["R404A", "R410A", "R32", "R134a", "R507A"] },
  { label: "HFO / Low-GWP", ids: ["R448A", "R449A", "R452A", "R454B", "R454C", "R1234yf", "R513A", "R450A"] },
  { label: "Hidrocarbonetos", ids: ["R290", "R600a", "R1270"] },
  { label: "Naturais", ids: ["R717", "R744"] },
];

function buildBaseInputs(opts: {
  refrigerantId: string;
  te: number;
  tc: number;
  airTempC: number;
  airRH: number;
}): CoilCycleInputs {
  return {
    physical: {
      rows: 4,
      finnedLengthMm: 1250,
      finnedHeightMm: 400,
      finPitchMm: 6,
      tubePitchTransversalMm: 38.1,
      tubePitchLongitudinalMm: 33,
      tubeExternalDiameterMm: 12.7,
      tubeInternalDiameterMm: 11.5,
      tubesPerRow: 10,
      circuits: 5,
      finThicknessMm: 0.15,
      finType: "plain",
    },
    airInletTempC: opts.airTempC,
    airRelativeHumidity: opts.airRH / 100,
    airFlowM3H: 5000,
    refrigerantId: opts.refrigerantId,
    evaporatingTempC: opts.te,
    condensingTempC: opts.tc,
    superheatK: 5,
    subcoolingK: 5,
    refrigerantMassFlowKgS: 0.05,
    componentType: "evaporator",
    htCatalog: {},
    tubeMaterialConductivity: 385,
  };
}

export function OptimizationPage() {
  const [refrigerantId, setRefrigerantId] = useState("R404A");
  const [te, setTe] = useState(-10);
  const [tc, setTc] = useState(40);
  const [airTempC, setAirTempC] = useState(5);
  const [airRH, setAirRH] = useState(85);
  const [appliedGeometry, setAppliedGeometry] = useState<{
    rows: number;
    circuits: number;
    finPitchMm: number;
  } | null>(null);
  const [refrigerantsMeta, setRefrigerantsMeta] = useState<
    Array<{ id: string; name: string }>
  >([]);

  useEffect(() => {
    listAvailableRefrigerants()
      .then((list) => setRefrigerantsMeta(list.map((r) => ({ id: r.id, name: r.name }))))
      .catch(() => setRefrigerantsMeta([]));
  }, []);

  const baseInputs = useMemo(
    () => buildBaseInputs({ refrigerantId, te, tc, airTempC, airRH }),
    [refrigerantId, te, tc, airTempC, airRH],
  );

  // Capacidade alvo aproximada (W) — usada como referência de constraint
  const currentCapacityW = 12000;

  const meta = refrigerantsMeta.find((r) => r.id === refrigerantId);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="border-b border-gray-800 px-6 py-3">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-emerald-400" />
          <h1 className="text-lg font-bold">Otimização Multi-objetivo</h1>
        </div>
        <p className="text-xs text-gray-400">
          Grid search · COP × Custo × ΔP · {refrigerantId}
        </p>
      </div>

      <div className="grid grid-cols-12 gap-0 h-[calc(100vh-65px)]">
        {/* Configuração */}
        <aside className="col-span-12 md:col-span-3 overflow-y-auto border-r border-gray-800 bg-gray-900/50 p-4 space-y-4">
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
            {meta && (
              <p className="text-[10px] text-gray-400">{meta.name}</p>
            )}
          </section>

          <section className="space-y-2">
            <Label className="text-xs text-gray-300">
              Te (°C): <span className="font-mono text-emerald-400">{te}</span>
            </Label>
            <Slider min={-40} max={15} step={1} value={[te]} onValueChange={(v) => setTe(v[0])} />
          </section>

          <section className="space-y-2">
            <Label className="text-xs text-gray-300">
              Tc (°C): <span className="font-mono text-emerald-400">{tc}</span>
            </Label>
            <Slider min={20} max={70} step={1} value={[tc]} onValueChange={(v) => setTc(v[0])} />
          </section>

          <section className="space-y-2">
            <Label className="text-xs text-gray-300">
              Temperatura do ar (°C):{" "}
              <span className="font-mono text-emerald-400">{airTempC}</span>
            </Label>
            <Slider min={-25} max={35} step={1} value={[airTempC]} onValueChange={(v) => setAirTempC(v[0])} />
          </section>

          <section className="space-y-2">
            <Label className="text-xs text-gray-300">
              Umidade relativa (%):{" "}
              <span className="font-mono text-emerald-400">{airRH}</span>
            </Label>
            <Slider min={30} max={100} step={1} value={[airRH]} onValueChange={(v) => setAirRH(v[0])} />
          </section>

          {appliedGeometry && (
            <section className="rounded border border-emerald-800/50 bg-emerald-950/20 p-3 text-xs space-y-1">
              <p className="font-semibold text-emerald-300">Geometria aplicada</p>
              <p className="text-gray-300">
                Filas: {appliedGeometry.rows} · Circuitos: {appliedGeometry.circuits} · Aleta:{" "}
                {appliedGeometry.finPitchMm} mm
              </p>
            </section>
          )}
        </aside>

        {/* Resultados */}
        <main className="col-span-12 md:col-span-9 overflow-y-auto p-6 bg-gray-950">
          <div className="rounded-lg border border-gray-800 bg-white p-4 text-gray-900">
            <OptimizationPanel
              baseInputs={baseInputs}
              currentCapacityW={currentCapacityW}
              onApplyGeometry={(rows, circuits, finPitchMm) =>
                setAppliedGeometry({ rows, circuits, finPitchMm })
              }
            />
          </div>
        </main>
      </div>
    </div>
  );
}
