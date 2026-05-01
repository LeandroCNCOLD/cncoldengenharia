export * from "./domain/types";
export { mapCatalogRowToEquipment } from "./mappers/catalogToEquipment";
export { getTechnicalStatus } from "./validators/technicalStatus";
export type { TechnicalStatusResult } from "./validators/technicalStatus";
export { parseNullableNumber, normalizeString, isFilled } from "./utils/number";
