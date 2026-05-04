/**
 * SystemCyclePage — página unificada para os 3 sistemas (Câmara Fria, DX Completo, Bomba de Calor).
 * Tarefa 6: ativa CycleEngine com configuração específica por modo.
 */
import { useEffect, useMemo, useState } from "react";
import { Snowflake, Flame, Box } from "lucide-react";
import { WorkspaceLayout } from "../../components/WorkspaceLayout";
import { WorkspaceHeader } from "../../components/WorkspaceHeader";
import { WorkspaceInputsSidebar } from "../../components/WorkspaceInputsSidebar";
import { useCycleSimulation } from "../../hooks/useCycleSimulation";
import { CyclePHDiagram } from "../../components/CyclePHDiagram";
import { CycleResultPanel } from "../../components/CycleResultPanel";
import { listAvailableRefrigerants } from "../../engines/refrigerant/refrigerantProperties";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CycleSystemConfig } from "../../engines/cycle/cycleTypes";

const REFRIGERANT_GROUPS: Array<{ label: string; ids: string[] }> = [
  { label: "HFC Comuns", ids: ["R404A", "R410A", "R32", "R134a", "R507A"] },
  { label: "HFO / Low-GWP", ids: ["R448A", "R449A", "R454B", "R1234yf", "R513A"] },
  { label: "Hidrocarbonetos", ids: ["R290", "R600a", "R1270"] },
  { label: "Naturais", ids: ["R717", "R744"] },
];

export type SystemMode = "cold-room" | "dx-complete" | "heat-pump";

const MODE_PRESETS: Record<
  SystemMode,
  {
    title: string;
    subtitle: string;
    icon: typeof Snowflake;
    iconColor: string;
    refrigerant: string;
    te: number;
    tc: number;
    airTempC: number;
  }
> = {
  "cold-room": {
    title: "Câmara Fria",
    subtitle: "Evaporador DX + condensador a ar + carga térmica",
    icon: Snowflake,
    iconColor: "text-cyan-400",
    refrigerant: "R448A",
    te: -10,
    tc: 45,
    airTempC: 2,
  },
  "dx-complete": {
    title: "Sistema DX Completo",
    subtitle: "Evaporador + Condensador acoplados em ciclo refrigerante",
    icon: Box,
    iconColor: "text-blue-400",
    refrigerant: "R410A",
    te: 7,
    tc: 45,
    airTempC: 27,
  },
  "heat-pump": {
    title: "Bomba de Calor",
    subtitle: "Modo Verão (resfriamento) e Modo Inverno (aquecimento)",
    icon: Flame,
    iconColor: "text-orange-400",
    refrigerant: "R32",
    te: 5,
    tc: 50,
    airTempC: 20,
  },
};

