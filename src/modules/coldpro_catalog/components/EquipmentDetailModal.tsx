import { useMemo, useState } from "react";
import { X, ChevronDown, ChevronUp, CheckCircle2, AlertCircle, Clock, XCircle, FilePlus2 } from "lucide-react";
import type {
  CatalogEquipmentRow,
  ValidationStatus,
  RevisionStatus,
} from "../data/equipmentCatalog.types";
import {
  DEFAULT_VALIDATION_STATUS,
  DEFAULT_REVISION_STATUS,
  DEFAULT_REVISION_NUMBER,
} from "../data/equipmentCatalog.types";
import { useCatalogRevisionStore } from "../store/useCatalogRevisionStore";
import { useCatalogValidationStore } from "../store/useCatalogValidationStore";
import {
  computeBlockCompleteness,
  BLOCK_LABEL,
  type BlockKey,
  type CatalogCompleteness,
} from "../services/blockCompletenessService";

type Tab = "tech" | "validation" | "history";

interface Props {
  equipment: CatalogEquipmentRow | null;
  onClose: () => void;
}

const NA = "Não informado";

function fmt(value: unknown, suffix = "", decimals = 2): string {
  if (value === undefined || value === null || value === "") return NA;
  if (typeof value === "number") {
    if (Number.isNaN(value)) return NA;
    return `${value.toLocaleString("pt-BR", { maximumFractionDigits: decimals })}${suffix ? " " + suffix : ""}`;
  }
  return `${String(value)}${suffix ? " " + suffix : ""}`;
}

const VALIDATION_LABEL: Record<ValidationStatus, string> = {
  pending: "Pendente",
  analyzed: "Analisado",
  validated: "Validado",
  rejected: "Rejeitado",
};

const VALIDATION_STYLE: Record<ValidationStatus, string> = {
  pending: "bg-slate-100 text-slate-700 border-slate-300",
  analyzed: "bg-amber-50 text-amber-800 border-amber-300",
  validated: "bg-emerald-50 text-emerald-800 border-emerald-300",
  rejected: "bg-red-50 text-red-800 border-red-300",
};

const VALIDATION_ICON: Record<ValidationStatus, React.ComponentType<{ className?: string }>> = {
  pending: Clock,
  analyzed: AlertCircle,
  validated: CheckCircle2,
  rejected: XCircle,
};

const REVISION_LABEL: Record<RevisionStatus, string> = {
  draft: "Rascunho",
  active: "Ativo",
  superseded: "Substituído",
};

