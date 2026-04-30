/**
 * cn_catalog_performance_curves — serviço de leitura.
 * Curvas reais de operação CN COLD usadas como REFERÊNCIA DE VALIDAÇÃO.
 * Não substitui compressor_models / fan_models / coils.
 */
import { supabase } from "@/integrations/supabase/client";

export interface CatalogCurvePoint {
  // pontos canônicos da curva (estrutura flexível conforme o CSV original)
  // os campos comuns são detectados via parser; mantemos passthrough.
  [key: string]: number | string | null | undefined;
}

export interface CatalogCurve {
  id: string;
  modelo: string;
  linha: string | null;
  hp: string | null;
  gabinete: string | null;
  tipo: string | null;
  refrigerante: string | null;
  curva_indice: number | null;
  total_pontos: number | null;
  curva_json: CatalogCurvePoint[];
  corrente_estimada: number | null;
  corrente_partida: number | null;
  carga_fluido: number | null;
  origem: string | null;
  created_at: string;
}

/**
 * Busca todas as curvas associadas a um modelo (match exato, case-insensitive).
 * Como decidido: vínculo curva↔equipamento usa equipment_projects.commercial_name.
 */
export async function getPerformanceCurvesByModel(modelo: string): Promise<CatalogCurve[]> {
  if (!modelo?.trim()) return [];
  const { data, error } = await supabase
    .from("cn_catalog_performance_curves")
    .select("*")
    .ilike("modelo", modelo.trim())
    .order("refrigerante", { ascending: true })
    .order("curva_indice", { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as CatalogCurve[];
}

/**
 * Variante: busca também por correspondência parcial (ILIKE %modelo%) caso
 * o commercial_name contenha o código do catálogo.
 */
export async function searchPerformanceCurves(query: string): Promise<CatalogCurve[]> {
  if (!query?.trim()) return [];
  const { data, error } = await supabase
    .from("cn_catalog_performance_curves")
    .select("*")
    .ilike("modelo", `%${query.trim()}%`)
    .order("modelo", { ascending: true })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as unknown as CatalogCurve[];
}

export async function countCatalogCurves(): Promise<number> {
  const { count, error } = await supabase
    .from("cn_catalog_performance_curves")
    .select("*", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}
