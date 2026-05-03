/**
 * FrostAnalysisPage — página dedicada de análise de geada (Tarefa 4).
 * Reusa CycleEngine + useFrostAnalysis + FrostAnalysisPanel.
 */
import { useEffect, useMemo, useState } from "react";
import { Snowflake } from "lucide-react";
import { useCycleSimulation } from "../hooks/useCycleSimulation";
import { useFrostAnalysis } from "../hooks/useFrostAnalysis";
import { FrostAnalysisPanel } from "../components/FrostAnalysisPanel";
import { listAvailableRefrigerants } from "../engines/refrigerant/refrigerantProperties";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
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
import type { CycleSystemConfig } from "../engines/cycle/cycleTypes";

const REFRIGERANT_GROUPS: Array<{ label: string; ids: string[] }> = [
  { label: "HFC Comuns", ids: ["R404A", "R410A", "R32", "R134a", "R507A"] },
  { label: "HFO / Low-GWP", ids: ["R448A", "R449A", "R452A", "R454B", "R454C", "R1234yf", "R513A", "R450A"] },
  { label: "Hidrocarbonetos", ids: ["R290", "R600a", "R1270"] },
  { label: "Naturais", ids: ["R717", "R744"] },
];

function buildConfig(opts: {
  refrigerantId: string;
  te: number;
  tc: number;
  airTempC: number;
  airRH: number;
}): CycleSystemConfig {
  return {
    id: "frost-page",
    name: "Análise de Geada",
    refrigerantId: opts.refrigerantId,
    compressor: {
      id: "BITZER_2KES05",
      model: "2KES-05",
      manufacturer: "BITZER",
      refrigerant: opts.refrigerantId,
      modelType: "bitzer_native",
      bitzerNative: {
        displacement_m3h: 4.06,
        coeff_lambda: [1.08, -0.0069, 4.66e-5],
        coeff_current: [-0.116, 0.00605, -9.54e-5],
        coeff_specific_power: [0.565, 0.0155, 1.99e-4],
        rpm: 1450,
      },
    },
    evaporator: {
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
      superheatK: 5,
      subcoolingK: 5,
      htCatalog: {},
      tubeMaterialConductivity: 385,
    },
    condenser: {
      physical: {
        rows: 2,
        finnedLengthMm: 800,
        finnedHeightMm: 600,
        finPitchMm: 3,
        tubePitchTransversalMm: 25.4,
        tubePitchLongitudinalMm: 22,
        tubeExternalDiameterMm: 9.52,
        tubeInternalDiameterMm: 8.5,
        tubesPerRow: 24,
        circuits: 4,
        finThicknessMm: 0.1,
        finType: "plain",
      },
      airInletTempC: 32,
      airRelativeHumidity: 0.5,
      airFlowM3H: 8000,
      superheatK: 0,
      subcoolingK: 5,
      htCatalog: {},
      tubeMaterialConductivity: 385,
    },
    expansionDevice: { type: "txv", superheatTarget_K: 5 },
    solver: {
      Te_initial_C: opts.te,
      Tc_initial_C: opts.tc,
      tolerance: 0.01,
      maxIterations: 30,
      relaxation: 0.4,
    },
  };
}

