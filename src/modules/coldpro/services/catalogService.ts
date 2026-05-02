// Catálogo de equipamentos — service layer (stub tipado, sem mock).
//
// O backend desta tabela ainda não existe. Este arquivo expõe a API que será
// usada pelas telas; cada função retorna um shape vazio porém válido e marca
// claramente a ausência de dados via flag `pending`. Quando a tabela for
// criada, basta substituir o corpo pelas chamadas Supabase reais.

import type {
  CatalogEntry,
  CatalogFilter,
  CatalogPage,
} from "../types/frontend.types";
import { ServiceError } from "../types/frontend.types";

const NOT_IMPLEMENTED_MESSAGE =
  "Catálogo de equipamentos ainda não está conectado ao backend.";

export interface CatalogServiceStatus {
  readonly available: boolean;
  readonly reason: string | null;
}

export function getCatalogStatus(): CatalogServiceStatus {
  return {
    available: false,
    reason: NOT_IMPLEMENTED_MESSAGE,
  };
}

export async function listCatalog(
  _filter: CatalogFilter = {},
): Promise<CatalogPage> {
  return {
    items: [],
    total: 0,
    hasMore: false,
  };
}

export async function getCatalogEntry(id: string): Promise<CatalogEntry | null> {
  if (!id) {
    throw new ServiceError("VALIDATION_ERROR", "id é obrigatório");
  }
  return null;
}

export async function listCatalogBrands(): Promise<readonly string[]> {
  return [];
}
