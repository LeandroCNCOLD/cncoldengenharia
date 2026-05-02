import { useState } from "react";
import { TechnicalField } from "../ui/TechnicalField";
import { useComponentStore } from "../../stores/useComponentStore";
import type { FourWayValveSpec } from "@/modules/coldpro_v2";

interface Props {
  onSaved: () => void;
}

const num = (v: string): number | undefined => {
  if (v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

export function FourWayValveForm({ onSaved }: Props) {
  const addFourWayValve = useComponentStore((s) => s.addFourWayValve);
  const [name, setName] = useState("");
  const [cap, setCap] = useState<number | undefined>();

  const canSave = name.trim().length > 0 && cap !== undefined && cap > 0;

  const handleSave = () => {
    if (!canSave) return;
    const spec: FourWayValveSpec = { max_capacity_w: cap! };
    addFourWayValve(name.trim(), spec);
    onSaved();
  };

  return (
    <div className="space-y-5">
      <TechnicalField
        label="Nome / modelo"
        value={name}
        onChange={(v) => setName(v)}
        type="text"
        placeholder="Ex: 4V-10kW"
        required
      />
      <TechnicalField
        label="Capacidade máxima"
        value={cap ?? ""}
        onChange={(v) => setCap(num(v))}
        type="number"
        unit="W"
        required
      />
      <button
        type="button"
        onClick={handleSave}
        disabled={!canSave}
        className="w-full rounded-md bg-[#1E6FD9] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1558b0] disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        Salvar Válvula 4 Vias
      </button>
    </div>
  );
}
