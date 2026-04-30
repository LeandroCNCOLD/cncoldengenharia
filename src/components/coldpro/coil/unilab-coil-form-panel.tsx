/**
 * UnilabCoilFormPanel
 *
 * Formulário Unilab-style com 3 blocos lado a lado:
 *  - Geometria (tubos, aletas, circuitos, materiais)
 *  - Lado Ar (vazão, T entrada, RH; resultados: T saída, RH saída, ΔP ar, vel. frontal)
 *  - Lado Fluido (refrigerante, T evap/cond, superaquecimento, subresfriamento;
 *    resultados: vazão mássica, ΔP refrig, velocidade)
 *
 * Botões:
 *  - Calcular   → chama simulateHybridCoil() do thermalcalc
 *  - Comparar com catálogo → busca ponto CN (auto via equipment.code, fallback manual)
 *
 * NÃO faz cálculos no React — apenas monta input e exibe o que o engine retorna.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calculator, GitCompare, Info } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  simulateHybridCoil,
  type CoilCalculationInput,
  type CoilCalculationResult,
} from "@/modules/thermalcalc/engines/coil";
import type { CoilSimulatorInput, CoilSimulatorResult, CoilType } from "@/modules/coldpro/coil/coilSimulatorTypes";
import {
  listCoilMaterials,
  listCnCatalogModelsLite,
  getCnCatalogPointByModelId,
  findCnCatalogPointByCode,
  type CnCatalogPoint,
} from "@/server/coilUnilab.functions";

type CoilKind = "evaporator" | "condenser";

type UnilabGeometryState = {
  tubesPerRow: string;
  rows: string;
  coilLengthMm: string;
  circuits: string;
  finPitchMm: string;
  skippedTubes: string;
  tubeOdMm: string;
  tubeWallMm: string;
  tubeMaterialId: string;
  finMaterialId: string;
  tubePitchMm: string;
  rowPitchMm: string;
  finThicknessMm: string;
};

interface Props {
  equipmentCode?: string | null;
  equipmentCommercialName?: string | null;
  defaultRefrigerant?: string | null;
  label?: string;
  prefill?: UnilabCoilPrefill | null;
  onSimulationComplete?: (input: CoilSimulatorInput, result: CoilSimulatorResult) => void;
  onCoilKindChange?: (coilType: CoilType) => void;
}

export type UnilabCoilPrefill = {
  coilType?: CoilType;
  refrigerant?: string;
  nominal?: { airTempInC?: number; refTempC?: number; airflowM3h?: number };
  geometry?: Record<string, number | null | undefined>;
};

const REFRIGERANTS = ["R-404A", "R-449A", "R-448A", "R-134a", "R-22", "R-290", "R-744"];

const numOrUndef = (s: string): number | undefined => {
  if (s === "" || s == null) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
};
const numOrZero = (s: string): number => numOrUndef(s) ?? 0;

const fmt = (v: number | null | undefined, digits = 2, suffix = ""): string => {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v.toFixed(digits)}${suffix ? ` ${suffix}` : ""}`;
};

export function UnilabCoilFormPanel({
  equipmentCode,
  equipmentCommercialName,
  defaultRefrigerant,
  label,
  prefill,
  onSimulationComplete,
  onCoilKindChange,
}: Props) {
  const [coilKind, setCoilKind] = useState<CoilKind>("evaporator");

  // ============= GEOMETRIA =============
  const [geo, setGeo] = useState({
    tubesPerRow: "16",
    rows: "4",
    coilLengthMm: "600",
    circuits: "4",
    finPitchMm: "5.0",
    skippedTubes: "0",
    tubeOdMm: "9.52",
    tubeWallMm: "0.4",
    tubeMaterialId: "", // uuid de coil_materials
    finMaterialId: "",
    // pitches default (passo entre tubos numa fila e entre filas)
    tubePitchMm: "25",
    rowPitchMm: "21.65",
    finThicknessMm: "0.13",
  });

  // ============= AR =============
  const [air, setAir] = useState({
    airflowM3h: "2368",
    airTempInC: coilKind === "evaporator" ? "0" : "35",
    rhInPct: "85",
  });

  // ============= FLUIDO =============
  const [ref, setRef] = useState({
    refrigerant: defaultRefrigerant ?? "R-404A",
    refTempC: coilKind === "evaporator" ? "-10" : "48",
    superheatK: "7",
    subcoolingK: "3",
  });

  useEffect(() => {
    if (!prefill) return;
    if (prefill.coilType) setCoilKind(prefill.coilType);
    const geometry = prefill.geometry ?? {};
    setGeo((s) => ({
      ...s,
      rows: geometry.rows != null ? String(geometry.rows) : s.rows,
      tubesPerRow: geometry.tubesPerRow != null ? String(geometry.tubesPerRow) : s.tubesPerRow,
      circuits: geometry.circuits != null ? String(geometry.circuits) : s.circuits,
      coilLengthMm: geometry.coilLengthMm != null ? String(geometry.coilLengthMm) : s.coilLengthMm,
      finPitchMm: geometry.finPitchMm != null ? String(geometry.finPitchMm) : s.finPitchMm,
      tubeOdMm: geometry.tubeOdMm != null ? String(geometry.tubeOdMm) : s.tubeOdMm,
      tubeWallMm: geometry.tubeWallMm != null ? String(geometry.tubeWallMm) : s.tubeWallMm,
    }));
    setAir((s) => ({
      ...s,
      airTempInC: prefill.nominal?.airTempInC != null ? String(prefill.nominal.airTempInC) : s.airTempInC,
      airflowM3h: prefill.nominal?.airflowM3h != null ? String(prefill.nominal.airflowM3h) : s.airflowM3h,
    }));
    setRef((s) => ({
      ...s,
      refrigerant: prefill.refrigerant ?? s.refrigerant,
      refTempC: prefill.nominal?.refTempC != null ? String(prefill.nominal.refTempC) : s.refTempC,
    }));
  }, [prefill]);

  // ============= MATERIAIS =============
  const { data: materials = [] } = useQuery({
    queryKey: ["coil-materials"],
    queryFn: () => listCoilMaterials(),
  });
  const tubeMaterials = useMemo(
    () => materials.filter((m) => m.category === "tube" || m.category === "both"),
    [materials],
  );
  const finMaterials = useMemo(
    () => materials.filter((m) => m.category === "fin" || m.category === "both"),
    [materials],
  );

  // Defaults inteligentes quando lista chega
  useEffect(() => {
    if (!geo.tubeMaterialId && tubeMaterials.length) {
      const cu = tubeMaterials.find((m) => /cobre/i.test(m.name)) ?? tubeMaterials[0];
      setGeo((s) => ({ ...s, tubeMaterialId: cu.id }));
    }
    if (!geo.finMaterialId && finMaterials.length) {
      const al = finMaterials.find((m) => /alum/i.test(m.name)) ?? finMaterials[0];
      setGeo((s) => ({ ...s, finMaterialId: al.id }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tubeMaterials.length, finMaterials.length]);

  const tubeMaterial = materials.find((m) => m.id === geo.tubeMaterialId);
  const finMaterial = materials.find((m) => m.id === geo.finMaterialId);

  // ============= EXEC =============
  const [result, setResult] = useState<CoilCalculationResult | null>(null);
  const [calcError, setCalcError] = useState<string | null>(null);

  const buildEngineInput = (): CoilCalculationInput => {
    const tubeOd = numOrZero(geo.tubeOdMm);
    const tubeWall = numOrZero(geo.tubeWallMm);
    const tubeId = Math.max(tubeOd - 2 * tubeWall, 0.1);
    const rows = numOrZero(geo.rows);
    const tubesPerRow = numOrZero(geo.tubesPerRow);
    const tubePitch = numOrZero(geo.tubePitchMm);
    const rowPitch = numOrZero(geo.rowPitchMm);
    const lengthMm = numOrZero(geo.coilLengthMm);

    return {
      mode: coilKind === "evaporator" ? "direct_expansion" : "condensation",
      geometry: {
        code: `manual-${coilKind}`,
        mode: coilKind === "evaporator" ? "direct_expansion" : "condensation",
        finType: "plain",
        tubeType: "smooth",
        tubeOuterDiameterMm: tubeOd,
        tubeInnerDiameterMm: tubeId,
        tubePitchMm: tubePitch,
        rowPitchMm: rowPitch,
        finPitchMm: numOrZero(geo.finPitchMm),
        finThicknessMm: numOrZero(geo.finThicknessMm),
        coilLengthMm: lengthMm,
        coilHeightMm: tubesPerRow * tubePitch,
        rows,
        tubesPerRow,
        circuits: numOrZero(geo.circuits) || 1,
        skippedTubes: numOrUndef(geo.skippedTubes),
        tubeMaterialConductivityWmK: tubeMaterial?.thermal_conductivity_w_mk
          ? Number(tubeMaterial.thermal_conductivity_w_mk)
          : 401,
        finMaterialConductivityWmK: finMaterial?.thermal_conductivity_w_mk
          ? Number(finMaterial.thermal_conductivity_w_mk)
          : 237,
      },
      airInletTempC: numOrZero(air.airTempInC),
      refTempC: numOrZero(ref.refTempC),
      airflowM3h: numOrZero(air.airflowM3h),
      relativeHumidityPct: numOrUndef(air.rhInPct),
      refrigerant: ref.refrigerant,
    };
  };

  const handleCalculate = () => {
    setCalcError(null);
    try {
      const input = buildEngineInput();
      const r = simulateHybridCoil(input);
      setResult(r);
      onSimulationComplete?.(toLegacyInput(input, label, coilKind, geo, air, ref, tubeMaterial?.name, finMaterial?.name), toLegacyResult(r, coilKind));
      const errs = r.warnings.filter((w) => /^ERRO/i.test(w));
      if (errs.length) toast.error(errs[0]);
      else toast.success(`Q = ${(r.capacityW / 1000).toFixed(2)} kW`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha no cálculo";
      setCalcError(msg);
      toast.error(msg);
    }
  };

  // ============= COMPARATIVO COM CATÁLOGO CN =============
  const [showCompare, setShowCompare] = useState(false);
  const [manualModelId, setManualModelId] = useState<string>("");

  const { data: cnAutoPoint } = useQuery({
    queryKey: ["cn-auto-point", equipmentCode, equipmentCommercialName],
    queryFn: () =>
      findCnCatalogPointByCode({
        data: {
          code: equipmentCode ?? undefined,
          commercialName: equipmentCommercialName ?? undefined,
        },
      }),
    enabled: showCompare && (!!equipmentCode || !!equipmentCommercialName),
  });

  const { data: cnModels = [] } = useQuery({
    queryKey: ["cn-models-lite"],
    queryFn: () => listCnCatalogModelsLite(),
    enabled: showCompare,
  });

  const { data: cnManualPoint } = useQuery({
    queryKey: ["cn-manual-point", manualModelId],
    queryFn: () => getCnCatalogPointByModelId({ data: { modelId: manualModelId } }),
    enabled: !!manualModelId,
  });

  const cnPoint: CnCatalogPoint | null = cnManualPoint ?? cnAutoPoint ?? null;

  const errorPct = useMemo(() => {
    if (!result || !cnPoint?.capacityW) return null;
    return ((result.capacityW - cnPoint.capacityW) / cnPoint.capacityW) * 100;
  }, [result, cnPoint]);

  // Reaplica defaults razoáveis quando o tipo muda
  const handleCoilKindChange = (k: CoilKind) => {
    setCoilKind(k);
    onCoilKindChange?.(k);
    setAir((s) => ({ ...s, airTempInC: k === "evaporator" ? "0" : "35" }));
    setRef((s) => ({ ...s, refTempC: k === "evaporator" ? "-10" : "48" }));
    setResult(null);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Label className="text-sm">Tipo:</Label>
          <Select value={coilKind} onValueChange={(v) => handleCoilKindChange(v as CoilKind)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="evaporator">Evaporador</SelectItem>
              <SelectItem value="condenser">Condensador</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant="outline" className="ml-2">engine: hybrid_unilab</Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowCompare((s) => !s)}>
            <GitCompare className="mr-2 h-4 w-4" />
            Comparar com catálogo
          </Button>
          <Button onClick={handleCalculate}>
            <Calculator className="mr-2 h-4 w-4" />
            Calcular
          </Button>
        </div>
      </div>

      {/* 3 blocos lado a lado */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* GEOMETRIA */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Geometria do aletado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field label="Tubos por fila" value={geo.tubesPerRow} onChange={(v) => setGeo({ ...geo, tubesPerRow: v })} />
            <Field label="Número de filas" value={geo.rows} onChange={(v) => setGeo({ ...geo, rows: v })} />
            <Field label="Comprimento do aletado (mm)" value={geo.coilLengthMm} onChange={(v) => setGeo({ ...geo, coilLengthMm: v })} />
            <Field label="Número de circuitos" value={geo.circuits} onChange={(v) => setGeo({ ...geo, circuits: v })} />
            <Field label="Passo da aleta (mm)" value={geo.finPitchMm} onChange={(v) => setGeo({ ...geo, finPitchMm: v })} />
            <Field label="Tubos não utilizados" value={geo.skippedTubes} onChange={(v) => setGeo({ ...geo, skippedTubes: v })} />
            <Field label="Diâmetro externo do tubo (mm)" value={geo.tubeOdMm} onChange={(v) => setGeo({ ...geo, tubeOdMm: v })} />
            <Field label="Espessura do tubo (mm)" value={geo.tubeWallMm} onChange={(v) => setGeo({ ...geo, tubeWallMm: v })} />
            <div>
              <Label className="text-xs">Material do tubo</Label>
              <Select value={geo.tubeMaterialId} onValueChange={(v) => setGeo({ ...geo, tubeMaterialId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  {tubeMaterials.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name} ({m.thermal_conductivity_w_mk} W/m·K)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Material da aleta</Label>
              <Select value={geo.finMaterialId} onValueChange={(v) => setGeo({ ...geo, finMaterialId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  {finMaterials.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name} ({m.thermal_conductivity_w_mk} W/m·K)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">Geometria avançada</summary>
              <div className="mt-2 space-y-2">
                <Field label="Passo entre tubos (mm)" value={geo.tubePitchMm} onChange={(v) => setGeo({ ...geo, tubePitchMm: v })} />
                <Field label="Passo entre filas (mm)" value={geo.rowPitchMm} onChange={(v) => setGeo({ ...geo, rowPitchMm: v })} />
                <Field label="Espessura da aleta (mm)" value={geo.finThicknessMm} onChange={(v) => setGeo({ ...geo, finThicknessMm: v })} />
              </div>
            </details>
          </CardContent>
        </Card>

        {/* LADO AR */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lado Ar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field label="Vazão de ar (m³/h)" value={air.airflowM3h} onChange={(v) => setAir({ ...air, airflowM3h: v })} />
            <Field label="Temperatura entrada (°C)" value={air.airTempInC} onChange={(v) => setAir({ ...air, airTempInC: v })} />
            <Field label="Umidade relativa (%)" value={air.rhInPct} onChange={(v) => setAir({ ...air, rhInPct: v })} />
            <div className="mt-4 rounded-md border bg-muted/30 p-3">
              <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">Resultados</div>
              <Result label="Temperatura saída" value={fmt(result?.debug?.airOutletTempC as number | undefined, 2, "°C")} />
              <Result label="Umidade saída" value={fmt(result?.debug?.airOutletRhPct as number | undefined, 1, "%")} />
              <Result label="ΔP ar" value={fmt(result?.airPressureDropPa, 1, "Pa")} />
              <Result
                label="Velocidade frontal"
                value={fmt(result?.debug?.frontalVelocityMs as number | undefined, 2, "m/s")}
              />
              <Result label="Área frontal" value={fmt(result?.frontalAreaM2, 3, "m²")} />
            </div>
          </CardContent>
        </Card>

        {/* LADO FLUIDO */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lado Fluido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">Fluido</Label>
              <Select value={ref.refrigerant} onValueChange={(v) => setRef({ ...ref, refrigerant: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REFRIGERANTS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Field
              label={coilKind === "evaporator" ? "Temperatura evaporação (°C)" : "Temperatura condensação (°C)"}
              value={ref.refTempC}
              onChange={(v) => setRef({ ...ref, refTempC: v })}
            />
            <Field label="Superaquecimento (K)" value={ref.superheatK} onChange={(v) => setRef({ ...ref, superheatK: v })} />
            <Field label="Subresfriamento (K)" value={ref.subcoolingK} onChange={(v) => setRef({ ...ref, subcoolingK: v })} />
            <div className="mt-4 rounded-md border bg-muted/30 p-3">
              <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">Resultados</div>
              <Result
                label="Vazão mássica refrigerante"
                value={fmt(result?.debug?.refrigerantMassFlowKgH as number | undefined, 1, "kg/h")}
              />
              <Result label="ΔP refrigerante" value={fmt(result?.refrigerantPressureDropKpa, 2, "kPa")} />
              <Result
                label="Velocidade fluido"
                value={fmt(result?.debug?.refrigerantVelocityMs as number | undefined, 2, "m/s")}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* RESULTADOS GLOBAIS */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resultado da simulação</CardTitle>
        </CardHeader>
        <CardContent>
          {!result ? (
            <p className="text-sm text-muted-foreground">
              Preencha os 3 blocos e clique em <strong>Calcular</strong> para rodar o motor <code>thermalcalc</code>.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Stat label="Capacidade" value={`${(result.capacityW / 1000).toFixed(2)} kW`} sub={`${result.capacityKcalh.toFixed(0)} kcal/h`} />
              <Stat label="U" value={fmt(result.uWm2K, 1, "W/m²·K")} />
              <Stat label="h ar" value={fmt(result.hAirWm2K, 1, "W/m²·K")} />
              <Stat label="h refrigerante" value={fmt(result.hRefWm2K, 1, "W/m²·K")} />
              <Stat label="ΔP ar" value={fmt(result.airPressureDropPa, 1, "Pa")} />
              <Stat label="ΔP refrigerante" value={fmt(result.refrigerantPressureDropKpa, 2, "kPa")} />
              <Stat label="Volume interno" value={fmt(result.geometryResult?.internalVolumeL, 2, "L")} />
              <Stat label="Área de troca" value={fmt(result.effectiveAreaM2, 2, "m²")} />
            </div>
          )}
          {result?.warnings && result.warnings.length > 0 && (
            <Alert className="mt-4">
              <Info className="h-4 w-4" />
              <AlertTitle>Avisos do motor</AlertTitle>
              <AlertDescription>
                <ul className="ml-4 list-disc text-sm">
                  {result.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
          {calcError && (
            <Alert variant="destructive" className="mt-4">
              <AlertTitle>Falha no cálculo</AlertTitle>
              <AlertDescription>{calcError}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* COMPARATIVO COM CATÁLOGO */}
      {showCompare && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Comparativo com catálogo CN</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Label>Modelo CN:</Label>
              <Select value={manualModelId} onValueChange={setManualModelId}>
                <SelectTrigger className="w-72">
                  <SelectValue placeholder={cnAutoPoint ? `Auto: ${cnAutoPoint.modelo}` : "Selecione um modelo…"} />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  {cnModels.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.modelo} {m.refrigerante ? `· ${m.refrigerante}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {cnPoint && (
                <Badge variant="secondary">
                  {cnManualPoint ? "manual" : "auto-match"}: {cnPoint.modelo}
                </Badge>
              )}
            </div>
            {!cnPoint && (
              <p className="text-sm text-muted-foreground">
                Nenhum ponto encontrado. Selecione um modelo manualmente acima.
              </p>
            )}
            {cnPoint && (
              <div className="overflow-hidden rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase">
                    <tr>
                      <th className="p-2 text-left">Métrica</th>
                      <th className="p-2 text-right">Catálogo CN</th>
                      <th className="p-2 text-right">Calculado</th>
                      <th className="p-2 text-right">Erro</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t">
                      <td className="p-2">Capacidade</td>
                      <td className="p-2 text-right">{fmt(cnPoint.capacityW != null ? cnPoint.capacityW / 1000 : null, 2, "kW")}</td>
                      <td className="p-2 text-right">{result ? fmt(result.capacityW / 1000, 2, "kW") : "—"}</td>
                      <td className="p-2 text-right">
                        {errorPct == null ? "—" : (
                          <Badge variant={Math.abs(errorPct) > 10 ? "destructive" : "secondary"}>
                            {errorPct > 0 ? "+" : ""}{errorPct.toFixed(1)}%
                          </Badge>
                        )}
                      </td>
                    </tr>
                    <tr className="border-t">
                      <td className="p-2">Capacidade (kcal/h)</td>
                      <td className="p-2 text-right">{fmt(cnPoint.capacityKcalh, 0)}</td>
                      <td className="p-2 text-right">{result ? fmt(result.capacityKcalh, 0) : "—"}</td>
                      <td className="p-2 text-right">—</td>
                    </tr>
                    <tr className="border-t">
                      <td className="p-2">T. evaporação (°C)</td>
                      <td className="p-2 text-right">{fmt(cnPoint.tempEvapC, 1)}</td>
                      <td className="p-2 text-right">{coilKind === "evaporator" ? fmt(numOrUndef(ref.refTempC), 1) : "—"}</td>
                      <td className="p-2 text-right">—</td>
                    </tr>
                    <tr className="border-t">
                      <td className="p-2">T. condensação (°C)</td>
                      <td className="p-2 text-right">{fmt(cnPoint.tempCondC, 1)}</td>
                      <td className="p-2 text-right">{coilKind === "condenser" ? fmt(numOrUndef(ref.refTempC), 1) : "—"}</td>
                      <td className="p-2 text-right">—</td>
                    </tr>
                    <tr className="border-t">
                      <td className="p-2">Vazão de ar (m³/h)</td>
                      <td className="p-2 text-right">{fmt(cnPoint.airflowM3h, 0)}</td>
                      <td className="p-2 text-right">{fmt(numOrUndef(air.airflowM3h), 0)}</td>
                      <td className="p-2 text-right">—</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} inputMode="decimal" />
    </div>
  );
}

function toLegacyInput(
  input: CoilCalculationInput,
  label: string | undefined,
  coilType: CoilKind,
  geo: UnilabGeometryState,
  air: { airflowM3h: string; airTempInC: string; rhInPct: string },
  ref: { refrigerant: string; refTempC: string; superheatK: string; subcoolingK: string },
  tubeMaterial?: string,
  finMaterial?: string,
): CoilSimulatorInput {
  return {
    mode: "verify",
    coilType,
    label: label || undefined,
    geometry: {
      finType: "integral",
      tubeArrangement: "staggered",
      tubeSpacingMm: input.geometry.tubePitchMm,
      rowSpacingMm: input.geometry.rowPitchMm,
      tubeOdMm: input.geometry.tubeOuterDiameterMm,
      tubeIdMm: input.geometry.tubeInnerDiameterMm,
      tubeWallMm: numOrUndef(geo.tubeWallMm),
      finThicknessMm: input.geometry.finThicknessMm,
      tubesPerRow: input.geometry.tubesPerRow,
      rows: input.geometry.rows,
      circuits: input.geometry.circuits,
      coilLengthMm: input.geometry.coilLengthMm,
      finPitchMm: input.geometry.finPitchMm,
      skippedTubes: input.geometry.skippedTubes,
      tubeMaterial,
      finMaterial,
    },
    air: {
      airflowM3h: numOrUndef(air.airflowM3h),
      airTempInC: numOrUndef(air.airTempInC),
      rhInPct: numOrUndef(air.rhInPct),
    },
    refrigerant: {
      refrigerant: ref.refrigerant,
      refTempC: numOrUndef(ref.refTempC),
      superheatK: numOrUndef(ref.superheatK),
      subcoolingK: numOrUndef(ref.subcoolingK),
    },
  };
}

function toLegacyResult(r: CoilCalculationResult, coilType: CoilKind): CoilSimulatorResult {
  return {
    coilType,
    capacityW: r.capacityW,
    capacityKcalh: r.capacityKcalh,
    sensibleW: null,
    latentW: null,
    dtRealK: r.dtmlK,
    dtNominalK: r.dtmlK,
    faceAreaM2: r.frontalAreaM2,
    faceVelocityMs: typeof r.debug?.frontalVelocityMs === "number" ? r.debug.frontalVelocityMs : null,
    airflowFactor: 1,
    dtFactor: 1,
    airPressureDropPa: r.airPressureDropPa,
    refPressureDropKpa: r.refrigerantPressureDropKpa,
    condensateLh: null,
    warnings: r.warnings,
  };
}

function Result({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
