import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useCnCoilsSimulationStore } from "../store/useCnCoilsSimulationStore";
import {
  getAxialFans,
  getCentrifugalFans,
} from "../services/unilabCoefficientsService";
import type {
  AxialFanCoefficient,
  CentrifugalFanCoefficient,
} from "../types/unilabCoefficients.types";
import { NumberField } from "./NumberField";

type FanOption =
  | {
      type: "axial";
      fan: AxialFanCoefficient;
    }
  | {
      type: "centrifugal";
      fan: CentrifugalFanCoefficient;
    };

interface AirSidePanelProps {
  disabled?: boolean;
  result?: unknown;
}

function fmt(value: number | undefined, digits = 2): string {
  if (value === undefined || !Number.isFinite(value)) return "—";
  return value.toFixed(digits);
}

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

function fanPower(option: FanOption): number | undefined {
  return option.type === "axial" ? option.fan.power_W : undefined;
}

function fanCurrent(option: FanOption): number | undefined {
  return option.type === "axial" ? option.fan.current_A : undefined;
}

function fanRpm(option: FanOption): number | undefined {
  if (option.type === "axial") return option.fan.rpm;
  const { min, max } = option.fan.rpmRange;
  return min > 0 || max > 0 ? (min + max) / 2 : undefined;
}

export function AirSidePanel({ disabled }: AirSidePanelProps) {
  const thermo = useCnCoilsSimulationStore((s) => s.thermoInputs);
  const setThermo = useCnCoilsSimulationStore((s) => s.setThermoInputs);
  const [fans, setFans] = useState<FanOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([getAxialFans(), getCentrifugalFans()])
      .then(([axial, centrifugal]) => {
        if (cancelled) return;
        setFans([
          ...axial.map((fan) => ({ type: "axial" as const, fan })),
          ...centrifugal.map((fan) => ({ type: "centrifugal" as const, fan })),
        ]);
        setWarning(null);
      })
      .catch(() => {
        if (!cancelled) {
          setWarning("Não foi possível carregar a biblioteca de ventiladores CN COILS.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const selected = useMemo(
    () => fans.find((option) => option.fan.id === thermo.selectedFanId),
    [fans, thermo.selectedFanId],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return fans.slice(0, 200);
    return fans
      .filter((option) => {
        const text = `${option.fan.id} ${option.fan.model} ${option.type}`.toLowerCase();
        return text.includes(q);
      })
      .slice(0, 200);
  }, [fans, query]);

  const handleSelect = (fanId: string | undefined) => {
    const option = fanId ? fans.find((item) => item.fan.id === fanId) : undefined;
    if (!option) {
      setThermo({ selectedFanId: undefined });
      return;
    }
    setThermo({
      selectedFanId: option.fan.id,
      airFlowM3H: nominalAirflow(option),
    });
  };

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <div>
        <h4 className="text-sm font-semibold text-slate-900">Ventilador</h4>
        <p className="mt-0.5 text-xs text-slate-500">
          Selecione um ventilador real da biblioteca CN COILS ou informe a vazão manualmente.
        </p>
      </div>

      {warning && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
          {warning}
        </div>
      )}

      <div className="space-y-1">
        <label className="text-xs font-medium text-slate-700">Buscar ventilador</label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            disabled={disabled || loading}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Modelo, ID ou tipo…"
            className="w-full rounded-md border border-slate-300 bg-white py-1.5 pl-8 pr-2.5 text-sm text-slate-900 shadow-sm focus:border-[#1E6FD9] focus:outline-none focus:ring-1 focus:ring-[#1E6FD9] disabled:cursor-not-allowed disabled:bg-slate-50"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-slate-700">Biblioteca de ventiladores</label>
        <select
          value={thermo.selectedFanId ?? ""}
          disabled={disabled || loading}
          onChange={(event) => handleSelect(event.target.value || undefined)}
          className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 shadow-sm focus:border-[#1E6FD9] focus:outline-none focus:ring-1 focus:ring-[#1E6FD9] disabled:cursor-not-allowed disabled:bg-slate-50"
        >
          <option value="">Nenhum ventilador selecionado</option>
          {filtered.map((option) => {
            const range = airflowRange(option);
            return (
              <option key={option.fan.id} value={option.fan.id}>
                {option.fan.model} · {option.type === "axial" ? "axial" : "centrífugo"} ·{" "}
                {fmt(range.min, 0)}–{fmt(range.max, 0)} m³/h
              </option>
            );
          })}
        </select>
        {fans.length > 200 && (
          <p className="text-[11px] text-slate-500">
            Exibindo até 200 ventiladores. Use a busca para refinar a lista.
          </p>
        )}
      </div>

      <NumberField
        label="Vazão de ar"
        unit="m³/h"
        value={thermo.airFlowM3H}
        onChange={(value) => setThermo({ airFlowM3H: value })}
        disabled={disabled}
      />

      {selected ? (
        <dl className="grid grid-cols-1 gap-2 rounded-md border border-slate-100 bg-slate-50 p-3 text-xs sm:grid-cols-2">
          <Info label="Modelo" value={selected.fan.model} />
          <Info label="Tipo" value={selected.type === "axial" ? "axial" : "centrífugo"} />
          <Info
            label="Vazão mínima"
            value={`${fmt(airflowRange(selected).min, 0)} m³/h`}
          />
          <Info
            label="Vazão máxima"
            value={`${fmt(airflowRange(selected).max, 0)} m³/h`}
          />
          <Info label="Potência" value={`${fmt(fanPower(selected), 0)} W`} />
          <Info label="Corrente" value={`${fmt(fanCurrent(selected), 2)} A`} />
          <Info label="Rotação" value={`${fmt(fanRpm(selected), 0)} rpm`} />
        </dl>
      ) : (
        <p className="text-xs text-slate-500">
          Nenhum ventilador selecionado. A vazão informada será usada manualmente.
        </p>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-900">{value}</dd>
    </div>
  );
}
