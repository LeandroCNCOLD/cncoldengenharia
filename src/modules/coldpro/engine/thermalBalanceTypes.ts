// Tipos canônicos do motor térmico CN Cold (SI: °C, W, m³/h).

export type ThermalSimulationInput = {
  evaporatorId: string;
  condenserId: string;
  compressorId: string;
  chamberAirTempC: number;
  condenserAirInletTempC: number;
  requiredLoadW?: number;
  evaporatorAirFlowM3h?: number;
  condenserAirFlowM3h?: number;
  frostFactor?: number;
  evaporatorFoulingFactor?: number;
  condenserFoulingFactor?: number;
  altitudeFactor?: number;
};

export type CompressorPerformance = {
  coolingCapacityW: number;
  powerInputW: number;
  massFlowKgh?: number;
  currentA?: number;
  cop: number;
};

export type HeatExchangerPerformance = {
  capacityW: number;
  deltaT: number;
  utilizationPercent?: number;
};

export type SimulationStatus = "approved" | "warning" | "rejected";
export type Bottleneck =
  | "compressor"
  | "evaporator"
  | "condenser"
  | "balanced"
  | "invalid";

export type ThermalSimulationResult = {
  tevapC: number;
  tcondC: number;
  compressor: CompressorPerformance;
  evaporator: HeatExchangerPerformance;
  condenser: HeatExchangerPerformance;
  coolingCapacityW: number;
  coolingCapacityKcalh: number;
  heatRejectionW: number;
  powerInputW: number;
  cop: number;
  balanceErrorW: number;
  bottleneck: Bottleneck;
  status: SimulationStatus;
  alerts: string[];
};

export class ThermalEngineError extends Error {
  constructor(message: string, public readonly details?: Record<string, unknown>) {
    super(message);
    this.name = "ThermalEngineError";
  }
}