function buildConfig(opts: {
  refrigerantId: string;
  te: number;
  tc: number;
  airTempC: number;
}): CycleSystemConfig {
  return {
    id: "system-page",
    name: "Sistema",
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
      airRelativeHumidity: 0.85,
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

const fmt = (v: number, d = 2) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

interface SystemCyclePageProps {
  mode: SystemMode;
}

export function SystemCyclePage({ mode }: SystemCyclePageProps) {
  const preset = MODE_PRESETS[mode];
  const Icon = preset.icon;
  const [cycleEnabled, setCycleEnabled] = useState(true);
  const [refrigerantId, setRefrigerantId] = useState(preset.refrigerant);
  const [te, setTe] = useState(preset.te);
  const [tc, setTc] = useState(preset.tc);
  const [airTempC, setAirTempC] = useState(preset.airTempC);
  const [hpMode, setHpMode] = useState<"summer" | "winter">("summer");
  const [refrigerantsMeta, setRefrigerantsMeta] = useState<
    Array<{ id: string; name: string }>
  >([]);

  useEffect(() => {
    listAvailableRefrigerants()
      .then((list) => setRefrigerantsMeta(list.map((r) => ({ id: r.id, name: r.name }))))
      .catch(() => setRefrigerantsMeta([]));
  }, []);

  const config = useMemo(
    () => buildConfig({ refrigerantId, te, tc, airTempC }),
    [refrigerantId, te, tc, airTempC],
  );

  const simState = useCycleSimulation(cycleEnabled ? config : null);
  const cycleResult = simState.status === "success" ? simState.result : null;

  const cop = cycleResult?.COP ?? 0;
  const copH = cop + 1; // COP de aquecimento
  const meta = refrigerantsMeta.find((r) => r.id === refrigerantId);

  const convergenceBadge = cycleEnabled && cycleResult ? (
    <Badge
      variant="outline"
      className={cycleResult.converged ? "border-emerald-600 text-emerald-400" : "border-amber-600 text-amber-400"}
    >
      {cycleResult.converged ? "🟢 Convergido" : "🟡 Estimativa"}
    </Badge>
  ) : null;

  const header = (
    <WorkspaceHeader
      title={preset.title}
      badges={[refrigerantId, `Te: ${fmt(te, 0)}°C`, `Tc: ${fmt(tc, 0)}°C`]}
      backTo="/coldpro/cncoils"
      backLabel="CN Coils"
    />
  );

  return (
    <WorkspaceLayout
      header={header}
      sidebar={
        <WorkspaceInputsSidebar
          onCalculate={() => simState.trigger()}
          isCalculating={simState.status === "running"}
          calculateLabel="Calcular Ciclo"
        >
          <div className="space-y-4 p-4">
          <section className="rounded border border-gray-800 bg-gray-900 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wide text-gray-300">
                Motor de Ciclo
              </Label>
              <button
                type="button"
                onClick={() => setCycleEnabled((v) => !v)}
                className={`rounded px-2 py-0.5 text-[10px] font-medium ${
                  cycleEnabled
                    ? "bg-emerald-700 text-white"
                    : "bg-gray-700 text-gray-300"
                }`}
              >
                {cycleEnabled ? "ATIVO" : "DESATIVADO"}
              </button>
            </div>
            <p className="text-[10px] text-gray-400">
              {cycleEnabled
                ? "Te/Tc são calculados pelo CycleEngine."
                : "Ative para usar o solver acoplado."}
            </p>
          </section>

          {mode === "heat-pump" && (
            <section className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-gray-300">
                Modo de Operação
              </Label>
              <div className="flex gap-1">
                {(["summer", "winter"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setHpMode(m)}
                    className={`flex-1 rounded px-2 py-1 text-[10px] font-medium ${
                      hpMode === m
                        ? "bg-orange-600 text-white"
                        : "bg-gray-800 text-gray-300"
                    }`}
                  >
                    {m === "summer" ? "Verão" : "Inverno"}
                  </button>
                ))}
              </div>
            </section>
          )}

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
              Te (°C): <span className="font-mono text-cyan-400">{te}</span>
            </Label>
            <Slider
              min={-40}
              max={20}
              step={1}
              value={[te]}
              onValueChange={(v) => setTe(v[0])}
              disabled={cycleEnabled}
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
              disabled={cycleEnabled}
            />
          </section>

          <section className="space-y-2">
            <Label className="text-xs text-gray-300">
              Temperatura do ar (°C):{" "}
              <span className="font-mono text-cyan-400">{airTempC}</span>
            </Label>
            <Slider
              min={-25}
              max={45}
              step={1}
              value={[airTempC]}
              onValueChange={(v) => setAirTempC(v[0])}
            />
          </section>
          </div>
        </WorkspaceInputsSidebar>
      }
    >
      <div className="p-6 space-y-4">
          {!cycleEnabled && (
            <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-6 text-sm text-gray-400">
              Motor de ciclo desativado. Ative para calcular o sistema.
            </div>
          )}
          {cycleEnabled && simState.status === "running" && (
            <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-6 text-sm text-gray-400">
              Calculando ponto de equilíbrio…
            </div>
          )}
          {cycleEnabled && simState.status === "error" && (
            <div className="rounded-lg border border-red-900/50 bg-red-950/20 p-6 text-sm text-red-300">
              Erro: {simState.message}
            </div>
          )}
          {cycleEnabled && cycleResult && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="Te" value={`${fmt(cycleResult.Te_C, 1)} °C`} />
                <KpiCard label="Tc" value={`${fmt(cycleResult.Tc_C, 1)} °C`} />
                {mode === "heat-pump" ? (
                  <>
                    <KpiCard
                      label={hpMode === "summer" ? "COP Resfriamento" : "COP Aquecimento"}
                      value={fmt(hpMode === "summer" ? cop : copH, 2)}
                      accent
                    />
                    <KpiCard
                      label={hpMode === "summer" ? "Q Resf. (kW)" : "Q Aquec. (kW)"}
                      value={fmt(
                        (hpMode === "summer"
                          ? cycleResult.Q_evap_W
                          : cycleResult.Q_cond_W) / 1000,
                        2,
                      )}
                    />
                  </>
                ) : (
                  <>
                    <KpiCard label="COP" value={fmt(cop, 2)} accent />
                    <KpiCard
                      label="Q evap (kW)"
                      value={fmt(cycleResult.Q_evap_W / 1000, 2)}
                    />
                  </>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-lg border border-gray-800 bg-white p-3">
                  <CyclePHDiagram result={cycleResult} refrigerantId={refrigerantId} />
                </div>
                <div className="rounded-lg border border-gray-800 bg-white p-3 text-gray-900">
                  <CycleResultPanel result={cycleResult} />
                </div>
              </div>
            </>
          )}
      </div>
    </WorkspaceLayout>
  );
}

function KpiCard({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        accent
          ? "border-emerald-800/50 bg-emerald-950/30"
          : "border-gray-800 bg-gray-900/50"
      }`}
    >
      <p className="text-[10px] uppercase tracking-wide text-gray-400">{label}</p>
      <p
        className={`mt-1 text-lg font-bold ${
          accent ? "text-emerald-300" : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
