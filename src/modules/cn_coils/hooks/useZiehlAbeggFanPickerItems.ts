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
  // EBM-rebadged: "A3G300A…", "R6G500…" → último grupo de 3-4 dígitos = mm
  const m2 = /^[A-Z]\d[A-Z](\d{3,4})/.exec(model);
  if (m2) return Number(m2[1]);
  return undefined;
}

/** Normaliza nome da série (FN50hz / FN60hz → FN, "Series FB" → FB). */
function normalizeSeries(series: string | undefined): string | undefined {
  if (!series) return undefined;
  const s = series.trim();
  if (/^FN/i.test(s)) return "FN";
  const m = /^Series\s+(.+)$/i.exec(s);
  if (m) return m[1].trim();
  return s;
}

/** Infere categoria (axial/centrifugal) a partir da série/modelo quando o JSON não traz. */
function inferCategory(
  series: string | undefined,
  model: string,
  declared: "axial" | "centrifugal" | undefined,
): "axial" | "centrifugal" | undefined {
  if (declared) return declared;
  const s = (series ?? "").toUpperCase();
  // Axiais Ziehl: FN, FB, FC, FE, FH, FL, AT, ADH, RDH, TLI, TLZ, THLZ, TZAF, VKA, PF, HYBLADE
  if (/^(FN|FB|FC|FE|FH|FL|AT|ADH|RDH|TLI|TLZ|THLZ|TZAF|VKA|PF|HYBLADE)/.test(s)) return "axial";
  // EBM rebadged via série "EbmSeries" / "60 Hz" / "Series Cliente":
  // decodifica o motor pelo modelo (mesma regra do useEnrichedFanPickerItems)
  const m = /^[A-Z]\d([A-Z])\d{3,4}/.exec(model);
  if (m) {
    const motor = m[1];
    // N (backward) e S (RadiPac) → centrífugos; demais → axiais
    return motor === "N" || motor === "S" ? "centrifugal" : "axial";
  }
  return undefined;
}

function toPickerItem(row: ZiehlRow): FanPickerItem {
  const series = normalizeSeries(row.series);
  return {
    id: `ZIEHL_${row.id}_${slug(row.model)}`,
    manufacturer: row.builder,
    model: row.model,
    series,
    fanCategory: inferCategory(series, row.model, row.fanCategory),
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
