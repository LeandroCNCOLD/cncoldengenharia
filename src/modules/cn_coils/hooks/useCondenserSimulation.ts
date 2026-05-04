import { useCallback, useEffect, useMemo, useState } from "react";
import {
  runSimulationV2,
  SimulationV2Error,
  type SimulationV2Result,
} from "../engine_v2/simulatorCoreV2";
import { getRefrigerantLiquidProps } from "../engine_v2/refrigerantProps";
import type {
  CnCoilsPhysicalInputs,
  CnCoilsThermoInputs,
  CoilGeometryCatalogItem,
  TubeMaterialItem,
} from "../types/cncoils.types";

export interface CondenserInputs {
  Tc: number;
  Tair_in: number;
  geometryId: string;
  refrigerant: string;
  subcooling: number;
  fanCount: number;
  fanId: string;
  airFlowM3H?: number;
  rows?: number;
  circuits?: number;
  finnedHeightMm?: number;
  finnedLengthMm?: number;
  tubeMaterialId?: string;
  finPitchMm?: number;
  finThicknessMm?: number;
  fluidMassFlowKgH?: number;
}

export interface CondenserResult {
  Q_cond_W: number;
  Q_cond_kcalh: number;
  UA: number;
  LMTD: number;
  Tair_out: number;
  deltaP_Pa: number;
  airflow_m3h: number;
  regime: "superheated" | "two-phase" | "subcooled";
  raw: SimulationV2Result;
}

interface UseCondenserSimulationOptions {
  inputs: CondenserInputs;
  geometries: CoilGeometryCatalogItem[];
  tubeMaterials: TubeMaterialItem[];
}

const DEFAULT_AIRFLOW_M3H = 8000;
const DEFAULT_FLUID_MASS_KGH = 1200;

function toFluidId(refrigerant: string): string {
  return refrigerant.startsWith("REF_") ? refrigerant : `REF_${refrigerant}`;
}

function formatErrors(err: unknown): string {
  if (err instanceof SimulationV2Error) return err.errors.join(" • ");
  return err instanceof Error ? err.message : String(err);
}

function calculateLmtd(hotInC: number, hotOutC: number, coldInC: number): number {
  const dT1 = Math.max(0.1, hotInC - coldInC);
  const dT2 = Math.max(0.1, hotOutC - coldInC);
  if (Math.abs(dT1 - dT2) < 1e-6) return dT1;
  return (dT1 - dT2) / Math.log(dT1 / dT2);
}

