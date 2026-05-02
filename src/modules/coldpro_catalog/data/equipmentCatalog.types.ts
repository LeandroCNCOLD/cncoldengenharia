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
  | "R410A"
  | "R448A"
  | "R449A"
  | "R452A"
  | "R290"
  | "unknown";

export type TemperatureApplication =
  | "LT"
  | "MT"
  | "HT"
  | "AGRO"
  | "freezing"
  | "cooling"
  | "unknown";

export interface CatalogEquipmentRow {
  id: string;
  modelo: string;
  modeloUnico: string;
  modeloBaseReferencia?: string;
  modeloCatalogoOriginal?: string;
  statusCompressor?: string;

  family: EquipmentFamily;
  application: TemperatureApplication;

  fabricante?: string;
  fabricanteOrigem?: string;
  compressorModelo?: string;
  compressorCodigo?: string;
  tipoCompressor?: string;

  refrigerante: Refrigerant;

  tensaoV?: number;
  tensaoComercial?: string;
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
  copCarnot?: number;
  gwp?: number;
  odp?: number;

  tempEvaporacaoC?: number;
  tempCondensacaoC?: number;
  tempAmbienteC?: number;
  tempCamaraC?: number;
  umidadeCamaraPercent?: number;

  vazaoArEvaporadorM3H?: number;
  vazaoArCondensadorM3H?: number;

  tipoDegelo?: string;

  // --- Condensador (geometria básica + estendida) ---
  condensadorRows?: number;
  condensadorTubesPorRow?: number;
  condensadorCircuitos?: number;
  condensadorFinSpacingMm?: number;
  condensadorLengthMm?: number;
  condensadorTuboDiametroMm?: number;
  condensadorTuboDiametroIn?: string;
  condensadorTuboDiametroInternoMm?: number;
  condensadorTuboEspessuraMm?: number;
  condensadorTubePitchTransverseMm?: number;
  condensadorTubePitchLongitudinalMm?: number;
  condensadorFinThicknessMm?: number;
  condensadorCoilWidthM?: number;
  condensadorCoilHeightM?: number;
  condensadorCoilDepthM?: number;
  condensadorTubeMaterial?: "copper" | "aluminum" | "steel";
  condensadorFinMaterial?: "copper" | "aluminum" | "steel";
  condensadorAreaFaceM2?: number;
  condensadorAreaTrocaM2?: number;
  condensadorVolumeInternoL?: number;
  condensadorGeometria?: string;
  ventiladorCondensador?: string;

  // --- Evaporador (geometria básica + estendida) ---
  modeloEvaporador?: string;
  evaporadorRows?: number;
  evaporadorTubesPorRow?: number;
  evaporadorCircuitos?: number;
  evaporadorFinSpacingMm?: number;
  evaporadorLengthMm?: number;
  evaporadorTuboDiametroMm?: number;
  evaporadorTuboDiametroIn?: string;
  evaporadorVolumeInternoL?: number;
  evaporadorAreaSuperficieM2?: number;
  evaporadorAreaFaceM2?: number;
  evaporadorAreaTrocaM2?: number;
  evaporadorTuboEspessuraMm?: number;
  evaporadorCoilDepthM?: number;
  evaporadorGeometria?: string;
  evaporadorQuantidade?: number;
  ventiladorEvaporador?: string;

  // --- Geometria detalhada do evaporador (para ProgressiveCoilInput) ---
  evaporadorTubeInnerDiameterMm?: number;
  evaporadorTubePitchTransverseMm?: number;
  evaporadorTubePitchLongitudinalMm?: number;
  evaporadorFinHeightMm?: number;
  evaporadorFinThicknessMm?: number;
  evaporadorCoilWidthM?: number;
  evaporadorCoilHeightM?: number;
  evaporadorTubeMaterial?: "copper" | "aluminum" | "steel";
  evaporadorFinMaterial?: "copper" | "aluminum" | "steel";
  evaporadorAirTemperatureInC?: number;
  evaporadorAirRelativeHumidityIn?: number;
  evaporadorAirMassFlowKgS?: number;

  // --- Serpentina de reaquecimento (para ReheatCoilSizingInput) ---
  reheatQTargetW?: number;
  reheatTAirInC?: number;
  reheatTAirOutC?: number;
  reheatAirMassFlowKgS?: number;
  reheatTCondensingC?: number;
  reheatTHotGasInC?: number;
  reheatTubeOuterDiameterM?: number;
  reheatTubeThicknessM?: number;
  reheatFinSpacingM?: number;
  reheatFinThicknessM?: number;
  reheatTubePitchTransversalM?: number;
  reheatTubePitchLongitudinalM?: number;
  reheatCoilLengthM?: number;
  reheatCircuits?: number;
  reheatTubeMaterial?: "copper" | "aluminum" | "steel";
  reheatFinMaterial?: "copper" | "aluminum" | "steel";
  reheatCoilWidthM?: number;
  reheatCoilHeightM?: number;
  reheatCoilDepthM?: number;
  reheatAreaFaceM2?: number;
  reheatAreaTrocaM2?: number;
  reheatVolumeInternoL?: number;
  // Geometria do aletado de reaquecimento (em mm — direto da planilha)
  reheatRows?: number;
  reheatTubesPerRow?: number;
  reheatFinSpacingMm?: number;
  reheatCoilLengthMm?: number;
  reheatGeometria?: string;

  linhaSucao?: string;
  linhaDescarga?: string;
  linhaLiquido?: string;
  velocidadeDescargaMs?: number;
  velocidadeLiquidoMs?: number;
  velocidadeSucaoMs?: number;

  superaquecimentoTotalK?: number;
  superaquecimentoUtilK?: number;
  subresfriamentoK?: number;
  subresfriamentoAdicionalK?: number;
  altitudeM?: number;

  vazaoMassaKgH?: number;
  vazaoMassaKgS?: number;
  deltaEntalpiaKjKg?: number;
  cargaFluidoKg?: number;
  umidadeExternaPercent?: number;

  // Correntes individuais
  correnteCompressorA?: number;
  correnteVentiladoresA?: number;

  // Circuito secundário (quando existir)
  modeloCondensadorSecundario?: string;
  ventiladorCondensadorSecundario?: string;
  vazaoArCondensadorSecundarioM3H?: number;

  quantidadeAguaLH?: number;
  diametroDreno?: string;
  quantidadeDrenos?: number;

  // --- Status de validação e controle de revisão ---
  validationStatus?: "pending" | "analyzed" | "validated" | "rejected";
  revisionStatus?: "draft" | "active" | "superseded";
  revisionNumber?: number;
  lastReviewedAt?: string;
  lastReviewedBy?: string;
  validationNotes?: string[];

  raw: Record<string, unknown>;
}

export type ValidationStatus = NonNullable<CatalogEquipmentRow["validationStatus"]>;
export type RevisionStatus = NonNullable<CatalogEquipmentRow["revisionStatus"]>;

export const DEFAULT_VALIDATION_STATUS: ValidationStatus = "pending";
export const DEFAULT_REVISION_STATUS: RevisionStatus = "draft";
export const DEFAULT_REVISION_NUMBER = 0;

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
