import { useId, useState, useEffect } from "react";

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
  const [localValue, setLocalValue] = useState<string>(
    value !== undefined && Number.isFinite(value) ? String(value) : ""
  );

  useEffect(() => {
    setLocalValue(value !== undefined && Number.isFinite(value) ? String(value) : "");
  }, [value]);

  return (
    <div className="min-w-0 space-y-0.5">
      <label
        htmlFor={id}
        className="flex items-center justify-between gap-1 text-[11px] font-medium text-slate-700"
      >
        <span className="truncate" title={label}>{label}</span>
        {unit && <span className="shrink-0 text-[10px] text-slate-400">{unit}</span>}
      </label>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        value={localValue}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "" || raw === "-" || raw === "." || raw === "-." || /^-?\d*\.?\d*$/.test(raw)) {
            setLocalValue(raw);
            const n = parseFloat(raw);
            if (Number.isFinite(n)) onChange(n);
            else if (raw === "") onChange(undefined);
          }
        }}
        onBlur={() => {
          const n = parseFloat(localValue);
          if (Number.isFinite(n)) {
            const clamped = min !== undefined ? Math.max(min, n) : n;
            const final = max !== undefined ? Math.min(max, clamped) : clamped;
            setLocalValue(String(final));
            onChange(final);
          } else {
            setLocalValue(value !== undefined && Number.isFinite(value) ? String(value) : "");
          }
        }}
        className="w-full min-w-0 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 shadow-sm focus:border-[#1E6FD9] focus:outline-none focus:ring-1 focus:ring-[#1E6FD9] disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
      />
    </div>
  );
}
