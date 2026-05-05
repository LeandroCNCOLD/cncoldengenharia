import { useState, useEffect } from "react";
import type React from "react";

/**
 * Hook para inputs numéricos com UX fluida:
 * - Seleciona tudo ao focar (onFocus)
 * - Aceita digitação intermediária ("-", "1.", "-0.")
 * - Converte para número só no onBlur
 * - Sincroniza quando o valor externo muda (reset, cálculo)
 */
export function useNumericInput(
  externalValue: number | undefined | null,
  onCommit: (v: number | undefined) => void,
  options?: { min?: number; max?: number }
) {
  const toStr = (v: number | undefined | null) =>
    v !== undefined && v !== null && Number.isFinite(v) ? String(v) : "";

  const [local, setLocal] = useState<string>(() => toStr(externalValue));

  useEffect(() => {
    setLocal(toStr(externalValue));
  }, [externalValue]);

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (
      raw === "" ||
      raw === "-" ||
      raw === "." ||
      raw === "-." ||
      /^-?\d*\.?\d*$/.test(raw)
    ) {
      setLocal(raw);
      const n = parseFloat(raw);
      if (Number.isFinite(n)) onCommit(n);
      else if (raw === "") onCommit(undefined);
    }
  };

  const handleBlur = () => {
    const n = parseFloat(local);
    if (Number.isFinite(n)) {
      let final = n;
      if (options?.min !== undefined) final = Math.max(options.min, final);
      if (options?.max !== undefined) final = Math.min(options.max, final);
      setLocal(String(final));
      onCommit(final);
    } else {
      setLocal(toStr(externalValue));
    }
  };

  return { value: local, onFocus: handleFocus, onChange: handleChange, onBlur: handleBlur };
}
