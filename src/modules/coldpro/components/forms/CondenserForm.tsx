import { TechnicalField } from "../ui/TechnicalField";
import { validateCapacityW, validateCondTemp } from "../../utils/validation";
import type { CondenserSpec } from "@/modules/coldpro_v2";

interface CondenserFormProps {
  value: Partial<CondenserSpec>;
  onChange: (value: Partial<CondenserSpec>) => void;
}

export function CondenserForm({ value, onChange }: CondenserFormProps) {
  const set = (field: keyof CondenserSpec, raw: string) => {
    const n = parseFloat(raw);
    onChange({ ...value, [field]: isNaN(n) ? undefined : n });
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-slate-900">Condensador</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TechnicalField
          label="Capacidade de rejeição"
          value={value.heat_rejection_capacity_w}
          onChange={(v) => set("heat_rejection_capacity_w", v)}
          type="number"
          unit="W"
          required
          validation={validateCapacityW(value.heat_rejection_capacity_w)}
          help={{
            description: "Capacidade máxima de rejeição de calor do condensador.",
            unit: "Watts [W]",
            typicalRange: "5.000 W a 150.000 W",
            example: "8000",
            impact: "Deve ser maior que q_cond_required para o ponto não ser rejeitado.",
          }}
        />
        <TechnicalField
          label="T cond máxima"
          value={value.max_cond_temp_c}
          onChange={(v) => set("max_cond_temp_c", v)}
          type="number"
          unit="°C"
          required
          validation={validateCondTemp(value.max_cond_temp_c)}
          help={{
            description: "Temperatura máxima de condensação suportada.",
            unit: "Graus Celsius [°C]",
            typicalRange: "45°C a 65°C",
            example: "55",
            impact: "Limita a operação em ambientes quentes.",
          }}
        />
      </div>
    </section>
  );
}
