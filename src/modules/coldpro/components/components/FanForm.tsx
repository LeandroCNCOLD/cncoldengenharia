import { useState } from "react";
import { TechnicalField } from "../ui/TechnicalField";
import { useComponentStore } from "../../stores/useComponentStore";
import type { FanSpec } from "@/modules/coldpro_v2";

interface FanFormProps {
  onSaved: () => void;
}

type FanRole = "evaporator_fan" | "condenser_fan";

const num = (v: string): number | undefined => {
  if (v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

export function FanForm({ onSaved }: FanFormProps) {
  const addFan = useComponentStore((s) => s.addFan);
  const [name, setName] = useState("");
  const [role, setRole] = useState<FanRole>("evaporator_fan");
  const [mode, setMode] = useState<"blower" | "exhaust">("exhaust");
  const [airflow, setAirflow] = useState<number | undefined>();
  const [pressure, setPressure] = useState<number | undefined>(50);

  const canSave =
    name.trim().length > 0 &&
    airflow !== undefined &&
    airflow > 0 &&
    pressure !== undefined;

  const handleSave = () => {
    if (!canSave) return;
    const spec: FanSpec = {
      airflow_m3_h: airflow!,
      available_static_pressure_pa: pressure!,
      mode,
    };
    addFan(name.trim(), role, spec);
    onSaved();
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TechnicalField
          label="Nome / modelo"
          value={name}
          onChange={(v) => setName(v)}
          type="text"
          placeholder="Ex: Fan 4000m³/h"
          required
        />
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Posição
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as FanRole)}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="evaporator_fan">Ventilador de evaporador</option>
            <option value="condenser_fan">Ventilador de condensador</option>
          </select>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Tipo de operação
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode("blower")}
            className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition ${
              mode === "blower"
                ? "border-[#1E6FD9] bg-[#1E6FD9] text-white"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Soprador
          </button>
          <button
            type="button"
            onClick={() => setMode("exhaust")}
            className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition ${
              mode === "exhaust"
                ? "border-[#1E6FD9] bg-[#1E6FD9] text-white"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Exaustor
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TechnicalField
          label="Vazão de ar"
          value={airflow ?? ""}
          onChange={(v) => setAirflow(num(v))}
          type="number"
          unit="m³/h"
          required
        />
        <TechnicalField
          label="Pressão estática disponível"
          value={pressure ?? ""}
          onChange={(v) => setPressure(num(v))}
          type="number"
          unit="Pa"
          required
        />
      </div>
      <button
        type="button"
        onClick={handleSave}
        disabled={!canSave}
        className="w-full rounded-md bg-[#1E6FD9] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1558b0] disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        Salvar Ventilador
      </button>
    </div>
  );
}
