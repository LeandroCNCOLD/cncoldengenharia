import { useEffect, useMemo, useState } from "react";
import { useCnCoilsSimulationStore } from "../store/useCnCoilsSimulationStore";
import {
  validateAirSideInputs,
  type PsychrometricValidationResult,
} from "../services/psychrometrics";
import type { CnCoilsSimulationResult } from "../types/cncoils.types";
import { UnitSelect } from "./UnitSelect";
import {
  AIRFLOW_UNITS,
  CAPACITY_UNITS,
  PRESSURE_UNITS,
  TEMP_UNITS,
  VELOCITY_UNITS,
  airFlowConv,
  capacityConv,
  pressureConv,
  tempConv,
  velocityConv,
  type AirFlowUnit,
  type CapacityUnit,
  type PressureUnit,
  type TempUnit,
  type VelocityUnit,
  fmtBR,
} from "../utils/unitConversions";

interface AirSidePanelProps {
  result?: CnCoilsSimulationResult;
}

function fmt(n: number | undefined, digits = 1): string {
  if (n === undefined || !Number.isFinite(n)) return "---";
  return fmtBR(n, digits).replace("—", "---");
}

import {
  loadCnCoilsCoefficients,
  listUsableAxialFans,
  evaluateFanCurve,
  type AxialFanRecord,
  type FanFunction,
} from "../services/cncoilsCoefficientsService";
import { findFanOperatingPointSimple } from "../engine/cycle/fanOperatingPoint";
import { FanPickerModal } from "./FanPickerModal";
import { ChevronDown, X } from "lucide-react";

interface FanCatalogItem {
  id: string;
  manufacturer?: string;
  model?: string;
  airflow_m3h?: number;
  family?:
    | "axial"
    | "centrifugal_forward"
    | "centrifugal_backward"
    | "centrifugal_radial"
    | "mixed_flow"
    | "tangential"
    | "ec_plug"
    | "unknown";
  /** Tipo: axial ou centrifugal */
  fanCategory?: "axial" | "centrifugal";
  /** Função: soprador, exaustor, livre, universal */
  fanFunction?: FanFunction;
  series?: string;
  seriesDescription?: string;
  diameter_mm?: number;
  rpm?: number;
  motor_power_w?: number;
  motor_current_a?: number;
  frequency_hz?: number;
  voltage_v?: number;
  /** Reference to the original axial record (used for curve evaluation). */
  axial?: AxialFanRecord;
}

