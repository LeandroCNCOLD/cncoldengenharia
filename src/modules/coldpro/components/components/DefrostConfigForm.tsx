import { useState } from "react";
import { TechnicalField } from "../ui/TechnicalField";
import { useComponentStore } from "../../stores/useComponentStore";
import type {
  DefrostCycleInput,
  DefrostMethod,
} from "@/modules/coldpro_v2";

interface Props {
  onSaved: () => void;
}

const METHODS: { value: DefrostMethod; label: string }[] = [
  { value: "hot_gas_reversal", label: "Reversão por gás quente" },
  { value: "hot_gas_bypass", label: "Bypass de gás quente" },
  { value: "electric", label: "Elétrico" },
];

const num = (v: string): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function DefrostConfigForm({ onSaved }: Props) {
  const addDefrostConfig = useComponentStore((s) => s.addDefrostConfig);
  const [name, setName] = useState("");
  const [method, setMethod] = useState<DefrostMethod>("hot_gas_reversal");
  const [frostMass, setFrostMass] = useState(2);
  const [frostTemp, setFrostTemp] = useState(-5);
  const [compressorCap, setCompressorCap] = useState(5000);
  const [tCond, setTCond] = useState(35);
  const [tEvap, setTEvap] = useState(-8);
  const [refrigerant, setRefrigerant] = useState("R404A");

  const canSave =
    name.trim().length > 0 && frostMass > 0 && compressorCap > 0;

  const handleSave = () => {
    if (!canSave) return;
    const spec: DefrostCycleInput = {
      method,
      frost_mass_kg: frostMass,
      frost_temperature_c: frostTemp,
      compressor_capacity_w: compressorCap,
      T_condensing_c: tCond,
      T_evaporating_c: tEvap,
      refrigerant,
    };
    addDefrostConfig(name.trim(), spec);
    onSaved();
  };

  return (
    <div className="space-y-5">
      <TechnicalField
        label="Nome"
        value={name}
        onChange={(v) => setName(v)}
        type="text"
        placeholder="Ex: Degelo gás quente padrão"
        required
      />
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Método de degelo
        </label>
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value as DefrostMethod)}
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          {METHODS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <TechnicalField
          label="Massa de gelo"
          value={frostMass}
          onChange={(v) => setFrostMass(num(v))}
          type="number"
          unit="kg"
        />
        <TechnicalField
          label="T gelo"
          value={frostTemp}
          onChange={(v) => setFrostTemp(num(v))}
          type="number"
          unit="°C"
        />
        <TechnicalField
          label="Capacidade do compressor"
          value={compressorCap}
          onChange={(v) => setCompressorCap(num(v))}
          type="number"
          unit="W"
        />
        <TechnicalField
          label="T condensação"
          value={tCond}
          onChange={(v) => setTCond(num(v))}
          type="number"
          unit="°C"
        />
        <TechnicalField
          label="T evaporação"
          value={tEvap}
          onChange={(v) => setTEvap(num(v))}
          type="number"
          unit="°C"
        />
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Refrigerante
          </label>
          <input
            type="text"
            value={refrigerant}
            onChange={(e) => setRefrigerant(e.target.value)}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </div>
      </div>
      <button
        type="button"
        onClick={handleSave}
        disabled={!canSave}
        className="w-full rounded-md bg-[#1E6FD9] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1558b0] disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        Salvar Configuração de Degelo
      </button>
    </div>
  );
}