export function FrostAnalysisPage() {
  const [refrigerantId, setRefrigerantId] = useState("R404A");
  const [te, setTe] = useState(-10);
  const [tc, setTc] = useState(40);
  const [airTempC, setAirTempC] = useState(2);
  const [airRH, setAirRH] = useState(85);
  const [operationTimeH, setOperationTimeH] = useState(6);
  const [defrostThresholdMm, setDefrostThresholdMm] = useState(3);
  const [refrigerantsMeta, setRefrigerantsMeta] = useState<
    Array<{ id: string; name: string }>
  >([]);

  useEffect(() => {
    listAvailableRefrigerants()
      .then((list) => setRefrigerantsMeta(list.map((r) => ({ id: r.id, name: r.name }))))
      .catch(() => setRefrigerantsMeta([]));
  }, []);

  const config = useMemo(
    () => buildConfig({ refrigerantId, te, tc, airTempC, airRH }),
    [refrigerantId, te, tc, airTempC, airRH],
  );

  const simState = useCycleSimulation(config);
  const cycleResult = simState.status === "success" ? simState.result : null;

  // Estimativa simples da área externa do evaporador para o frost
  const evaporatorAreaM2 = 35;
  const airMassFlowKgS = (5000 / 3600) * 1.2;

  const frostResult = useFrostAnalysis({
    cycleResult,
    refrigerantId,
    airInletTempC: airTempC,
    airRelativeHumidity: airRH / 100,
    airMassFlowKgS,
    evaporatorExternalAreaM2: evaporatorAreaM2,
    config: { operationTimeH, defrostThresholdMm },
  });

  const meta = refrigerantsMeta.find((r) => r.id === refrigerantId);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="border-b border-gray-800 px-6 py-3">
        <div className="flex items-center gap-2">
          <Snowflake className="h-5 w-5 text-cyan-400" />
          <h1 className="text-lg font-bold">Análise de Geada</h1>
        </div>
        <p className="text-xs text-gray-400">
          Curva Q(t) de degradação · Tempo até degelo necessário · {refrigerantId}
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
              Te (°C): <span className="font-mono text-cyan-400">{te}</span>
            </Label>
            <Slider
              min={-40}
              max={15}
              step={1}
              value={[te]}
              onValueChange={(v) => setTe(v[0])}
            />
          </section>

          <section className="space-y-2">
            <Label className="text-xs text-gray-300">
              Tc (°C): <span className="font-mono text-cyan-400">{tc}</span>
            </Label>
            <Slider
              min={20}
              max={70}
              step={1}
              value={[tc]}
              onValueChange={(v) => setTc(v[0])}
            />
          </section>

          <section className="space-y-2">
            <Label className="text-xs text-gray-300">
              Temperatura do ar (°C):{" "}
              <span className="font-mono text-cyan-400">{airTempC}</span>
            </Label>
            <Slider
              min={-25}
              max={20}
              step={1}
              value={[airTempC]}
              onValueChange={(v) => setAirTempC(v[0])}
            />
          </section>

          <section className="space-y-2">
            <Label className="text-xs text-gray-300">
              Umidade relativa (%):{" "}
              <span className="font-mono text-cyan-400">{airRH}</span>
            </Label>
            <Slider
              min={30}
              max={100}
              step={1}
              value={[airRH]}
              onValueChange={(v) => setAirRH(v[0])}
            />
          </section>

          <section className="space-y-2">
            <Label className="text-xs text-gray-300">
              Tempo de análise (h):{" "}
              <span className="font-mono text-cyan-400">{operationTimeH}</span>
            </Label>
            <Slider
              min={1}
              max={24}
              step={1}
              value={[operationTimeH]}
              onValueChange={(v) => setOperationTimeH(v[0])}
            />
          </section>

          <section className="space-y-2">
            <Label className="text-xs text-gray-300">
              Limiar de degelo (mm):
            </Label>
            <Input
              type="number"
              min={1}
              max={10}
              step={0.5}
              value={defrostThresholdMm}
              onChange={(e) => setDefrostThresholdMm(Number(e.target.value))}
              className="bg-gray-800 border-gray-700 text-white text-xs h-8"
            />
          </section>
        </aside>

        {/* Resultados */}
        <main className="col-span-12 md:col-span-9 overflow-y-auto p-6 bg-gray-950">
          {simState.status === "running" && (
            <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-6 text-sm text-gray-400">
              Calculando ciclo de referência…
            </div>
          )}
          {simState.status === "error" && (
            <div className="rounded-lg border border-red-900/50 bg-red-950/20 p-6 text-sm text-red-300">
              Erro no ciclo: {simState.message}
            </div>
          )}
          {cycleResult && !frostResult && (
            <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-6 text-sm text-gray-400">
              Aguardando análise de geada…
            </div>
          )}
          {cycleResult && frostResult && (
            <div className="rounded-lg border border-gray-800 bg-white p-4 text-gray-900">
              <FrostAnalysisPanel
                result={frostResult}
                nominalCapacityW={cycleResult.Q_evap_W}
                operationTimeH={operationTimeH}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
