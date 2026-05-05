/**
 * AirSidePanel — Coluna central "LADO VENTILAÇÃO"
 *
 * Layout de tabela com cabeçalho azul, campos de entrada e resultados
 * lado a lado, conforme o layout ColdPro de referência.
 */
import { useEffect, useMemo, useState } from "react";
import { useCnCoilsSimulationStore } from "../store/useCnCoilsSimulationStore";
import {
  getAxialFans,
  getCentrifugalFans,
} from "../services/unilabCoefficientsService";
import type {
  AxialFanCoefficient,
  CentrifugalFanCoefficient,
} from "../types/unilabCoefficients.types";
import type { CnCoilsSimulationResult } from "../types/cncoils.types";
import { FanPickerModal, type FanPickerItem } from "./FanPickerModal";


// ─── tipos de ventilador ─────────────────────────────────────────────────────
type FanOption =
  | { type: "axial"; fan: AxialFanCoefficient }
  | { type: "centrifugal"; fan: CentrifugalFanCoefficient };

function airflowRange(option: FanOption) {
  return option.type === "axial"
    ? option.fan.airflowRange_m3h
    : option.fan.capacityRange_m3h;
}
function nominalAirflow(option: FanOption): number {
  const range = airflowRange(option);
  if (option.type === "axial") return (range.min + range.max) / 2;
  return range.max;
}

// ─── tipos de unidade ────────────────────────────────────────────────────────
type AirFlowUnit = "m3h" | "m3s" | "cfm";
type VelocityUnit = "m_s" | "ft_min";
type PressureUnit = "Pa" | "mmH2O" | "inH2O";
type TempUnit = "C" | "F";
type CapacityUnit = "kcal_h" | "kW" | "TR" | "BTU_h";

const AIR_FLOW_OPTS: { id: AirFlowUnit; label: string }[] = [
  { id: "m3h", label: "m³/h" },
  { id: "m3s", label: "m³/s" },
  { id: "cfm", label: "CFM" },
];
const VEL_OPTS: { id: VelocityUnit; label: string }[] = [
  { id: "m_s", label: "m/s" },
  { id: "ft_min", label: "ft/min" },
];
const PRESS_OPTS: { id: PressureUnit; label: string }[] = [
  { id: "Pa", label: "Pa" },
  { id: "mmH2O", label: "mmH₂O" },
  { id: "inH2O", label: "inH₂O" },
];
const TEMP_OPTS: { id: TempUnit; label: string }[] = [
  { id: "C", label: "°C" },
  { id: "F", label: "°F" },
];
const CAP_OPTS: { id: CapacityUnit; label: string }[] = [
  { id: "kcal_h", label: "kcal/h" },
  { id: "kW", label: "kW" },
  { id: "TR", label: "TR" },
  { id: "BTU_h", label: "BTU/h" },
];

// ─── conversões ──────────────────────────────────────────────────────────────
function toAirFlow(m3h: number, u: AirFlowUnit) {
  if (u === "m3s") return m3h / 3600;
  if (u === "cfm") return m3h * 0.5886;
  return m3h;
}
function fromAirFlow(v: number, u: AirFlowUnit) {
  if (u === "m3s") return v * 3600;
  if (u === "cfm") return v / 0.5886;
  return v;
}
function toVel(ms: number, u: VelocityUnit) {
  return u === "ft_min" ? ms * 196.85 : ms;
}
function toPress(pa: number, u: PressureUnit) {
  if (u === "mmH2O") return pa * 0.10197;
  if (u === "inH2O") return pa * 0.00401;
  return pa;
}
function toTemp(c: number, u: TempUnit) {
  return u === "F" ? (c * 9) / 5 + 32 : c;
}
function fromTemp(v: number, u: TempUnit) {
  return u === "F" ? ((v - 32) * 5) / 9 : v;
}
function toCap(kw: number, u: CapacityUnit) {
  if (u === "kcal_h") return kw * 860;
  if (u === "TR") return kw / 3.517;
  if (u === "BTU_h") return kw * 3412.14;
  return kw;
}
function capDigits(u: CapacityUnit) {
  return u === "kW" || u === "TR" ? 2 : 0;
}

