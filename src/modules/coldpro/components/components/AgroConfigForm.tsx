import { useState } from "react";
import { TechnicalField } from "../ui/TechnicalField";
import { useComponentStore } from "../../stores/useComponentStore";
import type { AgroCycleInput } from "@/modules/coldpro_v2";

interface Props {
  onSaved: () => void;
}

const num = (v: string): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function AgroConfigForm({ onSaved }: Props) {
  const addAgroConfig = useComponentStore((s) => s.addAgroConfig);
  const [name, setName] = useState("");
  const [tRoom, setTRoom] = useState(12);
  const [rhRoom, setRhRoom] = useState(0.85);
  const [tSetpoint, setTSetpoint] = useState(8);
  const [rhSetpoint, setRhSetpoint] = useState(0.7);
  const [airMass, setAirMass] = useState(1.5);

  const canSave = name.trim().length > 0 && airMass > 0;

  const handleSave = () => {
    if (!canSave) return;
    const spec: AgroCycleInput = {
      T_room_c: tRoom,
      RH_room: rhRoom,
      T_setpoint_c: tSetpoint,
      RH_setpoint: rhSetpoint,
      air_mass_flow_kg_s: airMass,
    };
    addAgroConfig(name.trim(), spec);
    onSaved();
  };

  return (
    <div className="space-y-5">
      <TechnicalField
        label="Nome"
        value={name}
        onChange={(v) => setName(v)}
        type="text"
        placeholder="Ex: Câmara verdes 8°C / 70% UR"
        required
      />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <TechnicalField
          label="T câmara"
          value={tRoom}
          onChange={(v) => setTRoom(num(v))}
          type="number"
          unit="°C"
        />
        <TechnicalField
          label="UR câmara"
          value={rhRoom}
          onChange={(v) => setRhRoom(num(v))}
          type="number"
          unit="0–1"
        />
        <TechnicalField
          label="Vazão mássica de ar"
          value={airMass}
          onChange={(v) => setAirMass(num(v))}
          type="number"
          unit="kg/s"
        />
        <TechnicalField
          label="T setpoint"
          value={tSetpoint}
          onChange={(v) => setTSetpoint(num(v))}
          type="number"
          unit="°C"
        />
        <TechnicalField
          label="UR setpoint"
          value={rhSetpoint}
          onChange={(v) => setRhSetpoint(num(v))}
          type="number"
          unit="0–1"
        />
      </div>
      <button
        type="button"
        onClick={handleSave}
        disabled={!canSave}
        className="w-full rounded-md bg-[#1E6FD9] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1558b0] disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        Salvar Configuração AGRO
      </button>
    </div>
  );
}
