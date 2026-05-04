import { useState } from "react";
import { useCycleSimulation } from "../hooks/useCycleSimulation";
import { useFrostAnalysis } from "../hooks/useFrostAnalysis";
import { useUncertaintyAnalysis } from "../hooks/useUncertaintyAnalysis";
import { CoilEnvelopeTab } from "../components/CoilEnvelopeTab";
import { CoilsInSeriesPanel } from "../components/CoilsInSeriesPanel";
import { CyclePHDiagram } from "../components/CyclePHDiagram";
import { FrostAnalysisPanel } from "../components/FrostAnalysisPanel";
import { CycleResultPanel } from "../components/CycleResultPanel";
import { UncertaintyPanel } from "../components/UncertaintyBadge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CoilCycleInputs, CoilCycleResult } from "../engines/coil/coilCycleAdapter";
import type { CycleSystemConfig } from "../engines/cycle/cycleTypes";

const DEFAULT_CONFIG: CycleSystemConfig = {
  id: "demo-01",
  name: "Câmara Fria — Demonstração",
  refrigerantId: "R404A",
  compressor: {
    id: "BITZER_2KES05",
    model: "2KES-05",
    manufacturer: "BITZER",
    refrigerant: "R404A",
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
    airInletTempC: 5,
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
    Te_initial_C: -10,
    Tc_initial_C: 40,
    tolerance: 0.01,
    maxIterations: 30,
    relaxation: 0.4,
  },
};

