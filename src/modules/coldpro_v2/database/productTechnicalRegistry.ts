import type {
  ProductComparisonItem,
  ProductRegistryAddResult,
  ProductRegistryFilter,
  ProductRegistryStats,
  ProductTechnicalRecord,
  ProductTechnicalRegistryHandle,
} from "../domain/types";

function isBlank(value: string | undefined): boolean {
  return !value || value.trim().length === 0;
}

function sameText(a: string | undefined, b: string | undefined): boolean {
  return (a ?? "").toLowerCase() === (b ?? "").toLowerCase();
}

function buildAddResult(
  status: ProductRegistryAddResult["status"],
  record: ProductTechnicalRecord,
  warnings: string[],
): ProductRegistryAddResult {
  return {
    status,
    id: record.identity?.id ?? "",
    model: record.identity?.model ?? "",
    warnings,
  };
}

function toComparisonItem(record: ProductTechnicalRecord): ProductComparisonItem {
  return {
    id: record.identity.id,
    model: record.identity.model,
    family: record.identity.family,
    line: record.identity.line,
    refrigerant: record.identity.refrigerant,
    final_status: record.validation.final_status,
    min_capacity_w: record.operating_limits.min_capacity_w,
    max_capacity_w: record.operating_limits.max_capacity_w,
    min_cop: record.operating_limits.min_cop,
    max_cop: record.operating_limits.max_cop,
    min_evap_temp_c: record.operating_limits.min_evap_temp_c,
    max_evap_temp_c: record.operating_limits.max_evap_temp_c,
    min_cond_temp_c: record.operating_limits.min_cond_temp_c,
    max_cond_temp_c: record.operating_limits.max_cond_temp_c,
  };
}

function incrementCounter(counter: Record<string, number>, key: string): void {
  counter[key] = (counter[key] ?? 0) + 1;
}

export function createProductTechnicalRegistry(
  initialRecords?: ProductTechnicalRecord[],
): ProductTechnicalRegistryHandle {
  const records = new Map<string, ProductTechnicalRecord>();
  const modelIndex = new Map<string, string>();

  function add(record: ProductTechnicalRecord): ProductRegistryAddResult {
    const warnings: string[] = [];
    const id = record.identity?.id ?? "";
    const model = record.identity?.model ?? "";

    if (isBlank(id)) warnings.push("ProductTechnicalRegistry: record identity.id is required.");
    if (isBlank(model))
      warnings.push("ProductTechnicalRegistry: record identity.model is required.");
    if (warnings.length > 0) return buildAddResult("error", record, warnings);

    if (records.has(id)) {
      return buildAddResult("duplicate", record, [
        `ProductTechnicalRegistry: duplicate id "${id}".`,
      ]);
    }
    if (modelIndex.has(model.toLowerCase())) {
      return buildAddResult("duplicate", record, [
        `ProductTechnicalRegistry: duplicate model "${model}".`,
      ]);
    }

    records.set(id, record);
    modelIndex.set(model.toLowerCase(), id);

    return buildAddResult("added", record, []);
  }

  function all(): ProductTechnicalRecord[] {
    return Array.from(records.values());
  }

  function filter(filterInput: ProductRegistryFilter): ProductTechnicalRecord[] {
    return all().filter((record) => {
      if (filterInput.family !== undefined && !sameText(record.identity.family, filterInput.family))
        return false;
      if (filterInput.line !== undefined && !sameText(record.identity.line, filterInput.line))
        return false;
      if (
        filterInput.refrigerant !== undefined &&
        !sameText(record.identity.refrigerant, filterInput.refrigerant)
      )
        return false;
      if (
        filterInput.application !== undefined &&
        !sameText(record.identity.application, filterInput.application)
      )
        return false;
      if (
        filterInput.final_status !== undefined &&
        record.validation.final_status !== filterInput.final_status
      )
        return false;

      return true;
    });
  }

  function compare(ids?: string[]): ProductComparisonItem[] {
    const selectedRecords =
      ids === undefined
        ? all()
        : ids
            .map((id) => records.get(id))
            .filter((record): record is ProductTechnicalRecord => record !== undefined);

    return selectedRecords.map(toComparisonItem);
  }

  function stats(): ProductRegistryStats {
    const result: ProductRegistryStats = {
      total: records.size,
      approved: 0,
      warning: 0,
      rejected: 0,
      by_family: {},
      by_line: {},
      by_refrigerant: {},
      by_application: {},
    };

    for (const record of records.values()) {
      if (record.validation.final_status === "approved") result.approved += 1;
      if (record.validation.final_status === "warning") result.warning += 1;
      if (record.validation.final_status === "rejected") result.rejected += 1;

      incrementCounter(result.by_family, record.identity.family);
      incrementCounter(result.by_line, record.identity.line);
      incrementCounter(result.by_refrigerant, record.identity.refrigerant);
      incrementCounter(result.by_application, record.identity.application ?? "unspecified");
    }

    return result;
  }

  const handle: ProductTechnicalRegistryHandle = {
    add,
    addMany(recordsToAdd) {
      return recordsToAdd.map((record) => add(record));
    },
    getById(id) {
      return records.get(id);
    },
    getByModel(model) {
      const id = modelIndex.get(model.toLowerCase());
      return id ? records.get(id) : undefined;
    },
    filter,
    listApproved() {
      return filter({ final_status: "approved" });
    },
    listWarnings() {
      return filter({ final_status: "warning" });
    },
    listRejected() {
      return filter({ final_status: "rejected" });
    },
    compare,
    stats,
    all,
  };

  if (initialRecords) handle.addMany(initialRecords);

  return handle;
}
