import { useEffect, useMemo, useState } from "react";
import { useUnilabSimulationStore } from "../store/useUnilabSimulationStore";
import {
  validateAirSideInputs,
  type PsychrometricValidationResult,
} from "../services/psychrometrics";
import type { UnilabSimulationResult } from "../types/unilab.types";
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
} from "../utils/unitConversions";

interface AirSidePanelProps {
  result?: UnilabSimulationResult;
}

function fmt(n: number | undefined, digits = 1): string {
  if (n === undefined || !Number.isFinite(n)) return "---";
  return n.toFixed(digits);
}

import {
  loadUnilabCoefficients,
  listUsableAxialFans,
  evaluateFanCurve,
  type AxialFanRecord,
} from "../services/unilabCoefficientsService";
import { FanPickerModal } from "./FanPickerModal";
import { ChevronDown } from "lucide-react";

interface FanCatalogItem {
  id: string;
  manufacturer?: string;
  model?: string;
  airflow_m3h?: number;
  /** Reference to the original axial record (used for curve evaluation). */
  axial?: AxialFanRecord;
}

export function AirSidePanel({ result }: AirSidePanelProps = {}) {
  const airFlow_m3h = useUnilabSimulationStore((s) => s.airFlow_m3h);
  const tempInDB_C = useUnilabSimulationStore((s) => s.tempInDB_C);
  const rhIn_pct = useUnilabSimulationStore((s) => s.rhIn_pct);
  const foulingFactorAir = useUnilabSimulationStore((s) => s.foulingFactorAir);
  const selectedFanId = useUnilabSimulationStore((s) => s.selectedFanId);
  const fanCount = useUnilabSimulationStore((s) => s.fanCount);
  const fanRole = useUnilabSimulationStore((s) => s.fanRole);
  const calcMode = useUnilabSimulationStore((s) => s.calcMode);
  const targetCapacityW = useUnilabSimulationStore((s) => s.targetCapacityW);
  const setAirFlow = useUnilabSimulationStore((s) => s.setAirFlow);
  const setTempInDB = useUnilabSimulationStore((s) => s.setTempInDB);
  const setRhIn = useUnilabSimulationStore((s) => s.setRhIn);
  const setFoulingFactorAir = useUnilabSimulationStore((s) => s.setFoulingFactorAir);
  const setTargetCapacityW = useUnilabSimulationStore((s) => s.setTargetCapacityW);
  const [fanModalOpen, setFanModalOpen] = useState(false);

  const [fans, setFans] = useState<FanCatalogItem[]>([]);

  // Unidades selecionadas por linha (estado local — não afeta o motor)
  const [uCapTotal, setUCapTotal] = useState<CapacityUnit>("W");
  const [uCapSens, setUCapSens] = useState<CapacityUnit>("W");
  const [uCapLat, setUCapLat] = useState<CapacityUnit>("W");
  const [uAirFlow, setUAirFlow] = useState<AirFlowUnit>("m3_h");
  const [uVel, setUVel] = useState<VelocityUnit>("m_s");
  const [uTempIn, setUTempIn] = useState<TempUnit>("C");
  const [uTempOut, setUTempOut] = useState<TempUnit>("C");
  const [uPdrop, setUPdrop] = useState<PressureUnit>("Pa");

  useEffect(() => {
    let cancelled = false;
    loadUnilabCoefficients()
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
            manufacturer: fan.fanType === 0 ? "Axial T0" : "Axial T1",
            model: fan.model,
            airflow_m3h: Number.isFinite(mid) && mid > 0 ? mid : undefined,
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
    if (!selectedFan?.axial || !(airFlow_m3h > 0)) return null;
    return evaluateFanCurve(selectedFan.axial, airFlow_m3h);
  }, [selectedFan, airFlow_m3h]);

  // ---- valores convertidos para a unidade exibida ----
  const totalCapW = result?.totalCapacityKw !== undefined ? result.totalCapacityKw * 1000 : undefined;
  const sensCapW = result?.sensibleCapacityKw !== undefined ? result.sensibleCapacityKw * 1000 : undefined;
  const latCapW = result?.latentCapacityKw !== undefined ? result.latentCapacityKw * 1000 : undefined;

  const obtCapTotal = useMemo(
    () => (totalCapW === undefined ? "---" : capacityConv.fromCanonical(totalCapW, uCapTotal).toFixed(uCapTotal === "TR" || uCapTotal === "kW" ? 3 : 1)),
    [totalCapW, uCapTotal],
  );
  const obtCapSens = useMemo(
    () => (sensCapW === undefined ? "---" : capacityConv.fromCanonical(sensCapW, uCapSens).toFixed(uCapSens === "TR" || uCapSens === "kW" ? 3 : 1)),
    [sensCapW, uCapSens],
  );
  const obtCapLat = useMemo(
    () => (latCapW === undefined ? "---" : capacityConv.fromCanonical(latCapW, uCapLat).toFixed(uCapLat === "TR" || uCapLat === "kW" ? 3 : 1)),
    [latCapW, uCapLat],
  );
  const obtAirFlow =
    airFlow_m3h > 0 ? airFlowConv.fromCanonical(airFlow_m3h, uAirFlow).toFixed(1) : "---";
  const obtVel =
    result?.faceVelocityMs !== undefined
      ? velocityConv.fromCanonical(result.faceVelocityMs, uVel).toFixed(2)
      : "---";
  const obtTempIn = tempConv.fromCanonical(tempInDB_C, uTempIn).toFixed(1);
  const obtTempOut =
    result?.airOutletTempC !== undefined
      ? tempConv.fromCanonical(result.airOutletTempC, uTempOut).toFixed(1)
      : "---";
  const obtPdrop =
    result?.airPressureDropPa !== undefined
      ? pressureConv.fromCanonical(result.airPressureDropPa, uPdrop).toFixed(uPdrop === "Pa" ? 0 : 3)
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
          unitNode={<UnitSelect value={uCapTotal} onChange={setUCapTotal} options={CAPACITY_UNITS} />}
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
          unitNode={<UnitText text="—" />}
          input={
            <select
              value={selectedFanId ?? ""}
              onChange={(e) => handleFanChange(e.target.value)}
              disabled={fans.length === 0}
              className="w-full rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] text-slate-900 focus:border-[#1E6FD9] focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
              title={
                fans.length === 0
                  ? "Catálogo de ventiladores não disponível — preencha a vazão manualmente abaixo"
                  : "Selecione um ventilador"
              }
            >
              <option value="">
                {fans.length === 0 ? "— sem catálogo —" : "Selecione…"}
              </option>
              {fans.map((f) => (
                <option key={f.id} value={f.id}>
                  {[f.manufacturer, f.model].filter(Boolean).join(" ") || f.id} —{" "}
                  {f.airflow_m3h} m³/h
                </option>
              ))}
            </select>
          }
          obtained="---"
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
          unitNode={<UnitText text="Pa" />}
          input={<DisabledInput />}
          obtained={
            fanStaticPressurePa === null || fanStaticPressurePa === undefined
              ? "---"
              : fanStaticPressurePa.toFixed(0)
          }
        />

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
          label="Fator de Erro"
          unitNode={<UnitText text="(m²·K)/W" />}
          input={
            <NumberCell
              value={foulingFactorAir}
              onChange={setFoulingFactorAir}
              min={0}
              step={0.0001}
            />
          }
          obtained="---"
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
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <input
      type="number"
      value={Number.isFinite(value) ? value : 0}
      min={min}
      max={max}
      step={step ?? "any"}
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
