export type CalibrationFactors = {
  capacityCorrectionFactor?: number;
  airPressureDropFactor?: number;
  refrigerantPressureDropFactor?: number;
  heatTransferFactor?: number;
};

export type EngineName = 'empirical' | 'physical_simple' | 'physical_advanced';

export function shouldApplyCalibrationAsPostProcess(engine: EngineName): boolean {
  return engine === 'empirical';
}

export function normalizeCalibrationFactors(f?: CalibrationFactors | null): Required<CalibrationFactors> {
  return {
    capacityCorrectionFactor: safeFactor(f?.capacityCorrectionFactor),
    airPressureDropFactor: safeFactor(f?.airPressureDropFactor),
    refrigerantPressureDropFactor: safeFactor(f?.refrigerantPressureDropFactor),
    heatTransferFactor: safeFactor(f?.heatTransferFactor ?? f?.capacityCorrectionFactor),
  };
}

export function safeFactor(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.min(3, Math.max(0.3, n));
}
