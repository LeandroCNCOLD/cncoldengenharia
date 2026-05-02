export type EquipmentFamily =
  | "compressor"
  | "condenser"
  | "evaporator"
  | "condensing_unit"
  | "plugin"
  | "split"
  | "unknown";

export type Refrigerant =
  | "R404A"
  | "R507A"
  | "R134a"
  | "R22"
  | "R448A"
  | "R449A"
  | "R452A"
  | "R290"
  | "unknown";

export type TemperatureApplication =
  | "LT"
  | "MT"
  | "HT"
  | "freezing"
  | "cooling"
  | "unknown";

export interface CatalogEquipmentRow {
  id: string;
  modelo: string;
  modeloUnico: string;
  modeloBaseReferencia?: string;

  family: EquipmentFamily;
  application: TemperatureApplication;

  fabricante?: string;
  fabricanteOrigem?: string;
  compressorModelo?: string;
  compressorCodigo?: string;
  tipoCompressor?: string;

  refrigerante: Refrigerant;

  tensaoV?: number;
  numeroFases?: number;
  frequenciaHz?: number;
  configuracaoEletrica?: string;

  linha?: string;
  designacaoHp?: string;
  gabinete?: string;
  tipoGabinete?: string;

  capacidadeFrigorificaKcalH?: number;
  capacidadeCompressorKcalH?: number;
  calorRejeitadoKcalH?: number;

  potenciaEletricaKw?: number;
  potenciaCompressorKw?: number;
  potenciaVentiladorKw?: number;
  correnteA?: number;
  correntePartidaA?: number;

  cop?: number;
  gwp?: number;

  tempEvaporacaoC?: number;
  tempCondensacaoC?: number;
  tempAmbienteC?: number;
  tempCamaraC?: number;
  umidadeCamaraPercent?: number;

  vazaoArEvaporadorM3H?: number;
  vazaoArCondensadorM3H?: number;

  tipoDegelo?: string;

  condensadorRows?: number;
  condensadorTubesPorRow?: number;
  condensadorCircuitos?: number;
  condensadorFinSpacingMm?: number;
  condensadorLengthMm?: number;
  condensadorTuboDiametroMm?: number;

  evaporadorRows?: number;
  evaporadorTubesPorRow?: number;
  evaporadorCircuitos?: number;
  evaporadorFinSpacingMm?: number;
  evaporadorLengthMm?: number;
  evaporadorTuboDiametroMm?: number;
  evaporadorVolumeInternoL?: number;
  evaporadorAreaSuperficieM2?: number;

  linhaSucao?: string;
  linhaDescarga?: string;
  linhaLiquido?: string;

  superaquecimentoTotalK?: number;
  superaquecimentoUtilK?: number;
  subresfriamentoK?: number;
  altitudeM?: number;

  quantidadeAguaLH?: number;
  diametroDreno?: string;

  raw: Record<string, unknown>;
}

export interface CatalogFilter {
  search?: string;
  family?: EquipmentFamily | "all";
  refrigerant?: Refrigerant | "all";
  application?: TemperatureApplication | "all";
  voltage?: number | "all";
  phases?: number | "all";
  minCapacityKcalH?: number;
  maxCapacityKcalH?: number;
}

export interface CatalogValidationIssue {
  equipmentId: string;
  field: string;
  severity: "warning" | "error";
  message: string;
}
