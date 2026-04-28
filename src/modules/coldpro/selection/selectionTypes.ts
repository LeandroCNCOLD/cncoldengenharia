// Tipos do módulo de seleção automática.

export type ApplicationType = "freezing" | "cooling" | "storage";

export type SelectionInput = {
  requiredLoadW: number;
  chamberAirTempC: number;
  condenserAirInletTempC: number;
  refrigerant: string;
  preferredEvapDeltaT?: number;
  preferredCondDeltaT?: number;
  maxPowerKW?: number;
  minCOP?: number;
  applicationType?: ApplicationType;
  altitudeFactor?: number;
};

export type EquipmentCombination = {
  compressorId: string;
  evaporatorId: string;
  condenserId: string;
};

export type SelectionRating = "ideal" | "bom" | "aceitável" | "ruim";

export type SelectionResult = {
  combination: EquipmentCombination;
  models: { compressor: string; evaporator: string; condenser: string };
  tevapC: number;
  tcondC: number;
  coolingCapacityW: number;
  powerInputW: number;
  cop: number;
  compressorUtilization: number;
  evaporatorUtilization: number;
  condenserUtilization: number;
  heatRejectionW: number;
  balanceErrorW: number;
  bottleneck: string;
  status: string;
  score: number;
  rating: SelectionRating;
  alerts: string[];
};

export type SelectionSummary = {
  totalTested: number;
  approved: number;
  rejected: number;
  bestCOP: number;
  bestCapacityMatch: number;
};

export type SelectionOutput = {
  bestOptions: SelectionResult[];
  allResults: SelectionResult[];
  summary: SelectionSummary;
};

export type PerformancePoint = {
  tevap: number;
  tcond: number;
  capacity: number;
  power: number;
  cop: number;
};

export type PerformanceMap = {
  combination: EquipmentCombination;
  points: PerformancePoint[];
};

export type CatalogEntry = {
  id: string;
  name: string;
  description: string;
  combination: EquipmentCombination;
  capacityW: number;
  powerW: number;
  cop: number;
  tevapC: number;
  tcondC: number;
  refrigerant: string;
  application: ApplicationType;
  rating: SelectionRating;
};

export const APPLICATION_RULES: Record<
  ApplicationType,
  { minCOP: number; priority: "capacity" | "efficiency" | "stability"; maxEvapDT: number }
> = {
  freezing: { minCOP: 1.3, priority: "capacity", maxEvapDT: 12 },
  cooling: { minCOP: 2.0, priority: "efficiency", maxEvapDT: 10 },
  storage: { minCOP: 2.5, priority: "stability", maxEvapDT: 8 },
};