export function CycleWorkspacePage() {
  const [config] = useState<CycleSystemConfig>(DEFAULT_CONFIG);
  const simState = useCycleSimulation(config);
  const cycleResult = simState.status === "success" ? simState.result : null;
  const evaporatorExternalAreaM2 = estimateEvaporatorExternalAreaM2(config);
  const frostOperationTimeH = 6;
  const uncertaintyInputs = cycleResult ? buildEvaporatorUncertaintyInputs(config, cycleResult.m_dot_kgS) : null;
  const uncertaintyNominal = cycleResult ? buildEvaporatorNominalResult(cycleResult) : null;
  const {
    result: uncertaintyResult,
    isLoading: uncertaintyLoading,
  } = useUncertaintyAnalysis({
    inputs: uncertaintyInputs,
    nominalResult: uncertaintyNominal,
    debounceMs: 1500,
    enabled: !!uncertaintyNominal?.success,
    config: { samples: 200 },
  });
  const frostResult = useFrostAnalysis({
    cycleResult,
    refrigerantId: config.refrigerantId,
    airInletTempC: config.evaporator.airInletTempC,
    airRelativeHumidity: config.evaporator.airRelativeHumidity,
    airMassFlowKgS: (config.evaporator.airFlowM3H * 1.2) / 3600,
    evaporatorExternalAreaM2,
    config: {
      operationTimeH: frostOperationTimeH,
      defrostMethod: "electric",
    },
  });

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4">
        <div>
          <h1 className="text-lg font-bold text-white">Ciclo de Refrigeração</h1>
          <p className="text-sm text-gray-400">
            {config.name} - {config.refrigerantId}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {simState.status === "running" && (
            <div className="flex items-center gap-2 text-sm text-blue-400">
              <div className="h-3 w-3 animate-pulse rounded-full bg-blue-400" />
              Calculando...
            </div>
          )}
          {simState.status === "success" && simState.result.converged && (
            <div className="text-sm text-green-400">✓ Convergido</div>
          )}
          {simState.status === "error" && (
            <div className="text-sm text-red-400">✗ Erro</div>
          )}
        </div>
      </div>

      <Tabs defaultValue="cycle" className="h-[calc(100vh-65px)]">
        <div className="border-b border-gray-800 px-6 py-2">
          <TabsList>
            <TabsTrigger value="cycle">Ciclo</TabsTrigger>
            <TabsTrigger value="envelope">Envelope Q×Te</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="cycle" className="m-0 h-[calc(100%-53px)]">
          <div className="flex h-full">
            <div className="flex-1 overflow-auto p-6">
              {simState.status === "success" ? (
                <div className="space-y-4">
                  <CyclePHDiagram
                    result={simState.result}
                    refrigerantId={config.refrigerantId}
                    width={620}
                    height={400}
                  />

                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {[
                      {
                        label: "Capacidade",
                        value: `${(simState.result.Q_evap_W / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kW`,
                        sub: "Refrigeração",
                        color: "border-blue-500",
                      },
                      {
                        label: "COP",
                        value: simState.result.COP.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                        sub: `EER: ${simState.result.EER.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                        color: "border-green-500",
                      },
                      {
                        label: "Te / Tc",
                        value: `${simState.result.Te_C.toLocaleString("pt-BR", { minimumFractionDigits: 1 })} / ${simState.result.Tc_C.toLocaleString("pt-BR", { minimumFractionDigits: 1 })} °C`,
                        sub: "Equilíbrio",
                        color: "border-orange-500",
                      },
                      {
                        label: "Compressor",
                        value: `${(simState.result.W_comp_W / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kW`,
                        sub: simState.result.compressorResult.mode,
                        color: "border-purple-500",
                      },
                    ].map((card) => (
                      <div
                        key={card.label}
                        className={`rounded-xl border-l-4 bg-gray-900 p-4 ${card.color}`}
                      >
                        <div className="mb-1 text-xs text-gray-500">{card.label}</div>
                        <div className="text-lg font-bold text-white">{card.value}</div>
                        <div className="mt-1 text-xs text-gray-500">{card.sub}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : simState.status === "running" ? (
                <div className="flex h-64 items-center justify-center">
                  <div className="space-y-3 text-center">
                    <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                    <p className="text-sm text-gray-400">Executando solver de ciclo...</p>
                  </div>
                </div>
              ) : simState.status === "error" ? (
                <div className="rounded-xl border border-red-800 bg-red-950/30 p-6 text-center">
                  <p className="font-semibold text-red-400">Erro no CycleEngine</p>
                  <p className="mt-2 text-sm text-red-300">{simState.message}</p>
                </div>
              ) : (
                <div className="flex h-64 items-center justify-center text-gray-600">
                  Configure o sistema para iniciar a simulação
                </div>
              )}
            </div>

            <div className="w-80 overflow-y-auto border-l border-gray-800 p-4">
              {simState.status === "success" ? (
                <div className="space-y-4">
                  <CoilsInSeriesPanel
                    primaryCoilResult={{
                      deltaP_Pa: simState.result.evaporatorResult.airPressureDropPa,
                      Q_kcalh: simState.result.evaporatorResult.totalCapacityW * 0.86,
                      T_ar_saida: simState.result.evaporatorResult.airOutletTempC,
                    }}
                  />
                  <CycleResultPanel result={simState.result} />
                  {(uncertaintyResult || uncertaintyLoading) && (
                    <details className="rounded-lg border border-gray-800 bg-white text-gray-900">
                      <summary className="cursor-pointer select-none px-4 py-2 text-sm font-medium">
                        Análise de Incerteza
                        {uncertaintyLoading && (
                          <span className="ml-2 animate-pulse text-xs text-gray-400">
                            calculando...
                          </span>
                        )}
                      </summary>
                      <div className="px-4 pb-4 pt-2">
                        {uncertaintyResult ? (
                          <UncertaintyPanel
                            result={uncertaintyResult}
                            isLoading={uncertaintyLoading}
                          />
                        ) : (
                          <div className="animate-pulse text-xs text-gray-400">
                            Calculando intervalos de confiança...
                          </div>
                        )}
                      </div>
                    </details>
                  )}
                  {frostResult && cycleResult?.converged && (
                    <div className="rounded-lg border border-gray-800 bg-white p-4 text-gray-900">
                      <FrostAnalysisPanel
                        result={frostResult}
                        nominalCapacityW={cycleResult.Q_evap_W}
                        operationTimeH={frostOperationTimeH}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-8 text-center text-sm text-gray-600">
                  Aguardando resultado...
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="envelope" className="m-0 h-[calc(100%-53px)] overflow-auto bg-white text-slate-900">
          <CoilEnvelopeTab equipmentId={config.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function estimateEvaporatorExternalAreaM2(config: CycleSystemConfig): number {
  const p = config.evaporator.physical;
  return (
    p.rows *
    (p.finnedLengthMm / 1000) *
    (p.finnedHeightMm / 1000) *
    p.tubesPerRow *
    Math.PI *
    (p.tubeExternalDiameterMm / 1000)
  );
}

function buildEvaporatorUncertaintyInputs(
  config: CycleSystemConfig,
  massFlowKgS: number,
): CoilCycleInputs {
  return {
    ...config.evaporator,
    refrigerantId: config.refrigerantId,
    evaporatingTempC: config.solver?.Te_initial_C ?? -10,
    condensingTempC: config.solver?.Tc_initial_C ?? 40,
    refrigerantMassFlowKgS: massFlowKgS,
    componentType: "evaporator",
  };
}

function buildEvaporatorNominalResult(result: NonNullable<ReturnType<typeof getCycleResultTypeHack>>): CoilCycleResult {
  return {
    totalCapacityW: result.evaporatorResult.totalCapacityW,
    sensibleCapacityW: result.evaporatorResult.sensibleCapacityW,
    latentCapacityW: result.evaporatorResult.latentCapacityW,
    airOutletTempC: result.evaporatorResult.airOutletTempC,
    airOutletRH: result.evaporatorResult.airOutletRH,
    airPressureDropPa: result.evaporatorResult.airPressureDropPa,
    fluidPressureDropKPa: result.evaporatorResult.fluidPressureDropKPa,
    overallU_WM2K: result.evaporatorResult.overallU_WM2K,
    safetyFactor: result.evaporatorResult.safetyFactor,
    refrigerantOutletTempC: result.Te_C,
    inletQuality: result.statePoints.point4_valveOut.quality,
    warnings: result.warnings,
    success: true,
  };
}

function getCycleResultTypeHack() {
  return null as import("../engines/cycle/cycleTypes").CycleResult | null;
}
