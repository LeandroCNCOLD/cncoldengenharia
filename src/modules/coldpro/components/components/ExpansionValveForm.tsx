import { useState } from "react";
import { TechnicalField } from "../ui/TechnicalField";
import { useComponentStore } from "../../stores/useComponentStore";
import type { ExpansionValveSpec } from "@/modules/coldpro_v2";

interface Props {
  onSaved: () => void;
}

const num = (v: string): number | undefined => {
  if (v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

export function ExpansionValveForm({ onSaved }: Props) {
  const addExpansionValve = useComponentStore((s) => s.addExpansionValve);
  const [name, setName] = useState("");
  const [cap, setCap] = useState<number | undefined>();

  const canSave = name.trim().length > 0 && cap !== undefined && cap > 0;

  const handleSave = () => {
    if (!canSave) return;
    const spec: ExpansionValveSpec = { nominal_capacity_w: cap! };
    addExpansionValve(name.trim(), spec);
    onSaved();
  };

  return (
    <div className="space-y-5">
      <TechnicalField
        label="Nome / modelo"
        value={name}
        onChange={(v) => setName(v)}
        type="text"
        placeholder="Ex: TXV 5kW"
        required
      />
      <TechnicalField
        label="Capacidade nominal"
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
        Salvar Válvula de Expansão
      </button>
    </div>
  );
}
