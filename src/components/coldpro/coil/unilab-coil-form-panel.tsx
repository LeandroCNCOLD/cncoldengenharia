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
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calculator, Database, GitCompare, Info, Loader2 } from "lucide-react";
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
  listCnCatalogPointsByModelo,
  getCnCatalogPointByModelId,
  findCnCatalogPointByCode,
  type CnCatalogPoint,
  type CnCatalogGeometry,
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

  // ============= ESTADO DE PRÉ-PREENCHIMENTO PELO CATÁLOGO CN =============
  // Track se vieram do catálogo (badge azul) e se o usuário editou alguma coisa.
  const [filledFromCatalog, setFilledFromCatalog] = useState(false);
  const [manuallyEdited, setManuallyEdited] = useState(false);
  const [catalogModelo, setCatalogModelo] = useState<string | null>(null);
  const [selectedCurveId, setSelectedCurveId] = useState<string | null>(null);
  const [referenceCapacityW, setReferenceCapacityW] = useState<number | null>(null);
  const [referenceCurveIdx, setReferenceCurveIdx] = useState<number | null>(null);
  // ref para diferenciar mudanças "programáticas" (carregamento) de mudanças do usuário
  const isApplyingFromCatalog = useRef(false);

  // Wrappers que marcam "editado manualmente" sem perder a tipagem.
  const editGeo = (patch: Partial<typeof geo>) => {
    if (!isApplyingFromCatalog.current && filledFromCatalog) setManuallyEdited(true);
    setGeo((s) => ({ ...s, ...patch }));
  };
  const editAir = (patch: Partial<typeof air>) => {
    if (!isApplyingFromCatalog.current && filledFromCatalog) setManuallyEdited(true);
    setAir((s) => ({ ...s, ...patch }));
  };
  const editRef = (patch: Partial<typeof ref>) => {
    if (!isApplyingFromCatalog.current && filledFromCatalog) setManuallyEdited(true);
    setRef((s) => ({ ...s, ...patch }));
  };

  // Aplica um ponto do catálogo no formulário (geometria + ar + fluido).
  const applyCatalogPoint = (point: CnCatalogPoint, kind: CoilKind) => {
    isApplyingFromCatalog.current = true;
    try {
      const g: CnCatalogGeometry =
        kind === "evaporator" ? point.evaporatorGeometry : point.condenserGeometry;
      const tEvap = point.tempEvapC;
      const tCond = point.tempCondC;

      setGeo((s) => ({
        ...s,
        rows: g.rows != null ? String(g.rows) : s.rows,
        tubesPerRow: g.tubesPerRow != null ? String(g.tubesPerRow) : s.tubesPerRow,
        circuits: g.circuits != null ? String(g.circuits) : s.circuits,
        coilLengthMm: g.coilLengthMm != null ? String(g.coilLengthMm) : s.coilLengthMm,
        finPitchMm: g.finPitchMm != null ? String(g.finPitchMm) : s.finPitchMm,
        tubeOdMm: g.tubeOdMm != null ? String(g.tubeOdMm) : s.tubeOdMm,
        tubeWallMm: g.tubeWallMm != null ? String(g.tubeWallMm) : s.tubeWallMm,
        tubePitchMm: g.tubePitchMm != null ? String(g.tubePitchMm) : s.tubePitchMm,
        rowPitchMm: g.rowPitchMm != null ? String(g.rowPitchMm) : s.rowPitchMm,
        finThicknessMm: g.finThicknessMm != null ? String(g.finThicknessMm) : s.finThicknessMm,
        skippedTubes: g.skippedTubes != null ? String(g.skippedTubes) : s.skippedTubes,
      }));
      setAir((s) => ({
        ...s,
        airflowM3h: g.airflowM3h != null ? String(g.airflowM3h) : s.airflowM3h,
        airTempInC:
          kind === "evaporator"
            ? tEvap != null
              ? String(tEvap)
              : s.airTempInC
            : s.airTempInC,
        rhInPct: point.rhInPct != null ? String(point.rhInPct) : s.rhInPct,
      }));
      setRef((s) => ({
        ...s,
        refrigerant: point.refrigerante ?? s.refrigerant,
        refTempC:
          kind === "evaporator"
            ? tEvap != null
              ? String(tEvap)
              : s.refTempC
            : tCond != null
              ? String(tCond)
              : s.refTempC,
        superheatK: point.superheatK != null ? String(point.superheatK) : s.superheatK,
        subcoolingK: point.subcoolingK != null ? String(point.subcoolingK) : s.subcoolingK,
      }));
      setCatalogModelo(point.modelo);
      setSelectedCurveId(point.id);
      setReferenceCapacityW(point.capacityW);
      setReferenceCurveIdx(point.curvaIndice);
      setFilledFromCatalog(true);
      setManuallyEdited(false);
    } finally {
      // libera no próximo tick para garantir que os setters acima já rodaram.
      setTimeout(() => {
        isApplyingFromCatalog.current = false;
      }, 0);
    }
  };

  // Compatibilidade com o prefill antigo (do "Carregar e abrir" de outras telas).
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

  // Auto-load do catálogo CN ao abrir, usando code → commercial_name.
  const { data: cnAutoPointEager, isFetching: cnAutoFetching } = useQuery({
    queryKey: ["cn-auto-point-eager", equipmentCode, equipmentCommercialName],
    queryFn: () =>
      findCnCatalogPointByCode({
        data: {
          code: equipmentCode ?? undefined,
          commercialName: equipmentCommercialName ?? undefined,
        },
      }),
    enabled: !!equipmentCode || !!equipmentCommercialName,
    staleTime: 60_000,
  });

  // Aplica auto-load quando o ponto chegar (apenas uma vez por modelo).
  const autoAppliedKey = useRef<string | null>(null);
  useEffect(() => {
    if (!cnAutoPointEager) return;
    const key = `${cnAutoPointEager.id}:${coilKind}`;
    if (autoAppliedKey.current === key) return;
    autoAppliedKey.current = key;
    applyCatalogPoint(cnAutoPointEager, coilKind);
    toast.success(`Pré-preenchido: ${cnAutoPointEager.modelo} (ponto #${cnAutoPointEager.curvaIndice ?? "—"})`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cnAutoPointEager, coilKind]);

  // Lista de pontos da curva do modelo carregado (para o seletor "Ponto da curva CN").
  const { data: cnPoints = [] } = useQuery({
    queryKey: ["cn-points-by-modelo", catalogModelo],
    queryFn: () => listCnCatalogPointsByModelo({ data: { modelo: catalogModelo! } }),
    enabled: !!catalogModelo,
  });

  // Troca de ponto na mesma curva: re-busca o ponto inteiro e re-aplica (preserva geometria).
  const handleSelectCurvePoint = async (curveId: string) => {
    const point = await getCnCatalogPointByModelId({ data: { modelId: curveId } });
    if (!point) {
      toast.error("Ponto não encontrado");
      return;
    }
    if (manuallyEdited) {
      const ok = window.confirm("Há campos editados manualmente. Deseja sobrescrevê-los com este ponto?");
      if (!ok) return;
    }
    applyCatalogPoint(point, coilKind);
    toast.success(`Ponto #${point.curvaIndice ?? "—"} carregado`);
  };

  // Botão "Carregar dados do catálogo" (manual)
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const handleLoadFromCatalog = async () => {
    if (manuallyEdited) {
      const ok = window.confirm("Há campos editados manualmente. Deseja sobrescrevê-los com os dados do catálogo CN?");
      if (!ok) return;
    }
    setLoadingCatalog(true);
    try {
      const point = await findCnCatalogPointByCode({
        data: {
          code: equipmentCode ?? undefined,
          commercialName: equipmentCommercialName ?? undefined,
        },
      });
      if (!point) {
        toast.error("Modelo não encontrado no catálogo CN");
        return;
      }
      applyCatalogPoint(point, coilKind);
      toast.success("Dados do catálogo carregados");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao carregar do catálogo");
    } finally {
      setLoadingCatalog(false);
    }
  };

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

  // ============= COMPARATIVO COM CATÁLOGO CN (modo manual: outro modelo) =============
  const [showCompare, setShowCompare] = useState(false);
  const [manualModelId, setManualModelId] = useState<string>("");

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

  // Ponto efetivo para comparação: manual (se selecionado) > auto-load
  const cnPoint: CnCatalogPoint | null = cnManualPoint ?? cnAutoPointEager ?? null;

  const errorPct = useMemo(() => {
    if (!result) return null;
    const refW = referenceCapacityW ?? cnPoint?.capacityW ?? null;
    if (!refW) return null;
    return ((result.capacityW - refW) / refW) * 100;
  }, [result, cnPoint, referenceCapacityW]);

  // Reaplica defaults razoáveis quando o tipo muda; se já há modelo CN carregado,
  // reaproveita a geometria do outro lado (evap ↔ cond) sem precisar recarregar.
  const handleCoilKindChange = (k: CoilKind) => {
    setCoilKind(k);
    onCoilKindChange?.(k);
    setAir((s) => ({ ...s, airTempInC: k === "evaporator" ? "0" : "35" }));
    setRef((s) => ({ ...s, refTempC: k === "evaporator" ? "-10" : "48" }));
    setResult(null);
    if (cnAutoPointEager) {
      autoAppliedKey.current = null; // força reapply pro novo lado
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
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
          <Badge variant="outline">engine: hybrid_unilab</Badge>
          {filledFromCatalog && (
            <Badge className="bg-blue-600 hover:bg-blue-600">
              Pré-preenchido pelo Catálogo CN
              {catalogModelo ? ` · ${catalogModelo}` : ""}
              {referenceCurveIdx != null ? ` · ponto #${referenceCurveIdx}` : ""}
            </Badge>
          )}
          {filledFromCatalog && manuallyEdited && (
            <Badge variant="destructive">Editado manualmente</Badge>
          )}
          {cnAutoFetching && !filledFromCatalog && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Buscando no catálogo CN…
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleLoadFromCatalog} disabled={loadingCatalog}>
            {loadingCatalog ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Database className="mr-2 h-4 w-4" />
            )}
            Carregar dados do catálogo
          </Button>
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

      {/* Seletor de ponto da curva CN, quando há modelo carregado */}
      {filledFromCatalog && cnPoints.length > 1 && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 py-3 text-sm">
            <Label className="text-sm">Ponto da curva CN:</Label>
            <Select value={selectedCurveId ?? ""} onValueChange={handleSelectCurvePoint}>
              <SelectTrigger className="w-[420px]">
                <SelectValue placeholder="Selecione um ponto…" />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                {cnPoints.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    #{p.curvaIndice ?? "—"} · Tev {fmt(p.tempEvapC, 1, "°C")} · Tcond{" "}
                    {fmt(p.tempCondC, 1, "°C")} · {fmt(p.capacityKcalh, 0, "kcal/h")} ·{" "}
                    {p.refrigerante ?? "—"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">
              {cnPoints.length} pontos disponíveis
            </span>
          </CardContent>
        </Card>
      )}

      {/* 3 blocos lado a lado */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* GEOMETRIA */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Geometria do aletado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field label="Tubos por fila" value={geo.tubesPerRow} onChange={(v) => editGeo({ tubesPerRow: v })} />
            <Field label="Número de filas" value={geo.rows} onChange={(v) => editGeo({ rows: v })} />
            <Field label="Comprimento do aletado (mm)" value={geo.coilLengthMm} onChange={(v) => editGeo({ coilLengthMm: v })} />
            <Field label="Número de circuitos" value={geo.circuits} onChange={(v) => editGeo({ circuits: v })} />
            <Field label="Passo da aleta (mm)" value={geo.finPitchMm} onChange={(v) => editGeo({ finPitchMm: v })} />
            <Field label="Tubos não utilizados" value={geo.skippedTubes} onChange={(v) => editGeo({ skippedTubes: v })} />
            <Field label="Diâmetro externo do tubo (mm)" value={geo.tubeOdMm} onChange={(v) => editGeo({ tubeOdMm: v })} />
            <Field label="Espessura do tubo (mm)" value={geo.tubeWallMm} onChange={(v) => editGeo({ tubeWallMm: v })} />
            <div>
              <Label className="text-xs">Material do tubo</Label>
              <Select value={geo.tubeMaterialId} onValueChange={(v) => editGeo({ tubeMaterialId: v })}>
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
              <Select value={geo.finMaterialId} onValueChange={(v) => editGeo({ finMaterialId: v })}>
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
                <Field label="Passo entre tubos (mm)" value={geo.tubePitchMm} onChange={(v) => editGeo({ tubePitchMm: v })} />
                <Field label="Passo entre filas (mm)" value={geo.rowPitchMm} onChange={(v) => editGeo({ rowPitchMm: v })} />
                <Field label="Espessura da aleta (mm)" value={geo.finThicknessMm} onChange={(v) => editGeo({ finThicknessMm: v })} />
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
            <Field label="Vazão de ar (m³/h)" value={air.airflowM3h} onChange={(v) => editAir({ airflowM3h: v })} />
            <Field label="Temperatura entrada (°C)" value={air.airTempInC} onChange={(v) => editAir({ airTempInC: v })} />
            <Field label="Umidade relativa (%)" value={air.rhInPct} onChange={(v) => editAir({ rhInPct: v })} />
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
              <Select value={ref.refrigerant} onValueChange={(v) => editRef({ refrigerant: v })}>
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
              onChange={(v) => editRef({ refTempC: v })}
            />
            <Field label="Superaquecimento (K)" value={ref.superheatK} onChange={(v) => editRef({ superheatK: v })} />
            <Field label="Subresfriamento (K)" value={ref.subcoolingK} onChange={(v) => editRef({ subcoolingK: v })} />
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
                  <SelectValue placeholder={cnAutoPointEager ? `Auto: ${cnAutoPointEager.modelo}` : "Selecione um modelo…"} />
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
