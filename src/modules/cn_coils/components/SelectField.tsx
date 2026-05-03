import { useId } from "react";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps {
  label: string;
  value: string | undefined;
  options: SelectOption[];
  onChange: (v: string | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function SelectField({
  label,
  value,
  options,
  onChange,
  placeholder = "Selecione…",
  disabled,
}: SelectFieldProps) {
  const id = useId();
  return (
    <div className="min-w-0 space-y-0.5">
      <label htmlFor={id} className="block truncate text-[11px] font-medium text-slate-700" title={label}>
        {label}
      </label>
      <select
        id={id}
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}
        className="w-full min-w-0 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 shadow-sm focus:border-[#1E6FD9] focus:outline-none focus:ring-1 focus:ring-[#1E6FD9] disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
