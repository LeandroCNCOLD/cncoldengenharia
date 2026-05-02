import { useMemo, useState } from "react";
import { catalogRepository } from "../services/catalogRepository";
import { filterCatalog } from "../services/catalogFilterService";
import { validateCatalog } from "../services/catalogValidationService";
import type { CatalogFilter } from "../data/equipmentCatalog.types";

export function useEquipmentCatalog() {
  const [filter, setFilter] = useState<CatalogFilter>({
    family: "all",
    refrigerant: "all",
    application: "all",
    voltage: "all",
    phases: "all",
  });

  const allRows = useMemo(() => catalogRepository.list(), []);
  const filteredRows = useMemo(() => filterCatalog(allRows, filter), [allRows, filter]);
  const validationIssues = useMemo(() => validateCatalog(allRows), [allRows]);

  return {
    rows: filteredRows,
    allRows,
    filter,
    setFilter,
    validationIssues,
    total: allRows.length,
    filteredTotal: filteredRows.length,
    errorCount: validationIssues.filter((i) => i.severity === "error").length,
    warningCount: validationIssues.filter((i) => i.severity === "warning").length,
  };
}
