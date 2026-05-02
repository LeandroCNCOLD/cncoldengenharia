import { useState } from "react";
import { TechnicalField } from "../ui/TechnicalField";
import { useComponentStore } from "../../stores/useComponentStore";
import type { FrostFormationInput } from "@/modules/coldpro_v2";

interface Props {
  onSaved: () => void;
}

const num = (v: string): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function FrostConfigForm({ onSaved }: Props) {
  const addFrostConfig = useComponentStore((s) => s.addFrostConfig);
  const [name, setName] = useState("");
  const [airTemp, setAirTemp] = useState(2);
  const [airRh, setAirRh] = useState(0.9);
  const [airMass, setAirMass] = useState(1.5);
  const [surfaceTemp, setSurfaceTemp] = useState(-6);
  const [opTime, setOpTime] = useState(8);
  const [extArea, setExtArea] = useState(40);
  const [evapTemp, setEvapTemp] = useState<number | undefined>(-8);

  const canSave =
    name.trim().length > 0 &&
    airMass > 0 &&
    extArea > 0 &&
    opTime > 0;

  const handleSave = () => {
    if (!canSave) return;
    const spec: FrostFormationInput = {
      air_temperature_c: airTemp,
      air_relative_humidity: airRh,
      air_mass_flow_kg_s: airMass,
      coil_surface_temperature_c: surfaceTemp,
      operation_time_h: opTime,
      evaporator_external_area_m2: extArea,
      ...(evapTemp !== undefined ? { evaporating_temperature_c: evapTemp } : {}),
    };
    addFrostConfig(name.trim(), spec);
    onSaved();
  };

  return (
    <div className="space-y-5">
      <TechnicalField
        label="Nome"
        value={name}
        onChange={(v) => setName(v)}
        type="text"
        placeholder="Ex: Formação 8h câmara congelada"
        required
      />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <TechnicalField
          label="T ar"
          value={airTemp}
          onChange={(v) => setAirTemp(num(v))}
          type="number"
          unit="°C"
        />
        <TechnicalField
          label="UR ar"
          value={airRh}
          onChange={(v) => setAirRh(num(v))}
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
          label="T superfície serpentina"
          value={surfaceTemp}
          onChange={(v) => setSurfaceTemp(num(v))}
          type="number"
          unit="°C"
        />
        <TechnicalField
          label="Tempo de operação"
          value={opTime}
          onChange={(v) => setOpTime(num(v))}
          type="number"
          unit="h"
        />
        <TechnicalField
          label="Área externa do evaporador"
          value={extArea}
          onChange={(v) => setExtArea(num(v))}
          type="number"
          unit="m²"
        />
        <TechnicalField
          label="T evaporação (opcional)"
          value={evapTemp ?? ""}
          onChange={(v) => setEvapTemp(v === "" ? undefined : num(v))}
          type="number"
          unit="°C"
        />
      </div>
      <button
        type="button"
        onClick={handleSave}
        disabled={!canSave}
        className="w-full rounded-md bg-[#1E6FD9] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1558b0] disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        Salvar Configuração de Gelo
      </button>
    </div>
  );
}
