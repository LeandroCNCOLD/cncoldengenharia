/**
 * OptimizationTabContent — Aba 5 do Hub de Testes
 * Ranking de Variações usando o optimizationEngine real do CN Coils.
 * Reutiliza o OptimizationPanel existente com CoilCycleInputs reais.
 *
 * O motor gera variações de (rows × circuits × finPitch) e ranqueia
 * pela função objetivo selecionada (COP, capacidade, queda de pressão, etc.)
 * usando o progressiveCoilSolver real — sem valores hardcoded.
 */
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OptimizationPanel } from "@/modules/cn_coils/components/OptimizationPanel";
import { listAvailableRefrigerants } from "@/modules/cn_coils/engines/refrigerant/refrigerantProperties";
import type { CoilCycleInputs } from "@/modules/cn_coils/engines/coil/coilCycleAdapter";

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
  airFlowM3H: number;
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
    airFlowM3H: opts.airFlowM3H,
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

export function OptimizationTabContent() {
  const [refrigerantId, setRefrigerantId] = useState("R404A");
  const [te, setTe] = useState(-10);
  const [tc, setTc] = useState(40);
  const [airTempC, setAirTempC] = useState(5);
  const [airRH, setAirRH] = useState(85);
  const [airFlowM3H, setAirFlowM3H] = useState(5000);

  const baseInputs = useMemo(
    () => buildBaseInputs({ refrigerantId, te, tc, airTempC, airRH, airFlowM3H }),
    [refrigerantId, te, tc, airTempC, airRH, airFlowM3H],
  );

  const refrigerantsMeta = useMemo(() => {
    try {
      return listAvailableRefrigerants();
    } catch {
      return [];
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* Parâmetros de busca */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Parâmetros de Operação para Ranking</CardTitle>
          <CardDescription className="text-xs">
            O motor gera automaticamente variações de fileiras, circuitos e passo de aleta
            e ranqueia usando o <strong>progressiveCoilSolver real</strong> — sem valores estimados.
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
              <Label className="text-xs">
                Te Evaporação: <strong>{te} °C</strong>
              </Label>
              <Slider
                min={-40}
                max={10}
                step={1}
                value={[te]}
                onValueChange={([v]) => setTe(v)}
                className="mt-2"
              />
            </div>

            {/* Tc */}
            <div className="space-y-1.5">
              <Label className="text-xs">
                Tc Condensação: <strong>{tc} °C</strong>
              </Label>
              <Slider
                min={20}
                max={60}
                step={1}
                value={[tc]}
                onValueChange={([v]) => setTc(v)}
                className="mt-2"
              />
            </div>

            {/* Temperatura do ar */}
            <div className="space-y-1.5">
              <Label className="text-xs">
                Temperatura do ar: <strong>{airTempC} °C</strong>
              </Label>
              <Slider
                min={-30}
                max={40}
                step={1}
                value={[airTempC]}
                onValueChange={([v]) => setAirTempC(v)}
                className="mt-2"
              />
            </div>

            {/* Umidade relativa */}
            <div className="space-y-1.5">
              <Label className="text-xs">
                Umidade relativa: <strong>{airRH} %</strong>
              </Label>
              <Slider
                min={30}
                max={100}
                step={1}
                value={[airRH]}
                onValueChange={([v]) => setAirRH(v)}
                className="mt-2"
              />
            </div>

            {/* Vazão de ar */}
            <div className="space-y-1.5">
              <Label className="text-xs">
                Vazão de ar: <strong>{airFlowM3H.toLocaleString("pt-BR")} m³/h</strong>
              </Label>
              <Slider
                min={500}
                max={20000}
                step={100}
                value={[airFlowM3H]}
                onValueChange={([v]) => setAirFlowM3H(v)}
                className="mt-2"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Painel de otimização (componente existente do cn_coils) */}
      <OptimizationPanel baseInputs={baseInputs} />
    </div>
  );
}
