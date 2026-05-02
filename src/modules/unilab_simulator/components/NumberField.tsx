import { useId } from "react";

interface NumberFieldProps {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  unit?: string;
  step?: number;
  min?: number;
  max?: number;
  placeholder?: string;
  disabled?: boolean;
}

export function NumberField({
  label,
  value,
  onChange,
  unit,
  step,
  min,
  max,
  placeholder,
  disabled,
}: NumberFieldProps) {
  const id = useId();
  return (
    <div className="space-y-1">
      <label
        htmlFor={id}
        className="flex items-center justify-between text-xs font-medium text-slate-700"
      >
        <span>{label}</span>
        {unit && <span className="text-[10px] text-slate-400">{unit}</span>}
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        step={step ?? "any"}
        min={min}
        max={max}
        value={value === undefined || Number.isNaN(value) ? "" : value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") {
            onChange(undefined);
            return;
          }
          const n = Number(raw);
          onChange(Number.isFinite(n) ? n : undefined);
        }}
        className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 shadow-sm focus:border-[#1E6FD9] focus:outline-none focus:ring-1 focus:ring-[#1E6FD9] disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
      />
    </div>
  );
}