// ─── helpers de formatação ───────────────────────────────────────────────────
function fmt(v: number | undefined, digits = 1): string {
  if (v === undefined || !Number.isFinite(v)) return "---";
  return v.toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

// ─── sub-componentes ─────────────────────────────────────────────────────────
function UnitSel<T extends string>({
  value,
  onChange,
  options,
  disabled,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: string }[];
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as T)}
      className="w-full rounded border border-slate-300 bg-white px-0.5 py-0.5 text-[10px] text-slate-700 focus:border-[#1E6FD9] focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
    >
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Célula de resultado (verde quando tem valor) */
function ResultCell({
  value,
  highlight = false,
}: {
  value: string;
  highlight?: boolean;
}) {
  const hasValue = value !== "---";
  return (
    <div
      className={`min-w-[60px] rounded border px-1.5 py-0.5 text-right text-[10px] font-medium ${
        hasValue && highlight
          ? "border-emerald-400 bg-emerald-50 text-emerald-900"
          : hasValue
            ? "border-emerald-300 bg-emerald-50/60 text-emerald-800"
            : "border-slate-200 bg-slate-50 text-slate-400"
      }`}
    >
      {value}
    </div>
  );
}

/** Célula de entrada numérica */
function InputCell({
  value,
  onChange,
  disabled,
  placeholder,
  step = "any",
  min,
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  placeholder?: string;
  step?: string | number;
  min?: number;
  max?: number;
}) {
  return (
    <input
      type="number"
      value={Number.isFinite(value) ? value : ""}
      step={step}
      min={min}
      max={max}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => {
        const n = parseFloat(e.target.value);
        if (Number.isFinite(n)) onChange(n);
      }}
      className="w-full min-w-0 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-right text-[10px] text-slate-900 focus:border-[#1E6FD9] focus:outline-none focus:ring-1 focus:ring-[#1E6FD9] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
    />
  );
}

/** Linha da tabela */
function Row({
  label,
  unit,
  input,
  result,
}: {
  label: string;
  unit?: React.ReactNode;
  input?: React.ReactNode;
  result?: React.ReactNode;
}) {
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="py-0.5 pr-1 text-[10px] text-slate-700 whitespace-nowrap">{label}</td>
      <td className="w-[70px] py-0.5 px-0.5">{unit}</td>
      <td className="py-0.5 pl-0.5">{input}</td>
      <td className="w-[72px] py-0.5 pl-1">{result}</td>
    </tr>
  );
}

// ─── componente principal ────────────────────────────────────────────────────
interface AirSidePanelProps {
  result?: CnCoilsSimulationResult | null;
  disabled?: boolean;
  /** Callback para abrir o modal de seleção de ventilador */
  onFanPickerOpen?: () => void;
}

