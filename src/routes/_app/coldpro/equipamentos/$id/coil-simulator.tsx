import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { ArrowLeft, Calculator, Save, AlertTriangle, History, Sparkles, GitCompare } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { useAuth } from "@/lib/auth";
import { getEquipmentProject } from "@/lib/coldpro/equipment-projects";
import {
  listEquipmentCoilSimulations,
  saveCoilSimulatorRun,
} from "@/lib/coldpro/coil-simulations";
import { createComponent } from "@/lib/coldpro/component-items";
import { listApprovedComponents } from "@/lib/coldpro/technical-library";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { PerformanceMapPanel } from "@/components/coldpro/performance-map-panel";
import { BookOpen, Wand2, Activity } from "lucide-react";
import {
  simulateDxEvaporator,
  simulateDxCondenser,
  simulatePhysicalSimple,
  calibrateAgainstReference,
} from "@/modules/coldpro/adapters/thermalcalcAdapter";
import { factorsFromRow, getLatestCalibration, saveCoilCalibration } from "@/lib/coldpro/coil-calibrations";
import { NEUTRAL_CALIBRATION, type CalibrationFactors, type CoilEngine } from "@/modules/coldpro/coil/coilEngineTypes";
import { OriginBadge } from "@/components/coldpro/origin-badge";
import { SystemSimulatorPanel } from "@/components/coldpro/system-simulator-panel";
import type {
  CoilSimulatorInput,
  CoilSimulatorResult,
  CoilType,
} from "@/modules/coldpro/coil/coilSimulatorTypes";

export const Route = createFileRoute("/_app/coldpro/equipamentos/$id/coil-simulator")({
  component: CoilSimulatorPage,
});

