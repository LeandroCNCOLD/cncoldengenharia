// Dropdown compacto de unidade (estilo UNILAB). Renderizado na coluna "unidade"
// das linhas dos painéis de Ventilação / Fluido.
import type { UnitOption } from "../utils/unitConversions";

interface UnitSelectProps<U extends string> {
  value: U;
  onChange: (next: U) => void;
  options: UnitOption<U>[];
  disabled?: boolean;
  title?: string;
}

export function UnitSelect<U extends string>({
  value,
  onChange,
  options,
  disabled,
  title,
}: UnitSelectProps<U>) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as U)}
      disabled={disabled}
      title={title}
      className="w-full cursor-pointer rounded border border-slate-300 bg-white px-1 py-1 text-center text-[11px] text-slate-700 focus:border-[#1E6FD9] focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
    >
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
