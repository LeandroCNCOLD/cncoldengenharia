import { useState } from "react";
import { TechnicalField } from "../ui/TechnicalField";
import { useComponentStore } from "../../stores/useComponentStore";
import type { FanSpec, FanFamily, FanDriveType } from "@/modules/coldpro_v2";

interface FanFormProps {
  onSaved: () => void;
}

type FanRole = "evaporator_fan" | "condenser_fan";

const num = (v: string): number | undefined => {
  if (v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

const FAMILY_OPTIONS: { value: FanFamily; label: string }[] = [
  { value: "axial", label: "Axial" },
  { value: "centrifugal_forward", label: "Centrífugo — pás para frente (Sirocco)" },
  { value: "centrifugal_backward", label: "Centrífugo — pás para trás (Backward)" },
  { value: "centrifugal_radial", label: "Centrífugo — pás radiais" },
  { value: "mixed_flow", label: "Fluxo misto (Mixed flow)" },
  { value: "tangential", label: "Tangencial / Cross-flow" },
  { value: "ec_plug", label: "Plug fan EC" },
];

export function FanForm({ onSaved }: FanFormProps) {
  const addFan = useComponentStore((s) => s.addFan);
  const [name, setName] = useState("");
  const [role, setRole] = useState<FanRole>("evaporator_fan");
  const [mode, setMode] = useState<"blower" | "exhaust">("exhaust");
  const [family, setFamily] = useState<FanFamily>("axial");
  const [drive, setDrive] = useState<FanDriveType>("direct");
  const [phases, setPhases] = useState<1 | 3>(3);

  const [airflow, setAirflow] = useState<number | undefined>();
  const [pressure, setPressure] = useState<number | undefined>(50);
  const [diameter, setDiameter] = useState<number | undefined>();
  const [rpm, setRpm] = useState<number | undefined>();
  const [bladeCount, setBladeCount] = useState<number | undefined>();
  const [motorPower, setMotorPower] = useState<number | undefined>();
  const [motorCurrent, setMotorCurrent] = useState<number | undefined>();
  const [voltage, setVoltage] = useState<number | undefined>(380);
  const [frequency, setFrequency] = useState<number | undefined>(60);
  const [sound, setSound] = useState<number | undefined>();
  const [weight, setWeight] = useState<number | undefined>();

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
      family,
      drive,
      phases,
      diameter_mm: diameter,
      rpm,
      blade_count: bladeCount,
      motor_power_w: motorPower,
      motor_current_a: motorCurrent,
      voltage_v: voltage,
      frequency_hz: frequency,
      sound_pressure_db: sound,
      weight_kg: weight,
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Família construtiva
          </label>
          <select
            value={family}
            onChange={(e) => setFamily(e.target.value as FanFamily)}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {FAMILY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Transmissão
          </label>
          <select
            value={drive}
            onChange={(e) => setDrive(e.target.value as FanDriveType)}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="direct">Direta (acoplamento direto)</option>
            <option value="belt">Por correia / polias</option>
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <TechnicalField
          label="Diâmetro do rotor"
          value={diameter ?? ""}
          onChange={(v) => setDiameter(num(v))}
          type="number"
          unit="mm"
        />
        <TechnicalField
          label="Rotação"
          value={rpm ?? ""}
          onChange={(v) => setRpm(num(v))}
          type="number"
          unit="rpm"
        />
        <TechnicalField
          label="Nº de pás"
          value={bladeCount ?? ""}
          onChange={(v) => setBladeCount(num(v))}
          type="number"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <TechnicalField
          label="Potência do motor"
          value={motorPower ?? ""}
          onChange={(v) => setMotorPower(num(v))}
          type="number"
          unit="W"
        />
        <TechnicalField
          label="Corrente nominal"
          value={motorCurrent ?? ""}
          onChange={(v) => setMotorCurrent(num(v))}
          type="number"
          unit="A"
        />
        <TechnicalField
          label="Tensão"
          value={voltage ?? ""}
          onChange={(v) => setVoltage(num(v))}
          type="number"
          unit="V"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Fases
          </label>
          <select
            value={phases}
            onChange={(e) => setPhases(Number(e.target.value) === 1 ? 1 : 3)}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value={1}>Monofásico</option>
            <option value={3}>Trifásico</option>
          </select>
        </div>
        <TechnicalField
          label="Frequência"
          value={frequency ?? ""}
          onChange={(v) => setFrequency(num(v))}
          type="number"
          unit="Hz"
        />
        <TechnicalField
          label="Ruído @ 1 m"
          value={sound ?? ""}
          onChange={(v) => setSound(num(v))}
          type="number"
          unit="dB(A)"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TechnicalField
          label="Peso"
          value={weight ?? ""}
          onChange={(v) => setWeight(num(v))}
          type="number"
          unit="kg"
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
