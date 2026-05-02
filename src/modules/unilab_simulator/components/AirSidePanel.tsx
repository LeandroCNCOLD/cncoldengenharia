import { useEffect, useState } from "react";
import { useUnilabSimulationStore } from "../store/useUnilabSimulationStore";
import {
  validateAirSideInputs,
  type PsychrometricValidationResult,
} from "../services/psychrometrics";
import type { UnilabSimulationResult } from "../types/unilab.types";

interface AirSidePanelProps {
  result?: UnilabSimulationResult;
}

function fmt(n: number | undefined, digits = 1): string {
  if (n === undefined || !Number.isFinite(n)) return "---";
  return n.toFixed(digits);
}

/**
 * AirSidePanel — replica o bloco "LADO VENTILAÇÃO" do Unilab Coils 9.0.
 *
 * Layout:
 *   Linha por linha: [Label] [Unidade] [Input editável]  | [Obt.]
 *   Inputs editáveis ficam à esquerda; coluna "Obt." (Obtido) à direita
 *   mostra resultados read-only (--- por enquanto, calculados na Etapa 5).
 *
 * Regras Etapa 3 (intencionais):
 *   - Sem cálculo termodinâmico
 *   - Ventilador apenas preenche vazão (não simula curva)
 *   - Outputs read-only com "---"
 */

interface FanCatalogItem {
  id: string;
  manufacturer?: string;
  model?: string;
  airflow_m3h?: number;
}

const FANS_CATALOG_URL = "/data/catalogs/fans_clean.json";

export function AirSidePanel() {
  const airFlow_m3h = useUnilabSimulationStore((s) => s.airFlow_m3h);
  const tempInDB_C = useUnilabSimulationStore((s) => s.tempInDB_C);
  const rhIn_pct = useUnilabSimulationStore((s) => s.rhIn_pct);
  const foulingFactorAir = useUnilabSimulationStore((s) => s.foulingFactorAir);
  const selectedFanId = useUnilabSimulationStore((s) => s.selectedFanId);
  const setAirFlow = useUnilabSimulationStore((s) => s.setAirFlow);
  const setTempInDB = useUnilabSimulationStore((s) => s.setTempInDB);
  const setRhIn = useUnilabSimulationStore((s) => s.setRhIn);
  const setFoulingFactorAir = useUnilabSimulationStore((s) => s.setFoulingFactorAir);
  const setSelectedFan = useUnilabSimulationStore((s) => s.setSelectedFan);

  const [fans, setFans] = useState<FanCatalogItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(FANS_CATALOG_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        const list: FanCatalogItem[] = Array.isArray(data) ? data : [];
        setFans(list.filter((f) => typeof f?.airflow_m3h === "number" && f.airflow_m3h! > 0));
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

  const handleFanChange = (id: string) => {
    setSelectedFan(id || undefined);
    const fan = fans.find((f) => f.id === id);
    if (fan?.airflow_m3h && fan.airflow_m3h > 0) {
      setAirFlow(fan.airflow_m3h);
    }
  };

  return (
    <div className="rounded border border-slate-300 bg-slate-50 shadow-sm">
      {/* Header estilo UNILAB: título azul + coluna "Obt." */}
      <div className="grid grid-cols-[1fr_88px] border-b border-slate-300 bg-[#1E6FD9] text-white">
        <div className="px-3 py-1.5 text-center text-xs font-bold uppercase tracking-wider">
          Lado Ventilação
        </div>
        <div className="border-l border-white/30 px-2 py-1.5 text-center text-xs font-bold">
          Obt.
        </div>
      </div>

      <div className="space-y-1.5 p-2">
        {/* 1. CAPACIDADE — output (calculado depois) */}
        <Row
          label="Capacidade"
          unit="W"
          input={<DisabledInput />}
          obtained="---"
        />

        {/* 2. VENTILADOR — dropdown que preenche vazão */}
        <Row
          label="Ventilador"
          unit="m³/h"
          input={
            <select
              value={selectedFanId ?? ""}
              onChange={(e) => handleFanChange(e.target.value)}
              disabled={fans.length === 0}
              className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 focus:border-[#1E6FD9] focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
              title={
                fans.length === 0
                  ? "Catálogo de ventiladores não disponível"
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
          obtained={airFlow_m3h > 0 ? airFlow_m3h.toFixed(1) : "---"}
        />

        {/* 3. VELOCIDADE FRONTAL — calculada depois */}
        <Row
          label="Velocidade Frontal"
          unit="m/s"
          input={<DisabledInput />}
          obtained="---"
        />

        {/* 4. FAN WORKING @ % — info do ventilador */}
        <Row
          label="Fan working @"
          unit="%"
          input={<DisabledInput />}
          obtained="---"
        />

        {/* 5. TEMP. ENTRADA DB + UR ENTRADA (par) */}
        <Row
          label="Temperatura de Entrada DB"
          unit="°C"
          input={<NumberCell value={tempInDB_C} onChange={setTempInDB} />}
          obtained="---"
        />
        <Row
          label="Umidade Relativa de Entrada"
          unit="%"
          input={
            <NumberCell value={rhIn_pct} onChange={setRhIn} min={0} max={100} />
          }
          obtained="---"
        />

        {/* 6. TEMP. SAÍDA DB + UR SAÍDA (par — outputs) */}
        <Row
          label="Temperatura de Saída DB"
          unit="°C"
          input={<DisabledInput />}
          obtained="---"
        />
        <Row
          label="Umidade Relativa de Saída"
          unit="%"
          input={<DisabledInput />}
          obtained="---"
        />

        {/* 7. FATOR DE ERRO (FOULING) */}
        <Row
          label="Fator de Erro"
          unit="(m²·K)/W"
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

        {/* 8. QUEDA DE PRESSÃO — output */}
        <Row
          label="Queda de Pressão"
          unit="Pa"
          input={<DisabledInput />}
          obtained="---"
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
  unit,
  input,
  obtained,
}: {
  label: string;
  unit: string;
  input: React.ReactNode;
  obtained: string;
}) {
  const isEmpty = obtained === "---" || obtained === "";
  return (
    <div className="grid grid-cols-[160px_60px_1fr_88px] items-center gap-1.5">
      <label className="truncate text-[11px] font-medium text-slate-700" title={label}>
        {label}
      </label>
      <div className="rounded border border-slate-300 bg-white px-1.5 py-1 text-center text-[11px] text-slate-600">
        {unit}
      </div>
      <div>{input}</div>
      <div
        className={`rounded border border-emerald-300 bg-emerald-100 px-2 py-1 text-right font-mono text-[11px] ${
          isEmpty ? "text-emerald-700/60" : "text-emerald-900 font-semibold"
        }`}
      >
        {obtained}
      </div>
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
      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-right text-xs text-slate-900 focus:border-[#1E6FD9] focus:outline-none focus:ring-1 focus:ring-[#1E6FD9]"
    />
  );
}

function DisabledInput() {
  return (
    <input
      type="text"
      value=""
      disabled
      className="w-full cursor-not-allowed rounded border border-slate-200 bg-slate-100 px-2 py-1 text-xs"
    />
  );
}
