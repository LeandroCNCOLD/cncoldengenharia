import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface FanOperatingPoint {
  query_airflow_m3h: number | null;
  query_pressure_pa: number | null;
  airflow_m3h: number | null;
  static_pressure_pa: number | null;
  power_w: number | null;
  efficiency_pct: number | null;
  rpm: number | null;
  sfp_class: string | null;
  sfp_value: number | null;
  sound_db: string | null;
}

export interface FanCatalogRow {
  id: string;
  manufacturer: string;
  article_number: string | null;
  type_key: string;
  series: string | null;
  fan_genre: "axial" | "centrifugal" | null;
  design: string | null;
  size_mm: number | null;
  motor: string | null;
  motor_family: string | null;
  motor_power_w: number | null;
  voltage_v: number | null;
  phases: number | null;
  frequency_hz: number | null;
  electrical: string | null;
  rpm: number | null;
  airflow_m3h: number | null;
  static_pressure_pa: number | null;
  power_w: number | null;
  efficiency_pct: number | null;
  sfp_class: string | null;
  sfp_value: number | null;
  sound_db: string | null;
  operating_points: FanOperatingPoint[];
}

export function useFansCatalog() {
  const [data, setData] = useState<FanCatalogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const { data: rows, error } = await supabase
        .from("fans_catalog" as never)
        .select("*")
        .order("manufacturer", { ascending: true })
        .order("type_key", { ascending: true })
        .limit(2000);
      if (!alive) return;
      if (error) setError(error.message);
      else setData((rows ?? []) as unknown as FanCatalogRow[]);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  return { data, loading, error };
}
