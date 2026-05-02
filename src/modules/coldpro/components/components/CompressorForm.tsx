import { useState } from "react";
import { TechnicalField } from "../ui/TechnicalField";
import { useComponentStore } from "../../stores/useComponentStore";
import type { CompressorSpec } from "@/modules/coldpro_v2";

interface CompressorFormProps {
  onSaved: () => void;
}

const REFRIGERANTS = [
  "R404A",
  "R134a",
  "R410A",
  "R22",
  "R407C",
  "R448A",
  "R449A",
  "R452A",
  "R507A",
];

const num = (v: string): number | undefined => {
  if (v === "" || v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

export function CompressorForm({ onSaved }: CompressorFormProps) {
  const addCompressor = useComponentStore((s) => s.addCompressor);
  const [name, setName] = useState("");
  const [refrigerant, setRefrigerant] = useState("R404A");
  const [coolingCapacity, setCoolingCapacity] = useState<number | undefined>();
  const [power, setPower] = useState<number | undefined>();
  const [evapTemp, setEvapTemp] = useState<number | undefined>(-8);
  const [condTemp, setCondTemp] = useState<number | undefined>(35);

  const canSave =
    name.trim().length > 0 &&
    coolingCapacity !== undefined &&
    coolingCapacity > 0 &&
    power !== undefined &&
    power > 0 &&
    evapTemp !== undefined &&
    condTemp !== undefined;

  const handleSave = () => {
    if (!canSave) return;
    const spec: CompressorSpec = {
      cooling_capacity_w: coolingCapacity!,
      power_w: power!,
      refrigerant,
      evap_temp_c: evapTemp!,
      cond_temp_c: condTemp!,
    };
    addCompressor(name.trim(), spec);
    onSaved();
  };

  return (
    <div className="space-y-5">
      <TechnicalField
        label="Nome / modelo"
        value={name}
        onChange={(v) => setName(v)}
        type="text"
        placeholder="Ex: Bitzer 4FES-3Y"
        required
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TechnicalField
          label="Capacidade frigorífica nominal"
          value={coolingCapacity ?? ""}
          onChange={(v) => setCoolingCapacity(num(v))}
          type="number"
          unit="W"
          required
          help={{
            description:
              "Capacidade frigorífica nominal do compressor nas condições de referência.",
            unit: "W",
            typicalRange: "500 – 500 000 W",
            example: "5000",
            impact: "Define o ponto de operação do equilíbrio do sistema.",
          }}
        />
        <TechnicalField
          label="Potência absorvida"
          value={power ?? ""}
          onChange={(v) => setPower(num(v))}
          type="number"
          unit="W"
          required
          help={{
            description:
              "Potência elétrica absorvida pelo compressor nas condições nominais.",
            unit: "W",
            typicalRange: "100 – 200 000 W",
            example: "1800",
            impact: "Usado para calcular o COP do sistema.",
          }}
        />
        <TechnicalField
          label="Temperatura de evaporação (catálogo)"
          value={evapTemp ?? ""}
          onChange={(v) => setEvapTemp(num(v))}
          type="number"
          unit="°C"
          required
          help={{
            description:
              "Temperatura de evaporação nas condições de catálogo do compressor.",
            unit: "°C",
            typicalRange: "-40 a +10 °C",
            example: "-8",
            impact: "Ponto de referência da curva do compressor.",
          }}
        />
        <TechnicalField
          label="Temperatura de condensação (catálogo)"
          value={condTemp ?? ""}
          onChange={(v) => setCondTemp(num(v))}
          type="number"
          unit="°C"
          required
          help={{
            description:
              "Temperatura de condensação nas condições de catálogo do compressor.",
            unit: "°C",
            typicalRange: "+20 a +65 °C",
            example: "35",
            impact: "Ponto de referência da curva do compressor.",
          }}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Refrigerante
        </label>
        <select
          value={refrigerant}
          onChange={(e) => setRefrigerant(e.target.value)}
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#1E6FD9] focus:outline-none focus:ring-2 focus:ring-blue-200"
        >
          {REFRIGERANTS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={!canSave}
        className="w-full rounded-md bg-[#1E6FD9] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1558b0] disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        Salvar Compressor
      </button>
    </div>
  );
}