export function AirSidePanel({ result }: AirSidePanelProps = {}) {
  const airFlow_m3h = useCnCoilsSimulationStore((s) => s.airFlow_m3h);
  const tempInDB_C = useCnCoilsSimulationStore((s) => s.tempInDB_C);
  const rhIn_pct = useCnCoilsSimulationStore((s) => s.rhIn_pct);
  const foulingFactorAir = useCnCoilsSimulationStore((s) => s.foulingFactorAir);
  const selectedFanId = useCnCoilsSimulationStore((s) => s.selectedFanId);
  const fanCount = useCnCoilsSimulationStore((s) => s.fanCount);
  const fanRole = useCnCoilsSimulationStore((s) => s.fanRole);
  const calcMode = useCnCoilsSimulationStore((s) => s.calcMode);
  const targetCapacityW = useCnCoilsSimulationStore((s) => s.targetCapacityW);
  const setAirFlow = useCnCoilsSimulationStore((s) => s.setAirFlow);
  const setTempInDB = useCnCoilsSimulationStore((s) => s.setTempInDB);
  const setRhIn = useCnCoilsSimulationStore((s) => s.setRhIn);
  const setFoulingFactorAir = useCnCoilsSimulationStore((s) => s.setFoulingFactorAir);
  const errorFactorPercent = useCnCoilsSimulationStore((s) => s.errorFactorPercent);
  const setErrorFactorPercent = useCnCoilsSimulationStore((s) => s.setErrorFactorPercent);
  const setTargetCapacityW = useCnCoilsSimulationStore((s) => s.setTargetCapacityW);
  const setSelectedFan = useCnCoilsSimulationStore((s) => s.setSelectedFan);
  const [fanModalOpen, setFanModalOpen] = useState(false);

  const [fans, setFans] = useState<FanCatalogItem[]>([]);

  // Unidades selecionadas por linha (estado local — não afeta o motor)
  // Unidades selecionadas por linha (estado local — não afeta o motor)
  const [uCapTotal, setUCapTotal] = useState<CapacityUnit>("kcal_h");
  const [uCapSens, setUCapSens] = useState<CapacityUnit>("kcal_h");
  const [uCapLat, setUCapLat] = useState<CapacityUnit>("kcal_h");
  const [uAirFlow, setUAirFlow] = useState<AirFlowUnit>("m3_h");
  const [uVel, setUVel] = useState<VelocityUnit>("m_s");
  const [uTempIn, setUTempIn] = useState<TempUnit>("C");
  const [uTempOut, setUTempOut] = useState<TempUnit>("C");
  const [uPdrop, setUPdrop] = useState<PressureUnit>("Pa");

  useEffect(() => {
    let cancelled = false;
    loadCnCoilsCoefficients()
      .then((bundle) => {
        if (cancelled) return;
        const usable = listUsableAxialFans(bundle);
        // representative airflow for the dropdown = midpoint of [Xmin, Xmax]
        const list: FanCatalogItem[] = usable.map((fan) => {
          const mid =
            fan.xMin > 0 && fan.xMax > fan.xMin
              ? (fan.xMin + fan.xMax) / 2
              : fan.xMax > 0
                ? fan.xMax
                : fan.xMin;
          return {
            id: `axial-${fan.fanType}-${fan.idFanModel}-${fan.source}`,
            manufacturer: fan.manufacturer ?? (fan.fanType === 0 ? "Axial T0" : "Axial T1"),
            model: fan.model,
            airflow_m3h: Number.isFinite(mid) && mid > 0 ? mid : undefined,
            family: "axial" as const,
            fanCategory: (fan.fanCategory ?? "axial") as "axial" | "centrifugal",
            fanFunction: fan.function as FanFunction | undefined,
            series: fan.series,
            seriesDescription: fan.seriesDescription,
            rpm: fan.rpm,
            motor_power_w: fan.powerW,
            motor_current_a: fan.currentA,
            frequency_hz: fan.frequency,
            voltage_v: fan.voltage,
            axial: fan,
          };
        });
        setFans(
          list.filter(
            (f) => typeof f.airflow_m3h === "number" && (f.airflow_m3h as number) > 0,
          ),
        );
      })
      .catch(() => {
        if (!cancelled) setFans([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const validation: PsychrometricValidationResult = validateAirSideInputs({
    tempInDB_C,
    rhIn_pct,
    foulingFactorAir,
  });

  // (Seleção de ventilador agora é feita via FanPickerModal — abaixo)

  // Static pressure at current airflow for the selected axial fan (Pa)
  const selectedFan = fans.find((f) => f.id === selectedFanId);
  const fanStaticPressurePa = useMemo(() => {
    const fromCurve =
      selectedFan?.axial && airFlow_m3h > 0
        ? evaluateFanCurve(selectedFan.axial, airFlow_m3h)
        : null;
    return fromCurve ?? result?.airPressureDropPa ?? null;
  }, [selectedFan, airFlow_m3h, result?.airPressureDropPa]);
  const operatingPoint = useMemo(() => {
    if (!selectedFan?.axial || !(fanCount > 0) || !(airFlow_m3h > 0)) return null;
    const knownPressurePa = result?.airPressureDropPa ?? fanStaticPressurePa;
    if (!(knownPressurePa && knownPressurePa > 0)) return null;
    return findFanOperatingPointSimple(
      selectedFan.axial,
      fanCount,
      airFlow_m3h,
      knownPressurePa,
    );
  }, [selectedFan, fanCount, airFlow_m3h, result?.airPressureDropPa, fanStaticPressurePa]);
  const operatingPointLabel = operatingPoint
    ? `Q=${fmtBR(operatingPoint.airFlowM3H, 0)} m³/h | ΔP=${fmtBR(operatingPoint.staticPressurePa, 0)} Pa`
    : "---";

  // ---- valores convertidos para a unidade exibida ----
  const airSafetyFactor = 1 + (Number.isFinite(errorFactorPercent) ? errorFactorPercent : 0) / 100;
  const totalCapW = result?.totalCapacityKw !== undefined ? result.totalCapacityKw * 1000 * airSafetyFactor : undefined;
  const sensCapW = result?.sensibleCapacityKw !== undefined ? result.sensibleCapacityKw * 1000 * airSafetyFactor : undefined;
  const latCapW = result?.latentCapacityKw !== undefined ? result.latentCapacityKw * 1000 * airSafetyFactor : undefined;
  const displayedAirPressureDropPa = result?.airPressureDropPa !== undefined
    ? result.airPressureDropPa * airSafetyFactor
    : undefined;
  const displayedFanStaticPressurePa = fanStaticPressurePa !== null && fanStaticPressurePa !== undefined
    ? fanStaticPressurePa * airSafetyFactor
    : undefined;

  const obtCapTotal = useMemo(
    () => (totalCapW === undefined ? "---" : fmtBR(capacityConv.fromCanonical(totalCapW, uCapTotal), uCapTotal === "TR" || uCapTotal === "kW" ? 3 : 1)),
    [totalCapW, uCapTotal],
  );
  const obtCapSens = useMemo(
    () => (sensCapW === undefined ? "---" : fmtBR(capacityConv.fromCanonical(sensCapW, uCapSens), uCapSens === "TR" || uCapSens === "kW" ? 3 : 1)),
    [sensCapW, uCapSens],
  );
  const obtCapLat = useMemo(
    () => (latCapW === undefined ? "---" : fmtBR(capacityConv.fromCanonical(latCapW, uCapLat), uCapLat === "TR" || uCapLat === "kW" ? 3 : 1)),
    [latCapW, uCapLat],
  );
  const obtAirFlow =
    airFlow_m3h > 0 ? fmtBR(airFlowConv.fromCanonical(airFlow_m3h, uAirFlow), 1) : "---";
  const obtVel =
    result?.faceVelocityMs !== undefined
      ? fmtBR(velocityConv.fromCanonical(result.faceVelocityMs, uVel), 2)
      : "---";
  const obtTempIn = fmtBR(tempConv.fromCanonical(tempInDB_C, uTempIn), 1);
  const obtTempOut =
    result?.airOutletTempC !== undefined
      ? fmtBR(tempConv.fromCanonical(result.airOutletTempC, uTempOut), 1)
      : "---";
  const obtPdrop =
    displayedAirPressureDropPa !== undefined
      ? fmtBR(pressureConv.fromCanonical(displayedAirPressureDropPa, uPdrop), uPdrop === "Pa" ? 0 : 3)
      : "---";

  // Capacidade alvo (modo Desenho) — input editável na unidade selecionada
  const targetCapInUnit = useMemo(
    () =>
      targetCapacityW > 0
        ? capacityConv.fromCanonical(targetCapacityW, uCapTotal)
        : 0,
    [targetCapacityW, uCapTotal],
  );

  const isDesign = calcMode === "design";

  return (
    <div className="rounded border border-slate-300 bg-slate-50 shadow-sm">
      <div className="grid grid-cols-[1fr_88px] border-b border-slate-300 bg-[#1E6FD9] text-white">
        <div className="px-3 py-1.5 text-center text-xs font-bold uppercase tracking-wider">
          Lado Ventilação {isDesign && <span className="ml-2 rounded bg-amber-400 px-1.5 py-0.5 text-[9px] text-amber-900">DESENHO</span>}
        </div>
        <div className="border-l border-white/30 px-2 py-1.5 text-center text-xs font-bold">
          Obt.
        </div>
      </div>

      <div className="space-y-1.5 p-2">
        {/* CAPACIDADE TOTAL — input em modo Desenho, output em Verificar */}
        <Row
          label="Capacidade Total"
          unitNode={<UnitSelect value={uCapTotal} onChange={(u) => { setUCapTotal(u); setUCapSens(u); setUCapLat(u); }} options={CAPACITY_UNITS} />}
          input={
            isDesign ? (
              <NumberCell
                value={targetCapInUnit}
                onChange={(v) => setTargetCapacityW(capacityConv.toCanonical(v, uCapTotal))}
                min={0}
              />
            ) : (
              <DisabledInput />
            )
          }
          obtained={obtCapTotal}
        />
        <Row
          label="Capacidade Sensível"
          unitNode={<UnitSelect value={uCapSens} onChange={setUCapSens} options={CAPACITY_UNITS} />}
          input={<DisabledInput />}
          obtained={obtCapSens}
        />
        <Row
          label="Capacidade Latente"
          unitNode={<UnitSelect value={uCapLat} onChange={setUCapLat} options={CAPACITY_UNITS} />}
          input={<DisabledInput />}
          obtained={obtCapLat}
        />

        {/* VENTILADOR (catálogo opcional) */}
        <Row
          label="Ventilador"
          unitNode={<UnitText text={fanCount > 0 ? `×${fanCount}` : "—"} />}
          input={
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setFanModalOpen(true)}
                disabled={fans.length === 0}
                className="flex flex-1 items-center justify-between rounded border border-slate-300 bg-white px-1.5 py-0.5 text-left text-[10px] text-slate-900 hover:border-[#1E6FD9] focus:border-[#1E6FD9] focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                title={
                  fans.length === 0
                    ? "Catálogo de ventiladores não disponível — preencha a vazão manualmente abaixo"
                    : selectedFan
                      ? "Trocar ventilador"
                      : "Selecionar ventilador (ou preencha a vazão manualmente abaixo)"
                }
              >
                <span className="truncate">
                  {fans.length === 0
                    ? "— sem catálogo —"
                    : selectedFan
                      ? `${[selectedFan.manufacturer, selectedFan.model].filter(Boolean).join(" ")} (${fanRole === "blower" ? "soprador" : "exaustor"})`
                      : "Manual / Selecionar…"}
                </span>
                <ChevronDown className="h-3 w-3 flex-shrink-0 text-slate-400" />
              </button>
              {selectedFan && (
                <button
                  type="button"
                  onClick={() => setSelectedFan(undefined)}
                  className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border border-slate-300 bg-white text-slate-500 hover:border-red-400 hover:text-red-600"
                  title="Remover ventilador (voltar a entrada manual)"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          }
          obtained={
            selectedFan?.airflow_m3h
              ? `${fmtBR(selectedFan.airflow_m3h * fanCount, 0)} m³/h`
              : "---"
          }
        />
        <FanPickerModal
          open={fanModalOpen}
          onClose={() => setFanModalOpen(false)}
          fans={fans}
        />


        {/* VAZÃO DE AR — sempre editável */}
        <Row
          label="Vazão de Ar"
          unitNode={<UnitSelect value={uAirFlow} onChange={setUAirFlow} options={AIRFLOW_UNITS} />}
          input={
            <NumberCell
              value={airFlowConv.fromCanonical(airFlow_m3h, uAirFlow)}
              onChange={(v) => setAirFlow(airFlowConv.toCanonical(v, uAirFlow))}
              min={0}
            />
          }
          obtained={obtAirFlow}
        />

        {/* VELOCIDADE FRONTAL — exibida (calculada pelo motor a partir da vazão) */}
        <Row
          label="Velocidade Frontal"
          unitNode={<UnitSelect value={uVel} onChange={setUVel} options={VELOCITY_UNITS} />}
          input={<DisabledInput />}
          obtained={obtVel}
        />

        <Row
          label="Pressão estática (ventilador)"
          unitNode={<UnitSelect value={uPdrop} onChange={setUPdrop} options={PRESSURE_UNITS} />}
          input={<DisabledInput />}
          obtained={
            displayedFanStaticPressurePa === null || displayedFanStaticPressurePa === undefined
              ? "---"
              : pressureConv
                  .fromCanonical(displayedFanStaticPressurePa, uPdrop)
                  .toLocaleString("pt-BR", { minimumFractionDigits: uPdrop === "Pa" ? 0 : 3, maximumFractionDigits: uPdrop === "Pa" ? 0 : 3 })
          }
        />

        <Row
          label="Ponto de operação real"
          unitNode={<UnitText text="Q×P" />}
          input={<DisabledInput />}
          obtained={operatingPointLabel}
        />
        {operatingPoint && (
          <div className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] text-blue-800">
            Diferença da seleção:{" "}
            {fmtBR(((operatingPoint.airFlowM3H - airFlow_m3h) / airFlow_m3h) * 100, 1)}
            % na vazão
          </div>
        )}

        {/* TEMP / RH ENTRADA */}
        <Row
          label="Temperatura de Entrada DB"
          unitNode={<UnitSelect value={uTempIn} onChange={setUTempIn} options={TEMP_UNITS} />}
          input={
            <NumberCell
              value={tempConv.fromCanonical(tempInDB_C, uTempIn)}
              onChange={(v) => setTempInDB(tempConv.toCanonical(v, uTempIn))}
            />
          }
          obtained={obtTempIn}
        />
        <Row
          label="Umidade Relativa de Entrada"
          unitNode={<UnitText text="%" />}
          input={<NumberCell value={rhIn_pct} onChange={setRhIn} min={0} max={100} />}
          obtained={fmt(rhIn_pct, 1)}
        />

        {/* TEMP / RH SAÍDA */}
        <Row
          label="Temperatura de Saída DB"
          unitNode={<UnitSelect value={uTempOut} onChange={setUTempOut} options={TEMP_UNITS} />}
          input={<DisabledInput />}
          obtained={obtTempOut}
        />
        <Row
          label="Umidade Relativa de Saída"
          unitNode={<UnitText text="%" />}
          input={<DisabledInput />}
          obtained={fmt(result?.airOutletRhPercent, 1)}
        />

        <Row
          label="Fator de Segurança"
          unitNode={<UnitText text="%" />}
          input={
            <NumberCell
              value={errorFactorPercent}
              onChange={setErrorFactorPercent}
              step={0.1}
              placeholder="0 (sem margem)"
            />
          }
          obtained="0%=sem margem | 10%=+10%"
        />

        <Row
          label="Queda de Pressão"
          unitNode={<UnitSelect value={uPdrop} onChange={setUPdrop} options={PRESSURE_UNITS} />}
          input={<DisabledInput />}
          obtained={obtPdrop}
        />
      </div>

      {!validation.valid && (
        <ul className="mx-2 mb-2 space-y-0.5 rounded border border-amber-300 bg-amber-50 p-2 text-[11px] text-amber-800">
          {validation.errors.map((e) => (
            <li key={e}>• {e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Row({
  label,
  unitNode,
  input,
  obtained,
}: {
  label: string;
  unitNode: React.ReactNode;
  input: React.ReactNode;
  obtained: string;
}) {
  const isEmpty = obtained === "---" || obtained === "";
  return (
    <div className="grid grid-cols-[minmax(96px,1fr)_60px_minmax(50px,1fr)_68px] sm:grid-cols-[140px_68px_1fr_74px] items-center gap-1">
      <label className="truncate text-[10px] font-medium text-slate-700" title={label}>
        {label}
      </label>
      <div>{unitNode}</div>
      <div>{input}</div>
      <div
        className={`rounded border border-emerald-300 bg-emerald-100 px-1.5 py-0.5 text-right font-mono text-[10px] ${
          isEmpty ? "text-emerald-700/60" : "text-emerald-900 font-semibold"
        }`}
      >
        {obtained}
      </div>
    </div>
  );
}

function UnitText({ text }: { text: string }) {
  return (
    <div className="rounded border border-slate-300 bg-white px-1 py-0.5 text-center text-[10px] text-slate-600">
      {text}
    </div>
  );
}

function NumberCell({
  value,
  onChange,
  min,
  max,
  step,
  placeholder,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
}) {
  return (
    <input
      type="number"
      value={Number.isFinite(value) ? value : 0}
      min={min}
      max={max}
      step={step ?? "any"}
      placeholder={placeholder}
      onChange={(e) => {
        const n = parseFloat(e.target.value);
        onChange(Number.isFinite(n) ? n : 0);
      }}
      className="w-full rounded border border-slate-300 bg-white px-1.5 py-0.5 text-right text-[10px] text-slate-900 focus:border-[#1E6FD9] focus:outline-none focus:ring-1 focus:ring-[#1E6FD9]"
    />
  );
}

function DisabledInput() {
  return (
    <input
      type="text"
      value=""
      disabled
      className="w-full cursor-not-allowed rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px]"
    />
  );
}
