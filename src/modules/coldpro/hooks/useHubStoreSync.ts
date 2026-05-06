/**
 * useHubStoreSync.ts
 *
 * Hook de sincronização unidirecional:
 *   useTestHubStore → useCatalogSessionStore
 *
 * Quando o Hub de Testes tem uma máquina selecionada, injeta o
 * CatalogEquipmentRow correspondente no useCatalogSessionStore para que
 * as páginas de Equilíbrio, Desempenho e Mapa Operacional recebam os
 * dados automaticamente — sem precisar de repreenchimento manual.
 *
 * Deve ser montado uma única vez no TestHubPage.
 */

import { useEffect, useRef } from "react";
import { useTestHubStore } from "../stores/useTestHubStore";
import { useCatalogSessionStore } from "@/modules/coldpro_catalog/store/useCatalogSessionStore";

export function useHubStoreSync() {
  const selectedMachine = useTestHubStore((s) => s.selectedMachine);
  const { setCompressor, setCondenser, setEvaporator, clearSelection } = useCatalogSessionStore();

  // Rastrear o último id sincronizado para evitar loops
  const lastSyncedId = useRef<string | null>(null);

  useEffect(() => {
    if (!selectedMachine) {
      // Máquina foi limpa — limpar também o catalog session store
      if (lastSyncedId.current !== null) {
        clearSelection();
        lastSyncedId.current = null;
      }
      return;
    }

    if (lastSyncedId.current === selectedMachine.id) {
      // Já sincronizado — não fazer nada
      return;
    }

    // Injetar a máquina selecionada nos três slots do catalog session store
    // As páginas de Equilíbrio/Desempenho/Mapa leem desses slots e
    // chamam buildMotorComponentsFromCatalog para converter para CompressorSpec/CondenserSpec/etc.
    setCompressor(selectedMachine);
    setCondenser(selectedMachine);
    setEvaporator(selectedMachine);
    lastSyncedId.current = selectedMachine.id;
  }, [selectedMachine, setCompressor, setCondenser, setEvaporator, clearSelection]);
}
