import { useRef, useState, useCallback } from "react";
import { createRegistry } from "../services/coldproEngineService";
import type { ProductTechnicalRecord, ProductTechnicalRegistryHandle } from "@/modules/coldpro_v2";

export function useRegistry() {
  const registryRef = useRef<ProductTechnicalRegistryHandle>(createRegistry());
  const [records, setRecords] = useState<ProductTechnicalRecord[]>([]);

  const addRecord = useCallback((record: ProductTechnicalRecord) => {
    registryRef.current.add(record);
    setRecords(registryRef.current.all());
  }, []);

  const search = useCallback((query: string) => {
    return registryRef.current.getByModel(query);
  }, []);

  const filter = useCallback(
    (filters: Parameters<ProductTechnicalRegistryHandle["filter"]>[0]) => {
      return registryRef.current.filter(filters);
    },
    [],
  );

  const compare = useCallback((ids: string[]) => {
    return registryRef.current.compare(ids);
  }, []);

  const stats = useCallback(() => {
    return registryRef.current.stats();
  }, []);

  return { records, addRecord, search, filter, compare, stats };
}