export function calculateCondenserResult(
  inputs: CondenserInputs,
  geometries: CoilGeometryCatalogItem[],
  tubeMaterials: TubeMaterialItem[],
): CondenserResult {
  const geometry = geometries.find((item) => item.id === inputs.geometryId) ?? geometries[0];
  const tubeMaterial =
    tubeMaterials.find((item) => item.id === inputs.tubeMaterialId) ?? tubeMaterials[0];
  if (!geometry) throw new SimulationV2Error("Geometria não selecionada.", ["Geometria não selecionada."]);
  if (!tubeMaterial) throw new SimulationV2Error("Material do tubo ausente.", ["Material do tubo ausente."]);

  const physical: CnCoilsPhysicalInputs = {
    componentType: "condenser_air",
    geometryId: geometry.id,
    finnedHeightMm: inputs.finnedHeightMm ?? 600,
    finnedLengthMm: inputs.finnedLengthMm ?? 1200,
    tubesPerRow:
      geometry.tubePitchTransverseMm > 0
        ? Math.max(1, Math.round((inputs.finnedHeightMm ?? 600) / geometry.tubePitchTransverseMm))
        : 16,
    rows: inputs.rows ?? geometry.defaultRows ?? 4,
    circuits: inputs.circuits ?? geometry.defaultCircuits ?? 4,
    tubeMaterialId: tubeMaterial.id,
    finPitchMm: inputs.finPitchMm ?? 2.5,
    finThicknessMm: inputs.finThicknessMm ?? 0.12,
    tubePitchTransverseMm: geometry.tubePitchTransverseMm,
    tubePitchLongitudinalMm: geometry.tubePitchLongitudinalMm,
    tubeOuterDiameterMm: geometry.tubeOuterDiameterMm,
    tubeInnerDiameterMm: geometry.tubeInnerDiameterMm ?? Math.max(1, geometry.tubeOuterDiameterMm - 0.6),
  };
  const thermo: CnCoilsThermoInputs = {
    refrigerantId: toFluidId(inputs.refrigerant),
    airFlowM3H: inputs.airFlowM3H ?? DEFAULT_AIRFLOW_M3H,
    airInletTempC: inputs.Tair_in,
    airInletRhPercent: 50,
    altitudeM: 0,
    condensingTempC: inputs.Tc,
    subcoolingK: inputs.subcooling,
  };
  const fluidData = getRefrigerantLiquidProps(thermo.refrigerantId, inputs.Tc);
  const geoRaw = geometry.raw as Record<string, unknown> | undefined;
  const finCorr = Number(geoRaw?.FatCorAl ?? geoRaw?.fin_correction_factor);
  const raw = runSimulationV2({
    physical,
    thermo,
    componentType: "condenser_air",
    tubeMaterialConductivity: tubeMaterial.conductivityWmK,
    fluidProps: {
      rho_kg_m3: fluidData.rho_kg_m3,
      mu_Pa_s: fluidData.mu_Pa_s,
      cp_J_kgK: fluidData.cp_J_kgK,
      k_W_mK: fluidData.k_W_mK,
    },
    fluidMassFlowKgS: (inputs.fluidMassFlowKgH ?? DEFAULT_FLUID_MASS_KGH) / 3600,
    subcoolingK: inputs.subcooling,
    finCorrectionFactor: Number.isFinite(finCorr) && finCorr > 0 ? finCorr : 1,
    h_fg_kJkg: fluidData.h_fg_kJkg,
  });
  const qCondW = raw.totalCapacityKw * 1000;
  const lmtd = raw.lmtdK ?? calculateLmtd(inputs.Tc, inputs.Tc - inputs.subcooling, inputs.Tair_in);
  const ua = lmtd > 0 ? qCondW / lmtd : 0;
  return {
    Q_cond_W: qCondW,
    Q_cond_kcalh: qCondW * 0.86,
    UA: ua,
    LMTD: lmtd,
    Tair_out: raw.airOutletTempC,
    deltaP_Pa: raw.airPressureDropPa,
    airflow_m3h: thermo.airFlowM3H,
    regime: inputs.subcooling > 0 ? "subcooled" : "two-phase",
    raw,
  };
}

export const calculateCondenserSnapshot = calculateCondenserResult;

export function useCondenserSimulation({
  inputs,
  geometries,
  tubeMaterials,
}: UseCondenserSimulationOptions) {
  const [result, setResult] = useState<CondenserResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canCalculate = geometries.length > 0 && tubeMaterials.length > 0;

  const calculate = useCallback(() => {
    if (!canCalculate) {
      setError("Catálogos ainda não carregados.");
      setResult(null);
      return null;
    }
    setIsCalculating(true);
    setError(null);
    try {
      const next = calculateCondenserResult(inputs, geometries, tubeMaterials);
      setResult(next);
      return next;
    } catch (err) {
      setResult(null);
      setError(formatErrors(err));
      return null;
    } finally {
      setIsCalculating(false);
    }
  }, [canCalculate, geometries, inputs, tubeMaterials]);

  const calculateSnapshotForInputs = useCallback(
    (nextInputs: CondenserInputs) => {
      if (!canCalculate) return null;
      try {
        return calculateCondenserResult(nextInputs, geometries, tubeMaterials);
      } catch {
        return null;
      }
    },
    [canCalculate, geometries, tubeMaterials],
  );

  useEffect(() => {
    calculate();
  }, [calculate]);

  return useMemo(
    () => ({
      result,
      isCalculating,
      error,
      calculate,
      calculateSnapshot: calculateSnapshotForInputs,
    }),
    [calculate, calculateSnapshotForInputs, error, isCalculating, result],
  );
}
