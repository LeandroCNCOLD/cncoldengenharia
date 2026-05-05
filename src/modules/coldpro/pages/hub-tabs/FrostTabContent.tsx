/**
 * FrostTabContent — Aba 6 do Hub de Testes
 * Análise de formação de gelo e ciclo de degelo.
 * Reutiliza o FrostAnalysisPanel + useFrostAnalysis + useCycleSimulation reais.
 */
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCycleSimulation } from "@/modules/cn_coils/hooks/useCycleSimulation";
import { useFrostAnalysis } from "@/modules/cn_coils/hooks/useFrostAnalysis";
import { FrostAnalysisPanel } from "@/modules/cn_coils/components/FrostAnalysisPanel";
import { listAvailableRefrigerants } from "@/modules/cn_coils/engines/refrigerant/refrigerantProperties";
import type { CycleSystemConfig } from "@/modules/cn_coils/engines/cycle/cycleTypes";

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
    id: "hub-frost",
    name: "Análise de Degelo — Hub",
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
      type: "air_cooled",
      airCooled: {
        heat_rejection_capacity_w: 15000,
        max_cond_temp_c: 55,
        ambient_temp_c: opts.tc - 15,
        airflow_m3_h: 8000,
      },
    },
    operatingPoint: {
      evaporatingTempC: opts.te,
      condensingTempC: opts.tc,
      superheatK: 5,
      subcoolingK: 5,
    },
  };
}

export function FrostTabContent() {
  const [refrigerantId, setRefrigerantId] = useState("R404A");
  const [te, setTe] = useState(-10);
  const [tc, setTc] = useState(40);
  const [airTempC, setAirTempC] = useState(5);
  const [airRH, setAirRH] = useState(85);
  const [operationTimeH, setOperationTimeH] = useState(8);

  const config = useMemo(
    () => buildConfig({ refrigerantId, te, tc, airTempC, airRH }),
    [refrigerantId, te, tc, airTempC, airRH],
  );

  const cycleState = useCycleSimulation(config, { mode: "manual" });
  const { frostResult, isAnalyzing, analyze } = useFrostAnalysis();

  const refrigerantsMeta = useMemo(() => {
    try {
      return listAvailableRefrigerants();
    } catch {
      return [];
    }
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Parâmetros de Operação</CardTitle>
          <CardDescription className="text-xs">
            O motor usa o <strong>frostCycleService</strong> real, que integra o modelo de
            formação de gelo (Hermes et al.) com o ciclo termodinâmico do compressor.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {/* Refrigerante */}
            <div className="space-y-1.5">
              <Label className="text-xs">Refrigerante</Label>
              <Select value={refrigerantId} onValueChange={setRefrigerantId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REFRIGERANT_GROUPS.map((g) => (
                    <SelectGroup key={g.label}>
                      <SelectLabel className="text-[10px]">{g.label}</SelectLabel>
                      {g.ids.map((id) => {
                        const meta = refrigerantsMeta.find((r) => r.id === id);
                        return (
                          <SelectItem key={id} value={id} className="text-xs">
                            {meta ? `${id} — ${meta.name}` : id}
                          </SelectItem>
                        );
                      })}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Te */}
            <div className="space-y-1.5">
              <Label className="text-xs">Te Evaporação: <strong>{te} °C</strong></Label>
              <Slider min={-40} max={5} step={1} value={[te]} onValueChange={([v]) => setTe(v)} className="mt-2" />
            </div>

            {/* Tc */}
            <div className="space-y-1.5">
              <Label className="text-xs">Tc Condensação: <strong>{tc} °C</strong></Label>
              <Slider min={20} max={60} step={1} value={[tc]} onValueChange={([v]) => setTc(v)} className="mt-2" />
            </div>

            {/* Temperatura do ar */}
            <div className="space-y-1.5">
              <Label className="text-xs">Temperatura do ar: <strong>{airTempC} °C</strong></Label>
              <Slider min={-25} max={30} step={1} value={[airTempC]} onValueChange={([v]) => setAirTempC(v)} className="mt-2" />
            </div>

            {/* Umidade relativa */}
            <div className="space-y-1.5">
              <Label className="text-xs">Umidade relativa: <strong>{airRH} %</strong></Label>
              <Slider min={50} max={100} step={1} value={[airRH]} onValueChange={([v]) => setAirRH(v)} className="mt-2" />
            </div>

            {/* Tempo de operação */}
            <div className="space-y-1.5">
              <Label className="text-xs">Tempo de operação (h)</Label>
              <Input
                type="number"
                min={1}
                max={24}
                step={0.5}
                value={operationTimeH}
                onChange={(e) => setOperationTimeH(Number(e.target.value))}
                className="h-8 text-xs"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Painel de análise de geada (componente existente do cn_coils) */}
      <FrostAnalysisPanel
        cycleState={cycleState}
        frostResult={frostResult}
        isAnalyzing={isAnalyzing}
        onAnalyze={analyze}
        operationTimeH={operationTimeH}
        onOperationTimeChange={setOperationTimeH}
      />
    </div>
  );
}
