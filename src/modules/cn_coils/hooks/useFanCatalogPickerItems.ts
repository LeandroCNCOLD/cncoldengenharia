/**
 * Hook que expõe o catálogo Ziehl-Abegg novo (com curvas reais Q×ΔP)
 * mapeado para o shape FanPickerItem usado pelo FanPickerModal.
 *
 * Fonte: src/modules/cn_coils/data/fanCatalog.ts (FAN_CATALOG)
 */
import { useMemo } from "react";
import { FAN_CATALOG, type FanModel } from "@/data/fanCatalog";
import type { FanPickerItem } from "../components/FanPickerModal";

/** Vazão recomendada de operação: ponto da curva onde psf_pa cai a ~60% do max. */
function recommendedAirflow(fan: FanModel): number | undefined {
  const pts = fan.curve_points;
  if (!pts || pts.length === 0) return undefined;
  // Heurística simples: ponto a ~60% da vazão máxima do catálogo, sem inventar valores.
  const target = fan.q_max_m3h * 0.6;
  // Retorna o ponto da curva mais próximo desse alvo
  let best = pts[0].q_m3h;
  let bestDelta = Math.abs(pts[0].q_m3h - target);
  for (const p of pts) {
    const d = Math.abs(p.q_m3h - target);
    if (d < bestDelta) {
      bestDelta = d;
      best = p.q_m3h;
    }
  }
  return best > 0 ? best : undefined;
}

/** Deriva a "série" (FN) a partir do prefixo do modelo. */
function deriveSeries(model: string): string | undefined {
  const m = /^([A-Z]{2})\d/.exec(model);
  return m?.[1];
}

function toPickerItem(fan: FanModel): FanPickerItem {
  return {
    id: `ZA_${fan.model}`,
    manufacturer: fan.manufacturer,
    model: fan.model,
    series: deriveSeries(fan.model),
    seriesDescription: fan.electrical_nominal,
    fanCategory: "axial",
    fanFunction: "soprador",
    diameter_mm: fan.diameter_mm,
    rpm: fan.rpm_nominal,
    motor_power_w: fan.p1_nominal_w,
    airflow_m3h: recommendedAirflow(fan),
  };
}

export interface UseFanCatalogPickerItemsResult {
  items: FanPickerItem[];
  loading: boolean;
  error: string | null;
}

export function useFanCatalogPickerItems(): UseFanCatalogPickerItemsResult {
  const items = useMemo(() => FAN_CATALOG.map(toPickerItem), []);
  return { items, loading: false, error: null };
}
