/**
 * Hook que carrega o catálogo Ziehl-Abegg de
 * /public/data/catalogs/fans.json e mapeia para FanPickerItem.
 *
 * Esses modelos vêm com metadados ricos já consolidados (série, fabricante,
 * categoria, função, vazão, potência, corrente, tensão, frequência, rpm).
 */
import { useEffect, useMemo, useState } from "react";
import type { FanPickerItem } from "../components/FanPickerModal";
import type { FanFunction } from "../services/cncoilsCoefficientsService";

interface ZiehlRow {
  id: number;
  model: string;
  series?: string;
  type?: string;
  builder: string;
  airflowM3h?: number;
  powerW?: number;
  speedRpm?: number;
  currentA?: number;
  voltageV?: number;
  frequencyHz?: number;
  fanCategory?: "axial" | "centrifugal";
  fanFunction?: FanFunction;
}

function slug(s: string): string {
  return s.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

/** Tenta extrair diâmetro do rotor (mm) a partir do nome do modelo. */
function extractDiameterMm(model: string): number | undefined {
  // Padrões frequentes Ziehl: "FN050-…", "FB035-…", "ZN071-…" → tamanho em cm × 10
  const m1 = /^[A-Z]{2,3}(\d{3})/.exec(model);
  if (m1) {
    const cm = Number(m1[1]);
    if (cm > 0) return cm * 10;
  }
  // "TLI 9-9" → 9 polegadas? Sem garantia — deixa undefined.
  return undefined;
}

function toPickerItem(row: ZiehlRow): FanPickerItem {
  return {
    id: `ZIEHL_${row.id}_${slug(row.model)}`,
    manufacturer: row.builder,
    model: row.model,
    series: row.series || undefined,
    fanCategory: row.fanCategory,
    fanFunction: row.fanFunction,
    diameter_mm: extractDiameterMm(row.model),
    rpm: row.speedRpm,
    airflow_m3h: row.airflowM3h,
    motor_power_w: row.powerW,
    motor_current_a: row.currentA,
    voltage_v: row.voltageV,
    frequency_hz: row.frequencyHz,
  };
}

export interface UseZiehlAbeggFanPickerItemsResult {
  items: FanPickerItem[];
  loading: boolean;
  error: string | null;
}

export function useZiehlAbeggFanPickerItems(): UseZiehlAbeggFanPickerItemsResult {
  const [state, setState] = useState<{
    loading: boolean;
    error: string | null;
    rows: ZiehlRow[];
  }>({ loading: true, error: null, rows: [] });

  useEffect(() => {
    let cancelled = false;
    fetch("/data/catalogs/fans.json", { cache: "force-cache" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status} carregando fans.json`);
        return res.json() as Promise<ZiehlRow[]>;
      })
      .then((rows) => {
        if (cancelled) return;
        if (!Array.isArray(rows)) throw new Error("Conteúdo inválido em fans.json");
        setState({ loading: false, error: null, rows });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({
          loading: false,
          error: err instanceof Error ? err.message : String(err),
          rows: [],
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const items = useMemo(() => state.rows.map(toPickerItem), [state.rows]);
  return { items, loading: state.loading, error: state.error };
}
