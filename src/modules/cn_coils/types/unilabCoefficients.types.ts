export interface VelocityRange {
  min: number;
  max: number;
}

export interface CoilCorrectionCoefficient {
  id: string;
  idCorr: number;
  idTipologia: number;
  serie: string;
  velocityRange_m_s: VelocityRange;
  coefficients: number[];
}

export interface SubcoolingCorrectionCoefficient {
  id: string;
  idCoeffSotto: number;
  serie: string;
  fatCoeflattub: number;
  securityFactor: number;
}

export interface AxialFanCoefficient {
  id: string;
  sourceType: string;
  idFanModel?: number;
  model: string;
  voltage: number;
  frequency: number;
  rpm: number;
  power_W: number;
  current_A: number;
  airflowRange_m3h: VelocityRange;
  curve: {
    x: number[];
    y: number[];
  };
  polynomial: {
    coefficients: number[];
  };
}

export interface CentrifugalFanCoefficient {
  id: string;
  idFanModel?: number;
  model: string;
  areaBocca_m2: number;
  codVentRif?: number;
  density_kg_m3: number;
  rpmRange: VelocityRange;
  pressureRange_Pa: VelocityRange;
  capacityRange_m3h: VelocityRange;
  rawCurve: Record<string, unknown> | Array<Record<string, unknown>>;
}

export type FanCoefficient = AxialFanCoefficient | CentrifugalFanCoefficient;

export type FanEvaluationMethod = "curve" | "polynomial" | "range_only" | "unavailable";

export interface FanCurveEvaluation {
  pressure_Pa: number | null;
  power_W?: number;
  current_A?: number;
  rpm?: number;
  warning?: string;
  method: FanEvaluationMethod;
}

export interface UnilabCorrelationReference {
  tag: string;
  name: string;
  value: string;
}

export interface UnilabCoefficientsDatabase {
  generatedAt: string;
  source: "UNILAB_COILS6_VAPCYC";
  coilCorrections: CoilCorrectionCoefficient[];
  subcoolingCorrections: SubcoolingCorrectionCoefficient[];
  fans: {
    axial: AxialFanCoefficient[];
    centrifugal: CentrifugalFanCoefficient[];
  };
  correlations: {
    coilDesigner: UnilabCorrelationReference[];
    heatExchanger: UnilabCorrelationReference[];
  };
}
