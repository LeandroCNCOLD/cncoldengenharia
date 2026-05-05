/**
 * Hook compartilhado: monta a lista de FanPickerItem a partir da
 * biblioteca rica de ventiladores EBM-Papst (/data/equipment/fans.json).
 *
 * Decodifica o modelo (ex.: A3G300A…) em série, tipo de motor e diâmetro,
 * estima a vazão livre via SPH(Q)=0 e expõe a potência absorvida @ Q=0.
 *
 * Substitui o conjunto antigo (Unilab axial+centrífugo) que não tinha
 * fabricante, série nem motor.
 */
import { useMemo } from "react";
import {
  useFanLibrary,
  type LibraryFan,
} from "@/modules/coldpro/hooks/useEquipmentLibrary";
import type { FanPickerItem } from "../components/FanPickerModal";

const MODEL_REGEX = /^([A-Z])(\d)([A-Z])(\d{3,4})/;

const MOTOR_TYPE_LABEL: Record<string, string> = {
  D: "DC",
  E: "AC capacitor",
  G: "EC (electronic)",
  H: "EC HyBlade",
  M: "AC",
  N: "EC backward",
  S: "EC RadiPac",
};

function estimateMaxAirflow(sphCoeffs: number[]): number {
  const sph = (q: number) => sphCoeffs.reduce((acc, c, i) => acc + c * q ** i, 0);
  let lo = 0;
  let hi = 30000;
  if (sph(lo) <= 0) return 0;
  if (sph(hi) > 0) return hi;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (sph(mid) > 0) lo = mid;
    else hi = mid;
  }
  return Math.round((lo + hi) / 2);
}

function powerAt(coeffs: number[], q: number): number {
  return coeffs.reduce((acc, c, i) => acc + c * q ** i, 0);
}

function toPickerItem(f: LibraryFan): FanPickerItem {
  const m = MODEL_REGEX.exec(f.model);
  const series = m?.[1] ?? undefined;
  const motorCode = m?.[3] ?? undefined;
  const sizeMm = m?.[4] ? Number(m[4]) : undefined;
  const motorLabel = motorCode ? MOTOR_TYPE_LABEL[motorCode] ?? motorCode : undefined;

  const freeFlow = estimateMaxAirflow(f.sph_coefficients);
  // ponto típico: ~50% da vazão livre
  const opQ = freeFlow > 0 ? freeFlow * 0.5 : 0;
  const power = opQ > 0 ? Math.max(0, powerAt(f.power_coefficients, opQ)) : undefined;

  // Família: motores "N" (backward) e "S" (RadiPac) são tipicamente centrífugos.
  const isCentrifugal = motorCode === "N" || motorCode === "S";

  return {
    id: f.id,
    manufacturer: f.manufacturer,
    model: f.model,
    series,
    seriesDescription: motorLabel ? `Motor ${motorLabel}` : undefined,
    fanCategory: isCentrifugal ? "centrifugal" : "axial",
    fanFunction: "soprador",
    diameter_mm: sizeMm,
    airflow_m3h: freeFlow > 0 ? Math.round(freeFlow * 0.5) : undefined,
    motor_power_w: power,
  };
}

export interface UseEnrichedFanPickerItemsResult {
  items: FanPickerItem[];
  loading: boolean;
  error: string | null;
}

export function useEnrichedFanPickerItems(): UseEnrichedFanPickerItemsResult {
  const { loading, error, data } = useFanLibrary();
  const items = useMemo(() => data.map(toPickerItem), [data]);
  return { items, loading, error };
}
