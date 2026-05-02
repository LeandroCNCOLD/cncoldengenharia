import { useState } from "react";
import { TechnicalField } from "../ui/TechnicalField";
import { useComponentStore } from "../../stores/useComponentStore";
import type { CondenserSpec } from "@/modules/coldpro_v2";
import { useTranslation } from "@/i18n/useTranslation";

interface CondenserFormProps {
  onSaved: () => void;
}

const num = (v: string): number | undefined => {
  if (v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

export function CondenserForm({ onSaved }: CondenserFormProps) {
  const { t } = useTranslation();
  const addCondenser = useComponentStore((s) => s.addCondenser);
  const [name, setName] = useState("");
  const [heat, setHeat] = useState<number | undefined>();
  const [maxCond, setMaxCond] = useState<number | undefined>(45);

  const canSave =
    name.trim().length > 0 &&
    heat !== undefined &&
    heat > 0 &&
    maxCond !== undefined;

  const handleSave = () => {
    if (!canSave) return;
    const spec: CondenserSpec = {
      heat_rejection_capacity_w: heat!,
      max_cond_temp_c: maxCond!,
    };
    addCondenser(name.trim(), spec);
    onSaved();
  };

  return (
    <div className="space-y-5">
      <TechnicalField
        label="Nome / modelo"
        value={name}
        onChange={(v) => setName(v)}
        type="text"
        placeholder={t("components.placeholders.condenser")}
        required
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TechnicalField
          label="Capacidade de rejeição de calor"
          value={heat ?? ""}
          onChange={(v) => setHeat(num(v))}
          type="number"
          unit="W"
          required
          help={{
            description:
              "Capacidade de rejeição de calor do condensador nas condições nominais.",
            unit: "W",
            typicalRange: "1 000 – 1 000 000 W",
            example: "7500",
            impact: "Limita a capacidade do ciclo no lado do condensador.",
          }}
        />
        <TechnicalField
          label="Temperatura máxima de condensação"
          value={maxCond ?? ""}
          onChange={(v) => setMaxCond(num(v))}
          type="number"
          unit="°C"
          required
          help={{
            description:
              "Temperatura máxima de condensação permitida para este condensador.",
            unit: "°C",
            typicalRange: "+30 a +70 °C",
            example: "45",
            impact: "Define o limite superior do envelope operacional.",
          }}
        />
      </div>
      <button
        type="button"
        onClick={handleSave}
        disabled={!canSave}
        className="w-full rounded-md bg-[#1E6FD9] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1558b0] disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        Salvar Condensador
      </button>
    </div>
  );
}
