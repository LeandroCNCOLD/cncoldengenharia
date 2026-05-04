/**
 * AssemblyWorkspacePage — simulador de arranjo de serpentinas (Bancada).
 */
import { useEffect, useMemo, useState } from "react";
import { Layers } from "lucide-react";
import { toast } from "sonner";
import { runAssemblySimulation } from "../engines/assembly/coilAssembly";
import { listAvailableRefrigerants } from "../engines/refrigerant/refrigerantProperties";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActionBar } from "../components/ActionBar";
import { ResultCard } from "../components/ResultCard";
import { WorkspaceHeader } from "../components/WorkspaceHeader";
import { WorkspaceInputsSidebar } from "../components/WorkspaceInputsSidebar";
import { WorkspaceLayout } from "../components/WorkspaceLayout";
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
  { id: "series_air", label: "Série (ar)", description: "Ar passa em sequência", defaultUnits: 2 },
  { id: "parallel_air", label: "Paralelo (ar)", description: "Vazão de ar dividida", defaultUnits: 2 },
  { id: "parallel_refrigerant", label: "Paralelo (refrig.)", description: "Fluido em circuitos", defaultUnits: 2 },
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
  const [refrigerantsMeta, setRefrigerantsMeta] = useState<Array<{ id: string; name: string }>>([]);
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
      airInlet: { tempC: airTempC, relativeHumidity: airRH / 100, totalFlowM3H: airTotalM3H },
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

  const sidebar = (
    <WorkspaceInputsSidebar
      onCalculate={handleRun}
      isCalculating={running}
      onReset={() => {
        setSpec(DEFAULT_SPEC);
        setArrangement("series_air");
        setUnitCount(2);
        setResult(null);
        setError(null);
      }}
      calculateLabel="Calcular arranjo"
    >
      <Accordion type="multiple" defaultValue={["arr", "geom", "ref", "ar"]}>
        <AccordionItem value="arr">
          <AccordionTrigger className="text-xs font-semibold">Arranjo</AccordionTrigger>
          <AccordionContent className="space-y-2 pt-2">
            <div className="grid grid-cols-1 gap-1">
              {ARRANGEMENT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setArrangement(opt.id);
                    setUnitCount(opt.defaultUnits);
                  }}
                  className={`rounded-md border px-2 py-1.5 text-left text-xs transition-colors ${
                    arrangement === opt.id
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  <p className="font-semibold text-foreground">{opt.label}</p>
                  <p className="text-[10px] text-muted-foreground">{opt.description}</p>
                </button>
              ))}
            </div>
            {arrangement !== "single" && arrangement !== "vbank" && (
              <div className="space-y-2 pt-2">
                <Label className="text-xs">
                  Nº de serpentinas: <span className="font-mono text-primary">{unitCount}</span>
                </Label>
                <Slider
                  min={2}
                  max={4}
                  step={1}
                  value={[unitCount]}
                  onValueChange={(v) => setUnitCount(v[0])}
                />
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="geom">
          <AccordionTrigger className="text-xs font-semibold">Geometria por serpentina</AccordionTrigger>
          <AccordionContent className="grid grid-cols-2 gap-2 pt-2">
            <NumField label="Filas" value={spec.rows} onChange={(v) => setSpec({ ...spec, rows: v })} />
            <NumField label="Circuitos" value={spec.circuits} onChange={(v) => setSpec({ ...spec, circuits: v })} />
            <NumField label="Altura (mm)" value={spec.finnedHeightMm} onChange={(v) => setSpec({ ...spec, finnedHeightMm: v })} />
            <NumField label="Largura (mm)" value={spec.finnedLengthMm} onChange={(v) => setSpec({ ...spec, finnedLengthMm: v })} />
            <NumField label="Aleta (mm)" value={spec.finPitchMm} step={0.1} onChange={(v) => setSpec({ ...spec, finPitchMm: v })} />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="ref">
          <AccordionTrigger className="text-xs font-semibold">Refrigerante</AccordionTrigger>
          <AccordionContent className="space-y-3 pt-2">
            <Select value={refrigerantId} onValueChange={setRefrigerantId}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-80">
                {REFRIGERANT_GROUPS.map((g) => (
                  <SelectGroup key={g.label}>
                    <SelectLabel>{g.label}</SelectLabel>
                    {g.ids.map((id) => (
                      <SelectItem key={id} value={id}>{id}</SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
            {meta && <p className="text-[10px] text-muted-foreground">{meta.name}</p>}
            <div className="space-y-2">
              <Label className="text-xs">Te (°C): <span className="font-mono text-primary">{te}</span></Label>
              <Slider min={-40} max={15} step={1} value={[te]} onValueChange={(v) => setTe(v[0])} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Tc (°C): <span className="font-mono text-primary">{tc}</span></Label>
              <Slider min={20} max={70} step={1} value={[tc]} onValueChange={(v) => setTc(v[0])} />
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="ar">
          <AccordionTrigger className="text-xs font-semibold">Ar de entrada</AccordionTrigger>
          <AccordionContent className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs">Vazão de ar total (m³/h)</Label>
              <Input
                type="number"
                min={500}
                step={500}
                value={airTotalM3H}
                onChange={(e) => setAirTotalM3H(Number(e.target.value))}
                className="h-9"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <NumField label="Tar (°C)" value={airTempC} onChange={setAirTempC} step={1} />
              <NumField label="UR (%)" value={airRH} onChange={setAirRH} step={1} />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </WorkspaceInputsSidebar>
  );

  return (
    <WorkspaceLayout
      header={
        <WorkspaceHeader
          title="Bancada — Arranjo de Serpentinas"
          icon={<Layers className="h-4 w-4" />}
          badges={[arrangement, refrigerantId, `Te ${te}°C`, `Tc ${tc}°C`]}
        />
      }
      sidebar={sidebar}
    >
      <div className="flex flex-col gap-4 p-4">
        {!result && !running && !error && (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              Configure o arranjo na lateral e clique em <strong>Calcular arranjo</strong>.
            </CardContent>
          </Card>
        )}

        {error && (
          <Card className="border-red-500/40 bg-red-500/5">
            <CardContent className="p-4 text-sm text-red-600">{error}</CardContent>
          </Card>
        )}

        {result && (
          <Tabs defaultValue="results">
            <TabsList>
              <TabsTrigger value="results">Resultados</TabsTrigger>
              <TabsTrigger value="units">Por serpentina</TabsTrigger>
              {result.warnings.length > 0 && (
                <TabsTrigger value="alerts">Alertas ({result.warnings.length})</TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="results" className="mt-3 space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant={result.converged ? "default" : "secondary"}>
                  {result.converged ? "Convergido" : "Estimativa"}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {result.units.length} serpentina(s) · {result.arrangement}
                </span>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <ResultCard
                  label="Q total"
                  value={fmt(result.totals.totalCapacityW / 1000)}
                  unit="kW"
                  variant="success"
                />
                <ResultCard
                  label="Q sensível"
                  value={fmt(result.totals.sensibleCapacityW / 1000)}
                  unit="kW"
                />
                <ResultCard
                  label="ΔP ar total"
                  value={fmt(result.totals.totalAirPressureDropPa, 0)}
                  unit="Pa"
                />
                <ResultCard
                  label="U médio"
                  value={fmt(result.totals.weightedOverallU_WM2K, 1)}
                  unit="W/m²K"
                />
              </div>
            </TabsContent>

            <TabsContent value="units" className="mt-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Detalhes por serpentina</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto p-0">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 text-muted-foreground">
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
                        <tr key={u.unitId} className="border-t border-border">
                          <td className="px-3 py-2">{u.unitName}</td>
                          <td className="px-3 py-2 text-right font-mono">
                            {fmt(u.coilResult.totalCapacityW / 1000)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono">
                            {fmt(u.coilResult.airPressureDropPa ?? 0, 0)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono">
                            {fmt(u.coilResult.fluidPressureDropKPa ?? 0, 1)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono">{fmt(u.airOutletTempC, 1)}</td>
                          <td className="px-3 py-2 text-right font-mono">
                            {fmt(u.airFlowFraction * 100, 0)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </TabsContent>

            {result.warnings.length > 0 && (
              <TabsContent value="alerts" className="mt-3">
                <Card className="border-amber-500/40 bg-amber-500/5">
                  <CardHeader>
                    <CardTitle className="text-sm">Avisos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-disc space-y-1 pl-4 text-xs text-amber-700 dark:text-amber-300">
                      {result.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>
        )}

        <ActionBar
          hasResults={!!result}
          onExportCsv={() => toast.info("Exportação CSV em breve")}
          onExportExcel={() => toast.info("Exportação Excel em breve")}
          onExportPdf={() => toast.info("Exportação PDF em breve")}
          onShare={() => toast.info("Compartilhamento em breve")}
        />
      </div>
    </WorkspaceLayout>
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
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      <Input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-8 text-xs"
      />
    </div>
  );
}
