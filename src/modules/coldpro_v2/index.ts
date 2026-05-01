// Domain types
export * from "./domain/types";

// Mapper
export { mapCatalogRowToEquipment } from "./mappers/catalogToEquipment";
export { FIELD_ALIASES } from "./mappers/fieldAliases";

// Validators
export { getTechnicalStatus } from "./validators/technicalStatus";
export type { TechnicalStatusResult } from "./validators/technicalStatus";

// Utils
export { parseNullableNumber, normalizeString, isFilled } from "./utils/number";
export { normalizeFieldName, resolveField } from "./utils/fieldNormalizer";
export { toWatts, fromWatts, formatCapacity, detectUnitFromFieldName } from "./utils/unitConverter";
export { readNumberWithUnit } from "./utils/readNumberWithUnit";
export type { ReadNumberWithUnitResult } from "./utils/readNumberWithUnit";

// Engines
export { calculateCoil } from "./engines/coilCalculationEngine";
