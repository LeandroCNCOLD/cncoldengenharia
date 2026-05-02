import { useState } from "react";
import { HelpCircle, AlertCircle, CheckCircle2, AlertTriangle } from "lucide-react";
import type { FieldValidation } from "../../types/frontend.types";

interface TechnicalFieldProps {
  label: string;
  value: string | number | undefined;
  onChange: (value: string) => void;
  type?: "text" | "number";
  unit?: string;
  placeholder?: string;
  validation?: FieldValidation;
  help?: {
    description: string;
    unit: string;
    typicalRange: string;
    example: string;
    impact: string;
  };
  disabled?: boolean;
  required?: boolean;
  step?: string;
}

export function TechnicalField({
  label,
  value,
  onChange,
  type = "text",
  unit,
  placeholder,
  validation,
  help,
  disabled,
  required,
  step,
}: TechnicalFieldProps) {
  const [showHelp, setShowHelp] = useState(false);

  const status = validation?.status ?? "idle";
  const borderClass =
    status === "error"
      ? "border-red-400 focus:border-red-500 focus:ring-red-200"
      : status === "warning"
        ? "border-amber-400 focus:border-amber-500 focus:ring-amber-200"
        : status === "valid"
          ? "border-emerald-300 focus:border-[#1E6FD9] focus:ring-blue-200"
          : "border-slate-300 focus:border-[#1E6FD9] focus:ring-blue-200";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-700">
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
          {unit && <span className="ml-1 text-xs text-slate-400">({unit})</span>}
        </label>
        {help && (
          <button
            type="button"
            onClick={() => setShowHelp((v) => !v)}
            className="text-slate-400 hover:text-[#1E6FD9]"
            aria-label="Ajuda do campo"
          >
            <HelpCircle className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="relative">
        <input
          type={type}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          step={step}
          className={`w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:ring-2 disabled:bg-slate-100 disabled:text-slate-500 ${borderClass}`}
        />
        {unit && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
            {unit}
          </span>
        )}
      </div>

      {validation?.message && (
        <div
          className={`flex items-center gap-1 text-xs ${
            status === "error"
              ? "text-red-600"
              : status === "warning"
                ? "text-amber-600"
                : "text-emerald-600"
          }`}
        >
          {status === "error" && <AlertCircle className="h-3 w-3" />}
          {status === "warning" && <AlertTriangle className="h-3 w-3" />}
          {status === "valid" && <CheckCircle2 className="h-3 w-3" />}
          <span>{validation.message}</span>
        </div>
      )}

      {showHelp && help && (
        <div className="mt-2 space-y-1 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
          <p>
            <span className="font-semibold">Descrição:</span> {help.description}
          </p>
          <p>
            <span className="font-semibold">Unidade:</span> {help.unit}
          </p>
          <p>
            <span className="font-semibold">Faixa típica:</span> {help.typicalRange}
          </p>
          <p>
            <span className="font-semibold">Exemplo:</span> {help.example}
          </p>
          <p>
            <span className="font-semibold">Impacto:</span> {help.impact}
          </p>
        </div>
      )}
    </div>
  );
}