const NUM = (v: string): number | undefined => {
  if (v === "" || v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

function CoilSimulatorPage() {
  const { id } = useParams({ from: "/_app/coldpro/equipamentos/$id/coil-simulator" });
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: project } = useQuery({
    queryKey: ["equipment-project", id],
    queryFn: () => getEquipmentProject(id),
  });

  const { data: history = [] } = useQuery({
    queryKey: ["coil-sims", id],
    queryFn: () => listEquipmentCoilSimulations(id),
  });

  const [coilType, setCoilType] = useState<CoilType>("evaporator");
  const [label, setLabel] = useState("");

  // Geometria
  const [g, setG] = useState({
    description: "",
    finType: "integral",
    tubeArrangement: "staggered",
    tubeSpacingMm: "",
    rowSpacingMm: "",
    tubeOdMm: "",
    tubeIdMm: "",
    tubeWallMm: "",
    finThicknessMm: "",
    finCorrugation: "",
    tubeCorrugation: "",
    tubesPerRow: "",
    rows: "",
    circuits: "",
    coilLengthMm: "",
    finPitchMm: "",
    skippedTubes: "",
    tubeMaterial: "Cobre",
    finMaterial: "Alumínio",
  });

  // Ar
  const [a, setA] = useState({
    airflowM3h: "",
    faceVelocityMs: "",
    airTempInC: "",
    airTempOutC: "",
    rhInPct: "",
    rhOutPct: "",
    atmPressureKpa: "",
    altitudeM: "",
    airDensityKgM3: "",
    enthalpyInKjkg: "",
    enthalpyOutKjkg: "",
    airPressureDropPa: "",
  });

  // Refrigerante
  const [r, setR] = useState({
    refrigerant: "R-404A",
    refTempC: "",
    pressureKpa: "",
    massFlowKgs: "",
    superheatK: "",
    subcoolingK: "",
    vapourVelocityMs: "",
    liquidVelocityMs: "",
    refrigerantPressureDropKpa: "",
  });

  const [prefillNominal, setPrefillNominal] = useState<{
    capacityW: number; airTempInC: number; refTempC: number; airflowM3h: number;
  } | null>(null);
  const [prefillComponentId, setPrefillComponentId] = useState<string | null>(null);

  // Carrega prefill vindo do botão dentro da aba Evaporador/Condensador
  useEffect(() => {
    const key = `coilsim:prefill:${id}`;
    const raw = localStorage.getItem(key);
    if (!raw) return;
    localStorage.removeItem(key);
    try {
      const p = JSON.parse(raw) as {
        coilType?: CoilType;
        label?: string;
        componentItemId?: string;
        refrigerant?: string;
        nominal?: { capacityW: number; airTempInC: number; refTempC: number; airflowM3h: number };
        geometry?: Record<string, number | null | undefined>;
      };
      if (p.coilType) setCoilType(p.coilType);
      if (p.label) setLabel(p.label);
      if (p.componentItemId) setPrefillComponentId(p.componentItemId);
      if (p.nominal) {
        setPrefillNominal(p.nominal);
        setA((s) => ({
          ...s,
          airTempInC: s.airTempInC || String(p.nominal!.airTempInC ?? ""),
          airflowM3h: s.airflowM3h || String(p.nominal!.airflowM3h ?? ""),
        }));
        setR((s) => ({
          ...s,
          refTempC: s.refTempC || String(p.nominal!.refTempC ?? ""),
          refrigerant: p.refrigerant ?? s.refrigerant,
        }));
      }
      const gx = p.geometry ?? {};
      setG((s) => ({
        ...s,
        rows: gx.rows != null ? String(gx.rows) : s.rows,
        tubesPerRow: gx.tubesPerRow != null ? String(gx.tubesPerRow) : s.tubesPerRow,
        circuits: gx.circuits != null ? String(gx.circuits) : s.circuits,
        coilLengthMm: gx.coilLengthMm != null ? String(gx.coilLengthMm) : s.coilLengthMm,
        finPitchMm: gx.finPitchMm != null ? String(gx.finPitchMm) : s.finPitchMm,
        tubeOdMm: gx.tubeOdMm != null ? String(gx.tubeOdMm) : s.tubeOdMm,
        tubeIdMm: gx.tubeIdMm != null ? String(gx.tubeIdMm) : s.tubeIdMm,
      }));
      toast.info("Dados do componente pré-carregados.");
    } catch {
      // noop
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const [engine, setEngine] = useState<CoilEngine>("empirical");
  const [result, setResult] = useState<CoilSimulatorResult | null>(null);
  const [physicalResult, setPhysicalResult] = useState<CoilSimulatorResult | null>(null);
  const [empiricalResult, setEmpiricalResult] = useState<CoilSimulatorResult | null>(null);
  const [lastInput, setLastInput] = useState<CoilSimulatorInput | null>(null);

  // Última calibração para o componente prefilled
  const { data: latestCal } = useQuery({
    queryKey: ["coil-cal-latest", prefillComponentId],
    queryFn: () => (prefillComponentId ? getLatestCalibration(prefillComponentId) : Promise.resolve(null)),
    enabled: !!prefillComponentId,
  });

  const calibration: CalibrationFactors = useMemo(() => {
    if (!latestCal) return NEUTRAL_CALIBRATION;
    return factorsFromRow(latestCal as unknown as Parameters<typeof factorsFromRow>[0]);
  }, [latestCal]);

  const buildInput = (): CoilSimulatorInput => ({
    mode: "verify",
    coilType,
    label: label || undefined,
    geometry: {
      description: g.description || undefined,
      finType: g.finType as never,
      tubeArrangement: g.tubeArrangement as never,
      tubeSpacingMm: NUM(g.tubeSpacingMm),
      rowSpacingMm: NUM(g.rowSpacingMm),
      tubeOdMm: NUM(g.tubeOdMm),
      tubeIdMm: NUM(g.tubeIdMm),
      tubeWallMm: NUM(g.tubeWallMm),
      finThicknessMm: NUM(g.finThicknessMm),
      finCorrugation: g.finCorrugation || undefined,
      tubeCorrugation: g.tubeCorrugation || undefined,
      tubesPerRow: NUM(g.tubesPerRow),
      rows: NUM(g.rows),
      circuits: NUM(g.circuits),
      coilLengthMm: NUM(g.coilLengthMm),
      finPitchMm: NUM(g.finPitchMm),
      skippedTubes: NUM(g.skippedTubes),
      tubeMaterial: g.tubeMaterial || undefined,
      finMaterial: g.finMaterial || undefined,
    },
    air: {
      airflowM3h: NUM(a.airflowM3h),
      faceVelocityMs: NUM(a.faceVelocityMs),
      airTempInC: NUM(a.airTempInC),
      airTempOutC: NUM(a.airTempOutC),
      rhInPct: NUM(a.rhInPct),
      rhOutPct: NUM(a.rhOutPct),
      atmPressureKpa: NUM(a.atmPressureKpa),
      altitudeM: NUM(a.altitudeM),
      airDensityKgM3: NUM(a.airDensityKgM3),
      enthalpyInKjkg: NUM(a.enthalpyInKjkg),
      enthalpyOutKjkg: NUM(a.enthalpyOutKjkg),
      airPressureDropPa: NUM(a.airPressureDropPa),
    },
    refrigerant: {
      refrigerant: r.refrigerant || undefined,
      refTempC: NUM(r.refTempC),
      pressureKpa: NUM(r.pressureKpa),
      massFlowKgs: NUM(r.massFlowKgs),
      superheatK: NUM(r.superheatK),
      subcoolingK: NUM(r.subcoolingK),
      vapourVelocityMs: NUM(r.vapourVelocityMs),
      liquidVelocityMs: NUM(r.liquidVelocityMs),
      refrigerantPressureDropKpa: NUM(r.refrigerantPressureDropKpa),
    },
    nominal: prefillNominal ?? undefined,
  });

  const handleCalculate = () => {
    const input = buildInput();
    // Empírico: aplica calibração como pós-processamento (via options).
    const emp =
      coilType === "evaporator"
        ? simulateDxEvaporator(input, { calibration })
        : simulateDxCondenser(input, { calibration });
    // Físico: aplica calibração internamente. NUNCA aplicar de novo por cima.
    const phy = simulatePhysicalSimple(input, {
      calibration,
      componentItemId: prefillComponentId ?? undefined,
      calibrationId: (latestCal as { id?: string } | null)?.id ?? null,
      nominalCapacityW: prefillNominal?.capacityW ?? null,
      logCalibration: true,
      calibrationSignature:
        (latestCal as { model_signature?: string | null } | null)?.model_signature ?? null,
    });
    setEmpiricalResult(emp);
    setPhysicalResult(phy);
    const chosen = engine === "physical_simple" ? phy : emp;
    setResult(chosen);
    setLastInput(input);
    const errs = chosen.warnings.filter((w) => w.startsWith("ERRO"));
    if (errs.length) toast.error(errs[0]);
    else toast.success(`Q (${engine === "physical_simple" ? "físico" : "empírico"}) = ${(chosen.capacityW / 1000).toFixed(2)} kW`);
  };

  const calibrateMutation = useMutation({
    mutationFn: async () => {
      if (!prefillComponentId) throw new Error("Importe um componente antes de calibrar.");
      if (!prefillNominal) throw new Error("Sem ponto nominal Unilab para calibrar.");
      const input = buildInput();
      const outcome = calibrateAgainstReference(input, {
        capacityW: prefillNominal.capacityW,
        airPressureDropPa: NUM(a.airPressureDropPa) ?? null,
        refPressureDropKpa: NUM(r.refrigerantPressureDropKpa) ?? null,
      });
      const calRes = outcome.calibratedResult as typeof outcome.calibratedResult & {
        modelSignature?: string;
        engineName?: string;
        engineVersion?: string;
        correlationSetVersion?: string;
      };
      await saveCoilCalibration({
        componentItemId: prefillComponentId,
        coilType,
        outcome,
        referenceSource: "Unilab nominal",
        inputSnapshot: input,
        outputSnapshot: outcome.calibratedResult,
        userId: user?.id,
        modelSignature: calRes.modelSignature ?? "unknown",
        engineName: calRes.engineName ?? "physical_simple",
        engineVersion: calRes.engineVersion ?? "v1",
        correlationSetVersion: calRes.correlationSetVersion ?? "v1",
      });
      return outcome;
    },
    onSuccess: (outcome) => {
      qc.invalidateQueries({ queryKey: ["coil-cal-latest", prefillComponentId] });
      qc.invalidateQueries({ queryKey: ["coil-cal-active", prefillComponentId] });
      qc.invalidateQueries({ queryKey: ["coil-cal-history", prefillComponentId] });
      const dev = outcome.deviationAfter.capacityPct;
      toast.success(
        outcome.meetsTargets
          ? `Calibrado: erro de capacidade ${dev?.toFixed(2)}% (meta ≤5%).`
          : `Calibração salva. Erro residual ${dev?.toFixed(2)}% — revisar.`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!result || !lastInput) throw new Error("Calcule antes de salvar.");
      await saveCoilSimulatorRun({
        equipmentProjectId: id,
        componentItemId: prefillComponentId,
        input: lastInput,
        result,
        userId: user?.id,
      });
    },
    onSuccess: () => {
      toast.success("Simulação salva no histórico.");
      qc.invalidateQueries({ queryKey: ["coil-sims", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const errors = useMemo(() => result?.warnings.filter((w) => w.startsWith("ERRO")) ?? [], [result]);
  const warns = useMemo(() => result?.warnings.filter((w) => !w.startsWith("ERRO")) ?? [], [result]);

  return (
    <div className="space-y-6">

      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link to="/coldpro/equipamentos/$id" params={{ id }}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Voltar ao equipamento
          </Link>
        </Button>
        <PageHeader
          title="Coil Simulator"
          description={
            <span className="text-sm">
              {project?.commercial_name ?? "—"} · modo <strong>VERIFY</strong>
            </span>
          }
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Select value={coilType} onValueChange={(v) => setCoilType(v as CoilType)}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="evaporator">Evaporador (DX)</SelectItem>
                  <SelectItem value="condenser">Condensador</SelectItem>
                </SelectContent>
              </Select>
              <Select value={engine} onValueChange={(v) => setEngine(v as CoilEngine)}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="empirical">Motor: Empírico</SelectItem>
                  <SelectItem value="physical_simple">Motor: Físico simples</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleCalculate}>
                <Calculator className="mr-1 h-4 w-4" /> Calcular
              </Button>
              <Button
                variant="secondary"
                disabled={!prefillNominal || !prefillComponentId || calibrateMutation.isPending}
                onClick={() => calibrateMutation.mutate()}
                title={!prefillNominal ? "Importe um componente Unilab para habilitar" : "Calibrar motor físico contra ponto nominal"}
              >
                <Sparkles className="mr-1 h-4 w-4" /> Calibrar c/ Unilab
              </Button>
              <Button
                variant="outline"
                disabled={!result || saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
              >
                <Save className="mr-1 h-4 w-4" /> Salvar
              </Button>
            </div>
          }
        />
      </div>

      {latestCal && (
        <Alert>
          <Sparkles className="h-4 w-4" />
          <AlertTitle className="flex flex-wrap items-center gap-2">
            Calibração ativa
            {(() => {
              const lc = latestCal as unknown as { status?: string; confidence_score?: number; meets_targets?: boolean };
              const status = lc.status ?? (lc.meets_targets ? "calibrated" : "needs_review");
              const conf = Number(lc.confidence_score ?? (lc.meets_targets ? 0.85 : 0.7));
              const variant = status === "calibrated" ? "default" : "secondary";
              const label =
                status === "calibrated" ? "Calibrado" : status === "needs_review" ? "Revisão" : "Rascunho";
              return (
                <>
                  <Badge variant={variant}>{label}</Badge>
                  <Badge variant="outline">Confiança: {(conf * 100).toFixed(0)}%</Badge>
                  <Badge variant="outline">
                    Motor: {engine === "physical_simple" ? "Físico simples" : "Empírico"}
                  </Badge>
                </>
              );
            })()}
          </AlertTitle>
          <AlertDescription className="text-xs">
            Fatores aplicados — capacidade ×{Number(latestCal.capacity_correction_factor).toFixed(3)},
            ΔP ar ×{Number(latestCal.air_dp_correction_factor).toFixed(3)},
            ΔP ref ×{Number(latestCal.ref_dp_correction_factor).toFixed(3)}.
            {engine === "physical_simple"
              ? " Aplicados internamente pelo motor físico."
              : " Aplicados como pós-processamento ao motor empírico."}
          </AlertDescription>
        </Alert>
      )}

      <div className="max-w-md">

        <Label>Descrição da simulação</Label>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex.: Verify base R404A -8°C" />
      </div>

      <Tabs defaultValue="geometry">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="geometry">Geometria</TabsTrigger>
          <TabsTrigger value="air">Lado do Ar</TabsTrigger>
          <TabsTrigger value="ref">Lado Refrigerante</TabsTrigger>
          <TabsTrigger value="results">Resultados</TabsTrigger>
          <TabsTrigger value="compare"><GitCompare className="mr-1 h-3 w-3" />Comparativo</TabsTrigger>
          <TabsTrigger value="alerts">
            Alertas {result && result.warnings.length > 0 && (
              <Badge variant="secondary" className="ml-2">{result.warnings.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="debug">Debug técnico</TabsTrigger>
          <TabsTrigger value="system">Sistema</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="system" className="mt-4">
          <SystemSimulatorPanel
            defaultEvaporatorCode={g.description || "EVAP_DEFAULT"}
          />
        </TabsContent>

        {/* Geometria */}
        <TabsContent value="geometry" className="mt-4">
          <Card>
            <CardContent className="grid gap-4 p-6 md:grid-cols-3">
              <Field label="Descrição" colSpan={3}>
                <Input value={g.description} onChange={(e) => setG({ ...g, description: e.target.value })} />
              </Field>
              <Field label="Tipo de aleta">
                <Select value={g.finType} onValueChange={(v) => setG({ ...g, finType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="integral">Integral</SelectItem>
                    <SelectItem value="espiral">Espiral</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Arranjo dos tubos">
                <Select value={g.tubeArrangement} onValueChange={(v) => setG({ ...g, tubeArrangement: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staggered">Staggered</SelectItem>
                    <SelectItem value="aligned">Aligned</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <NumField label="Espaç. tubos (mm)" v={g.tubeSpacingMm} onChange={(v) => setG({ ...g, tubeSpacingMm: v })} />
              <NumField label="Espaç. fileiras (mm)" v={g.rowSpacingMm} onChange={(v) => setG({ ...g, rowSpacingMm: v })} />
              <NumField label="Tubo ⌀ ext. (mm)" v={g.tubeOdMm} onChange={(v) => setG({ ...g, tubeOdMm: v })} />
              <NumField label="Tubo ⌀ int. (mm)" v={g.tubeIdMm} onChange={(v) => setG({ ...g, tubeIdMm: v })} />
              <NumField label="Espessura tubo (mm)" v={g.tubeWallMm} onChange={(v) => setG({ ...g, tubeWallMm: v })} />
              <NumField label="Espessura aleta (mm)" v={g.finThicknessMm} onChange={(v) => setG({ ...g, finThicknessMm: v })} />
              <Field label="Corrugação aleta">
                <Input value={g.finCorrugation} onChange={(e) => setG({ ...g, finCorrugation: e.target.value })} />
              </Field>
              <Field label="Corrugação tubo">
                <Input value={g.tubeCorrugation} onChange={(e) => setG({ ...g, tubeCorrugation: e.target.value })} />
              </Field>
              <NumField label="Tubos por fileira" v={g.tubesPerRow} onChange={(v) => setG({ ...g, tubesPerRow: v })} />
              <NumField label="Fileiras" v={g.rows} onChange={(v) => setG({ ...g, rows: v })} />
              <NumField label="Circuitos" v={g.circuits} onChange={(v) => setG({ ...g, circuits: v })} />
              <NumField label="Comprimento bateria (mm)" v={g.coilLengthMm} onChange={(v) => setG({ ...g, coilLengthMm: v })} />
              <NumField label="Passo aleta (mm)" v={g.finPitchMm} onChange={(v) => setG({ ...g, finPitchMm: v })} />
              <NumField label="Tubos saltados" v={g.skippedTubes} onChange={(v) => setG({ ...g, skippedTubes: v })} />
              <Field label="Material tubo">
                <Input value={g.tubeMaterial} onChange={(e) => setG({ ...g, tubeMaterial: e.target.value })} />
              </Field>
              <Field label="Material aleta">
                <Input value={g.finMaterial} onChange={(e) => setG({ ...g, finMaterial: e.target.value })} />
              </Field>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Ar */}
        <TabsContent value="air" className="mt-4">
          <Card>
            <CardContent className="grid gap-4 p-6 md:grid-cols-3">
              <NumField label="Vazão de ar (m³/h)" v={a.airflowM3h} onChange={(v) => setA({ ...a, airflowM3h: v })} />
              <NumField label="Velocidade frontal (m/s)" v={a.faceVelocityMs} onChange={(v) => setA({ ...a, faceVelocityMs: v })} />
              <NumField label="T entrada (°C)" v={a.airTempInC} onChange={(v) => setA({ ...a, airTempInC: v })} />
              <NumField label="T saída (°C)" v={a.airTempOutC} onChange={(v) => setA({ ...a, airTempOutC: v })} />
              <NumField label="UR entrada (%)" v={a.rhInPct} onChange={(v) => setA({ ...a, rhInPct: v })} />
              <NumField label="UR saída (%)" v={a.rhOutPct} onChange={(v) => setA({ ...a, rhOutPct: v })} />
              <NumField label="Pressão atm. (kPa)" v={a.atmPressureKpa} onChange={(v) => setA({ ...a, atmPressureKpa: v })} />
              <NumField label="Altitude (m)" v={a.altitudeM} onChange={(v) => setA({ ...a, altitudeM: v })} />
              <NumField label="Densidade (kg/m³)" v={a.airDensityKgM3} onChange={(v) => setA({ ...a, airDensityKgM3: v })} />
              <NumField label="Entalpia entrada (kJ/kg)" v={a.enthalpyInKjkg} onChange={(v) => setA({ ...a, enthalpyInKjkg: v })} />
              <NumField label="Entalpia saída (kJ/kg)" v={a.enthalpyOutKjkg} onChange={(v) => setA({ ...a, enthalpyOutKjkg: v })} />
              <NumField label="Perda de carga ar (Pa)" v={a.airPressureDropPa} onChange={(v) => setA({ ...a, airPressureDropPa: v })} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Refrigerante */}
        <TabsContent value="ref" className="mt-4">
          <Card>
            <CardContent className="grid gap-4 p-6 md:grid-cols-3">
              <Field label="Fluido refrigerante">
                <Input value={r.refrigerant} onChange={(e) => setR({ ...r, refrigerant: e.target.value })} />
              </Field>
              <NumField
                label={coilType === "evaporator" ? "T evaporação (°C)" : "T condensação (°C)"}
                v={r.refTempC}
                onChange={(v) => setR({ ...r, refTempC: v })}
              />
              <NumField label="Pressão (kPa)" v={r.pressureKpa} onChange={(v) => setR({ ...r, pressureKpa: v })} />
              <NumField label="Vazão mássica (kg/s)" v={r.massFlowKgs} onChange={(v) => setR({ ...r, massFlowKgs: v })} />
              <NumField label="Superaquecimento (K)" v={r.superheatK} onChange={(v) => setR({ ...r, superheatK: v })} />
              <NumField label="Subresfriamento (K)" v={r.subcoolingK} onChange={(v) => setR({ ...r, subcoolingK: v })} />
              <NumField label="Vel. fase gasosa (m/s)" v={r.vapourVelocityMs} onChange={(v) => setR({ ...r, vapourVelocityMs: v })} />
              <NumField label="Vel. fase líquida (m/s)" v={r.liquidVelocityMs} onChange={(v) => setR({ ...r, liquidVelocityMs: v })} />
              <NumField label="Perda de carga refrig. (kPa)" v={r.refrigerantPressureDropKpa} onChange={(v) => setR({ ...r, refrigerantPressureDropKpa: v })} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Resultados */}
        <TabsContent value="results" className="mt-4">
          {!result ? (
            <Card><CardContent className="p-6 text-sm text-muted-foreground">Clique em <strong>Calcular como Verify</strong> para gerar resultados.</CardContent></Card>
          ) : (
            <Card>
              <CardHeader><CardTitle>Resultado — {result.coilType === "evaporator" ? "Evaporador DX" : "Condensador"}</CardTitle></CardHeader>
              <CardContent className="grid gap-4 p-6 md:grid-cols-3">
                <Stat label="Capacidade total" value={`${(result.capacityW / 1000).toFixed(2)} kW`} sub={`${result.capacityKcalh.toFixed(0)} kcal/h`} />
                <Stat label="Capacidade sensível" value={result.sensibleW != null ? `${(result.sensibleW / 1000).toFixed(2)} kW` : "—"} />
                <Stat label="Capacidade latente" value={result.latentW != null ? `${(result.latentW / 1000).toFixed(2)} kW` : "—"} />
                <Stat label="DT real" value={`${result.dtRealK.toFixed(2)} K`} sub={`nominal ${result.dtNominalK.toFixed(1)} K`} />
                <Stat label="Fator vazão" value={result.airflowFactor.toFixed(3)} />
                <Stat label="Fator DT" value={result.dtFactor.toFixed(3)} />
                <Stat label="Área frontal" value={result.faceAreaM2 != null ? `${result.faceAreaM2.toFixed(3)} m²` : "—"} />
                <Stat label="Velocidade frontal" value={result.faceVelocityMs != null ? `${result.faceVelocityMs.toFixed(2)} m/s` : "—"} />
                <Stat label="ΔP ar" value={result.airPressureDropPa != null ? `${result.airPressureDropPa.toFixed(0)} Pa` : "—"} />
                <Stat label="ΔP refrigerante" value={result.refPressureDropKpa != null ? `${result.refPressureDropKpa.toFixed(1)} kPa` : "—"} />
                <Stat label="Condensado / gelo" value={result.condensateLh != null ? `${result.condensateLh.toFixed(2)} L/h` : "—"} />
                {result.rejection?.estimated && (
                  <div className="md:col-span-3 text-xs text-muted-foreground">
                    Q nominal estimada: {result.rejection.used.capacityW.toFixed(0)} W @ DT {(result.rejection.used.airTempInC - result.rejection.used.refTempC).toFixed(1)} K
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Comparativo Unilab × Empírico × Físico */}
        <TabsContent value="compare" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitCompare className="h-4 w-4" /> Comparativo de motores
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {!empiricalResult || !physicalResult ? (
                <p className="text-sm text-muted-foreground">Clique em <strong>Calcular</strong> para gerar a comparação.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b">
                      <tr className="text-left">
                        <th className="py-2 pr-4">Métrica</th>
                        <th className="py-2 pr-4">Unilab (nominal)</th>
                        <th className="py-2 pr-4">Empírico</th>
                        <th className="py-2 pr-4">Físico simples {latestCal && <Badge variant="outline" className="ml-1">calibrado</Badge>}</th>
                        <th className="py-2 pr-4">Δ Empírico</th>
                        <th className="py-2 pr-4">Δ Físico</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      <CompareRow
                        label="Capacidade (kW)"
                        nominal={prefillNominal ? prefillNominal.capacityW / 1000 : null}
                        emp={empiricalResult.capacityW / 1000}
                        phy={physicalResult.capacityW / 1000}
                        digits={2}
                      />
                      <CompareRow
                        label="DT real (K)"
                        nominal={prefillNominal ? prefillNominal.airTempInC - prefillNominal.refTempC : null}
                        emp={empiricalResult.dtRealK}
                        phy={physicalResult.dtRealK}
                        digits={2}
                      />
                      <CompareRow
                        label="ΔP ar (Pa)"
                        nominal={NUM(a.airPressureDropPa) ?? null}
                        emp={empiricalResult.airPressureDropPa}
                        phy={physicalResult.airPressureDropPa}
                        digits={0}
                      />
                      <CompareRow
                        label="ΔP refrigerante (kPa)"
                        nominal={NUM(r.refrigerantPressureDropKpa) ?? null}
                        emp={empiricalResult.refPressureDropKpa}
                        phy={physicalResult.refPressureDropKpa}
                        digits={2}
                      />
                      <CompareRow
                        label="Vel. frontal (m/s)"
                        nominal={NUM(a.faceVelocityMs) ?? null}
                        emp={empiricalResult.faceVelocityMs}
                        phy={physicalResult.faceVelocityMs}
                        digits={2}
                      />
                    </tbody>
                  </table>
                  <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Origem dos campos:</span>
                    <OriginBadge origin="imported" />
                    <OriginBadge origin="calculated" />
                    <OriginBadge origin="calibrated" />
                    <OriginBadge origin="estimated" />
                    <OriginBadge origin="manual" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alertas */}
        <TabsContent value="alerts" className="mt-4 space-y-3">
          {!result && <p className="text-sm text-muted-foreground">Sem cálculo ainda.</p>}
          {result && result.warnings.length === 0 && (
            <Alert><AlertTitle>Sem alertas</AlertTitle><AlertDescription>Cálculo dentro das faixas recomendadas.</AlertDescription></Alert>
          )}
          {errors.map((w, i) => (
            <Alert key={`e-${i}`} variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Erro</AlertTitle>
              <AlertDescription>{w}</AlertDescription>
            </Alert>
          ))}
          {warns.map((w, i) => (
            <Alert key={`w-${i}`}>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Atenção</AlertTitle>
              <AlertDescription>{w}</AlertDescription>
            </Alert>
          ))}
        </TabsContent>

        {/* Debug técnico — Hybrid engine */}
        <TabsContent value="debug" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Motor híbrido (correlações + Unilab)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-6 text-sm">
              {!result?.debug && (
                <p className="text-muted-foreground">
                  Calcule uma simulação para ver os detalhes do motor híbrido.
                </p>
              )}
              {result?.debug && (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1">
                      <div className="text-xs uppercase text-muted-foreground">Origem dos dados</div>
                      <div className="flex items-center gap-2">
                        <Badge variant={result.debug.source === "unilab" ? "default" : "secondary"}>
                          {result.debug.source}
                        </Badge>
                        {result.debug.isEstimated && (
                          <Badge variant="outline">estimated</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Geometria: {result.debug.geometryCode || "—"} ·{" "}
                        Aleta: {result.debug.finType || "—"} ·{" "}
                        Tubo: {result.debug.tubeType || "—"}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs uppercase text-muted-foreground">Confiança</div>
                      <div className="font-mono">
                        {(result.debug.confidenceScore * 100).toFixed(0)}%
                      </div>
                      <div className="text-xs text-muted-foreground">
                        ar: {(result.debug.airCorrelationConfidence * 100).toFixed(0)}% ·{" "}
                        ref: {(result.debug.refCorrelationConfidence * 100).toFixed(0)}%
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-md border p-3">
                      <div className="text-xs uppercase text-muted-foreground">Lado ar</div>
                      <div className="mt-1 font-medium">{result.debug.airCorrelationName}</div>
                      <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-xs">
                        <div>h base: {result.debug.hAirBaseWm2K?.toFixed(1)}</div>
                        <div>h final: {result.debug.hAirFinalWm2K?.toFixed(1)}</div>
                      </div>
                    </div>
                    <div className="rounded-md border p-3">
                      <div className="text-xs uppercase text-muted-foreground">Lado refrigerante</div>
                      <div className="mt-1 font-medium">{result.debug.refCorrelationName}</div>
                      <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-xs">
                        <div>h base: {result.debug.hRefBaseWm2K?.toFixed(1)}</div>
                        <div>h final: {result.debug.hRefFinalWm2K?.toFixed(1)}</div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3 font-mono text-xs">
                    <div className="rounded-md border p-3">
                      U global: <span className="font-semibold">{result.debug.uWm2K?.toFixed(1)} W/m²K</span>
                    </div>
                    <div className="rounded-md border p-3">
                      Área efetiva: <span className="font-semibold">{result.debug.effectiveAreaM2?.toFixed(2)} m²</span>
                    </div>
                    <div className="rounded-md border p-3">
                      Q U·A·LMTD: <span className="font-semibold">
                        {((result.debug.uWm2K * result.debug.effectiveAreaM2 * (result.dtRealK ?? 0)) / 1000).toFixed(2)} kW
                      </span>
                    </div>
                  </div>

                  {result.debug.geometry && (
                    <div>
                      <div className="text-xs uppercase text-muted-foreground mb-2 flex items-center gap-2">
                        Geometria do aletado
                        <Badge variant={result.debug.geometry.areaSource === "calculated_geometry" ? "default" : "secondary"}>
                          {result.debug.geometry.areaSource === "calculated_geometry" ? "calculada" : "Unilab"}
                        </Badge>
                      </div>
                      <div className="grid gap-2 font-mono text-xs md:grid-cols-3">
                        <div className="rounded-md border p-2">
                          Área frontal: <span className="font-semibold">{result.debug.geometry.frontalAreaM2.toFixed(3)} m²</span>
                        </div>
                        <div className="rounded-md border p-2">
                          Área externa total: <span className="font-semibold">{result.debug.geometry.totalExternalAreaM2.toFixed(2)} m²</span>
                          {result.debug.geometry.areaDeviationPct != null && (
                            <span className="ml-1 text-muted-foreground">
                              ({result.debug.geometry.areaDeviationPct >= 0 ? "+" : ""}
                              {result.debug.geometry.areaDeviationPct.toFixed(1)}% vs Unilab)
                            </span>
                          )}
                        </div>
                        <div className="rounded-md border p-2">
                          Área interna tubos: <span className="font-semibold">{result.debug.geometry.internalTubeAreaM2.toFixed(2)} m²</span>
                        </div>
                        <div className="rounded-md border p-2">
                          Volume interno: <span className="font-semibold">{result.debug.geometry.internalVolumeL.toFixed(2)} L</span>
                          {result.debug.geometry.volumeDeviationPct != null && (
                            <span className="ml-1 text-muted-foreground">
                              ({result.debug.geometry.volumeDeviationPct >= 0 ? "+" : ""}
                              {result.debug.geometry.volumeDeviationPct.toFixed(1)}% vs Unilab)
                            </span>
                          )}
                        </div>
                        <div className="rounded-md border p-2">
                          Eficiência aleta: <span className="font-semibold">{(result.debug.geometry.finEfficiency * 100).toFixed(1)}%</span>
                        </div>
                        <div className="rounded-md border p-2">
                          Nº de aletas: <span className="font-semibold">{result.debug.geometry.finCount}</span>
                        </div>
                        <div className="rounded-md border p-2">
                          Nº de tubos: <span className="font-semibold">{result.debug.geometry.totalTubeCount}</span>
                        </div>
                        <div className="rounded-md border p-2">
                          Comprimento total tubo: <span className="font-semibold">{result.debug.geometry.totalTubeLengthM.toFixed(1)} m</span>
                        </div>
                        <div className="rounded-md border p-2">
                          q específico: <span className="font-semibold">{result.debug.geometry.qSpecificWm2.toFixed(0)} W/m²</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {result.debug.factorsApplied && (
                    <div>
                      <div className="text-xs uppercase text-muted-foreground mb-2">Fatores Unilab aplicados</div>
                      <div className="grid gap-1 font-mono text-xs md:grid-cols-2">
                        {Object.entries(result.debug.factorsApplied)
                          .filter(([, v]) => v != null)
                          .map(([k, v]) => (
                            <div key={k} className="flex justify-between rounded border px-2 py-1">
                              <span className="text-muted-foreground">{k}</span>
                              <span>{Number(v).toFixed(3)}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {result.debug.warnings.length > 0 && (
                    <div>
                      <div className="text-xs uppercase text-muted-foreground mb-2">Warnings do motor</div>
                      <ul className="list-disc pl-5 space-y-1 text-xs">
                        {result.debug.warnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Histórico */}
        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><History className="h-4 w-4" /> Últimas simulações</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {history.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">Nenhuma simulação salva ainda.</p>
              ) : (
                <div className="divide-y">
                  {history.map((h) => {
                    const out = (h.outputs ?? {}) as Partial<CoilSimulatorResult>;
                    return (
                      <div key={h.id} className="flex items-center justify-between p-4 text-sm">
                        <div>
                          <div className="font-medium">
                            {(h as { label?: string }).label || "(sem rótulo)"}{" "}
                            <Badge variant="outline" className="ml-2">{(h as { coil_type?: string }).coil_type ?? "—"}</Badge>
                            <Badge variant="secondary" className="ml-1">{(h as { mode?: string }).mode ?? "verify"}</Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(h.created_at).toLocaleString()} · DT {out.dtRealK?.toFixed?.(1) ?? "—"} K
                          </div>
                        </div>
                        <div className="font-mono">{out.capacityW != null ? `${(out.capacityW / 1000).toFixed(2)} kW` : "—"}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, children, colSpan }: { label: string; children: React.ReactNode; colSpan?: number }) {
  return (
    <div className={colSpan === 3 ? "md:col-span-3" : ""}>
      <Label className="text-xs">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function NumField({ label, v, onChange }: { label: string; v: string; onChange: (s: string) => void }) {
  return (
    <Field label={label}>
      <Input type="number" inputMode="decimal" value={v} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function CompareRow({
  label,
  nominal,
  emp,
  phy,
  digits = 2,
}: {
  label: string;
  nominal: number | null | undefined;
  emp: number | null | undefined;
  phy: number | null | undefined;
  digits?: number;
}) {
  const fmt = (v: number | null | undefined) =>
    v == null || !Number.isFinite(v) ? "—" : v.toFixed(digits);
  const dev = (v: number | null | undefined) => {
    if (v == null || nominal == null || nominal === 0) return "—";
    const d = ((v - nominal) / nominal) * 100;
    const sign = d > 0 ? "+" : "";
    return `${sign}${d.toFixed(1)}%`;
  };
  const tone = (v: number | null | undefined) => {
    if (v == null || nominal == null || nominal === 0) return "text-muted-foreground";
    const d = Math.abs((v - nominal) / nominal) * 100;
    if (d <= 5) return "text-emerald-600 font-medium";
    if (d <= 15) return "text-amber-600";
    return "text-destructive";
  };
  return (
    <tr>
      <td className="py-2 pr-4 font-medium">{label}</td>
      <td className="py-2 pr-4 font-mono">{fmt(nominal)}</td>
      <td className="py-2 pr-4 font-mono">{fmt(emp)}</td>
      <td className="py-2 pr-4 font-mono">{fmt(phy)}</td>
      <td className={`py-2 pr-4 font-mono ${tone(emp)}`}>{dev(emp)}</td>
      <td className={`py-2 pr-4 font-mono ${tone(phy)}`}>{dev(phy)}</td>
    </tr>
  );
}