export function AirSidePanel({ result, disabled, onFanPickerOpen }: AirSidePanelProps) {
  const thermo = useCnCoilsSimulationStore((s) => s.thermoInputs);
  const setThermo = useCnCoilsSimulationStore((s) => s.setThermoInputs);
  const errorFactorPercent = useCnCoilsSimulationStore((s) => s.errorFactorPercent);
  const setErrorFactorPercent = useCnCoilsSimulationStore(
    (s) => s.setErrorFactorPercent,
  );

  // biblioteca de ventiladores
  const [fans, setFans] = useState<FanOption[]>([]);
  const [loadingFans, setLoadingFans] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingFans(true);
    Promise.all([getAxialFans(), getCentrifugalFans()])
      .then(([axial, centrifugal]) => {
        if (cancelled) return;
        setFans([
          ...axial.map((fan) => ({ type: "axial" as const, fan })),
          ...centrifugal.map((fan) => ({ type: "centrifugal" as const, fan })),
        ]);
      })
      .catch(() => {
        /* silencioso — ventilador não é obrigatório */
      })
      .finally(() => {
        if (!cancelled) setLoadingFans(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // unidades locais
  const [uCap, setUCap] = useState<CapacityUnit>("kcal_h");
  const [uFlow, setUFlow] = useState<AirFlowUnit>("m3h");
  const [uVel, setUVel] = useState<VelocityUnit>("m_s");
  const [uPress, setUPress] = useState<PressureUnit>("Pa");
  const [uTempIn, setUTempIn] = useState<TempUnit>("C");
  const [uTempOut, setUTempOut] = useState<TempUnit>("C");

  // valores de entrada convertidos para exibição
  const airFlowDisplay = useMemo(
    () =>
      Number.isFinite(thermo.airFlowM3H) ? toAirFlow(thermo.airFlowM3H ?? 0, uFlow) : 0,
    [thermo.airFlowM3H, uFlow],
  );
  const airTempDisplay = useMemo(
    () => toTemp(thermo.airInletTempC ?? 25, uTempIn),
    [thermo.airInletTempC, uTempIn],
  );

  // ventilador selecionado
  const selectedFan = useMemo(
    () => fans.find((o) => o.fan.id === thermo.selectedFanId),
    [fans, thermo.selectedFanId],
  );
  const fanLabel = selectedFan
    ? `${selectedFan.fan.model} · ${selectedFan.type === "axial" ? "axial" : "centrífugo"}`
    : "Manual / Selecionar…";

  // valores de resultado
  const totalKw = result?.totalCapacityKw;
  const sensibleKw = result?.sensibleCapacityKw;
  const latentKw = result?.latentCapacityKw;
  const airPressDropPa = result?.airPressureDropPa;
  const airOutTempC = result?.airOutletTempC;
  const airOutRh = result?.airOutletRhPercent;
  const faceVelMs = result?.faceVelocityMs;
  const fanEval = result?.fanEvaluation;

  const fmtCap = (kw: number | undefined) =>
    kw !== undefined && Number.isFinite(kw)
      ? fmt(toCap(kw, uCap), capDigits(uCap))
      : "---";

  const fmtPress = (pa: number | undefined) =>
    pa !== undefined && Number.isFinite(pa)
      ? fmt(toPress(pa, uPress), uPress === "Pa" ? 0 : 2)
      : "---";

  const fmtVel = (ms: number | undefined) =>
    ms !== undefined && Number.isFinite(ms) ? fmt(toVel(ms, uVel), 2) : "---";

  const fmtTempOut = (c: number | undefined) =>
    c !== undefined && Number.isFinite(c) ? fmt(toTemp(c, uTempOut), 1) : "---";

  // Ponto de operação real (Q / P)
  const opPoint = useMemo(() => {
    if (!fanEval || fanEval.method === "unavailable") return "---";
    const q = fmt(toAirFlow(fanEval.airflow_m3h, uFlow), 0);
    const p =
      fanEval.pressure_Pa !== null
        ? fmt(toPress(fanEval.pressure_Pa, uPress), 0)
        : "---";
    return `${q} / ${p}`;
  }, [fanEval, uFlow, uPress]);

  return (
    <div className="flex flex-col rounded border border-slate-300 bg-slate-50 shadow-sm overflow-hidden">
      {/* Cabeçalho azul */}
      <div className="flex items-center justify-between border-b border-slate-300 bg-[#1E6FD9] px-3 py-1.5">
        <span className="text-xs font-bold uppercase tracking-wider text-white">
          Lado Ventilação
        </span>
        <span className="text-[10px] font-semibold text-white/80 uppercase tracking-wide">
          Obt.
        </span>
      </div>

      {/* Tabela de campos */}
      <div className="overflow-x-auto p-1">
        <table className="w-full border-collapse">
          <colgroup>
            <col style={{ width: "160px" }} />
            <col style={{ width: "70px" }} />
            <col />
            <col style={{ width: "72px" }} />
          </colgroup>
          <tbody>
            {/* Capacidade Total */}
            <Row
              label="Capacidade Total"
              unit={
                <UnitSel
                  value={uCap}
                  onChange={setUCap}
                  options={CAP_OPTS}
                  disabled={disabled}
                />
              }
              input={null}
              result={<ResultCell value={fmtCap(totalKw)} highlight />}
            />
            {/* Capacidade Sensível */}
            <Row
              label="Capacidade Sensível"
              unit={
                <UnitSel
                  value={uCap}
                  onChange={setUCap}
                  options={CAP_OPTS}
                  disabled={disabled}
                />
              }
              input={null}
              result={<ResultCell value={fmtCap(sensibleKw)} highlight />}
            />
            {/* Capacidade Latente */}
            <Row
              label="Capacidade Latente"
              unit={
                <UnitSel
                  value={uCap}
                  onChange={setUCap}
                  options={CAP_OPTS}
                  disabled={disabled}
                />
              }
              input={null}
              result={<ResultCell value={fmtCap(latentKw)} highlight />}
            />
            {/* Ventilador */}
            <Row
              label="Ventilador"
              unit={
                <div className="rounded border border-slate-300 bg-white px-0.5 py-0.5 text-center text-[10px] text-slate-500">
                  ×1
                </div>
              }
              input={
                <button
                  type="button"
                  onClick={onFanPickerOpen}
                  disabled={disabled || !onFanPickerOpen}
                  className="w-full rounded border border-slate-300 bg-white px-1.5 py-0.5 text-left text-[10px] text-slate-500 truncate hover:border-blue-400 hover:text-blue-600 disabled:cursor-default disabled:opacity-70 transition-colors"
                >
                  {loadingFans ? "Carregando…" : fanLabel}
                </button>
              }
              result={<ResultCell value="---" />}
            />
            {/* Vazão de Ar */}
            <Row
              label="Vazão de Ar"
              unit={
                <UnitSel
                  value={uFlow}
                  onChange={setUFlow}
                  options={AIR_FLOW_OPTS}
                  disabled={disabled}
                />
              }
              input={
                <InputCell
                  value={airFlowDisplay}
                  onChange={(v) => setThermo({ airFlowM3H: fromAirFlow(v, uFlow) })}
                  disabled={disabled}
                  min={0}
                />
              }
              result={<ResultCell value={fmt(airFlowDisplay, 0)} />}
            />
            {/* Velocidade Frontal */}
            <Row
              label="Velocidade Frontal"
              unit={
                <UnitSel
                  value={uVel}
                  onChange={setUVel}
                  options={VEL_OPTS}
                  disabled={disabled}
                />
              }
              input={null}
              result={<ResultCell value={fmtVel(faceVelMs)} />}
            />
            {/* Pressão estática (ventilador) */}
            <Row
              label="Pressão estática (ventilador)"
              unit={
                <UnitSel
                  value={uPress}
                  onChange={setUPress}
                  options={PRESS_OPTS}
                  disabled={disabled}
                />
              }
              input={null}
              result={
                <ResultCell
                  value={
                    fanEval?.pressure_Pa !== null && fanEval?.pressure_Pa !== undefined
                      ? fmt(
                          toPress(fanEval.pressure_Pa, uPress),
                          uPress === "Pa" ? 0 : 2,
                        )
                      : "---"
                  }
                />
              }
            />
            {/* Ponto de operação real */}
            <Row
              label="Ponto de operação real"
              unit={
                <div className="rounded border border-slate-300 bg-white px-0.5 py-0.5 text-center text-[10px] text-slate-500">
                  Q+P
                </div>
              }
              input={null}
              result={<ResultCell value={opPoint} />}
            />
            {/* Temperatura de Entrada DB */}
            <Row
              label="Temperatura de Entrada DB"
              unit={
                <UnitSel
                  value={uTempIn}
                  onChange={setUTempIn}
                  options={TEMP_OPTS}
                  disabled={disabled}
                />
              }
              input={
                <InputCell
                  value={airTempDisplay}
                  onChange={(v) =>
                    setThermo({ airInletTempC: fromTemp(v, uTempIn) })
                  }
                  disabled={disabled}
                />
              }
              result={<ResultCell value={fmt(airTempDisplay, 1)} highlight />}
            />
            {/* Umidade Relativa de Entrada */}
            <Row
              label="Umidade Relativa de Entrada"
              unit={
                <div className="rounded border border-slate-300 bg-white px-0.5 py-0.5 text-center text-[10px] text-slate-500">
                  %
                </div>
              }
              input={
                <InputCell
                  value={thermo.airInletRhPercent ?? 60}
                  onChange={(v) =>
                    setThermo({
                      airInletRhPercent: Math.min(100, Math.max(0, v)),
                    })
                  }
                  disabled={disabled}
                  min={0}
                  max={100}
                />
              }
              result={
                <ResultCell
                  value={fmt(thermo.airInletRhPercent ?? 60, 1)}
                  highlight
                />
              }
            />
            {/* Temperatura de Saída DB */}
            <Row
              label="Temperatura de Saída DB"
              unit={
                <UnitSel
                  value={uTempOut}
                  onChange={setUTempOut}
                  options={TEMP_OPTS}
                  disabled={disabled}
                />
              }
              input={null}
              result={<ResultCell value={fmtTempOut(airOutTempC)} highlight />}
            />
            {/* Umidade Relativa de Saída */}
            <Row
              label="Umidade Relativa de Saída"
              unit={
                <div className="rounded border border-slate-300 bg-white px-0.5 py-0.5 text-center text-[10px] text-slate-500">
                  %
                </div>
              }
              input={null}
              result={
                <ResultCell
                  value={
                    airOutRh !== undefined && Number.isFinite(airOutRh)
                      ? fmt(airOutRh, 1)
                      : "---"
                  }
                />
              }
            />
            {/* Fator de Segurança */}
            <Row
              label="Fator de Segurança"
              unit={
                <div className="rounded border border-slate-300 bg-white px-0.5 py-0.5 text-center text-[10px] text-slate-500">
                  %
                </div>
              }
              input={
                <InputCell
                  value={errorFactorPercent}
                  onChange={setErrorFactorPercent}
                  disabled={disabled}
                  step={0.1}
                  placeholder="0"
                />
              }
              result={
                <ResultCell
                  value={
                    Number.isFinite(errorFactorPercent)
                      ? `${errorFactorPercent > 0 ? "+" : ""}${fmt(errorFactorPercent, 1)}%`
                      : "---"
                  }
                />
              }
            />
            {/* Queda de Pressão do Ar */}
            <Row
              label="Queda de Pressão"
              unit={
                <UnitSel
                  value={uPress}
                  onChange={setUPress}
                  options={PRESS_OPTS}
                  disabled={disabled}
                />
              }
              input={null}
              result={<ResultCell value={fmtPress(airPressDropPa)} highlight />}
            />
          </tbody>
        </table>
      </div>
    </div>
  );
}