export function EquipmentDetailModal({ equipment, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("tech");
  const [showRaw, setShowRaw] = useState(false);
  const [manualNote, setManualNote] = useState("");

  const revisions = useCatalogRevisionStore((s) =>
    equipment ? s.listRevisions(equipment.id) : [],
  );
  const addRevision = useCatalogRevisionStore((s) => s.addRevision);
  const clearRevisions = useCatalogRevisionStore((s) => s.clearRevisions);
  const validationOverride = useCatalogValidationStore((s) =>
    equipment ? s.getOverride(equipment.id) : undefined,
  );
  const setValidationStatus = useCatalogValidationStore((s) => s.setStatus);

  const effectiveValidation: ValidationStatus =
    validationOverride?.validationStatus ??
    equipment?.validationStatus ??
    DEFAULT_VALIDATION_STATUS;
  const effectiveRevisionStatus: RevisionStatus =
    equipment?.revisionStatus ?? DEFAULT_REVISION_STATUS;
  const effectiveRevisionNumber =
    equipment?.revisionNumber ?? DEFAULT_REVISION_NUMBER;
  const lastReviewedAt = validationOverride?.reviewedAt ?? equipment?.lastReviewedAt;
  const lastReviewedBy = validationOverride?.reviewedBy ?? equipment?.lastReviewedBy;
  const validationNotes = validationOverride?.notes ?? equipment?.validationNotes;

  const completeness: CatalogCompleteness | null = useMemo(
    () => (equipment ? computeBlockCompleteness(equipment) : null),
    [equipment],
  );

  const missingByBlock = useMemo(() => {
    const map = new Map<BlockKey, Set<string>>();
    if (!completeness) return map;
    (Object.keys(completeness.byBlock) as BlockKey[]).forEach((k) => {
      map.set(k, new Set(completeness.byBlock[k].missing));
    });
    return map;
  }, [completeness]);

  const hasReheat = useMemo(() => {
    if (!equipment) return false;
    return (
      equipment.reheatQTargetW !== undefined ||
      equipment.reheatTAirInC !== undefined ||
      equipment.reheatTubeOuterDiameterM !== undefined
    );
  }, [equipment]);

  if (!equipment || !completeness) return null;
  const ValidationIcon = VALIDATION_ICON[effectiveValidation];

  const handleMarkAnalyzed = () => {
    setValidationStatus(equipment.id, "analyzed");
  };
  const handleMarkValidated = () => {
    setValidationStatus(equipment.id, "validated");
  };
  const handleManualRevision = () => {
    addRevision(equipment, "manual_review", manualNote || undefined);
    setManualNote("");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4"
      onClick={onClose}
    >
      <div
        className="relative my-8 w-full max-w-5xl rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-semibold text-slate-900">
                {equipment.modeloBaseReferencia ?? equipment.modelo}
              </h2>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${VALIDATION_STYLE[effectiveValidation]}`}
              >
                <ValidationIcon className="h-3 w-3" />
                {VALIDATION_LABEL[effectiveValidation]}
              </span>
              <span className="rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-xs text-slate-700">
                Rev. {effectiveRevisionNumber} · {REVISION_LABEL[effectiveRevisionStatus]}
              </span>
              {equipment.application && (
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-800">
                  {equipment.application}
                </span>
              )}
            </div>
            <p className="mt-1 truncate text-xs text-slate-500">
              {equipment.modeloUnico}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-4 rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-200 px-6">
          <nav className="-mb-px flex gap-6 text-sm">
            <TabButton active={tab === "tech"} onClick={() => setTab("tech")}>
              Dados técnicos
            </TabButton>
            <TabButton active={tab === "validation"} onClick={() => setTab("validation")}>
              Validação
            </TabButton>
            <TabButton active={tab === "history"} onClick={() => setTab("history")}>
              Histórico de revisões {revisions.length > 0 && `(${revisions.length})`}
            </TabButton>
          </nav>
        </div>

        {/* Body */}
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5 text-sm">
          {tab === "tech" && (
            <div className="space-y-5">
              <Section title="Identificação">
                <Field label="Modelo" value={equipment.modelo} />
                <Field label="Modelo único" value={equipment.modeloUnico} />
                <Field label="Modelo base" value={equipment.modeloBaseReferencia} />
                <Field label="Linha" value={equipment.linha} />
                <Field label="Gabinete" value={equipment.gabinete} />
                <Field label="Tipo gabinete" value={equipment.tipoGabinete} />
                <Field label="Família" value={equipment.family} />
                <Field label="Aplicação" value={equipment.application} />
              </Section>

              <Section title="Compressor">
                <Field label="Modelo" value={equipment.compressorModelo} />
                <Field label="Código" value={equipment.compressorCodigo} />
                <Field label="Fabricante" value={equipment.fabricante} />
                <Field label="Tipo" value={equipment.tipoCompressor} />
                <Field label="Refrigerante" value={equipment.refrigerante} />
                <Field
                  label="Capacidade"
                  value={fmt(equipment.capacidadeCompressorKcalH ?? equipment.capacidadeFrigorificaKcalH, "kcal/h", 0)}
                />
                <Field label="Potência" value={fmt(equipment.potenciaCompressorKw, "kW")} />
                <Field label="Designação HP" value={equipment.designacaoHp} />
                <Field label="COP" value={fmt(equipment.cop)} />
                <Field label="GWP" value={fmt(equipment.gwp, "", 0)} />
              </Section>

              <Section title="Condensador">
                <Field label="Calor rejeitado" value={fmt(equipment.calorRejeitadoKcalH, "kcal/h", 0)} />
                <Field label="Vazão de ar" value={fmt(equipment.vazaoArCondensadorM3H, "m³/h", 0)} />
                <Field label="T condensação" value={fmt(equipment.tempCondensacaoC, "°C", 1)} />
                <Field label="T ambiente" value={fmt(equipment.tempAmbienteC, "°C", 1)} />
                <Field label="Rows" value={fmt(equipment.condensadorRows, "", 0)} />
                <Field label="Tubos/row" value={fmt(equipment.condensadorTubesPorRow, "", 0)} />
                <Field label="Circuitos" value={fmt(equipment.condensadorCircuitos, "", 0)} />
                <Field label="Fin spacing" value={fmt(equipment.condensadorFinSpacingMm, "mm")} />
                <Field label="Comprimento" value={fmt(equipment.condensadorLengthMm, "mm", 0)} />
                <Field label="Ø tubo" value={fmt(equipment.condensadorTuboDiametroMm, "mm")} />
              </Section>

              <Section title="Evaporador">
                <Field label="Capacidade frigorífica" value={fmt(equipment.capacidadeFrigorificaKcalH, "kcal/h", 0)} />
                <Field label="Vazão de ar" value={fmt(equipment.vazaoArEvaporadorM3H, "m³/h", 0)} />
                <Field label="T evaporação" value={fmt(equipment.tempEvaporacaoC, "°C", 1)} />
                <Field label="T câmara" value={fmt(equipment.tempCamaraC, "°C", 1)} />
                <Field label="Umidade câmara" value={fmt(equipment.umidadeCamaraPercent, "%", 0)} />
                <Field label="Área superfície" value={fmt(equipment.evaporadorAreaSuperficieM2, "m²")} />
                <Field label="Volume interno" value={fmt(equipment.evaporadorVolumeInternoL, "L")} />
                <Field label="Rows" value={fmt(equipment.evaporadorRows, "", 0)} />
                <Field label="Tubos/row" value={fmt(equipment.evaporadorTubesPorRow, "", 0)} />
                <Field label="Circuitos" value={fmt(equipment.evaporadorCircuitos, "", 0)} />
                <Field label="Fin spacing" value={fmt(equipment.evaporadorFinSpacingMm, "mm")} />
                <Field label="Comprimento" value={fmt(equipment.evaporadorLengthMm, "mm", 0)} />
                <Field label="Ø tubo externo" value={fmt(equipment.evaporadorTuboDiametroMm, "mm")} />
                <Field label="Ø tubo interno" value={fmt(equipment.evaporadorTubeInnerDiameterMm, "mm")} />
                <Field label="Pitch transverso" value={fmt(equipment.evaporadorTubePitchTransverseMm, "mm")} />
                <Field label="Pitch longitudinal" value={fmt(equipment.evaporadorTubePitchLongitudinalMm, "mm")} />
                <Field label="Altura aleta" value={fmt(equipment.evaporadorFinHeightMm, "mm")} />
                <Field label="Espessura aleta" value={fmt(equipment.evaporadorFinThicknessMm, "mm", 3)} />
                <Field label="Largura serpentina" value={fmt(equipment.evaporadorCoilWidthM, "m")} />
                <Field label="Altura serpentina" value={fmt(equipment.evaporadorCoilHeightM, "m")} />
                <Field label="Material tubo" value={equipment.evaporadorTubeMaterial} />
                <Field label="Material aleta" value={equipment.evaporadorFinMaterial} />
                <Field label="T ar entrada" value={fmt(equipment.evaporadorAirTemperatureInC, "°C", 1)} />
                <Field label="UR ar entrada" value={fmt(equipment.evaporadorAirRelativeHumidityIn)} />
                <Field label="Vazão mássica ar" value={fmt(equipment.evaporadorAirMassFlowKgS, "kg/s", 3)} />
              </Section>

              <Section title="Reaquecimento">
                <div className="col-span-full mb-1">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                      hasReheat
                        ? "bg-emerald-50 text-emerald-800"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {hasReheat ? "Disponível" : "Não cadastrado"}
                  </span>
                </div>
                <Field label="Q alvo" value={fmt(equipment.reheatQTargetW, "W", 0)} />
                <Field label="T ar entrada" value={fmt(equipment.reheatTAirInC, "°C", 1)} />
                <Field label="T ar saída" value={fmt(equipment.reheatTAirOutC, "°C", 1)} />
                <Field label="Vazão mássica ar" value={fmt(equipment.reheatAirMassFlowKgS, "kg/s", 3)} />
                <Field label="T condensação" value={fmt(equipment.reheatTCondensingC, "°C", 1)} />
                <Field label="T gás quente" value={fmt(equipment.reheatTHotGasInC, "°C", 1)} />
                <Field label="Ø tubo externo" value={fmt(equipment.reheatTubeOuterDiameterM, "m", 4)} />
                <Field label="Espessura tubo" value={fmt(equipment.reheatTubeThicknessM, "m", 4)} />
                <Field label="Fin spacing" value={fmt(equipment.reheatFinSpacingM, "m", 4)} />
                <Field label="Espessura aleta" value={fmt(equipment.reheatFinThicknessM, "m", 4)} />
                <Field label="Pitch transversal" value={fmt(equipment.reheatTubePitchTransversalM, "m", 4)} />
                <Field label="Pitch longitudinal" value={fmt(equipment.reheatTubePitchLongitudinalM, "m", 4)} />
                <Field label="Comprimento" value={fmt(equipment.reheatCoilLengthM, "m")} />
                <Field label="Circuitos" value={fmt(equipment.reheatCircuits, "", 0)} />
              </Section>

              <Section title="Elétrica">
                <Field label="Tensão" value={fmt(equipment.tensaoV, "V", 0)} />
                <Field label="Fases" value={fmt(equipment.numeroFases, "", 0)} />
                <Field label="Frequência" value={fmt(equipment.frequenciaHz, "Hz", 0)} />
                <Field label="Configuração" value={equipment.configuracaoEletrica} />
                <Field label="Corrente nominal" value={fmt(equipment.correnteA, "A")} />
                <Field label="Corrente partida" value={fmt(equipment.correntePartidaA, "A")} />
                <Field label="Potência total" value={fmt(equipment.potenciaEletricaKw, "kW")} />
                <Field label="Potência ventilador" value={fmt(equipment.potenciaVentiladorKw, "kW")} />
              </Section>

              <Section title="Degelo & Linhas frigoríficas">
                <Field label="Tipo de degelo" value={equipment.tipoDegelo} />
                <Field label="Linha sucção" value={equipment.linhaSucao} />
                <Field label="Linha descarga" value={equipment.linhaDescarga} />
                <Field label="Linha líquido" value={equipment.linhaLiquido} />
                <Field label="Água condensada" value={fmt(equipment.quantidadeAguaLH, "L/h")} />
                <Field label="Ø dreno" value={equipment.diametroDreno} />
              </Section>

              <Section title="Parâmetros térmicos">
                <Field label="Superaquecimento total" value={fmt(equipment.superaquecimentoTotalK, "K")} />
                <Field label="Superaquecimento útil" value={fmt(equipment.superaquecimentoUtilK, "K")} />
                <Field label="Subresfriamento" value={fmt(equipment.subresfriamentoK, "K")} />
                <Field label="Altitude" value={fmt(equipment.altitudeM, "m", 0)} />
              </Section>

              <section className="rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowRaw((v) => !v)}
                  className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Dados brutos (raw)
                  {showRaw ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {showRaw && (
                  <pre className="max-h-72 overflow-auto border-t border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-700">
                    {JSON.stringify(equipment.raw ?? {}, null, 2)}
                  </pre>
                )}
              </section>
            </div>
          )}

          {tab === "validation" && (
            <div className="space-y-5">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium ${VALIDATION_STYLE[effectiveValidation]}`}
                  >
                    <ValidationIcon className="h-4 w-4" />
                    {VALIDATION_LABEL[effectiveValidation]}
                  </span>
                  <span className="text-xs text-slate-600">
                    Revisão atual: <strong>{effectiveRevisionNumber}</strong> ·{" "}
                    {REVISION_LABEL[effectiveRevisionStatus]}
                  </span>
                </div>
                <dl className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                  <div>
                    <dt className="text-slate-500">Última revisão em</dt>
                    <dd className="text-slate-800">
                      {lastReviewedAt
                        ? new Date(lastReviewedAt).toLocaleString("pt-BR")
                        : NA}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Revisado por</dt>
                    <dd className="text-slate-800">{lastReviewedBy ?? NA}</dd>
                  </div>
                </dl>
                {validationNotes && validationNotes.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-slate-700">Notas</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-slate-600">
                      {validationNotes.map((n, i) => (
                        <li key={i}>{n}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleMarkAnalyzed}
                  className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
                >
                  <AlertCircle className="h-3.5 w-3.5" />
                  Marcar como analisado
                </button>
                <button
                  type="button"
                  onClick={handleMarkValidated}
                  className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Marcar como validado
                </button>
              </div>

              <div className="rounded-lg border border-slate-200 p-4">
                <p className="text-xs font-medium text-slate-700">Gerar revisão manual</p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Cria uma entrada no histórico com snapshot atual do equipamento.
                </p>
                <textarea
                  value={manualNote}
                  onChange={(e) => setManualNote(e.target.value)}
                  rows={3}
                  placeholder="Notas sobre esta revisão (opcional)"
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-xs focus:border-[#1E6FD9] focus:outline-none focus:ring-1 focus:ring-[#1E6FD9]"
                />
                <button
                  type="button"
                  onClick={handleManualRevision}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-[#1E6FD9] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1759b3]"
                >
                  <FilePlus2 className="h-3.5 w-3.5" />
                  Gerar revisão manual
                </button>
              </div>
            </div>
          )}

          {tab === "history" && (
            <div className="space-y-3">
              {revisions.length === 0 && (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                  Nenhuma revisão registrada ainda.
                </div>
              )}
              {revisions.length > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-600">
                      {revisions.length} revisão{revisions.length === 1 ? "" : "ões"} registrada{revisions.length === 1 ? "" : "s"}
                    </p>
                    <button
                      type="button"
                      onClick={() => clearRevisions(equipment.id)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Limpar histórico
                    </button>
                  </div>
                  <ul className="space-y-2">
                    {revisions.map((r) => (
                      <li
                        key={r.revisionId}
                        className="rounded-lg border border-slate-200 bg-white p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-mono text-slate-700">
                              Rev. {r.revisionNumber}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                r.source === "simulation"
                                  ? "bg-blue-50 text-blue-800"
                                  : r.source === "manual_review"
                                    ? "bg-purple-50 text-purple-800"
                                    : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {r.source === "simulation"
                                ? "Simulação"
                                : r.source === "manual_review"
                                  ? "Revisão manual"
                                  : "Importação"}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-500">
                            {new Date(r.createdAt).toLocaleString("pt-BR")}
                          </span>
                        </div>
                        {r.createdBy && (
                          <p className="mt-1 text-[11px] text-slate-500">
                            Por: {r.createdBy}
                          </p>
                        )}
                        {r.notes && (
                          <p className="mt-1 text-xs text-slate-700">{r.notes}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-b-2 px-1 py-3 text-sm font-medium transition ${
        active
          ? "border-[#1E6FD9] text-[#1E6FD9]"
          : "border-transparent text-slate-600 hover:text-slate-900"
      }`}
    >
      {children}
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h3>
      <dl className="grid grid-cols-1 gap-x-4 gap-y-2 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-3">
        {children}
      </dl>
    </section>
  );
}

function Field({ label, value }: { label: string; value: unknown }) {
  const display =
    value === undefined || value === null || value === ""
      ? NA
      : typeof value === "number"
        ? value.toLocaleString("pt-BR", { maximumFractionDigits: 4 })
        : String(value);
  const isMissing = display === NA;
  return (
    <div className="min-w-0">
      <dt className="truncate text-[11px] uppercase tracking-wide text-slate-500">{label}</dt>
      <dd
        className={`mt-0.5 truncate text-sm ${isMissing ? "text-slate-400 italic" : "text-slate-900"}`}
        title={display}
      >
        {display}
      </dd>
    </div>
  );
}
